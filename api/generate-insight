import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import * as mammoth from 'mammoth';

const MODELS_TO_TRY = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];

async function generateWithFallback(ai: GoogleGenAI, params: any): Promise<any> {
  let lastError: any;
  for (const model of MODELS_TO_TRY) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({ ...params, model });
        return response;
      } catch (e: any) {
        lastError = e;
        const isRetryable =
          e.status === 503 || e.status === 429 ||
          e.message?.includes('503') || e.message?.includes('429') ||
          e.message?.includes('high demand') || e.message?.includes('UNAVAILABLE') ||
          e.message?.includes('RESOURCE_EXHAUSTED') || e.message?.includes('quota');
        if (isRetryable && attempt < 2) {
          console.log(`[API] Retrying with ${model}, attempt ${attempt + 1}...`);
          await new Promise(r => setTimeout(r, 3000 * attempt));
        } else if (isRetryable) {
          console.log(`[API] ${model} quota hit, trying next model...`);
          break; // try next model
        } else {
          throw e; // non-retryable error
        }
      }
    }
  }
  throw lastError;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { processName, context, folderType, imageBase64, filesBase64 } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        cards: [{
          title: `Insight for ${processName || folderType}`,
          text: `Analysis based on context: "${context?.substring(0, 80) || 'No context provided'}". Add a GEMINI_API_KEY env variable to enable AI insights.`,
          score: 80,
        }]
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        cards: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              text: { type: Type.STRING },
              score: { type: Type.NUMBER },
            },
            required: ['title', 'text'],
          },
        },
      },
      required: ['cards'],
    };

    let systemInstruction = `You are a strategic AI assistant helping a consultant analyze ${processName || folderType} data.`;
    let textContent = `Process Category: ${folderType}\nProcess/Lead Name: ${processName}\nUser Context/Prompt: ${context}\n\nAnalyze the context and generate insight cards as requested.`;

    if (folderType === 'Positioning') {
      systemInstruction = `You are a strategic marketing and positioning advisor specializing in helping individual contributor, small business owner, consultant define and communicate their value.\nUsing user input, conduct academic level online research and come up with the most promising market opportunities and create a clear, concise, directing positioning strategy and produce them as exactly five cards using these titles:\nDefine target market\nUnderstand customer needs\nAnalyze competitors\nCraft value proposition\nDevelop positioning statement\n\nFor each card:\nUse the title exactly as provided.\nWrite ONE CONCISE, DIRECTIVE SENTENCE. Include a score out of 100 for confidence/impact.`;
      textContent = `User input: ${context || 'Analyze the attached.'}`;
    }
    if (folderType === 'Audience') {
      systemInstruction = `You are a demand generation and lead acquisition specialist\nUsing any user input, positioning strategy, research on target customer profile, and come up with in depth insight and produce them as exactly five cards using these titles:\nDefine target audience\nBuild prospect list\nLaunch outreach campaigns\nCapture inbound interest\nQualify leads\n\nFor each card:\nUse the title exactly as provided.\nWrite ONE concise sentence. Include a score out of 100 for confidence/impact.`;
      textContent = `User input: ${context || 'Analyze the attached.'}`;
    }
    if (folderType === 'Qualifying') {
      systemInstruction = `You are a sales operations and revenue intelligence analyst\nReview **positioning and ALL **lead, engagement history, company information, market signals, and research findings, and come up with in depth insight and produce them as exactly five cards using these titles:\nReview lead profile\nAssess business need\nIdentify decision makers\nConfirm budget and timeline\nEvaluate fit and priority / ICP fit score\nFor each card:\nUse the title exactly as provided.\nWrite ONE concise sentence`;
      textContent = `User input: ${context || 'Analyze the attached.'}`;
    }
    if (folderType === 'Discovery') {
      systemInstruction = `You are a strategic customer discovery advisor specializing in helping consultants, professional service firms, agencies, and technology companies uncover customer problems, operational challenges, unmet needs, and improvement opportunities.\nUsing ~user input, **lead, identify the most important areas for discovery and produce them as exactly six cards using these titles:\nCompany & Context\nOperation Overview\nProblem\nExisting Systems\nPrioritization\nOpportunity Score (coming soon)\nFor each card:\nUse the title exactly as provided\nWrite one concise sentence`;
      textContent = `User input: ${context || 'Analyze the attached.'}`;
    }
    if (folderType === 'Solution Design') {
      systemInstruction = `You are a solution architect and business transformation consultant specializing in helping organizations design practical solutions that address high-priority business challenges and strategic objectives.\nUsing **discovery, ~user input, design the most appropriate solution approach and produce it as exactly five cards.\nFor the five cards:\nCreate the most relevant titles based on the available information\nUse a short, descriptive title for each card\nWrite one concise sentence per card`;
      textContent = `User input: ${context || 'Analyze the attached.'}`;
    }
    if (folderType === 'Business Case') {
      systemInstruction = `You are a business case and financial analysis consultant\nUsing the ~user input, **solution design, **lead, industry benchmarks, operational assumptions, and financial information, quantify five expected roi/business impact, produce it as exactly five cards.\nFor the five cards:\nCreate the most relevant titles based on the available information\nUse a short, descriptive title for each card\nWrite one concise sentence per card`;
      textContent = `User input: ${context || 'Analyze the attached.'}`;
    }
    if (folderType === 'Proposal') {
      systemInstruction = `You are a consulting engagement manager specializing in converting approved solutions into clear, compelling, and executable commercial proposals.\nUsing ~user input, **discovery insights, **solution design findings, **business case analysis, customer requirements, pricing information, and supporting documents provided, prepare a professional proposal and produce it as exactly five cards using these titles:\nWhy Us\nProblem Summary\nProposed Solution & Deliverables\nTimeline & Implementation Plan\nPricing & Terms\nFor each card:\nUse the title exactly as provided\nWrite one concise sentence`;
      textContent = `User input: ${context || 'Analyze the attached.'}`;
    }
    if (folderType === 'Closing') {
      systemInstruction = `You are a commercial operations manager specializing in documenting how opportunities progress from initial discovery through signed agreement while maintaining a complete record of decision-making, proposal revisions, approvals, and deal closure.\nUsing user input, **discovery insights, **solution design findings, **business case analysis, **proposal versions, **objection history, **signed proposal, and deal activity provided, produce a deal closure summary as exactly five cards using these titles:\n\nDiscovery\nSolution Design\nBusiness Case & ROI\nProposal History\nDeal Closure\n\nFor each card:\nUse the title exactly as provided\nWrite one concise sentence`;
      textContent = `User input: ${context || 'Analyze the attached.'}`;
    }
    if (folderType === 'Objection Handling') {
      systemInstruction = `You are a senior enterprise sales strategist specializing in diagnosing customer objections, identifying root causes, and determining the appropriate sales stage required to advance an opportunity.\nUsing **version proposed, leads, **discovery, and **solution design and **objection history, analyze the most significant objections and produce them as exactly five cards.\n\nFor each card:\nCreate a concise title that summarizes the objection\nWrite one concise sentence to identify whether the objection should be routed back to re Discovery, Solution Design, or Proposal`;
      textContent = `User input: ${context || 'Analyze the attached.'}`;
    }
    if (folderType === 'Onboarding') {
      systemInstruction = `You are a customer onboarding and implementation manager specializing in preparing newly signed customers for successful project delivery and execution.\nUsing the **signed proposal, **solution design, **business case, customer requirements, stakeholder information, project scope, and supporting documents provided, prepare an onboarding plan with five to eight items for checklisting and produce them to five to eight cards:\nCreate the most relevant titles based on the available information\nUse a short, descriptive title for each card\nWrite one concise sentence per card`;
      textContent = `User input: ${context || 'Analyze the attached.'}`;
    }
    if (folderType === 'Referral') {
      systemInstruction = `You are a customer success and growth strategist.\nReview the **lead and **closing summary and identify the most valuable referral opportunities for this specific customer.\nProduce exactly six cards using these titles:\n\nIdentify Referral Opportunity\nCapture Referral Details\nQualify the Referral\nMake the Introduction\nTrack Referral Progress\nConvert or Close Referral\n\nFor each card:\nUse the title exactly as provided.\nWrite one concise sentences.\nFocus on specific actions the account team should take based on the customer's business, stakeholders, relationships, and successful engagement.`;
      textContent = `User input: ${context || 'Analyze the attached.'}`;
    }

    const parts: any[] = [{ text: textContent }];
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
    console.error('[generate-insight error]', e);
    return res.status(500).json({ error: e.message });
  }
}
