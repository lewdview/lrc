import { useState } from 'react';
import type { Line } from '../types/lyric';
import type { Flag, WordRef } from '../utils/review';
import { FLAG_HELP, FLAG_LABEL } from '../utils/review';
import { formatTimestamp, parseTimestampToMs } from '../utils/formatter';

interface InspectorProps {
  lines: Line[];
  flags: Flag[];
  selected: WordRef;
  playing: WordRef | null;
  currentTime: number;
  isPlaying: boolean;
  onSetTimestamp: (line: number, word: number, ms: number | null) => void;
  onNudge: (line: number, word: number, deltaMs: number) => void;
  onSpreadLine: (line: number) => void;
  onShiftFrom: (line: number, deltaMs: number) => void;
  onDeleteLine: (line: number) => void;
}

/** Live karaoke preview of the current line, plus the selected word's timing. */
export function Inspector({
  lines,
  flags,
  selected,
  playing,
  currentTime,
  isPlaying,
  onSetTimestamp,
  onNudge,
  onSpreadLine,
  onShiftFrom,
  onDeleteLine,
}: InspectorProps) {
  const previewLine = isPlaying && playing ? playing.line : selected.line;
  const line = lines[previewLine];
  const word = lines[selected.line]?.words[selected.word];
  const flag = word ? flags.find((f) => f.id === word.id) : undefined;
  const [draft, setDraft] = useState<{ id: string; text: string } | null>(null);

  const startText = word?.timestamp != null ? formatTimestamp(word.timestamp) : '';
  const shown = draft && word && draft.id === word.id ? draft.text : startText;

  const commitDraft = () => {
    if (!draft || !word) return;
    const ms = draft.text.trim() ? parseTimestampToMs(draft.text) : null;
    if (ms !== null || !draft.text.trim()) onSetTimestamp(selected.line, selected.word, ms);
    setDraft(null);
  };

  return (
    <aside className="inspector" aria-label="Preview and word timing">
      <span className="kicker">Live preview · as the main site shows it</span>
      <p className="preview-line" aria-live="off">
        {line && line.words.length > 0 ? (
          line.words.map((w) => {
            const sung = w.timestamp !== null && w.timestamp <= currentTime;
            const isSel = previewLine === selected.line && w.id === word?.id;
            return (
              <span key={w.id} className={`pw ${sung ? 'sung' : ''} ${isSel ? 'sel' : ''}`}>
                {w.text}{' '}
              </span>
            );
          })
        ) : (
          <span className="pw">…</span>
        )}
      </p>

      {word ? (
        <div className="wordcard">
          <div className="wordcard-head">
            <div>
              <span className="kicker">Selected word</span>
              <strong className="wordcard-word">{word.text}</strong>
            </div>
            <label className="field">
              <span className="kicker">Starts at</span>
              <input
                className="input input-time"
                value={shown}
                placeholder="not timed"
                onChange={(e) => setDraft({ id: word.id, text: e.target.value })}
                onBlur={commitDraft}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') setDraft(null);
                }}
              />
            </label>
          </div>
          <div className="wordcard-row">
            {[-100, -10, 10, 100].map((d) => (
              <button
                key={d}
                type="button"
                className="btn btn-sm"
                disabled={word.timestamp === null}
                onClick={() => onNudge(selected.line, selected.word, d)}
              >
                {d > 0 ? `+${d}` : d} ms
              </button>
            ))}
            <button type="button" className="btn btn-sm btn-on" onClick={() => onSetTimestamp(selected.line, selected.word, Math.round(currentTime))}>
              Starts now <kbd>T</kbd>
            </button>
            <button
              type="button"
              className="btn btn-sm"
              disabled={word.timestamp === null}
              onClick={() => onSetTimestamp(selected.line, selected.word, null)}
            >
              Clear
            </button>
          </div>
          {flag && (
            <div className="flagnote">
              <strong>{FLAG_LABEL[flag.reason]}</strong>
              <span>{FLAG_HELP[flag.reason]}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="inspector-empty">Select a word in the lyrics or on the lane.</p>
      )}

      {lines[selected.line] && (
        <div className="lineactions">
          <span className="kicker">Line {selected.line + 1}</span>
          <div className="lineactions-row">
            <button type="button" className="btn btn-sm" onClick={() => onShiftFrom(selected.line, -100)}>
              ← 100 ms
            </button>
            <button type="button" className="btn btn-sm" onClick={() => onShiftFrom(selected.line, 100)}>
              100 ms →
            </button>
            <span className="lineactions-note">moves this line and everything after it</span>
          </div>
          <div className="lineactions-row">
            <button type="button" className="btn btn-sm" onClick={() => onSpreadLine(selected.line)}>
              Spread words evenly
            </button>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={() => {
                if (window.confirm('Delete this line and its timings?')) onDeleteLine(selected.line);
              }}
            >
              Delete line
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
