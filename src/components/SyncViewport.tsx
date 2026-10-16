import { useState } from 'react';
import type { Line, Word } from '../types/lyric';

interface SyncViewportProps {
  lines: Line[];
  activeLineIndex: number;
  activeWordIndex: number;
  currentTime: number;
  onWordClick: (lineIndex: number, wordIndex: number) => void;
  onReTimeLine: (lineIndex: number) => void;
  onEditWordText: (lineIndex: number, wordIndex: number, text: string) => void;
  onAddWord: (lineIndex: number, afterWordIndex?: number) => void;
  onDeleteWord: (lineIndex: number, wordIndex: number) => void;
  onAddLine: (afterLineIndex?: number) => void;
}

export function SyncViewport({
  lines,
  activeLineIndex,
  activeWordIndex,
  currentTime,
  onWordClick,
  onReTimeLine,
  onEditWordText,
  onAddWord,
  onDeleteWord,
  onAddLine,
}: SyncViewportProps) {
  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // The word under the playhead: the latest timestamp at or before currentTime.
  let playingWordId = '';
  let maxTime = -1;
  for (const line of lines) {
    for (const word of line.words) {
      if (word.timestamp !== null && word.timestamp <= currentTime && word.timestamp > maxTime) {
        maxTime = word.timestamp;
        playingWordId = word.id;
      }
    }
  }

  const saveEditingWord = (lineIndex: number, wordIndex: number) => {
    if (!editingWordId) return;
    onEditWordText(lineIndex, wordIndex, editText.trim() || 'word');
    setEditingWordId(null);
  };

  const renderLineControls = (lineIndex: number, words: Word[]) => (
    <div className="sline-tools">
      <button className="btn btn-sm btn-ghost" onClick={() => onAddWord(lineIndex)} title="Add a word to this line">
        + Word
      </button>
      {words.some((w) => w.timestamp !== null) && (
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => onReTimeLine(lineIndex)}
          title="Clear this line's timestamps and jump here"
        >
          ↺ Re-time
        </button>
      )}
    </div>
  );

  const renderWords = (lineIndex: number, words: Word[], isCurrentLine: boolean) =>
    words.map((word, wIdx) => {
      if (editingWordId === word.id) {
        return (
          <input
            key={word.id}
            type="text"
            className="input sword-edit"
            aria-label="Edit word"
            value={editText}
            autoFocus
            onChange={(e) => setEditText(e.target.value)}
            onBlur={() => saveEditingWord(lineIndex, wIdx)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEditingWord(lineIndex, wIdx);
              else if (e.key === 'Escape') setEditingWordId(null);
            }}
          />
        );
      }

      const isActive = isCurrentLine && wIdx === activeWordIndex;
      const isSynced = word.timestamp !== null || (isCurrentLine && wIdx < activeWordIndex);
      const cls = [
        'sword',
        isActive ? 'active' : isSynced ? 'synced' : '',
        word.id === playingWordId ? 'playing' : '',
      ]
        .filter(Boolean)
        .join(' ');

      return (
        <span
          key={word.id}
          className={cls}
          onClick={() => onWordClick(lineIndex, wIdx)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditingWordId(word.id);
            setEditText(word.text);
          }}
          title="Click to select for sync. Double-click to edit."
        >
          {word.text}
          <button
            className="sword-del"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteWord(lineIndex, wIdx);
            }}
            title="Delete this word"
            aria-label={`Delete “${word.text}”`}
          >
            ×
          </button>
        </span>
      );
    });

  const slots: Array<{ offset: number; label: string; empty: string }> = [
    { offset: -1, label: 'Previous', empty: 'Start of song' },
    { offset: 0, label: 'Now syncing', empty: 'No lyrics parsed' },
    { offset: 1, label: 'Next', empty: 'End of song' },
  ];

  return (
    <div className="sync">
      <div className="sync-stack">
        {slots.map(({ offset, label, empty }) => {
          const idx = activeLineIndex + offset;
          const line = idx >= 0 && idx < lines.length ? lines[idx] : null;
          const isCurrent = offset === 0;
          return (
            <div key={offset} className={`sline ${isCurrent ? 'current' : ''}`}>
              <div className="sline-head">
                <span className={`kicker ${isCurrent ? 'kicker-hot' : ''}`}>
                  {label}
                  {line && ` · line ${idx + 1}/${lines.length}`}
                </span>
                {line && renderLineControls(idx, line.words)}
              </div>
              <div className="sline-words">
                {line ? renderWords(idx, line.words, isCurrent) : <span className="sline-empty">[{empty}]</span>}
              </div>
            </div>
          );
        })}

        <div>
          <button className="btn btn-sm" onClick={() => onAddLine(activeLineIndex)}>
            + Add line
          </button>
        </div>
      </div>

      <div className="sync-hint">
        Tap <kbd>Space</kbd> to sync · double-click a word to edit
      </div>
    </div>
  );
}
