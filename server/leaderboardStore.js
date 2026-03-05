import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const DEFAULT_DB_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'leaderboard.sqlite');
const require = createRequire(import.meta.url);

function createInMemoryLeaderboardStore() {
  const scores = new Map();

  function normalizeScore(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.round(n * 1000) / 1000);
  }

  function toSortedRows(limit = 10) {
    const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 10)));
    return [...scores.values()]
      .sort((a, b) => {
        if (b.lifetimeScore !== a.lifetimeScore) return b.lifetimeScore - a.lifetimeScore;
        if (b.bestRoundScore !== a.bestRoundScore) return b.bestRoundScore - a.bestRoundScore;
        if (b.roundsPlayed !== a.roundsPlayed) return b.roundsPlayed - a.roundsPlayed;
        return String(a.name).localeCompare(String(b.name));
      })
      .slice(0, safeLimit);
  }

  return {
    dbPath: ':memory:',
    saveRoundSummary(summary, limit = 10) {
      if (summary && Array.isArray(summary.players)) {
        const now = Date.now();
        for (const row of summary.players) {
          const name = String(row?.name || '').trim();
          if (!name) continue;
          const score = normalizeScore(row?.score || 0);
          const existing = scores.get(name.toLowerCase());
          if (!existing) {
            scores.set(name.toLowerCase(), {
              name,
              lifetimeScore: score,
              bestRoundScore: score,
              lastRoundScore: score,
              roundsPlayed: 1,
              updatedAt: now
            });
            continue;
          }
          existing.lifetimeScore = normalizeScore(existing.lifetimeScore + score);
          existing.bestRoundScore = Math.max(existing.bestRoundScore, score);
          existing.lastRoundScore = score;
          existing.roundsPlayed += 1;
          existing.updatedAt = now;
        }
      }

      return toSortedRows(limit);
    },

    getTopScores(limit = 10) {
      return toSortedRows(limit);
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

export function createLeaderboardStore(dbPath = DEFAULT_DB_PATH) {
  const Database = tryLoadSqlite();
  if (!Database) {
    console.warn('[leaderboard] better-sqlite3 unavailable, using in-memory leaderboard store');
    return createInMemoryLeaderboardStore();
  }

  function normalizeScore(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.round(n * 1000) / 1000);
  }

  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS player_scores (
      player_name TEXT PRIMARY KEY COLLATE NOCASE,
      lifetime_score REAL NOT NULL DEFAULT 0,
      best_round_score REAL NOT NULL DEFAULT 0,
      last_round_score REAL NOT NULL DEFAULT 0,
      rounds_played INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
  `);

  const upsertStmt = db.prepare(`
    INSERT INTO player_scores (
      player_name,
      lifetime_score,
      best_round_score,
      last_round_score,
      rounds_played,
      updated_at
    ) VALUES (?, ?, ?, ?, 1, ?)
    ON CONFLICT(player_name) DO UPDATE SET
      lifetime_score = player_scores.lifetime_score + excluded.last_round_score,
      best_round_score = MAX(player_scores.best_round_score, excluded.best_round_score),
      last_round_score = excluded.last_round_score,
      rounds_played = player_scores.rounds_played + 1,
      updated_at = excluded.updated_at
  `);

  const topStmt = db.prepare(`
    SELECT
      player_name AS name,
      ROUND(lifetime_score, 3) AS lifetimeScore,
      ROUND(best_round_score, 3) AS bestRoundScore,
      ROUND(last_round_score, 3) AS lastRoundScore,
      rounds_played AS roundsPlayed,
      updated_at AS updatedAt
    FROM player_scores
    ORDER BY lifetime_score DESC, best_round_score DESC, rounds_played DESC, player_name ASC
    LIMIT ?
  `);

  return {
    dbPath,
    saveRoundSummary(summary, limit = 10) {
      if (!summary || !Array.isArray(summary.players) || summary.players.length === 0) {
        return this.getTopScores(limit);
      }

      const now = Date.now();
      const tx = db.transaction((rows) => {
        for (const row of rows) {
          const name = (row?.name || '').trim();
          if (!name) continue;
          const score = normalizeScore(row?.score || 0);
          upsertStmt.run(name, score, score, score, now);
        }
      });

      tx(summary.players);
      return this.getTopScores(limit);
    },

    getTopScores(limit = 10) {
      const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 10)));
      return topStmt.all(safeLimit);
    }
  };
}
