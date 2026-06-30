import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type, Schema } from '@google/genai';

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

  try {
    const { context } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        cards: [
          { title: 'Welcome Teammate', text: 'Enable a GEMINI_API_KEY environment variable in Vercel to generate teammate onboarding cards.' },
          { title: 'Project Overview', text: 'Get started on the shared Drive folder and explore workspace docs.' },
          { title: 'Key Objectives', text: 'Understand core goals and deliverables for this project.' },
          { title: 'Collaboration Guidelines', text: 'Check communication channels and process folders.' },
          { title: 'Action Plan', text: 'Begin reviewing current tasks and active client proposal files.' }
        ]
      });
    }

    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });

    // Step 1: Chunking the context
    const textToChunk = context || '';
    const chunks: string[] = [];
    let currentChunk = '';
    const lines = textToChunk.split('\n');
    for (const line of lines) {
      if ((currentChunk + '\n' + line).length > 8000) {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }
    if (currentChunk) chunks.push(currentChunk);

    if (chunks.length === 0) {
      chunks.push('No project context provided. Generate a generic greeting and instructions.');
    }

    // Step 2: Summarize each chunk separately
    const summaries: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const summaryRes = await generateWithFallback(ai, {
          contents: [{ text: `You are a technical project lead. Identify and summarize the key project requirements, stakeholders, tech stacks, milestones, and constraints from this specific context chunk. Provide a detailed bulleted summary:\n\n${chunk}` }]
        });
        if (summaryRes && summaryRes.text) {
          summaries.push(summaryRes.text);
        }
      } catch (err) {
        console.error('Failed summarizing chunk', i, err);
      }
    }

    const combinedSummaries = summaries.join('\n\n') || 'No document content available.';

    // Step 3: Combine and generate 5 onboarding cards
    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        cards: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              text: { type: Type.STRING }
            },
            required: ['title', 'text']
          }
        }
      },
      required: ['cards']
    };

    const prompt = `
You are a technical project lead who works with a large number of individual contributors in a highly flexible work format. Summarize ALL context within a project folder and produce five cards containing the most important key information for onboarding a new teammate very IMMEDIATELY.

Create the most relevant titles based on the available information.
Use short, descriptive titles for each card.
Write one concise sentence per card.

Here is the summarized and chunked project context:
${combinedSummaries}
`;

    const finalResponse = await generateWithFallback(ai, {
      contents: [{ text: prompt }],
      config: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.2,
      }
    });

    if (!finalResponse || !finalResponse.text) {
      throw new Error('Onboarding generation returned empty text');
    }

    const result = JSON.parse(finalResponse.text);
    return res.json(result);
  } catch (e: any) {
    console.error('[generate-onboarding error]', e);
    return res.status(500).json({ error: e.message });
  }
}
