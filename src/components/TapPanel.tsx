import type { Line } from '../types/lyric';
import type { SyncMode } from './ModeBar';
import { lineText } from '../utils/review';

interface TapPanelProps {
  mode: Exclude<SyncMode, 'review'>;
  lines: Line[];
  lineIndex: number;
  wordIndex: number;
  isPlaying: boolean;
  onTap: () => void;
  onBack: () => void;
  onReplay: () => void;
}

/** The big "tap now" view for Tap lines and Tap words. */
export function TapPanel({ mode, lines, lineIndex, wordIndex, isPlaying, onTap, onBack, onReplay }: TapPanelProps) {
  const line = lines[lineIndex];
  const prev = lines.slice(0, lineIndex).reverse().find((l) => l.words.length > 0);
  const next = lines.slice(lineIndex + 1).find((l) => l.words.length > 0);
  const label = mode === 'lines' ? 'Tap when this line starts' : 'Tap on each word';

  return (
    <aside className="tappanel" aria-label="Tap to time">
      {prev && <p className="tap-prev">{lineText(prev)}</p>}
      <div className="tap-now">
        <span className="kicker kicker-hot">
          Line {lineIndex + 1} of {lines.length} · {label}
        </span>
        <p className="tap-line">
          {line?.words.map((w, i) => (
            <span
              key={w.id}
              className={`tw ${w.timestamp !== null ? 'timed' : ''} ${mode === 'words' && i === wordIndex ? 'cur' : ''}`}
            >
              {w.text}{' '}
            </span>
          ))}
        </p>
        {mode === 'lines' && (
          <p className="tap-help">
            Already-timed words keep their shape and move with your tap. Untimed words are spread out by length until the next
            line.
          </p>
        )}
      </div>
      {next && <p className="tap-next">{lineText(next)}</p>}
      <div className="tap-actions">
        <button type="button" className="btn btn-go tap-btn" onClick={onTap}>
          {isPlaying ? 'Tap' : 'Play'} <kbd>Space</kbd>
        </button>
        <button type="button" className="btn" onClick={onBack}>
          Back a {mode === 'lines' ? 'line' : 'word'} <kbd>⌫</kbd>
        </button>
        <button type="button" className="btn" onClick={onReplay}>
          Back 3s <kbd>R</kbd>
        </button>
      </div>
    </aside>
  );
}
