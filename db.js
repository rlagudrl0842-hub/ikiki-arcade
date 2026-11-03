// SQLite 저장소 (Node 22 내장 node:sqlite)
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = `
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  settings TEXT NOT NULL, state TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  ended_at INTEGER, deleted INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS teams (
  event_id TEXT NOT NULL, id INTEGER NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL, icon TEXT NOT NULL,
  PRIMARY KEY (event_id, id), FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY, event_id TEXT NOT NULL, team_id INTEGER, name TEXT NOT NULL, age TEXT NOT NULL,
  secret TEXT NOT NULL, device TEXT, rep INTEGER DEFAULT 0, excluded INTEGER DEFAULT 0, joined_at INTEGER NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_players_event ON players(event_id);
CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT NOT NULL, seq INTEGER NOT NULL, game TEXT NOT NULL,
  label TEXT NOT NULL, weight REAL NOT NULL, status TEXT NOT NULL, config TEXT, started_at INTEGER, ended_at INTEGER,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS team_results (
  run_id INTEGER NOT NULL, team_id INTEGER NOT NULL, metric REAL NOT NULL, rank INTEGER NOT NULL, points REAL NOT NULL,
  detail TEXT, PRIMARY KEY (run_id, team_id), FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS player_scores (
  run_id INTEGER NOT NULL, player_id TEXT NOT NULL, raw REAL NOT NULL, norm REAL NOT NULL, detail TEXT,
  PRIMARY KEY (run_id, player_id), FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT NOT NULL, team_id INTEGER NOT NULL, delta REAL NOT NULL,
  kind TEXT NOT NULL, reason TEXT, at INTEGER NOT NULL, FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT, action TEXT NOT NULL, detail TEXT, at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, age TEXT NOT NULL, text TEXT NOT NULL, emoji TEXT, answer INTEGER NOT NULL, active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
`;

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  const cache = new Map();
  const st = (sql) => { let s = cache.get(sql); if (!s) { s = db.prepare(sql); cache.set(sql, s); } return s; };
  const api = {
    raw: db,
    run: (sql, ...a) => st(sql).run(...a),
    get: (sql, ...a) => st(sql).get(...a),
    all: (sql, ...a) => st(sql).all(...a),
    tx(fn) {
      db.exec('BEGIN');
      try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    getKV: (k) => st('SELECT v FROM kv WHERE k=?').get(k)?.v,
    setKV: (k, v) => st('INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').run(k, v),
    close: () => db.close(),
  };
  return api;
}
