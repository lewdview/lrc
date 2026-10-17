import { useRef, useEffect, useState } from 'react';
import type { Line, Word } from '../types/lyric';
import { formatTimestamp, parseTimestampToMs } from '../utils/formatter';

interface TimelineProps {
  lines: Line[];
  currentTime: number;
  activeLineIndex: number;
  activeWordIndex: number;
  onSeek: (ms: number) => void;
  onNudge: (lineIndex: number, wordIndex: number, deltaMs: number) => void;
  onSetTimestamp: (lineIndex: number, wordIndex: number, ms: number | null) => void;
  onSelectWord: (lineIndex: number, wordIndex: number) => void;
  onEditWordText: (lineIndex: number, wordIndex: number, text: string) => void;
  onAddWord: (lineIndex: number, afterWordIndex?: number) => void;
  onDeleteWord: (lineIndex: number, wordIndex: number) => void;
}

interface SyncedWordInfo {
  word: Word;
  lineIndex: number;
  wordIndex: number;
}

export function Timeline({
  lines,
  currentTime,
  activeLineIndex,
  activeWordIndex,
  onSeek,
  onNudge,
  onSetTimestamp,
  onSelectWord,
  onEditWordText,
  onAddWord,
  onDeleteWord,
}: TimelineProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');

  // Flatten lines into a list of synced words
  const syncedWords: SyncedWordInfo[] = [];
  lines.forEach((line, lIdx) => {
    line.words.forEach((word, wIdx) => {
      if (word.timestamp !== null) {
        syncedWords.push({
          word,
          lineIndex: lIdx,
          wordIndex: wIdx,
        });
      }
    });
  });

  // Sort by timestamp
  syncedWords.sort((a, b) => (a.word.timestamp || 0) - (b.word.timestamp || 0));

  // The row under the playhead: the last synced word at or before currentTime.
  let playingId: string | null = null;
  for (const { word } of syncedWords) {
    if ((word.timestamp ?? 0) <= currentTime) playingId = word.id;
    else break;
  }

  // Determine active item to scroll to
  const activeWordId = lines[activeLineIndex]?.words?.[activeWordIndex]?.id;

  // Scroll to follow playhead or cursor
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeWordId]);

  const handleTimestampChange = (lineIdx: number, wordIdx: number, value: string) => {
    const ms = parseTimestampToMs(value);
    if (ms !== null) {
      onSetTimestamp(lineIdx, wordIdx, ms);
    }
  };

  const handleSaveText = (lineIdx: number, wordIdx: number) => {
    if (editingWordId) {
      onEditWordText(lineIdx, wordIdx, editText.trim() || 'word');
      setEditingWordId(null);
    }
  };

  return (
    <aside className="timeline" aria-label="Synced words">
      <div className="timeline-head">
        <span className="kicker">Timeline</span>
        <span className="chip chip-cyan">{syncedWords.length} synced</span>
      </div>

      <div ref={listRef} className="timeline-list">
        {syncedWords.length === 0 ? (
          <div className="timeline-empty">
            Nothing synced yet. Press play and tap <kbd>Space</kbd> on each word.
          </div>
        ) : (
          syncedWords.map(({ word, lineIndex, wordIndex }) => {
            const isCursorActive = lineIndex === activeLineIndex && wordIndex === activeWordIndex;
            const isCurrentlyPlaying = word.id === playingId;
            const isEditing = editingWordId === word.id;

            return (
              <div
                key={word.id}
                data-active={isCursorActive}
                className={`trow ${isCursorActive ? 'cursor' : ''} ${isCurrentlyPlaying ? 'playing' : ''}`}
              >
                <div className="trow-seek" onClick={() => onSeek(word.timestamp || 0)} title="Seek here">
                  <span className="trow-dot" />
                  {/* Keyed by timestamp so a nudge refreshes the uncontrolled field. */}
                  <input
                    key={word.timestamp ?? 'none'}
                    type="text"
                    className="input trow-time"
                    aria-label={`Timestamp for “${word.text}”`}
                    defaultValue={formatTimestamp(word.timestamp)}
                    onBlur={(e) => handleTimestampChange(lineIndex, wordIndex, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                  />
                </div>

                {isEditing ? (
                  <input
                    type="text"
                    className="input trow-edit"
                    aria-label="Edit word"
                    value={editText}
                    autoFocus
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={() => handleSaveText(lineIndex, wordIndex)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveText(lineIndex, wordIndex);
                      if (e.key === 'Escape') setEditingWordId(null);
                    }}
                  />
                ) : (
                  <div
                    className="trow-word"
                    onClick={() => onSelectWord(lineIndex, wordIndex)}
                    onDoubleClick={() => {
                      setEditingWordId(word.id);
                      setEditText(word.text);
                    }}
                    title="Click to select. Double-click to edit."
                  >
                    {word.text}
                  </div>
                )}

                <div className="trow-tools">
                  {[-100, -10, 10, 100].map((delta) => (
                    <button
                      key={delta}
                      className="nudge"
                      onClick={() => onNudge(lineIndex, wordIndex, delta)}
                      title={`${delta > 0 ? '+' : ''}${delta}ms`}
                    >
                      {delta > 0 ? `+${delta}` : delta}
                    </button>
                  ))}
                  <button className="nudge" onClick={() => onAddWord(lineIndex, wordIndex)} title="Insert a word after this">
                    +
                  </button>
                  <button className="nudge nudge-x" onClick={() => onDeleteWord(lineIndex, wordIndex)} title="Delete word">
                    ×
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
