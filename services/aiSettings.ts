import type { SQLiteDatabase } from 'expo-sqlite';
import { getKv, setKv } from '@/database/kv';

export type AnswerMode = 'offline' | 'online';
const ANSWER_MODE_KEY = 'ai_answer_mode';

export async function getAnswerMode(db: SQLiteDatabase): Promise<AnswerMode> {
  const v = await getKv(db, ANSWER_MODE_KEY);
  return v === 'online' ? 'online' : 'offline';
}

export async function setAnswerMode(db: SQLiteDatabase, mode: AnswerMode): Promise<void> {
  await setKv(db, ANSWER_MODE_KEY, mode);
}
