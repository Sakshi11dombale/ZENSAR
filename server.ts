import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import db from "./src/lib/db.ts";
import * as ai from "./src/lib/ai.ts";
import { v4 as uuidv4 } from 'uuid';

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // --- API Routes ---

  // 1. Ingest Logs
  app.post("/api/logs", async (req, res) => {
    const { logs } = req.body; // Array of LogEntry
    if (!logs || !Array.isArray(logs)) {
      return res.status(400).json({ error: "Invalid logs format" });
    }

    // Store raw logs
    const insertLog = db.prepare(`
      INSERT INTO logs (timestamp, level, service, message, raw_data)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const log of logs) {
      insertLog.run(log.timestamp, log.level, log.service, log.message, JSON.stringify(log));
    }

    // Trigger Detection Agent
    try {
      const anomalies = await ai.detectAnomalies(logs);
      
      const createdIncidents = [];
      for (const anomaly of anomalies) {
        const id = uuidv4();
        db.prepare(`
          INSERT INTO incidents (id, title, severity, summary)
          VALUES (?, ?, ?, ?)
        `).run(id, anomaly.title, anomaly.severity, anomaly.description);
        
        createdIncidents.push({ id, ...anomaly });
      }

      res.json({ message: "Logs ingested", anomalies: createdIncidents });
    } catch (error) {
      console.error("Detection error:", error);
      res.status(500).json({ error: "Failed to process logs" });
    }
  });

  // 2. Get Incidents
  app.get("/api/incidents", (req, res) => {
    const incidents = db.prepare("SELECT * FROM incidents ORDER BY created_at DESC").all();
    res.json(incidents);
  });

  // 3. Analyze Incident (Full Agentic Workflow)
  app.post("/api/incidents/:id/analyze", async (req, res) => {
    const { id } = req.params;
    const incident = db.prepare("SELECT * FROM incidents WHERE id = ?").get() as any;
    
    if (!incident) return res.status(404).json({ error: "Incident not found" });

    try {
      // Get related logs (simplified: last 100 logs)
      const logs = db.prepare("SELECT * FROM logs ORDER BY timestamp DESC LIMIT 100").all() as any[];

      // Agent 2: Log Analysis
      const logAnalysis = await ai.analyzeLogs(logs);

      // Agent 3: Retrieval (RAG)
      const similarIncidents = await ai.findSimilarIncidents(incident.title + " " + incident.summary);

      // Agent 4 & 5: RCA & Solution
      const rcaResult = await ai.performRCA(incident.title, logAnalysis, similarIncidents);

      // Agent 6: Report
      const report = await ai.generateReport(incident, rcaResult);

      // Update DB
      db.prepare(`
        UPDATE incidents 
        SET root_cause = ?, recommendation = ?, summary = ?, status = 'analyzed'
        WHERE id = ?
      `).run(
        JSON.stringify(rcaResult.rootCauses),
        JSON.stringify({ recommendations: rcaResult.recommendations, longTerm: rcaResult.longTermSolution }),
        report,
        id
      );

      res.json({ id, rca: rcaResult, report });
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ error: "Analysis failed" });
    }
  });

  // 4. Chat Assistant
  app.post("/api/chat", async (req, res) => {
    const { message, history, context } = req.body;
    try {
      const reply = await ai.chatAssistant(history, message, context);
      res.json({ reply });
    } catch (error) {
      res.status(500).json({ error: "Chat failed" });
    }
  });

  // 5. Seed Data
  app.post("/api/seed", async (req, res) => {
    try {
      await ai.seedPastIncident({
        title: "Database Connection Timeout",
        description: "High latency in DB connections leading to 504 errors in API gateway.",
        root_cause: "Connection pool exhaustion due to unclosed cursors in the user-service.",
        solution: "Implement proper try-with-resources and increase pool size to 50."
      });
      await ai.seedPastIncident({
        title: "Memory Leak in Auth Service",
        description: "Auth service memory usage grows linearly until OOM kill.",
        root_cause: "Caching JWT tokens indefinitely without TTL.",
        solution: "Add TTL to token cache and implement LRU eviction policy."
      });
      res.json({ message: "Seed data added" });
    } catch (error) {
      res.status(500).json({ error: "Seed failed" });
    }
  });

  // --- Vite / Static Serving ---
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
    console.log(`OpsMind Server running on http://localhost:${PORT}`);
  });
}

startServer();
