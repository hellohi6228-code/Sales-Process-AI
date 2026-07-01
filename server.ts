import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, Schema } from "@google/genai";
import * as mammoth from "mammoth";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // API routes FIRST
  app.post("/api/generate-insight", async (req, res) => {
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
      const { processName, context, folderType, imageBase64, filesBase64 } = req.body;

      // 2. Input Validation
      if (folderType && typeof folderType !== 'string') {
        return res.status(400).json({ error: 'Invalid folderType parameter' });
      }
      if (processName && typeof processName !== 'string') {
        return res.status(400).json({ error: 'Invalid processName parameter' });
      }
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
        // Fallback to mock data if no key
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return res.json({
          title: `New Insight for ${processName || folderType}`,
          text: `Extracted summary based on provided context: "${context?.substring(0, 50)}..." indicating new strategic opportunities.`,
          score: Math.floor(Math.random() * 15) + 85,
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });

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
              required: ["title", "text"],
            },
          },
        },
        required: ["cards"],
      };

      let systemInstruction = `You are a strategic AI assistant helping a consultant analyze ${processName || folderType} data.`;

      const parts: any[] = [];
      let textContent = `Process Category: ${folderType}\nProcess/Lead Name: ${processName}\nUser Context/Prompt: ${context}\n\nAnalyze the context and generate an insight card as requested.`;

      if (folderType === "Positioning") {
        systemInstruction = `You are a strategic marketing and positioning advisor specializing in helping individual contributor, small business owner, consultant define and communicate their value.
Using user input, conduct academic level online research and come up with the most promising market opportunities and create a clear, concise, directing positioning strategy and produce them as exactly five cards using these titles:
Define target market
Understand customer needs
Analyze competitors
Craft value proposition
Develop positioning statement

For each card:
Use the title exactly as provided.
Write ONE CONCISE, DIRECTIVE SENTENCE. Include a score out of 100 for confidence/impact.`;
        textContent = `User input: ${context || "Analyze the attached."}`;
      }

      if (folderType === "Audience") {
        systemInstruction = `You are a demand generation and lead acquisition specialist
Using any user input, positioning strategy, research on target customer profile, and come up with in depth insight and produce them as exactly five cards using these titles:
Define target audience
Build prospect list
Launch outreach campaigns
Capture inbound interest
Qualify leads

For each card:
Use the title exactly as provided.
Write ONE concise sentence. Include a score out of 100 for confidence/impact.`;
        textContent = `User input: ${context || "Analyze the attached."}`;
      }

      if (folderType === "Qualifying") {
        systemInstruction = `You are a sales operations and revenue intelligence analyst
Review **positioning and ALL **lead, engagement history, company information, market signals, and research findings, and come up with in depth insight and produce them as exactly five cards using these titles:
Review lead profile
Assess business need
Identify decision makers
Confirm budget and timeline
Evaluate fit and priority / ICP fit score
For each card:
Use the title exactly as provided.
Write ONE concise sentence`;
        textContent = `User input: ${context || "Analyze the attached."}`;
      }

      if (folderType === "Discovery") {
        systemInstruction = `You are a strategic customer discovery advisor specializing in helping consultants, professional service firms, agencies, and technology companies uncover customer problems, operational challenges, unmet needs, and improvement opportunities.
Using ~user input, **lead, identify the most important areas for discovery and produce them as exactly six cards using these titles:
Company & Context
Operation Overview
Problem
Existing Systems
Prioritization
Opportunity Score (coming soon)
For each card:
Use the title exactly as provided
Write one concise sentence`;
        textContent = `User input: ${context || "Analyze the attached."}`;
      }

      if (folderType === "Solution Design") {
        systemInstruction = `You are a solution architect and business transformation consultant specializing in helping organizations design practical solutions that address high-priority business challenges and strategic objectives.
Using **discovery, ~user input, design the most appropriate solution approach and produce it as exactly five cards.
For the five cards:
Create the most relevant titles based on the available information
Use a short, descriptive title for each card
Write one concise sentence per card`;
        textContent = `User input: ${context || "Analyze the attached."}`;
      }

      if (folderType === "Business Case") {
        systemInstruction = `You are a business case and financial analysis consultant
Using the ~user input, **solution design, **lead, industry benchmarks, operational assumptions, and financial information, quantify five expected roi/business impact, produce it as exactly five cards.
For the five cards:
Create the most relevant titles based on the available information
Use a short, descriptive title for each card
Write one concise sentence per card`;
        textContent = `User input: ${context || "Analyze the attached."}`;
      }

      if (folderType === "Proposal") {
        systemInstruction = `You are a consulting engagement manager specializing in converting approved solutions into clear, compelling, and executable commercial proposals.
Using ~user input, **discovery insights, **solution design findings, **business case analysis, customer requirements, pricing information, and supporting documents provided, prepare a professional proposal and produce it as exactly five cards using these titles:
Why Us
Problem Summary
Proposed Solution & Deliverables
Timeline & Implementation Plan
Pricing & Terms
For each card:
Use the title exactly as provided
Write one concise sentence`;
        textContent = `User input: ${context || "Analyze the attached."}`;
      }

      if (folderType === "Closing") {
        systemInstruction = `You are a commercial operations manager specializing in documenting how opportunities progress from initial discovery through signed agreement while maintaining a complete record of decision-making, proposal revisions, approvals, and deal closure.
Using user input, **discovery insights, **solution design findings, **business case analysis, **proposal versions, **objection history, **signed proposal, and deal activity provided, produce a deal closure summary as exactly five cards using these titles:

Discovery
Solution Design
Business Case & ROI
Proposal History
Deal Closure

For each card:
Use the title exactly as provided
Write one concise sentence`;
        textContent = `User input: ${context || "Analyze the attached."}`;
      }

      if (folderType === "Objection Handling") {
        systemInstruction = `You are a senior enterprise sales strategist specializing in diagnosing customer objections, identifying root causes, and determining the appropriate sales stage required to advance an opportunity.
Using **version proposed, leads, **discovery, and **solution design and **objection history, analyze the most significant objections and produce them as exactly five cards.

For each card:
Create a concise title that summarizes the objection
Write one concise sentence to identify whether the objection should be routed back to re Discovery, Solution Design, or Proposal`;
        textContent = `User input: ${context || "Analyze the attached."}`;
      }

      if (folderType === "Onboarding") {
        systemInstruction = `You are a customer onboarding and implementation manager specializing in preparing newly signed customers for successful project delivery and execution.
Using the **signed proposal, **solution design, **business case, customer requirements, stakeholder information, project scope, and supporting documents provided, prepare an onboarding plan with five to eight items for checklisting and produce them to five to eight cards:
Create the most relevant titles based on the available information
Use a short, descriptive title for each card
Write one concise sentence per card`;
        textContent = `User input: ${context || "Analyze the attached."}`;
      }

      if (folderType === "Referral") {
        systemInstruction = `You are a customer success and growth strategist.
Review the **lead and **closing summary and identify the most valuable referral opportunities for this specific customer.
Produce exactly six cards using these titles:

Identify Referral Opportunity
Capture Referral Details
Qualify the Referral
Make the Introduction
Track Referral Progress
Convert or Close Referral

For each card:
Use the title exactly as provided.
Write one concise sentences.
Focus on specific actions the account team should take based on the customer’s business, stakeholders, relationships, and successful engagement.
Generate tailored referral ideas, not generic descriptions of the referral process.
Infer likely referral sources from the available information, such as business partners, clients, vendors, affiliates, investors, industry peers, executive contacts, or professional networks, when appropriate.
Explain why the referral opportunity is promising and what the next step should be.
Keep the language simple, practical, and suitable for display as a mobile app card.
Avoid vague advice, theory, or definitions.
Do not include introductions, summaries, conclusions, bullet points, or any text outside the six cards.
Do not reference or reuse wording from these instructions, and do not rely on fixed examples; adapt the recommendations to the provided inputs.`;
        textContent = `User input: ${context || "Analyze the attached."}`;
      }

      parts.push({ text: textContent });

      const allImages = filesBase64 || (imageBase64 ? [imageBase64] : []);

      for (const imgBase64 of allImages) {
        const match = imgBase64.match(/^data:([^;]+);base64,/);
        const mimeType = match ? match[1] : "image/jpeg";
        const base64Data = imgBase64.replace(/^data:[^;]+;base64,/, "");

        if (
          mimeType ===
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          mimeType.includes("wordprocessing")
        ) {
          try {
            const result = await mammoth.extractRawText({
              buffer: Buffer.from(base64Data, "base64"),
            });
            parts.push({ text: `Attached Document Content:\n${result.value}` });
          } catch (e) {
            console.error("Mammoth error", e);
          }
        } else {
          parts.push({
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            },
          });
        }
      }

      let response;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts },
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              responseSchema,
              temperature: 0.2,
            },
          });
          break;
        } catch (e: any) {
          if (attempt === 3) throw e;
          if (e.status === 503 || e.status === 429 || e.message?.includes('503') || e.message?.includes('429') || e.message?.includes('high demand') || e.message?.includes('UNAVAILABLE') || e.message?.includes('RESOURCE_EXHAUSTED')) {
            console.log(`[API] 503/429 Output encountered on /api/generate-insight. Retrying attempt ${attempt}...`);
            await new Promise(r => setTimeout(r, 5000 * attempt));
          } else {
            throw e;
          }
        }
      }

      if (!response || !response.text) throw new Error("No text generated");
      const result = JSON.parse(response.text);

      res.json(result);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'An unexpected internal server error occurred.' });
    }
  });

  app.post("/api/generate-lead-cards", async (req, res) => {
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
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return res.json({
          companyName: "Acme Corp Showcase (Mock)",
          cards: [
            {
              title: "Company Profile",
              text: `Acme Corp Showcase\nGlobal tech manufacturer based in mock data.\n~500 Employees, ~$120M Revenue.\nFocus on scalable infrastructure.`,
            },
            {
              title: "Needs & Pain Points",
              text: `Current infrastructure does not support modern scalability, resulting in frequent downtimes during high loads. They need a scalable, robust, and cost-efficient cloud solution.`,
            },
            {
              title: "Engagement History",
              text: `First connected early Q2 via outbound sequencing. The CTO showed strong interest in modernizing backend capabilities. Scheduled follow up for next week.`,
            },
          ],
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });

      const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
          companyName: {
            type: Type.STRING,
            description:
              "The name of the company or lead extracted from the context or image.",
          },
          cards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                text: { type: Type.STRING },
              },
              required: ["title", "text"],
            },
          },
        },
        required: ["companyName", "cards"],
      };

      let systemInstruction = `You are a sales operations and customer intelligence analyst specializing in reviewing B2B leads and summarizing key information for sales teams.
Using user input, CRM records, company information, engagement history, website content, market research, supporting documents, emails, meeting notes, and any other available context, analyze the lead and produce exactly three cards using these titles:
Company Profile
Needs & Pain Points
Engagement History
For each card:
Use the title exactly as provided.
Write ONE concise sentence.`;

      const parts: any[] = [];
      if (context) {
        parts.push({ text: `Context: ${context}` });
      }

      const allImages = filesBase64 || (imageBase64 ? [imageBase64] : []);

      for (const imgBase64 of allImages) {
        const match = imgBase64.match(/^data:([^;]+);base64,/);
        const mimeType = match ? match[1] : "image/jpeg";
        const base64Data = imgBase64.replace(/^data:[^;]+;base64,/, "");

        if (
          mimeType ===
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          mimeType.includes("wordprocessing")
        ) {
          try {
            const result = await mammoth.extractRawText({
              buffer: Buffer.from(base64Data, "base64"),
            });
            parts.push({ text: `Attached Document Content:\n${result.value}` });
          } catch (e) {
            console.error("Mammoth error", e);
          }
        } else {
          parts.push({
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            },
          });
        }
      }

      if (parts.length === 0) {
        parts.push({ text: "Please generate a generic example lead." });
      }

      let response;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts },
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              responseSchema,
              temperature: 0.2,
            },
          });
          break;
        } catch (e: any) {
          if (attempt === 3) throw e;
          if (e.status === 503 || e.status === 429 || e.message?.includes('503') || e.message?.includes('429') || e.message?.includes('high demand') || e.message?.includes('UNAVAILABLE') || e.message?.includes('RESOURCE_EXHAUSTED')) {
            console.log(`[API] 503/429 Output encountered on /api/generate-lead-cards. Retrying attempt ${attempt}...`);
            await new Promise(r => setTimeout(r, 5000 * attempt));
          } else {
            throw e;
          }
        }
      }

      if (!response || !response.text) throw new Error("No text generated");
      const result = JSON.parse(response.text);
      res.json(result);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'An unexpected internal server error occurred.' });
    }
  });

  const userTokens: Record<string, any> = {};

  function getOAuth2Client() {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.APP_URL || "http://localhost:3000"}/api/auth/google/callback`
    );
  }

  app.get("/api/auth/google/url", (req, res) => {
    const oauth2Client = getOAuth2Client();
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/documents"
      ],
      prompt: "consent",
    });
    res.json({ url });
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const { code } = req.query;
    try {
      const oauth2Client = getOAuth2Client();
      const { tokens } = await oauth2Client.getToken(code as string);
      oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      const email = userInfo.data.email;
      
      if (email) {
        userTokens[email] = tokens;
      }
      
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', email: '${email}', token: '${tokens.access_token}' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error(error);
      res.status(500).send("Authentication failed: " + error.message);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
