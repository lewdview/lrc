import type { Line } from '../types/lyric';

const newId = () => Math.random().toString(36).slice(2, 11);
const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** The shape the main site's karaoke view reads (seconds), same as release-data.json. */
export interface TimedWord {
  word: string;
  start: number;
  end: number;
}

export interface TimedSegment {
  text: string;
  start: number;
  end: number;
}

export interface Timings {
  /** Plain lyrics, one line per lyric line, no timestamps. */
  lyrics: string;
  words: TimedWord[];
  segments: TimedSegment[];
}

const LAST_WORD_SECONDS = 0.8;
// A word held across an instrumental gap would stay lit for the whole gap.
const MAX_WORD_SECONDS = 2;
const round = (s: number) => Math.round(s * 1000) / 1000;

/**
 * Convert synced lines into word and segment timings. Only synced words are listed; a word
 * ends where the next synced word starts. `offsetMs` follows the LRC [offset] tag: a positive
 * value shows lyrics earlier.
 */
export function linesToTimings(lines: Line[], offsetMs = 0): Timings {
  const lyrics = lines.map((line) => line.words.map((w) => w.text).join(' ')).join('\n');
  const toSec = (ms: number) => Math.max(0, ms - offsetMs) / 1000;

  const synced = lines.flatMap((line, lineIndex) =>
    line.words
      .filter((w) => w.timestamp !== null)
      .map((w) => ({ lineIndex, text: w.text, start: toSec(w.timestamp as number) }))
  );
  synced.sort((a, b) => a.start - b.start);

  const words: TimedWord[] = synced.map((w, i) => ({
    word: w.text,
    start: round(w.start),
    end: round(Math.max(w.start, Math.min(synced[i + 1]?.start ?? w.start + LAST_WORD_SECONDS, w.start + MAX_WORD_SECONDS))),
  }));

  const segments: TimedSegment[] = [];
  lines.forEach((line, lineIndex) => {
    const own = words.filter((_, i) => synced[i].lineIndex === lineIndex);
    if (line.words.length === 0 || own.length === 0) return;
    segments.push({
      text: line.words.map((w) => w.text).join(' '),
      start: own[0].start,
      end: own[own.length - 1].end,
    });
  });

  return { lyrics, words, segments };
}

const MONTH_OFFSETS: Record<string, number> = {
  january: 0, february: 31, march: 59, april: 90, may: 120, june: 151,
  july: 181, august: 212, september: 243, october: 273, november: 304, december: 334,
};

/** Day of the 365 project (2026, not a leap year) for a catalog month and day of month. */
export function dayOfYear(month: string, dayOfMonth: number): number | null {
  const offset = MONTH_OFFSETS[month.toLowerCase()];
  if (offset === undefined || !Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) return null;
  return offset + dayOfMonth;
}

/**
 * Rebuild editor lines from published timings: the plain lyrics give every line (blank and
 * unsynced ones included), and timed words are matched onto them in order.
 */
export function timingsToLines(timings: Timings): Line[] {
  let pointer = 0;
  return timings.lyrics.split(/\r?\n/).map((lineText) => {
    const texts = lineText.trim() ? lineText.trim().split(/\s+/) : [];
    return {
      id: newId(),
      words: texts.map((text) => {
        let timestamp: number | null = null;
        const target = clean(text);
        // Look a few words ahead so one unsynced word doesn't shift everything after it.
        for (let i = pointer; i < Math.min(timings.words.length, pointer + 4); i++) {
          if (clean(timings.words[i].word) === target) {
            timestamp = Math.round(timings.words[i].start * 1000);
            pointer = i + 1;
            break;
          }
        }
        return { id: newId(), text, timestamp };
      }),
    };
  });
}
