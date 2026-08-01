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
    <div style={styles.container}>
      <div style={styles.header}>
        <h4 style={styles.title}>Timeline / Synced Words</h4>
        <span style={styles.count} className="mono">
          {syncedWords.length} Words
        </span>
      </div>

      <div ref={listRef} style={styles.list}>
        {syncedWords.length === 0 ? (
          <div style={styles.empty}>
            No synced words yet. Start tapping spacebar to synchronize or edit text.
          </div>
        ) : (
          syncedWords.map(({ word, lineIndex, wordIndex }) => {
            const isCursorActive =
              lineIndex === activeLineIndex && wordIndex === activeWordIndex;
            const isCurrentlyPlaying =
              word.timestamp !== null &&
              currentTime >= word.timestamp &&
              (syncedWords.find(
                (next, idx) =>
                  idx > syncedWords.findIndex((w) => w.word.id === word.id) &&
                  (next.word.timestamp || 0) > (word.timestamp || 0)
              )?.word.timestamp || Infinity) > currentTime;
            const isEditing = editingWordId === word.id;

            return (
              <div
                key={word.id}
                data-active={isCursorActive}
                style={{
                  ...styles.row,
                  ...(isCursorActive ? styles.rowActive : {}),
                  ...(isCurrentlyPlaying ? styles.rowPlaying : {}),
                }}
              >
                {/* Click to Seek / playhead indicator */}
                <div style={styles.seekZone} onClick={() => onSeek(word.timestamp || 0)}>
                  <div
                    style={{
                      ...styles.bullet,
                      ...(isCurrentlyPlaying ? styles.bulletPlaying : {}),
                    }}
                  />

                  {/* Timestamp Input */}
                  <input
                    type="text"
                    className="input mono"
                    style={styles.timeInput}
                    defaultValue={formatTimestamp(word.timestamp)}
                    onBlur={(e) =>
                      handleTimestampChange(lineIndex, wordIndex, e.target.value)
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                  />
                </div>

                {/* Word content / Inline Editor */}
                {isEditing ? (
                  <input
                    type="text"
                    className="input mono"
                    style={styles.textInputInline}
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
                    style={{
                      ...styles.wordText,
                      ...(isCursorActive ? { color: 'var(--accent-cyan)' } : {}),
                      ...(isCurrentlyPlaying ? { fontWeight: 'bold' } : {}),
                    }}
                    onClick={() => onSelectWord(lineIndex, wordIndex)}
                    onDoubleClick={() => {
                      setEditingWordId(word.id);
                      setEditText(word.text);
                    }}
                    title="Click to select. Double-click to edit word text."
                  >
                    {word.text}
                  </div>
                )}

                {/* Nudge controls and Actions */}
                <div style={styles.nudgers}>
                  <button
                    style={styles.nudgeBtn}
                    onClick={() => onNudge(lineIndex, wordIndex, -100)}
                    title="-100ms"
                  >
                    -100
                  </button>
                  <button
                    style={styles.nudgeBtn}
                    onClick={() => onNudge(lineIndex, wordIndex, -10)}
                    title="-10ms"
                  >
                    -10
                  </button>
                  <button
                    style={styles.nudgeBtn}
                    onClick={() => onNudge(lineIndex, wordIndex, 10)}
                    title="+10ms"
                  >
                    +10
                  </button>
                  <button
                    style={styles.nudgeBtn}
                    onClick={() => onNudge(lineIndex, wordIndex, 100)}
                    title="+100ms"
                  >
                    +100
                  </button>
                  <button
                    style={styles.nudgeBtn}
                    onClick={() => onAddWord(lineIndex, wordIndex)}
                    title="Insert word after this"
                  >
                    +
                  </button>
                  <button
                    style={{ ...styles.nudgeBtn, ...styles.clearBtn }}
                    onClick={() => onDeleteWord(lineIndex, wordIndex)}
                    title="Delete word"
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    width: '420px',
    backgroundColor: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
  },
  header: {
    padding: '15px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: '0.85rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    fontWeight: 'bold' as const,
    color: 'var(--text-secondary)',
  },
  count: {
    fontSize: '0.75rem',
    color: 'var(--accent-cyan)',
    backgroundColor: 'var(--accent-cyan-dim)',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  list: {
    flexGrow: 1,
    overflowY: 'auto' as const,
    padding: '10px 0',
  },
  empty: {
    padding: '30px',
    textAlign: 'center' as const,
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    lineHeight: '1.5',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 10px',
    borderBottom: '1px solid rgba(46, 46, 58, 0.3)',
    gap: '8px',
    transition: 'background-color 0.1s ease',
  },
  rowActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.04)',
    borderLeft: '2px solid var(--accent-cyan)',
  },
  rowPlaying: {
    backgroundColor: 'rgba(57, 255, 20, 0.02)',
  },
  seekZone: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
  },
  bullet: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'var(--text-muted)',
  },
  bulletPlaying: {
    backgroundColor: 'var(--accent-green)',
    boxShadow: '0 0 6px var(--accent-green)',
  },
  timeInput: {
    width: '72px',
    padding: '2px 4px',
    fontSize: '0.75rem',
    textAlign: 'center' as const,
  },
  textInputInline: {
    flexGrow: 1,
    fontSize: '0.85rem',
    padding: '2px 6px',
    color: 'var(--accent-cyan)',
  },
  wordText: {
    flexGrow: 1,
    fontSize: '0.85rem',
    fontWeight: 500,
    cursor: 'pointer',
    color: 'var(--text-primary)',
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
  },
  nudgers: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
  },
  nudgeBtn: {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-secondary)',
    fontSize: '0.65rem',
    padding: '2px 4px',
    cursor: 'pointer',
    borderRadius: '2px',
    fontFamily: 'var(--font-mono)',
  },
  clearBtn: {
    color: 'var(--accent-red)',
    fontWeight: 'bold' as const,
    fontSize: '0.8rem',
    padding: '0 5px',
  },
};
