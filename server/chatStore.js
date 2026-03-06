import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const DEFAULT_DB_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'chat.sqlite');
const require = createRequire(import.meta.url);

function normalizeMessage(row) {
  return {
    id: Number(row?.id || 0),
    playerId: Number(row?.playerId || 0),
    name: String(row?.name || '').trim() || 'Unknown',
    text: String(row?.text || '').trim()
  };
}

function createInMemoryChatStore() {
  const messages = [];
  let nextId = 1;

  return {
    dbPath: ':memory:',
    mode: 'memory',

    saveMessage(playerId, playerName, text) {
      const safeText = String(text || '').trim().slice(0, 200);
      if (!safeText) return null;
      const row = normalizeMessage({
        id: nextId++,
        playerId,
        name: playerName,
        text: safeText
      });
      messages.push(row);
      return row;
    },

    getHistory(limit = 200) {
      const safeLimit = Math.max(1, Math.min(2000, Math.floor(Number(limit) || 200)));
      return messages.slice(-safeLimit).map(normalizeMessage);
    }
  };
}

function tryLoadSqlite() {
  try {
    return require('better-sqlite3');
  } catch {
    return null;
  }
}

export function createChatStore(dbPath = DEFAULT_DB_PATH) {
  const Database = tryLoadSqlite();
  if (!Database) {
    console.warn('[chat] better-sqlite3 unavailable, using in-memory chat store');
    return createInMemoryChatStore();
  }

  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      player_name TEXT NOT NULL,
      message_text TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chat_created_at ON chat_messages(created_at DESC);
  `);

  const insertStmt = db.prepare(`
    INSERT INTO chat_messages (
      player_id,
      player_name,
      message_text,
      created_at
    ) VALUES (?, ?, ?, ?)
  `);

  const historyStmt = db.prepare(`
    SELECT
      id,
      player_id AS playerId,
      player_name AS name,
      message_text AS text
    FROM chat_messages
    ORDER BY id DESC
    LIMIT ?
  `);

  return {
    dbPath,
    mode: 'sqlite',

    saveMessage(playerId, playerName, text) {
      const safeText = String(text || '').trim().slice(0, 200);
      if (!safeText) return null;
      const safeName = String(playerName || '').trim().slice(0, 20) || `Player ${Number(playerId) || 0}`;
      const now = Date.now();
      const info = insertStmt.run(Number(playerId) || 0, safeName, safeText, now);

      return normalizeMessage({
        id: info.lastInsertRowid,
        playerId,
        name: safeName,
        text: safeText
      });
    },

    getHistory(limit = 200) {
      const safeLimit = Math.max(1, Math.min(2000, Math.floor(Number(limit) || 200)));
      const rows = historyStmt.all(safeLimit);
      // DB query is DESC for fast limit; reverse to replay oldest -> newest.
      return rows.reverse().map(normalizeMessage);
    }
  };
}
