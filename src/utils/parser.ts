import type { Line, Word } from '../types/lyric';

/**
 * Generates a simple unique ID for lyrics parsing
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Parses raw text lyrics into lines and words, preserving punctuation
 * and ignoring multiple spaces.
 */
export function parseLyrics(rawText: string): Line[] {
  if (!rawText.trim()) return [];

  // Split by line breaks, normalize carriage returns
  const rawLines = rawText.split(/\r?\n/);

  return rawLines.map((lineText) => {
    // Trim and split by whitespace, ignoring duplicate spaces
    const trimmed = lineText.trim();
    const rawWords = trimmed ? trimmed.split(/\s+/) : [];

    const words = rawWords.map((wordText) => ({
      id: generateId(),
      text: wordText,
      timestamp: null,
    }));

    return {
      id: generateId(),
      words,
    };
  });
}

interface DBWord {
  word: string;
  start: number;
  end: number;
}

interface DBSegment {
  text: string;
  start: number;
  end: number;
}

/**
 * Reconstructs lines and words with timestamps from database segments and words list
 */
export function reconstructLinesFromAnalysis(segments: DBSegment[], dbWords: DBWord[]): Line[] {
  if (!segments || segments.length === 0) return [];
  
  let wordPointer = 0;

  return segments.map((seg) => {
    const rawWords = seg.text.trim() ? seg.text.trim().split(/\s+/) : [];
    
    const words: Word[] = rawWords.map((wordText) => {
      let matchedTimestamp: number | null = null;
      
      // Look for a matching word in the sequential words list
      // Clean both words to handle potential punctuation mismatch
      const cleanTarget = wordText.toLowerCase().replace(/[^a-z0-9]/g, '');

      let tempPointer = wordPointer;
      while (tempPointer < dbWords.length) {
        const candidate = dbWords[tempPointer];
        const cleanCandidate = candidate.word.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        if (cleanCandidate === cleanTarget || cleanCandidate.includes(cleanTarget) || cleanTarget.includes(cleanCandidate)) {
          // Word matched! Use its start timestamp in milliseconds
          matchedTimestamp = Math.round(candidate.start * 1000);
          wordPointer = tempPointer + 1; // Advance pointer past this match
          break;
        }
        tempPointer++;
      }

      // Fallback to segment start if not matched
      if (matchedTimestamp === null && seg.start !== undefined) {
        matchedTimestamp = Math.round(seg.start * 1000);
      }

      return {
        id: generateId(),
        text: wordText,
        timestamp: matchedTimestamp,
      };
    });

    return {
      id: generateId(),
      words,
    };
  });
}
