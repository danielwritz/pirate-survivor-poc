/**
 * Pirate Survivor — Multiplayer game server (v1 vertical slice).
 *
 * - Serves static files for the client
 * - Runs authoritative game simulation at 20 ticks/sec
 * - Accepts WebSocket connections for player input
 * - Broadcasts state to all connected clients
 *
 * Usage: node server/index.js
 */

import { createServer } from 'http';
import { readFile, appendFile } from 'fs/promises';
import { extname, join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

// ─── Logging ───
const LOG_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'server.log');
const _ts = () => new Date().toISOString();
function log(...args) {
  const line = `[${_ts()}] ${args.join(' ')}`;
  console.log(line);
  appendFile(LOG_FILE, line + '\n').catch(() => {});
}
function logErr(...args) {
  const line = `[${_ts()}] ERROR: ${args.join(' ')}`;
  console.error(line);
  appendFile(LOG_FILE, line + '\n').catch(() => {});
}

// ─── Global crash guards ───
process.on('uncaughtException', (err) => {
  logErr('uncaughtException:', err?.stack || err);
});
process.on('unhandledRejection', (reason) => {
  logErr('unhandledRejection:', reason?.stack || reason);
});

import {
  createSimulation,
  addPlayer,
  removePlayer,
  setPlayerInput,
  playerFireCannon,
  playerSelectUpgrade,
  tick,
  getStateSnapshot,
  TICK_RATE,
  TICK_INTERVAL
} from './simulation.js';
import { createLeaderboardStore } from './leaderboardStore.js';

// --- Configuration ---
const PORT = parseInt(process.env.PORT || '3000', 10);
const ACTIVE_PLAYER_LIMIT = 10;
const GLOBAL_LEADERBOARD_LIMIT = 100;
const LEADERBOARD_DB_PATH = (process.env.LEADERBOARD_DB_PATH || '').trim() || undefined;
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// MIME types for static file serving
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// --- Static file server ---
const httpServer = createServer(async (req, res) => {
  let path = req.url.split('?')[0];
  if (path === '/') path = '/mp.html';

  const filePath = join(ROOT, path);

  // Prevent directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch (err) {
    log(`404 ${req.url}`);
    res.writeHead(404);
    res.end('Not found');
  }
});

// --- WebSocket server ---
const wss = new WebSocketServer({ server: httpServer });
let sim = null; // Will be set after async init
let leaderboardStore = null;

// Map WebSocket → playerId
const socketToPlayer = new Map();

function getSocketByPlayerId(playerId) {
  for (const [socket, id] of socketToPlayer) {
    if (id === playerId) return socket;
  }
  return null;
}

function rebalanceActiveSlots() {
  if (!sim) return;
  let idx = 0;
  for (const [playerId, pd] of sim.players) {
    const shouldSpectate = idx >= ACTIVE_PLAYER_LIMIT;
    const changed = pd.spectator !== shouldSpectate;
    pd.spectator = shouldSpectate;
    idx++;

    if (!changed) continue;
    const socket = getSocketByPlayerId(playerId);
    if (!socket || socket.readyState !== 1) continue;
    socket.send(JSON.stringify({
      type: 'roleUpdate',
      spectator: shouldSpectate,
      activePlayerLimit: ACTIVE_PLAYER_LIMIT
    }));
  }
}

wss.on('connection', (ws) => {
  let playerId = null;

  ws.on('error', (err) => {
    logErr(`WebSocket error (player ${playerId}):`, err?.message || err);
  });

  ws.on('message', (raw) => {
    if (!sim) return; // Not ready yet
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'join': {
        if (playerId !== null) return; // Already joined
        const name = (typeof msg.name === 'string' ? msg.name.trim().slice(0, 20) : '') || undefined;
        playerId = addPlayer(sim, name);
        socketToPlayer.set(ws, playerId);
        rebalanceActiveSlots();
        const joinedPd = sim.players.get(playerId);
        const startingOffer = joinedPd?.ship?.upgradeOffer ?? null;
        const startingPicksRemaining = joinedPd?.ship?.startingPicksRemaining ?? 0;
        ws.send(JSON.stringify({
          type: 'joined',
          id: playerId,
          roundSeed: sim.roundSeed,
          startingOffer,
          startingPicksRemaining,
          spectator: !!joinedPd?.spectator,
          activePlayerLimit: ACTIVE_PLAYER_LIMIT,
          persistentLeaderboard: sim.persistentLeaderboard
        }));
        log(`Player ${playerId} (${name || 'unnamed'}) joined. Total: ${sim.players.size}`);
        break;
      }

      case 'input': {
        if (playerId === null) return;
        const pd = sim.players.get(playerId);
        if (!pd || pd.spectator) return;
        setPlayerInput(sim, playerId, msg);
        break;
      }

      case 'cannonFire': {
        if (playerId === null) return;
        const pd = sim.players.get(playerId);
        if (!pd || pd.spectator) return;
        const aim = typeof msg.angle === 'number' ? msg.angle : 0;
        playerFireCannon(sim, playerId, aim);
        break;
      }

      case 'selectUpgrade': {
        if (playerId === null) return;
        const pd = sim.players.get(playerId);
        if (!pd || pd.spectator) return;
        const idx = typeof msg.index === 'number' ? Math.floor(msg.index) : -1;
        const result = playerSelectUpgrade(sim, playerId, idx);
        if (result) {
          ws.send(JSON.stringify({ type: 'upgradeApplied', ...result }));
        }
        break;
      }

      case 'chat': {
        if (playerId === null) return;
        const text = typeof msg.text === 'string' ? msg.text.trim().slice(0, 200) : '';
        if (!text) return;
        const pd = sim.players.get(playerId);
        const chatMsg = JSON.stringify({
          type: 'chat',
          id: playerId,
          name: pd?.ship?.name || `Player ${playerId}`,
          text
        });
        for (const client of wss.clients) {
          if (client.readyState === 1) client.send(chatMsg);
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    if (playerId !== null) {
      log(`Player ${playerId} disconnected. Remaining: ${sim.players.size - 1}`);
      removePlayer(sim, playerId);
      socketToPlayer.delete(ws);
      rebalanceActiveSlots();
    }
  });
});

// --- Game loop ---
function broadcastState() {
  if (!sim) return;
  const snapshot = JSON.stringify(getStateSnapshot(sim));
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(snapshot);
  }
}

// --- Start (async — loads catalogs before beginning tick loop) ---
async function start() {
  leaderboardStore = createLeaderboardStore(LEADERBOARD_DB_PATH);
  sim = await createSimulation();
  sim.activePlayerLimit = ACTIVE_PLAYER_LIMIT;
  sim.persistentLeaderboard = leaderboardStore.getTopScores(GLOBAL_LEADERBOARD_LIMIT);
  sim.onRoundEnded = (roundSummary) => leaderboardStore.saveRoundSummary(roundSummary, GLOBAL_LEADERBOARD_LIMIT);
  console.log('Simulation initialized (upgrade catalog loaded).');
  log(`Leaderboard DB path: ${leaderboardStore.dbPath}`);

  setInterval(() => {
    try {
      tick(sim);
      broadcastState();
    } catch (err) {
      logErr('Tick error:', err?.stack || err);
    }
  }, TICK_INTERVAL * 1000);

  httpServer.listen(PORT, () => {
    log(`Pirate Survivor server running on http://localhost:${PORT}`);
    log(`Tick rate: ${TICK_RATE} Hz | Round: 10 min`);
    log(`Open http://localhost:${PORT} in your browser to play.`);
  });
}

start().catch(err => {
  logErr('Failed to start server:', err?.stack || err);
  process.exit(1);
});
