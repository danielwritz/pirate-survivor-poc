import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { createChatStore } from '../server/chatStore.js';

describe('chatStore', () => {
  it('persists chat history across store re-initialization', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pirate-chat-store-'));
    const dbPath = join(dir, 'chat.sqlite');

    try {
      const first = createChatStore(dbPath);
      first.saveMessage(1, 'Anne', 'Ahoy');
      first.saveMessage(2, 'Blackbeard', 'Ready to sail');

      const second = createChatStore(dbPath);
      const history = second.getHistory(200);

      if (first.mode === 'sqlite' && second.mode === 'sqlite') {
        expect(history).toHaveLength(2);
        expect(history[0]).toMatchObject({ playerId: 1, name: 'Anne', text: 'Ahoy' });
        expect(history[1]).toMatchObject({ playerId: 2, name: 'Blackbeard', text: 'Ready to sail' });
      } else {
        // Memory fallback is process-local and intentionally non-durable.
        expect(first.mode).toBe('memory');
        expect(second.mode).toBe('memory');
        expect(history).toHaveLength(0);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('returns last N messages in chronological order', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pirate-chat-store-'));
    const dbPath = join(dir, 'chat.sqlite');

    try {
      const store = createChatStore(dbPath);
      for (let i = 1; i <= 6; i++) {
        store.saveMessage(i, `P${i}`, `m${i}`);
      }

      const replay = store.getHistory(3);
      expect(replay.map((row) => row.text)).toEqual(['m4', 'm5', 'm6']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
