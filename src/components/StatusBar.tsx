import type { Line } from '../types/lyric';

interface StatusBarProps {
  lines: Line[];
  lastSaved: string | null;
}

export function StatusBar({ lines, lastSaved }: StatusBarProps) {
  // Compute stats
  let totalWords = 0;
  let syncedWords = 0;

  lines.forEach((line) => {
    line.words.forEach((word) => {
      totalWords++;
      if (word.timestamp !== null) {
        syncedWords++;
      }
    });
  });

  const percentage = totalWords > 0 ? Math.round((syncedWords / totalWords) * 100) : 0;

  return (
    <div style={styles.statusBar} className="mono">
      <div style={styles.left}>
        <div style={styles.stat}>
          <span>WORDS: </span>
          <span style={{ color: 'var(--accent-cyan)' }}>
            {syncedWords} / {totalWords}
          </span>
          <span style={{ color: 'var(--text-muted)' }}> ({percentage}%)</span>
        </div>

        {lastSaved && (
          <div style={styles.stat}>
            <span style={{ color: 'var(--accent-green)' }}>● AUTO-SAVED {lastSaved}</span>
          </div>
        )}
      </div>

      <div style={styles.shortcuts}>
        <span>SPACE: Sync</span>
        <span style={styles.divider}>|</span>
        <span>Arrows: Nudge (100ms)</span>
        <span style={styles.divider}>|</span>
        <span>Shift+Arrows: Nudge (10ms)</span>
        <span style={styles.divider}>|</span>
        <span>Ctrl+Z: Undo</span>
        <span style={styles.divider}>|</span>
        <span>Backspace: Prev Word</span>
        <span style={styles.divider}>|</span>
        <span>Enter: Next Line</span>
      </div>
    </div>
  );
}

const styles = {
  statusBar: {
    height: '30px',
    backgroundColor: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    fontSize: '0.7rem',
    color: 'var(--text-secondary)',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  stat: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  shortcuts: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: 'var(--text-muted)',
  },
  divider: {
    color: '#2e2e3a',
  },
};
