import { GoogleGenAI, Type } from "@google/genai";
import db, { LogEntry, PastIncident } from "./db.ts";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Models
const reasoningModel = "gemini-3.1-pro-preview";
const fastModel = "gemini-3-flash-preview";
const embeddingModel = "gemini-embedding-2-preview";

/**
 * Agent 1: Incident Detection Agent
 */
export async function detectAnomalies(logs: LogEntry[]) {
  const prompt = `
    Analyze the following system logs and detect any anomalies or critical issues.
    Return a list of detected incidents with a title, severity, and a brief description of why it's an anomaly.
    
    Logs:
    ${JSON.stringify(logs, null, 2)}
  `;

  const response = await genAI.models.generateContent({
    model: fastModel,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            severity: { type: Type.STRING, enum: ["low", "medium", "high", "critical"] },
            description: { type: Type.STRING }
          },
          required: ["title", "severity", "description"]
        }
      }
    }
  });

  return JSON.parse(response.text);
}

/**
 * Agent 2: Log Analysis Agent
 */
export async function analyzeLogs(logs: LogEntry[]) {
  const prompt = `
    Extract key entities and patterns from these logs: service names, error codes, IP addresses, and specific error messages.
    Categorize them for root cause analysis.
    
    Logs:
    ${JSON.stringify(logs, null, 2)}
  `;

  const response = await genAI.models.generateContent({
    model: fastModel,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          servicesAffected: { type: Type.ARRAY, items: { type: Type.STRING } },
          errorCodes: { type: Type.ARRAY, items: { type: Type.STRING } },
          patterns: { type: Type.ARRAY, items: { type: Type.STRING } },
          summary: { type: Type.STRING }
        }
      }
    }
  });

  return JSON.parse(response.text);
}

/**
 * Agent 3: Incident Retrieval Agent (RAG)
 */
export async function findSimilarIncidents(query: string) {
  // 1. Generate embedding for query
  const embedResult = await genAI.models.embedContent({
    model: embeddingModel,
    contents: [query]
  });
  const queryVector = embedResult.embeddings[0].values;

  // 2. Get all past incidents from DB
  const pastIncidents = db.prepare('SELECT * FROM past_incidents').all() as PastIncident[];
  
  if (pastIncidents.length === 0) return [];

  // 3. Simple cosine similarity
  const results = pastIncidents.map(incident => {
    if (!incident.embedding) return { ...incident, score: 0 };
    const vector = new Float32Array(incident.embedding.buffer);
    let dotProduct = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < queryVector.length; i++) {
      dotProduct += queryVector[i] * vector[i];
      magA += queryVector[i] * queryVector[i];
      magB += vector[i] * vector[i];
    }
    const score = dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
    return { ...incident, score };
  });

  return results.sort((a, b) => b.score - a.score).slice(0, 3);
}

/**
 * Agent 4 & 5: Root Cause & Solution Agent
 */
export async function performRCA(incidentTitle: string, logAnalysis: any, similarIncidents: any[]) {
  const prompt = `
    Perform a deep Root Cause Analysis (RCA) for the following incident.
    
    Incident: ${incidentTitle}
    
    Log Analysis:
    ${JSON.stringify(logAnalysis, null, 2)}
    
    Similar Past Incidents:
    ${JSON.stringify(similarIncidents, null, 2)}
    
    Provide:
    1. A ranked list of possible root causes with confidence scores (0-1).
    2. Recommended troubleshooting steps.
    3. A suggested long-term solution.
  `;

  const response = await genAI.models.generateContent({
    model: reasoningModel,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          rootCauses: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                cause: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
                explanation: { type: Type.STRING }
              }
            }
          },
          recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
          longTermSolution: { type: Type.STRING }
        }
      }
    }
  });

  return JSON.parse(response.text);
}

/**
 * Agent 6: Report Generation Agent
 */
export async function generateReport(incident: any, rca: any) {
  const prompt = `
    Generate a professional incident summary report.
    Include a timeline of events, summary of the issue, root cause, and actions taken/recommended.
    
    Incident Data:
    ${JSON.stringify(incident, null, 2)}
    
    RCA Data:
    ${JSON.stringify(rca, null, 2)}
  `;

  const response = await genAI.models.generateContent({
    model: reasoningModel,
    contents: prompt,
    config: {
      systemInstruction: "You are a senior SRE generating an incident report."
    }
  });

  return response.text;
}

/**
 * Chat Assistant
 */
export async function chatAssistant(history: any[], message: string, context: any) {
  const chat = genAI.chats.create({
    model: fastModel,
    config: {
      systemInstruction: `You are OpsMind Assistant. You help engineers debug incidents. 
      Context of current incident: ${JSON.stringify(context)}`
    }
  });

  // Convert history to parts if needed, but for simplicity:
  const response = await chat.sendMessage({ message });
  return response.text;
}

/**
 * Helper to seed vector DB
 */
export async function seedPastIncident(incident: Omit<PastIncident, 'embedding'>) {
  const textToEmbed = `${incident.title} ${incident.description} ${incident.root_cause}`;
  const embedResult = await genAI.models.embedContent({
    model: embeddingModel,
    contents: [textToEmbed]
  });
  const vector = new Float32Array(embedResult.embeddings[0].values);
  const buffer = Buffer.from(vector.buffer);

  db.prepare(`
    INSERT INTO past_incidents (title, description, root_cause, solution, embedding)
    VALUES (?, ?, ?, ?, ?)
  `).run(incident.title, incident.description, incident.root_cause, incident.solution, buffer);
}
