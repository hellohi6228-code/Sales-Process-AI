import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import * as mammoth from 'mammoth';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');

const MODELS_TO_TRY = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3.5-flash'];

async function generateWithFallback(ai: GoogleGenAI, params: any): Promise<any> {
  let lastError: any;
  for (const model of MODELS_TO_TRY) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({ ...params, model });
        return response;
      } catch (e: any) {
        lastError = e;
        const isQuota = e.status === 429 || e.message?.includes('429') || e.message?.includes('RESOURCE_EXHAUSTED') || e.message?.includes('quota');
        const isUnavailable = e.status === 503 || e.message?.includes('503') || e.message?.includes('UNAVAILABLE') || e.message?.includes('high demand');
        const isNotFound = e.status === 404 || e.message?.includes('NOT_FOUND') || e.message?.includes('not found');

        if (isNotFound) {
          console.log(`[API] ${model} not found, skipping...`);
          break;
        }
        if ((isQuota || isUnavailable) && attempt < 2) {
          console.log(`[API] ${model} rate limited, waiting before retry...`);
          await new Promise(r => setTimeout(r, 4000));
        } else if (isQuota || isUnavailable) {
          console.log(`[API] ${model} still rate limited, trying next model...`);
          break;
        } else {
          throw e;
        }
      }
    }
  }
  throw lastError;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 1. Session Authentication check
  if (supabaseUrl && supabaseAnonKey) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized user session' });
    }
  }

  try {
    const { context, imageBase64, filesBase64 } = req.body;

    // 2. Input Validation
    if (context && (typeof context !== 'string' || context.length > 25000)) {
      return res.status(400).json({ error: 'Invalid or excessive context text payload' });
    }
    if (filesBase64 && (!Array.isArray(filesBase64) || filesBase64.length > 10)) {
      return res.status(400).json({ error: 'Invalid files array payload' });
    }

    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    const imagesToCheck = filesBase64 || (imageBase64 ? [imageBase64] : []);
    for (const imgBase64 of imagesToCheck) {
      if (typeof imgBase64 !== 'string') {
        return res.status(400).json({ error: 'Invalid file payload type' });
      }
      const sizeBytes = Buffer.byteLength(imgBase64, 'base64');
      if (sizeBytes > MAX_FILE_SIZE) {
        return res.status(400).json({ error: 'File size exceeds 5MB limit' });
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        companyName: 'New Lead',
        cards: [
          { title: 'Company Profile', text: 'Add a GEMINI_API_KEY environment variable in Vercel to generate AI-powered lead cards.' },
          { title: 'Needs & Pain Points', text: 'Context provided: ' + (context?.substring(0, 100) || 'None') },
          { title: 'Engagement History', text: 'Upload documents or enter context to get started.' },
        ],
      });
    }

    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        companyName: { type: Type.STRING, description: 'The name of the company or lead extracted from the context or image.' },
        cards: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              text: { type: Type.STRING },
            },
            required: ['title', 'text'],
          },
        },
      },
      required: ['companyName', 'cards'],
    };

    const systemInstruction = `You are a sales operations and customer intelligence analyst specializing in reviewing B2B leads and summarizing key information for sales teams.\nUsing user input, CRM records, company information, engagement history, website content, market research, supporting documents, emails, meeting notes, and any other available context, analyze the lead and produce exactly three cards using these titles:\nCompany Profile\nNeeds & Pain Points\nEngagement History\nFor each card:\nUse the title exactly as provided.\nWrite ONE concise sentence.`;

    const parts: any[] = [];
    if (context) parts.push({ text: `Context: ${context}` });

    const allImages = filesBase64 || (imageBase64 ? [imageBase64] : []);
    for (const imgBase64 of allImages) {
      const match = imgBase64.match(/^data:([^;]+);base64,/);
      const mimeType = match ? match[1] : 'image/jpeg';
      const base64Data = imgBase64.replace(/^data:[^;]+;base64,/, '');

      if (mimeType.includes('wordprocessing') || mimeType.includes('msword')) {
        try {
          const result = await mammoth.extractRawText({ buffer: Buffer.from(base64Data, 'base64') });
          parts.push({ text: `Attached Document Content:\n${result.value}` });
        } catch (e) {
          console.error('Mammoth error', e);
        }
      } else {
        parts.push({ inlineData: { mimeType, data: base64Data } });
      }
    }

    if (parts.length === 0) parts.push({ text: 'Please generate a generic example lead.' });

    const response = await generateWithFallback(ai, {
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.2,
      },
    });

    if (!response || !response.text) throw new Error('No text generated');
    const result = JSON.parse(response.text);
    return res.json(result);
  } catch (e: any) {
    console.error('[generate-lead-cards error]', e);
    return res.status(500).json({ error: 'An unexpected internal server error occurred.' });
  }
}
