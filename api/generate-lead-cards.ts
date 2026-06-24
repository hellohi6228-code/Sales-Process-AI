import { GoogleGenAI, Type, Schema } from "@google/genai";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { context, imageBase64, filesBase64 } = req.body;
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      return res.status(200).json({
        companyName: "Acme Corp Showcase (Mock)",
        cards: [
          { title: "Company Profile", text: `Acme Corp Showcase\nGlobal tech manufacturer based in mock data.\n~500 Employees, ~$120M Revenue.\nFocus on scalable infrastructure.` },
          { title: "Needs & Pain Points", text: `Current infrastructure does not support modern scalability, resulting in frequent downtimes during high loads. They need a scalable, robust, and cost-efficient cloud solution.` },
          { title: "Engagement History", text: `First connected early Q2 via outbound sequencing. The CTO showed strong interest in modernizing backend capabilities. Scheduled follow up for next week.` }
        ]
      });
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
    
    // Support legacy single image or new array of images
    const allImages = filesBase64 || (imageBase64 ? [imageBase64] : []);
    
    allImages.forEach((imgBase64: string) => {
      // Very basic data url parse, e.g. data:image/jpeg;base64,...
      const match = imgBase64.match(/^data:([^;]+);base64,/);
      const mimeType = match ? match[1] : "image/jpeg";
      const base64Data = imgBase64.replace(/^data:[^;]+;base64,/, "");
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        }
      });
    });

    if (parts.length === 0) {
       parts.push({ text: "Please generate a generic example lead." });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
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
    res.status(200).json(result);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
