import Database from 'better-sqlite3';
import path from 'path';

const db = new Database('opsmind.db');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    severity TEXT DEFAULT 'medium',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    summary TEXT,
    root_cause TEXT,
    recommendation TEXT,
    timeline JSON
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id TEXT,
    timestamp DATETIME,
    level TEXT,
    service TEXT,
    message TEXT,
    raw_data TEXT,
    FOREIGN KEY(incident_id) REFERENCES incidents(id)
  );

  CREATE TABLE IF NOT EXISTS past_incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    root_cause TEXT,
    solution TEXT,
    embedding BLOB
  );
`);

export default db;

export interface Incident {
  id: string;
  title: string;
  status: string;
  severity: string;
  created_at: string;
  summary?: string;
  root_cause?: string;
  recommendation?: string;
  timeline?: string;
}

export interface LogEntry {
  id?: number;
  incident_id?: string;
  timestamp: string;
  level: string;
  service: string;
  message: string;
  raw_data?: string;
}

export interface PastIncident {
  id?: number;
  title: string;
  description: string;
  root_cause: string;
  solution: string;
  embedding?: Buffer;
}
