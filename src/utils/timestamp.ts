import type { LyricsDocument } from '../types/lyric';

/**
 * Adjusts a timestamp by a delta, ensuring it doesn't go below 0
 */
export function adjustTimestamp(ms: number | null, delta: number): number | null {
  if (ms === null) return null;
  return Math.max(0, ms + delta);
}

/**
 * Serializes the lyrics document to a string for local storage saving
 */
export function serialize(doc: LyricsDocument): string {
  return JSON.stringify(doc);
}

/**
 * Deserializes the lyrics document from local storage
 */
export function deserialize(jsonStr: string): LyricsDocument | null {
  try {
    return JSON.parse(jsonStr) as LyricsDocument;
  } catch (e) {
    console.error('Failed to deserialize lyrics document', e);
    return null;
  }
}
