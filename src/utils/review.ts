import type { Line, Word } from '../types/lyric';
import { generateId, splitIntoLyricLines } from './parser';

/** Why a word deserves a second look in review. */
export type FlagReason = 'untimed' | 'order' | 'stacked' | 'long';

export const FLAG_LABEL: Record<FlagReason, string> = {
  untimed: 'Not timed yet',
  order: 'Starts before the word in front of it',
  stacked: 'Starts on top of the next word',
  long: 'Held for a long time before the next word',
};

export const FLAG_HELP: Record<FlagReason, string> = {
  untimed: 'Press T while it plays, or tap the line again in Tap lines mode.',
  order: 'Drag it right on the lane, or nudge it with the . key.',
  stacked:
    'The transcript gave it the same start as the word after it, so the karaoke wipe would skip it. Drag one of them apart.',
  long: 'Usually the transcript missed where this word really starts or the next one begins. Loop the line and check.',
};

// Two words starting this close together means one of them was never really timed.
const STACKED_MS = 40;
// A gap this long inside one line is almost always a mistimed word.
const LONG_MS = 2500;

export interface WordRef {
  line: number;
  word: number;
}

export interface Flag extends WordRef {
  id: string;
  reason: FlagReason;
}

/** Every word worth a second look, in song order. */
export function computeFlags(lines: Line[]): Flag[] {
  const flags: Flag[] = [];
  const flat: Array<WordRef & { w: Word }> = [];
  lines.forEach((line, l) => line.words.forEach((w, i) => flat.push({ line: l, word: i, w })));

  // Index of the next timed word after each position.
  const nextTimed = new Array<number>(flat.length).fill(-1);
  for (let i = flat.length - 2, n = -1; i >= 0; i--) {
    if (flat[i + 1].w.timestamp !== null) n = i + 1;
    nextTimed[i] = n;
  }

  let prevTs: number | null = null;
  flat.forEach((entry, i) => {
    const ts = entry.w.timestamp;
    const push = (reason: FlagReason) =>
      flags.push({ id: entry.w.id, line: entry.line, word: entry.word, reason });
    if (ts === null) {
      push('untimed');
      return;
    }
    if (prevTs !== null && ts < prevTs) {
      push('order');
      prevTs = ts;
      return;
    }
    prevTs = ts;

    const next = nextTimed[i] >= 0 ? flat[nextTimed[i]] : null;
    if (!next || next.w.timestamp === null) return;
    const gap = next.w.timestamp - ts;
    if (gap >= 0 && gap < STACKED_MS) push('stacked');
    else if (next.line === entry.line && gap > LONG_MS) push('long');
  });
  return flags;
}

export const cleanToken = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Line the new words up against the old ones (longest common subsequence on the
 * cleaned text). A word that survived the edit keeps its id and time; a new or changed
 * word comes back untimed. Changing only punctuation or case keeps the time too.
 */
export function realignWords(oldWords: Word[], newTexts: string[]): Word[] {
  const a = oldWords.map((w) => cleanToken(w.text));
  const b = newTexts.map(cleanToken);
  const n = a.length;
  const m = b.length;
  // dp[i][j] = LCS length of a[i..] and b[j..]
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const result: Word[] = newTexts.map((text) => ({ id: generateId(), text, timestamp: null }));
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      result[j] = { id: oldWords[i].id, text: newTexts[j], timestamp: oldWords[i].timestamp };
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }

  // An edited word sitting where exactly one old word was dropped ("Cause" → "'Cause",
  // "flip-flop" → "flip-flops") keeps that word's time.
  i = 0;
  j = 0;
  const oldIndex = new Map(oldWords.map((o, x) => [o.id, x]));
  const kept = { has: (id: string) => oldIndex.has(id) };
  while (j < m) {
    if (kept.has(result[j].id)) {
      i = (oldIndex.get(result[j].id) as number) + 1;
      j++;
      continue;
    }
    // run of new words result[j..k), and the old words between the surrounding matches
    let k = j;
    while (k < m && !kept.has(result[k].id)) k++;
    let end = n;
    if (k < m) end = oldIndex.get(result[k].id) as number;
    const oldRun = oldWords.slice(i, end);
    if (oldRun.length === k - j) {
      oldRun.forEach((o, x) => {
        result[j + x] = { id: o.id, text: newTexts[j + x], timestamp: o.timestamp };
      });
    }
    i = end;
    j = k;
  }
  return result;
}

const tokens = (text: string) => (text.trim() ? text.trim().split(/\s+/) : []);
// Pasted lines longer than this are almost certainly two sung lines (see parser.ts).
const LONG_LINE_WORDS = 14;

/**
 * Replace `count` lines starting at `start` with new line texts, keeping the time of every
 * word that survives. This one operation backs typing in a line, splitting it (Enter),
 * joining it to the line above (Backspace), deleting it, and pasting a whole new set of
 * lyrics over the song.
 */
export function replaceLineTexts(
  lines: Line[],
  start: number,
  count: number,
  newTexts: string[],
  { splitRunOns = false } = {}
): Line[] {
  const oldWords = lines.slice(start, start + count).flatMap((l) => l.words);
  let groups = newTexts.map(tokens);
  if (splitRunOns) {
    groups = groups.flatMap((g) => (g.length > LONG_LINE_WORDS ? splitIntoLyricLines(g) : [g]));
  }
  const aligned = realignWords(oldWords, groups.flat());
  let p = 0;
  const oldIds = lines.slice(start, start + count).map((l) => l.id);
  const rebuilt: Line[] = groups.map((g, gi) => ({
    id: oldIds[gi] ?? generateId(),
    words: g.map(() => aligned[p++]),
  }));
  return [...lines.slice(0, start), ...rebuilt, ...lines.slice(start + count)];
}

export const lineText = (line: Line) => line.words.map((w) => w.text).join(' ');

/** First timed word of the first line after `lineIndex` that has one. */
export function nextLineStart(lines: Line[], lineIndex: number): number | null {
  for (let l = lineIndex + 1; l < lines.length; l++) {
    const w = lines[l].words.find((x) => x.timestamp !== null);
    if (w) return w.timestamp;
  }
  return null;
}

export function lineStart(line: Line): number | null {
  const w = line.words.find((x) => x.timestamp !== null);
  return w ? w.timestamp : null;
}

/**
 * Time a whole line from one tap at `startMs`. A line whose words are already timed in
 * order keeps its shape and just moves; otherwise its words are spread by length until the
 * next line starts (or about a fifth of a second per letter when nothing follows).
 */
export function timeLineFromTap(lines: Line[], lineIndex: number, startMs: number): Line[] {
  const line = lines[lineIndex];
  if (!line || line.words.length === 0) return lines;
  const ts = line.words.map((w) => w.timestamp);
  const allTimed = ts.every((t): t is number => t !== null);
  const inOrder = allTimed && ts.every((t, i) => i === 0 || (t as number) >= (ts[i - 1] as number));

  let words: Word[];
  if (allTimed && inOrder) {
    const delta = startMs - (ts[0] as number);
    words = line.words.map((w) => ({ ...w, timestamp: Math.max(0, (w.timestamp as number) + delta) }));
  } else {
    const weights = line.words.map((w) => cleanToken(w.text).length + 2);
    const total = weights.reduce((s, x) => s + x, 0);
    const next = nextLineStart(lines, lineIndex);
    const natural = total * 65;
    const span = next !== null && next > startMs ? Math.min(next - startMs - 120, natural * 1.6) : natural;
    const usable = Math.max(span, line.words.length * 120);
    let acc = 0;
    words = line.words.map((w, i) => {
      const t = Math.round(startMs + (acc / total) * usable);
      acc += weights[i];
      return { ...w, timestamp: t };
    });
  }
  return lines.map((l, i) => (i === lineIndex ? { ...l, words } : l));
}

/** Spread a line's words evenly by length between its first word and the next line. */
export function spreadLineEvenly(lines: Line[], lineIndex: number): Line[] {
  const start = lineStart(lines[lineIndex]);
  if (start === null) return lines;
  const cleared = lines.map((l, i) =>
    i === lineIndex ? { ...l, words: l.words.map((w) => ({ ...w, timestamp: null })) } : l
  );
  return timeLineFromTap(cleared, lineIndex, start);
}

/** Move every word from `lineIndex` to the end of the song by `deltaMs`. */
export function shiftFromLine(lines: Line[], lineIndex: number, deltaMs: number): Line[] {
  return lines.map((l, i) =>
    i < lineIndex
      ? l
      : { ...l, words: l.words.map((w) => (w.timestamp === null ? w : { ...w, timestamp: Math.max(0, w.timestamp + deltaMs) })) }
  );
}

/** The word sounding at `timeMs`: the last timed word that has started. */
export function wordAt(lines: Line[], timeMs: number): WordRef | null {
  let best: WordRef | null = null;
  let bestTs = -1;
  lines.forEach((line, l) =>
    line.words.forEach((w, i) => {
      if (w.timestamp !== null && w.timestamp <= timeMs && w.timestamp >= bestTs) {
        bestTs = w.timestamp;
        best = { line: l, word: i };
      }
    })
  );
  return best;
}

/**
 * Set one word's start. Words after it that would now start before it (words the
 * transcript stacked on one time) are pushed along, spaced evenly up to the next word that
 * already started later, so song order holds.
 */
export function moveWord(lines: Line[], ref: WordRef, ms: number): Line[] {
  const flat: Array<WordRef & { ts: number | null }> = [];
  lines.forEach((line, l) => line.words.forEach((w, i) => flat.push({ line: l, word: i, ts: w.timestamp })));
  const at = flat.findIndex((f) => f.line === ref.line && f.word === ref.word);
  if (at < 0) return lines;

  const updates = new Map<string, number>([[`${ref.line}:${ref.word}`, ms]]);
  const pushed: typeof flat = [];
  let limit: number | null = null;
  for (let i = at + 1; i < flat.length; i++) {
    const ts = flat[i].ts;
    if (ts === null) continue;
    if (ts <= ms) pushed.push(flat[i]);
    else {
      limit = ts;
      break;
    }
  }
  if (pushed.length) {
    const step = limit !== null ? Math.min(250, (limit - ms) / (pushed.length + 1)) : 250;
    pushed.forEach((f, i) => updates.set(`${f.line}:${f.word}`, Math.round(ms + step * (i + 1))));
  }
  return lines.map((line, l) => ({
    ...line,
    words: line.words.map((w, i) => {
      const u = updates.get(`${l}:${i}`);
      return u === undefined ? w : { ...w, timestamp: u };
    }),
  }));
}
