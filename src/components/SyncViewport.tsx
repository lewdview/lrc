import type { Line } from '../types/lyric';

interface SyncViewportProps {
  lines: Line[];
  activeLineIndex: number;
  activeWordIndex: number;
  currentTime: number;
  onWordClick: (lineIndex: number, wordIndex: number) => void;
  onReTimeLine: (lineIndex: number) => void;
}

export function SyncViewport({
  lines,
  activeLineIndex,
  activeWordIndex,
  currentTime,
  onWordClick,
  onReTimeLine,
}: SyncViewportProps) {
  
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

  // Renders the clock reset button if a line is synced
  const renderReTimeButton = (lineIndex: number, lineWords: any[]) => {
    const hasSyncedWords = lineWords.some(w => w.timestamp !== null);
    if (!hasSyncedWords) return null;

    return (
      <button
        style={styles.reTimeBtn}
        onClick={() => onReTimeLine(lineIndex)}
        title="Re-time this line (reset timestamps & jump here)"
      >
        <svg
          width="14"
          height="14"
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
      </button>
    );
  };

  const renderWords = (lineIndex: number, words: any[], isCurrentLine: boolean) => {
    return words.map((word, wIdx) => {
      const isCurrent = isCurrentLine && wIdx === activeWordIndex;
      const isCompleted = isCurrentLine && wIdx < activeWordIndex;
      const isSynced = word.timestamp !== null;
      const isPlaying = word.id === activePlayingWordId;

      let wordStyle = { ...styles.word };
      
      if (isCurrent) {
        wordStyle = { ...wordStyle, ...styles.wordActive };
      } else if (isCompleted || isSynced) {
        wordStyle = { ...wordStyle, ...styles.wordCompleted };
      } else {
        wordStyle = { ...wordStyle, ...styles.wordUnsynced };
      }

      if (!isCurrentLine) {
        // Fallback styling for non-active lines
        wordStyle = { ...wordStyle, ...styles.wordNext };
      }

      // Add playing highlight if active in audio
      if (isPlaying) {
        wordStyle = { ...wordStyle, ...styles.wordPlaying };
      }

      return (
        <span
          key={word.id}
          style={wordStyle}
          onClick={() => onWordClick(lineIndex, wIdx)}
        >
          {word.text}
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
            <span style={styles.lineLabel}>PREV</span>
            {prevLineData && renderReTimeButton(prevLineData.index, prevLineData.line.words)}
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
            <span style={{ ...styles.lineLabel, ...styles.lineLabelCurrent }}>ACTIVE</span>
            {currentLineData && renderReTimeButton(currentLineData.index, currentLineData.line.words)}
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
            <span style={styles.lineLabel}>NEXT</span>
            {nextLineData && renderReTimeButton(nextLineData.index, nextLineData.line.words)}
          </div>
          <div style={styles.lineContent}>
            {nextLineData ? (
              renderWords(nextLineData.index, nextLineData.line.words, false)
            ) : (
              <span style={styles.emptyText}>[End of song]</span>
            )}
          </div>
        </div>

      </div>

      <div style={styles.instructions}>
        TAP <kbd style={styles.kbd}>SPACEBAR</kbd> TO SYNC THE GLOWING CYAN WORD TO CURRENT AUDIO TIME
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
    gap: '40px',
    width: '100%',
    maxWidth: '900px',
  },
  lineOuter: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    width: '100%',
  },
  lineOuterCurrent: {
    backgroundColor: 'rgba(0, 240, 255, 0.02)',
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
  lineContent: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '12px 16px',
    fontSize: '1.4rem',
    lineHeight: '1.4',
  },
  lineContentCurrent: {
    fontSize: '2.2rem',
    lineHeight: '1.3',
    fontWeight: 'bold' as const,
  },
  word: {
    cursor: 'pointer',
    userSelect: 'none' as const,
    transition: 'all 0.1s ease',
    borderBottom: '2px solid transparent',
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
  reTimeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px',
    borderRadius: '50%',
    transition: 'all 0.15s ease',
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
