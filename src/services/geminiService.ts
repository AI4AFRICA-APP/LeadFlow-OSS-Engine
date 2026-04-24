/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { Lead } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const BUSINESS_CONTEXT = `
AI4Africa: The continent's leading AI Automation Agency. 
Website: https://ai4africa.app
Core Capabilities (MUST mention these in outreach):
- Custom AI Voice Agents (24/7 smart telephony)
- WhatsApp Automation & High-Volume Bulk SMS Systems
- Intelligent Lead Generation & Omnichannel Chatbots (Instagram, Telegram, FB)
- Custom RAG AI (Internal knowledge bases for staff & customers)
- Multi-Agent Workflow Automation
- Full Enterprise Systems & End-to-End App Development (Capable world-class engineering team)
- Free Business Automation Audit
`;

export async function discoverLeads(location: string, niche: string, retryCount = 0): Promise<Lead[]> {
  const MAX_RETRIES = 2;
  const prompt = `
    Find 5 high-quality business leads in ${location} for the ${niche} industry.
    
    Agency Context: ${BUSINESS_CONTEXT}
    
    For each business, use Google Search to find:
    1. Business Name & official Website URL.
    2. Correct Contact Email (Crucial for SMTP: Try searching domain contacts).
    3. Proper WhatsApp/Phone Number (For direct messaging).
    4. Specific automation gaps (e.g., manual booking, slow response, missing 24/7 bots).
    5. A highly personalized outreach message.
    
    Outreach Requirements (100% HUMAN FEEL):
    - Tone: Casual, professional, and DIRECT. 
    - NO AI Words: Skip "leverage", "optimize", "ensure", "seamless", "delighted", "delve".
    - NO Em-dashes (—).
    - Hook: Mention one specific thing you noticed about their business.
    - Content: Mention we build Enterprise Systems and can integrate into their current apps or handle full END-TO-END development. Mention our team is world-class and capable.
    - Offer: Mention the Free Business Automation Audit.
    - CTA: Ask them to "hit reply" to any questions.
    
    Formatting Rules:
    - Plain-text style: Use short, clean paragraphs. No bolding or bullets.
    - Spacing: Use double-line breaks (\n\n) between every paragraph.
    - Signature:
    
    Cheers,
    
    Ai4africa Team
    www.ai4africa.app
    
    Return the data as a compact JSON array matching the Lead interface.
    Keep 'personalizedDraft' around 150-200 words and 'companyOverview' under 100 words to ensure the response fits within token limits.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              businessName: { type: Type.STRING },
              industry: { type: Type.STRING },
              location: { type: Type.STRING },
              website: { type: Type.STRING },
              phoneNumber: { type: Type.STRING },
              email: { type: Type.STRING },
              automationGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
              suggestedService: { type: Type.STRING },
              personalizedDraft: { type: Type.STRING },
              score: { type: Type.NUMBER },
              intelligenceReport: {
                type: Type.OBJECT,
                properties: {
                  companyOverview: { type: Type.STRING },
                  techStackIdentified: { type: Type.ARRAY, items: { type: Type.STRING } },
                  potentialROI: { type: Type.STRING },
                  recentNews: { type: Type.STRING },
                  founderContext: { type: Type.STRING },
                },
                required: ["companyOverview", "techStackIdentified", "potentialROI"],
              }
            },
          },
        },
      },
    });

    let text = response.text || "[]";
    
    // Fallback/Cleanup for malformed or truncated JSON
    try {
      if (!text.endsWith(']')) {
        // Attempt to close a truncated JSON array
        if (text.includes('}')) {
          text = text.substring(0, text.lastIndexOf('}') + 1) + ']';
        } else {
          text = "[]";
        }
      }
      const leads = JSON.parse(text);
      return leads.map((l: any) => ({
        ...l,
        id: l.id || Math.random().toString(36).substr(2, 9),
        status: 'ready',
        intelligenceReport: l.intelligenceReport || {
          companyOverview: "Intelligence summary unavailable.",
          techStackIdentified: [],
          potentialROI: "TBD"
        }
      }));
    } catch (parseError) {
      console.warn("JSON Parse fix failed, returning empty leads:", parseError);
      return [];
    }
  } catch (error: any) {
    console.error(`Discovery attempt ${retryCount + 1} failed:`, error);
    
    // Handle RPC/XHR transient errors with retries
    const isRpcError = error?.message?.includes("Rpc failed") || error?.message?.includes("xhr error");
    if (isRpcError && retryCount < MAX_RETRIES) {
      console.log(`Retrying discovery (${retryCount + 1}/${MAX_RETRIES})...`);
      // Exponential backoff or simple delay
      await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
      return discoverLeads(location, niche, retryCount + 1);
    }

    return [];
  }
}

export async function enrichLead(lead: Lead): Promise<Partial<Lead>> {
  const prompt = `
    Deep research for contact info for business: "${lead.businessName}". 
    Website: ${lead.website || 'N/A'}. 
    Location: ${lead.location}.
    Find their official email address and WhatsApp/Phone number.
    Only return a JSON object with these two fields: 
    { "email": "extracted_email", "phoneNumber": "extracted_phone" }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Enrichment error:", error);
    return {};
  }
}
