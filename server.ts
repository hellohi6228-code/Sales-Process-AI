import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, Schema } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({limit: '50mb'}));

  // API routes FIRST
  app.post("/api/generate-insight", async (req, res) => {
    try {
      const { processName, context, folderType, imageBase64 } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        // Fallback to mock data if no key
        await new Promise(resolve => setTimeout(resolve, 1500));
        return res.json({
          title: `New Insight for ${processName || folderType}`,
          text: `Extracted summary based on provided context: "${context?.substring(0, 50)}..." indicating new strategic opportunities.`,
          score: Math.floor(Math.random() * 15) + 85
        });
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
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
                    score: { type: Type.NUMBER }
                 },
                 required: ["title", "text"]
             }
          }
        },
        required: ["cards"]
      };

      let systemInstruction = `You are a strategic AI assistant helping a consultant analyze ${processName || folderType} data.`;
      
      const parts: any[] = [];
      let textContent = `Process Category: ${folderType}\nProcess/Lead Name: ${processName}\nUser Context/Prompt: ${context}\n\nAnalyze the context and generate an insight card as requested.`;

      if (folderType === 'Positioning') {
          systemInstruction = `You are a strategic marketing and positioning advisor specializing in helping consultants and professional service firms define and communicate their value.
Using user input, user professional profile, business context, research materials, market information, and supporting documents provided, identify the most promising market opportunities and create a clear positioning strategy and produce them as exactly five cards using these titles:
Define target market
Understand customer needs
Analyze competitors
Craft value proposition
Develop positioning statement

For each card:
Use the title exactly as provided.
Write ONE CONCISE SENTENCE. Include a score out of 100 for confidence/impact.`;
          textContent = `User input: ${context || 'Analyze the attached.'}`;
      }

      parts.push({ text: textContent });

      if (imageBase64) {
        const mimeType = imageBase64.match(/data:([^;]+);base64,/)?.[1] || "image/jpeg";
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        });
      }
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: { parts },
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.2
        }
      });

      if (!response.text) throw new Error("No text generated");
      const result = JSON.parse(response.text);
      
      res.json(result);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/generate-lead-cards", async (req, res) => {
    try {
      const { context, imageBase64 } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is missing");
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
          companyName: { type: Type.STRING, description: "The name of the company or lead extracted from the context or image." },
          cards: {
             type: Type.ARRAY,
             items: {
                 type: Type.OBJECT,
                 properties: {
                    title: { type: Type.STRING },
                    text: { type: Type.STRING },
                 },
                 required: ["title", "text"]
             }
          }
        },
        required: ["companyName", "cards"]
      };

      let systemInstruction = `You are a sales operations and customer intelligence analyst specializing in reviewing B2B leads and summarizing key information for sales teams.
Using user input, CRM records, company information, engagement history, website content, market research, supporting documents, emails, meeting notes, and any other available context, analyze the lead and produce exactly three cards using these titles:
Company Profile
Needs & Pain Points
Engagement History
For each card:
Use the title exactly as provided.
Write a short paragraph of 2-3 concise sentences.`;

      const parts: any[] = [];
      if (context) {
        parts.push({ text: `Context: ${context}` });
      }
      if (imageBase64) {
        const mimeType = imageBase64.match(/data:([^;]+);base64,/)?.[1] || "image/jpeg";
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        });
      }

      if (parts.length === 0) {
         parts.push({ text: "Please generate a generic example lead." });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: { parts },
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.2
        }
      });

      if (!response.text) throw new Error("No text generated");
      const result = JSON.parse(response.text);
      res.json(result);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
