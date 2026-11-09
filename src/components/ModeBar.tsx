export type SyncMode = 'review' | 'lines' | 'words';

interface ModeBarProps {
  mode: SyncMode;
  onMode: (mode: SyncMode) => void;
  total: number;
  toCheck: number;
  onNextToCheck: () => void;
  zoomMs: number;
  onZoom: (ms: number) => void;
  onPaste: () => void;
}

const MODES: Array<{ id: SyncMode; label: string; hint: string }> = [
  { id: 'review', label: 'Review', hint: 'Check and drag the timings that are already there' },
  { id: 'lines', label: 'Tap lines', hint: 'One tap when each line starts; its words follow' },
  { id: 'words', label: 'Tap words', hint: 'One tap per word, the classic way' },
];

const ZOOMS = [4000, 8000, 16000];

export function ModeBar({ mode, onMode, total, toCheck, onNextToCheck, zoomMs, onZoom, onPaste }: ModeBarProps) {
  const fine = Math.max(0, total - toCheck);
  const pctFine = total > 0 ? (fine / total) * 100 : 0;
  const pctCheck = total > 0 ? (toCheck / total) * 100 : 0;
  return (
    <nav className="modebar" aria-label="Sync mode">
      <div className="modes" role="tablist">
        {MODES.map((m) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={mode === m.id}
            className={`mode ${mode === m.id ? 'active' : ''}`}
            title={m.hint}
            onClick={() => onMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="tally">
        <div className="tally-track" aria-hidden="true">
          <div className="tally-ok" style={{ width: `${pctFine}%` }} />
          <div className="tally-check" style={{ width: `${pctCheck}%` }} />
        </div>
        <span>
          <b className="ok">{fine} look right</b> · <b className="warn">{toCheck} to check</b>
        </span>
      </div>

      <div className="modebar-tools">
        <button className="btn btn-sm btn-warn" onClick={onNextToCheck} disabled={toCheck === 0} title="Jump to the next word worth a look (N)">
          Next to check <kbd>N</kbd>
        </button>
        <div className="zoom" role="group" aria-label="Lane zoom">
          {ZOOMS.map((z) => (
            <button key={z} className={`btn btn-sm ${zoomMs === z ? 'btn-on' : ''}`} aria-pressed={zoomMs === z} onClick={() => onZoom(z)}>
              {z / 1000}s
            </button>
          ))}
        </div>
        <button className="btn btn-sm" onClick={onPaste}>
          Paste lyrics…
        </button>
      </div>
    </nav>
  );
}
