import { useState } from 'react';
import type { Line } from '../types/lyric';

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
  const [editText, setEditText] = useState<string>('');

  // Find the word that is currently playing based on currentTime
  let activePlayingWordId = '';
  let maxTime = -1;
  lines.forEach((line) => {
    line.words.forEach((word) => {
      if (word.timestamp !== null && word.timestamp <= currentTime) {
        if (word.timestamp > maxTime) {
          maxTime = word.timestamp;
          activePlayingWordId = word.id;
        }
      }
    });
  });

  const getLineData = (offset: number) => {
    const idx = activeLineIndex + offset;
    if (idx >= 0 && idx < lines.length) {
      return { line: lines[idx], index: idx };
    }
    return null;
  };

  const prevLineData = getLineData(-1);
  const currentLineData = getLineData(0);
  const nextLineData = getLineData(1);

  const startEditingWord = (wordId: string, currentText: string) => {
    setEditingWordId(wordId);
    setEditText(currentText);
  };

  const saveEditingWord = (lineIndex: number, wordIndex: number) => {
    if (editingWordId) {
      onEditWordText(lineIndex, wordIndex, editText.trim() || 'word');
      setEditingWordId(null);
    }
  };

  // Renders line action buttons (Re-time, Add Word)
  const renderLineControls = (lineIndex: number, lineWords: any[]) => {
    const hasSyncedWords = lineWords.some((w) => w.timestamp !== null);

    return (
      <div style={styles.lineControls}>
        <button
          style={styles.actionBtn}
          onClick={() => onAddWord(lineIndex)}
          title="Add a new word to this line"
        >
          + Word
        </button>

        {hasSyncedWords && (
          <button
            style={styles.actionBtn}
            onClick={() => onReTimeLine(lineIndex)}
            title="Re-time this line (reset timestamps & jump here)"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>Re-time</span>
          </button>
        )}
      </div>
    );
  };

  const renderWords = (lineIndex: number, words: any[], isCurrentLine: boolean) => {
    return words.map((word, wIdx) => {
      const isCurrent = isCurrentLine && wIdx === activeWordIndex;
      const isCompleted = isCurrentLine && wIdx < activeWordIndex;
      const isSynced = word.timestamp !== null;
      const isPlaying = word.id === activePlayingWordId;
      const isEditing = editingWordId === word.id;

      if (isEditing) {
        return (
          <input
            key={word.id}
            type="text"
            className="input mono"
            style={styles.inlineInput}
            value={editText}
            autoFocus
            onChange={(e) => setEditText(e.target.value)}
            onBlur={() => saveEditingWord(lineIndex, wIdx)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                saveEditingWord(lineIndex, wIdx);
              } else if (e.key === 'Escape') {
                setEditingWordId(null);
              }
            }}
          />
        );
      }

      let wordStyle = { ...styles.word };

      if (isCurrent) {
        wordStyle = { ...wordStyle, ...styles.wordActive };
      } else if (isCompleted || isSynced) {
        wordStyle = { ...wordStyle, ...styles.wordCompleted };
      } else {
        wordStyle = { ...wordStyle, ...styles.wordUnsynced };
      }

      if (!isCurrentLine) {
        wordStyle = { ...wordStyle, ...styles.wordNext };
      }

      if (isPlaying) {
        wordStyle = { ...wordStyle, ...styles.wordPlaying };
      }

      return (
        <span
          key={word.id}
          style={wordStyle}
          className="word-item"
          onClick={() => onWordClick(lineIndex, wIdx)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            startEditingWord(word.id, word.text);
          }}
          title="Click to select for sync. Double-click to edit text."
        >
          {word.text}
          <button
            style={styles.deleteWordBtn}
            onClick={(e) => {
              e.stopPropagation();
              onDeleteWord(lineIndex, wIdx);
            }}
            title="Delete this word"
          >
            ×
          </button>
        </span>
      );
    });
  };

  return (
    <div style={styles.container}>
      <div style={styles.wrapper}>
        {/* Previous Line */}
        <div style={styles.lineOuter}>
          <div style={styles.lineHeader}>
            <span style={styles.lineLabel}>PREV LINE</span>
            {prevLineData && renderLineControls(prevLineData.index, prevLineData.line.words)}
          </div>
          <div style={styles.lineContent}>
            {prevLineData ? (
              renderWords(prevLineData.index, prevLineData.line.words, false)
            ) : (
              <span style={styles.emptyText}>[Start of song]</span>
            )}
          </div>
        </div>

        {/* Current Line */}
        <div style={{ ...styles.lineOuter, ...styles.lineOuterCurrent }}>
          <div style={styles.lineHeader}>
            <span style={{ ...styles.lineLabel, ...styles.lineLabelCurrent }}>ACTIVE SYNC LINE</span>
            {currentLineData && renderLineControls(currentLineData.index, currentLineData.line.words)}
          </div>
          <div style={{ ...styles.lineContent, ...styles.lineContentCurrent }}>
            {currentLineData ? (
              renderWords(currentLineData.index, currentLineData.line.words, true)
            ) : (
              <span style={styles.emptyText}>[No lyrics parsed]</span>
            )}
          </div>
        </div>

        {/* Next Line */}
        <div style={styles.lineOuter}>
          <div style={styles.lineHeader}>
            <span style={styles.lineLabel}>NEXT LINE</span>
            {nextLineData && renderLineControls(nextLineData.index, nextLineData.line.words)}
          </div>
          <div style={styles.lineContent}>
            {nextLineData ? (
              renderWords(nextLineData.index, nextLineData.line.words, false)
            ) : (
              <span style={styles.emptyText}>[End of song]</span>
            )}
          </div>
        </div>

        {/* Global Add Line Button */}
        <div style={{ textAlign: 'center', marginTop: '10px' }}>
          <button
            className="btn"
            style={styles.addLineBtn}
            onClick={() => onAddLine(activeLineIndex)}
          >
            + Add New Line
          </button>
        </div>
      </div>

      <div style={styles.instructions}>
        TAP <kbd style={styles.kbd}>SPACEBAR</kbd> TO SYNC | DOUBLE-CLICK ANY WORD TO EDIT TEXT
      </div>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: 'var(--bg-primary)',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '30px 20px',
    height: '100%',
    position: 'relative' as const,
  },
  wrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '30px',
    width: '100%',
    maxWidth: '920px',
  },
  lineOuter: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    width: '100%',
  },
  lineOuterCurrent: {
    backgroundColor: 'rgba(0, 240, 255, 0.025)',
    padding: '20px',
    borderRadius: '8px',
    borderLeft: '4px solid var(--accent-cyan)',
  },
  lineHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  lineLabel: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.65rem',
    color: 'var(--text-muted)',
    letterSpacing: '1px',
    fontWeight: 'bold' as const,
  },
  lineLabelCurrent: {
    color: 'var(--accent-cyan)',
  },
  lineControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  actionBtn: {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-secondary)',
    fontSize: '0.7rem',
    padding: '3px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.15s ease',
  },
  lineContent: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '12px 16px',
    fontSize: '1.4rem',
    lineHeight: '1.4',
  },
  lineContentCurrent: {
    fontSize: '2.1rem',
    lineHeight: '1.3',
    fontWeight: 'bold' as const,
  },
  word: {
    position: 'relative' as const,
    cursor: 'pointer',
    userSelect: 'none' as const,
    transition: 'all 0.1s ease',
    borderBottomWidth: '2px',
    borderBottomStyle: 'solid' as const,
    borderBottomColor: 'transparent',
    padding: '0 2px',
  },
  wordCompleted: {
    color: 'var(--accent-green)',
  },
  wordActive: {
    color: 'var(--accent-cyan)',
    textShadow: '0 0 10px rgba(0, 240, 255, 0.6), 0 0 20px rgba(0, 240, 255, 0.2)',
    transform: 'scale(1.05)',
  },
  wordUnsynced: {
    color: 'var(--text-muted)',
  },
  wordNext: {
    color: 'var(--text-secondary)',
  },
  wordPlaying: {
    borderBottomColor: 'var(--accent-cyan)',
    textShadow: '0 0 8px rgba(0, 240, 255, 0.4)',
  },
  inlineInput: {
    fontSize: '1.2rem',
    padding: '2px 6px',
    width: '120px',
    color: 'var(--accent-cyan)',
    borderColor: 'var(--accent-cyan)',
    backgroundColor: 'var(--bg-tertiary)',
  },
  deleteWordBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--accent-red)',
    opacity: 0.4,
    fontSize: '0.75rem',
    cursor: 'pointer',
    marginLeft: '2px',
    verticalAlign: 'super',
  },
  addLineBtn: {
    fontSize: '0.8rem',
    padding: '6px 16px',
    backgroundColor: 'var(--bg-tertiary)',
    borderColor: 'var(--border-color)',
    color: 'var(--text-secondary)',
  },
  emptyText: {
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    fontSize: '1rem',
  },
  instructions: {
    position: 'absolute' as const,
    bottom: '20px',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.5px',
  },
  kbd: {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '0.75rem',
    color: 'var(--text-primary)',
    boxShadow: '0 2px 0 var(--border-color)',
  },
};
