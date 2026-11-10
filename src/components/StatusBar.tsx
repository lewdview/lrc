import type { Line } from '../types/lyric';
import type { SyncMode } from './ModeBar';
import { SHORTCUTS } from '../hooks/useKeyboardShortcuts';

interface StatusBarProps {
  lines: Line[];
  lastSaved: string | null;
  mode: SyncMode;
}


export function StatusBar({ lines, lastSaved, mode }: StatusBarProps) {
  let totalWords = 0;
  let syncedWords = 0;
  for (const line of lines) {
    for (const word of line.words) {
      totalWords++;
      if (word.timestamp !== null) syncedWords++;
    }
  }
  const percentage = totalWords > 0 ? Math.round((syncedWords / totalWords) * 100) : 0;

  return (
    <footer className="statusbar">
      <div className="status-left">
        <div className="status-progress">
          <span>Words</span>
          <div className="status-bar-track" aria-hidden="true">
            <div className="status-bar-fill" style={{ width: `${percentage}%` }} />
          </div>
          <span>
            {syncedWords}/{totalWords} ({percentage}%)
          </span>
        </div>
        {lastSaved && <span className="status-saved">● Saved {lastSaved}</span>}
      </div>

      <div className="status-keys">
        {SHORTCUTS[mode].map(([key, label]) => (
          <span key={key}>
            <kbd>{key}</kbd> {label}
          </span>
        ))}
      </div>
    </footer>
  );
}
