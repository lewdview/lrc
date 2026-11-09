import type { Line, Word } from '../types/lyric';

/**
 * Generates a simple unique ID for lyrics parsing
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// "I", "I'm", "I'll"… are capitalised mid-line, so they never start a new line.
const PRONOUN_I = /^I('(m|ma|ll|ve|d|s))?[,.!?]*$/;
const SENTENCE_END = /[.!?]["')\]]*$/;
// A line this long almost certainly holds more than one sung line.
const LONG_LINE_WORDS = 14;

/**
 * Split a run of words into lyric lines. The release transcripts carry no line breaks, and
 * their segments usually hold two sung lines ("…baby, yeah Can you feel it…"), but every
 * sung line starts with a capital. A new line starts at a capitalised word unless it is
 * "I"/"I'm"…, follows a comma (a name: "Oh, Lord"), or would leave a one-word line behind.
 */
export function splitIntoLyricLines(tokens: string[]): string[][] {
  const lines: string[][] = [];
  let current: string[] = [];
  tokens.forEach((token, i) => {
    const prev = current[current.length - 1];
    const remaining = tokens.length - i;
    const capital = /^["'(\[]?[A-Z]/.test(token) && !PRONOUN_I.test(token);
    const breakHere =
      current.length > 0 &&
      ((prev !== undefined && SENTENCE_END.test(prev) && remaining >= 2) ||
        (capital && current.length >= 2 && remaining >= 2 && !prev!.endsWith(',')));
    if (breakHere) {
      lines.push(current);
      current = [];
    }
    current.push(token);
  });
  if (current.length) lines.push(current);
  return lines;
}

const toWords = (texts: string[]): Word[] =>
  texts.map((text) => ({ id: generateId(), text, timestamp: null }));

/**
 * Parses raw text lyrics into lines and words, preserving punctuation and ignoring
 * multiple spaces. Lines the user broke stay as they are; a run-on line (pasted
 * transcripts have no line breaks at all) is split at its sung-line starts.
 */
export function parseLyrics(rawText: string): Line[] {
  if (!rawText.trim()) return [];

  return rawText.split(/\r?\n/).flatMap((lineText) => {
    const tokens = lineText.trim() ? lineText.trim().split(/\s+/) : [];
    const groups = tokens.length > LONG_LINE_WORDS ? splitIntoLyricLines(tokens) : [tokens];
    return groups.map((group) => ({ id: generateId(), words: toWords(group) }));
  });
}

/** Split run-on lines (more than LONG_LINE_WORDS, or two sung lines glued together) keeping timestamps. */
export function splitRunOnLines(lines: Line[]): Line[] {
  return lines.flatMap((line) => {
    const groups = splitIntoLyricLines(line.words.map((w) => w.text));
    if (groups.length < 2) return [line];
    let i = 0;
    return groups.map((group) => ({
      id: generateId(),
      words: group.map(() => line.words[i++]),
    }));
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

const cleanWord = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// Punctuation-only tokens ("-", "...") clean to "", and "" is a substring of everything, so
// they only ever match each other.
function sameWord(a: string, b: string): boolean {
  if (!a || !b) return a === b;
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Reconstructs lines and words with timestamps from the release data's transcript segments
 * and word list. Each segment is split into its sung lines (segments usually hold two).
 */
export function reconstructLinesFromAnalysis(segments: DBSegment[], dbWords: DBWord[]): Line[] {
  if (!segments || segments.length === 0) return [];

  let wordPointer = 0;

  return segments.flatMap((seg) => {
    const rawWords = seg.text.trim() ? seg.text.trim().split(/\s+/) : [];

    const words: Word[] = rawWords.map((wordText) => {
      let matchedTimestamp: number | null = null;
      const cleanTarget = cleanWord(wordText);

      // Walk the sequential word list for the next matching word.
      for (let i = wordPointer; i < dbWords.length; i++) {
        if (sameWord(cleanWord(dbWords[i].word), cleanTarget)) {
          matchedTimestamp = Math.round(dbWords[i].start * 1000);
          wordPointer = i + 1;
          break;
        }
      }

      // Fallback to segment start if not matched
      if (matchedTimestamp === null && seg.start !== undefined) {
        matchedTimestamp = Math.round(seg.start * 1000);
      }

      return { id: generateId(), text: wordText, timestamp: matchedTimestamp };
    });

    return splitRunOnLines([{ id: generateId(), words }]);
  });
}
