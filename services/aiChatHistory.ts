import type { SQLiteDatabase } from 'expo-sqlite';
import { getKv, setKv } from '@/database/kv';
import type { ChatMessage } from './aiAssistant';

const CHAT_HISTORY_KEY = 'ai_chat_history';
// Caps the persisted transcript so a long-lived chat doesn't grow this kv row without
// bound — oldest messages are dropped first, same trade-off as MAX_HISTORY_TURNS in
// aiAssistant.ts (which caps how much of this the model itself sees, separately).
const MAX_STORED_MESSAGES = 200;

export type StoredChatMessage = ChatMessage & { at: number };

export async function loadChatHistory(db: SQLiteDatabase): Promise<StoredChatMessage[] | null> {
  const raw = await getKv(db, CHAT_HISTORY_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveChatHistory(db: SQLiteDatabase, messages: StoredChatMessage[]): void {
  const trimmed = messages.length > MAX_STORED_MESSAGES ? messages.slice(messages.length - MAX_STORED_MESSAGES) : messages;
  setKv(db, CHAT_HISTORY_KEY, JSON.stringify(trimmed)).catch(() => {});
}

export async function clearChatHistory(db: SQLiteDatabase): Promise<void> {
  await setKv(db, CHAT_HISTORY_KEY, JSON.stringify([]));
}
