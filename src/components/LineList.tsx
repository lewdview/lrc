import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Line } from '../types/lyric';
import type { Flag, WordRef } from '../utils/review';
import { lineStart, lineText } from '../utils/review';
import { formatTimestamp } from '../utils/formatter';

interface LineListProps {
  lines: Line[];
  flags: Flag[];
  selected: WordRef;
  playing: WordRef | null;
  onSelect: (line: number, word: number) => void;
  onSeek: (ms: number) => void;
  /** Replace `count` lines at `start` with these texts; returns nothing, timings carry over. */
  onReplaceLines: (start: number, count: number, texts: string[], select: WordRef) => void;
}

interface Editing {
  line: number;
  caret: number;
}

/**
 * The lyrics, one row per sung line. Click a word to select it; double-click a line (or
 * press E) to type in it. While typing, Enter splits the line at the caret, Backspace at the
 * start joins it to the line above, and ↑/↓ move between lines. Words that survive an edit
 * keep their timing.
 */
export function LineList({ lines, flags, selected, playing, onSelect, onSeek, onReplaceLines }: LineListProps) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const flagged = useMemo(() => new Map(flags.map((f) => [f.id, f.reason])), [flags]);

  const startEditing = (line: number, caret?: number) => {
    const text = lines[line] ? lineText(lines[line]) : '';
    setDraft(text);
    setEditing({ line, caret: caret ?? text.length });
  };

  // Let the rest of the app open the editor on the selected line (E key).
  useEffect(() => {
    const open = () => startEditing(selected.line);
    window.addEventListener('lrc:edit-line', open);
    return () => window.removeEventListener('lrc:edit-line', open);
  });

  useLayoutEffect(() => {
    if (!editing || !inputRef.current) return;
    inputRef.current.focus();
    inputRef.current.setSelectionRange(editing.caret, editing.caret);
  }, [editing]);

  // Keep the selected (or playing) line in view.
  const focusLine = playing?.line ?? selected.line;
  useEffect(() => {
    const row = listRef.current?.querySelector<HTMLElement>(`[data-line="${focusLine}"]`);
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusLine]);

  // Set while Enter/Backspace restructure lines, so the input's blur as it unmounts doesn't
  // commit the stale draft a second time.
  const restructuring = useRef(false);

  const commit = (next?: Editing | null) => {
    if (!editing || restructuring.current) return;
    const original = lines[editing.line] ? lineText(lines[editing.line]) : '';
    if (draft !== original) onReplaceLines(editing.line, 1, [draft], { line: editing.line, word: 0 });
    if (next) startEditingAfterChange(next);
    else setEditing(null);
  };

  // After a change the lines prop updates on the next render; read the text then.
  const pending = useRef<Editing | null>(null);
  const startEditingAfterChange = (next: Editing) => {
    pending.current = next;
    restructuring.current = true;
    setEditing(null);
  };
  useEffect(() => {
    restructuring.current = false;
    if (!pending.current) return;
    const next = pending.current;
    pending.current = null;
    if (next.line >= 0 && next.line < lines.length) startEditing(next.line, next.caret);
  });

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!editing) return;
    const input = e.currentTarget;
    const caret = input.selectionStart ?? draft.length;
    const atStart = caret === 0 && input.selectionEnd === 0;

    if (e.key === 'Escape') {
      e.preventDefault();
      setEditing(null);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const before = draft.slice(0, caret).trimEnd();
      const after = draft.slice(caret).trimStart();
      onReplaceLines(editing.line, 1, [before, after], { line: editing.line + 1, word: 0 });
      startEditingAfterChange({ line: editing.line + 1, caret: 0 });
      return;
    }
    if (e.key === 'Backspace' && atStart && editing.line > 0) {
      e.preventDefault();
      const prev = lineText(lines[editing.line - 1]);
      const joined = [prev, draft.trim()].filter(Boolean).join(' ');
      onReplaceLines(editing.line - 1, 2, [joined], { line: editing.line - 1, word: 0 });
      startEditingAfterChange({ line: editing.line - 1, caret: prev.length + (prev && draft.trim() ? 1 : 0) });
      return;
    }
    if (e.key === 'ArrowUp' && editing.line > 0) {
      e.preventDefault();
      commit({ line: editing.line - 1, caret: Math.min(caret, lineText(lines[editing.line - 1]).length) });
      return;
    }
    if (e.key === 'ArrowDown' && editing.line < lines.length - 1) {
      e.preventDefault();
      commit({ line: editing.line + 1, caret: Math.min(caret, lineText(lines[editing.line + 1]).length) });
    }
  };

  if (lines.length === 0) {
    return (
      <div className="lines-empty">
        <p>Pick a song from the catalog, or paste lyrics to start.</p>
      </div>
    );
  }

  return (
    <div className="lines" ref={listRef} role="list" aria-label="Lyric lines">
      {lines.map((line, l) => {
        const start = lineStart(line);
        const isSelected = l === selected.line;
        const isPlaying = playing?.line === l;
        const isEditing = editing?.line === l;
        const lineFlags = line.words.filter((w) => flagged.has(w.id)).length;
        return (
          <div
            key={line.id}
            role="listitem"
            data-line={l}
            className={`lrow ${isSelected ? 'selected' : ''} ${isPlaying ? 'playing' : ''}`}
            onDoubleClick={() => !isEditing && startEditing(l)}
          >
            <button
              type="button"
              className="lrow-time"
              onClick={() => start !== null && onSeek(start)}
              disabled={start === null}
              title={start === null ? 'Not timed yet' : 'Play from here'}
            >
              {start === null ? '— —' : formatTimestamp(start)}
            </button>

            {isEditing ? (
              <input
                ref={inputRef}
                className="lrow-input"
                aria-label={`Edit line ${l + 1}`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                onBlur={() => commit(null)}
              />
            ) : (
              <div className="lrow-words">
                {line.words.length === 0 && <span className="lrow-blank">(pause)</span>}
                {line.words.map((w, i) => {
                  const reason = flagged.get(w.id);
                  const cls = [
                    'lword',
                    w.timestamp === null && 'untimed',
                    reason && 'flagged',
                    isSelected && i === selected.word && 'active',
                    isPlaying && playing?.word === i && 'now',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <button
                      type="button"
                      key={w.id}
                      className={cls}
                      onClick={() => {
                        onSelect(l, i);
                        if (w.timestamp !== null) onSeek(w.timestamp);
                      }}
                    >
                      {w.text}
                    </button>
                  );
                })}
              </div>
            )}

            {!isEditing && (
              <span className="lrow-meta">
                {lineFlags > 0 && <span className="lrow-flags" title="Words to check">{lineFlags}</span>}
                <button type="button" className="lrow-edit" onClick={() => startEditing(l)} aria-label={`Edit line ${l + 1}`}>
                  Edit
                </button>
              </span>
            )}
          </div>
        );
      })}
      <p className="lines-hint">
        Double-click a line to type in it. <kbd>Enter</kbd> splits it, <kbd>⌫</kbd> at the start joins it to the line
        above, and words you don&rsquo;t change keep their timing.
      </p>
    </div>
  );
}
