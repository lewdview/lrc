import { useRef } from 'react';

interface AudioPlayerProps {
  isPlaying: boolean;
  currentTime: number; // in ms
  duration: number; // in ms
  playbackRate: number;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (ms: number) => void;
  skip: (seconds: number) => void;
  setPlaybackRate: (rate: number) => void;
  audioUrl: string | null;
}

export function AudioPlayer({
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  play,
  pause,
  stop,
  seek,
  skip,
  setPlaybackRate,
  audioUrl,
}: AudioPlayerProps) {
  const waveformRef = useRef<HTMLDivElement>(null);

  const formatTimer = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const millis = Math.floor(ms % 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis
      .toString()
      .padStart(3, '0')}`;
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!waveformRef.current || duration === 0) return;
    const rect = waveformRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickRatio = x / rect.width;
    seek(clickRatio * duration);
  };

  return (
    <div style={styles.playerContainer}>
      <div style={styles.topRow}>
        {/* Playback rate speed buttons */}
        <div style={styles.speedSelector}>
          <span style={styles.label}>SPEED:</span>
          {[0.25, 0.5, 0.75, 1.0, 1.25].map((rate) => (
            <button
              key={rate}
              className="btn mono"
              style={{
                ...styles.speedBtn,
                ...(playbackRate === rate ? styles.activeSpeedBtn : {}),
              }}
              onClick={() => setPlaybackRate(rate)}
            >
              {rate}x
            </button>
          ))}
        </div>

        {/* Timers */}
        <div style={styles.timeDisplay} className="mono">
          <span style={{ color: 'var(--accent-cyan)' }}>{formatTimer(currentTime)}</span>
          <span style={{ color: 'var(--text-muted)' }}> / </span>
          <span>{formatTimer(duration)}</span>
        </div>
      </div>

      {/* Waveform Seekbar */}
      <div
        ref={waveformRef}
        style={styles.waveformContainer}
        onClick={handleWaveformClick}
      >
        {/* Waveform peaks - generated visual style */}
        <div style={styles.peaksWrapper}>
          {Array.from({ length: 120 }).map((_, i) => {
            // Generate a deterministic pseudo-random height
            const seed = (i * 37) % 100;
            const height = Math.max(15, seed % 85);
            const isPlayed = duration > 0 && (i / 120) <= (currentTime / duration);
            return (
              <div
                key={i}
                style={{
                  ...styles.peakBar,
                  height: `${height}%`,
                  backgroundColor: isPlayed ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  boxShadow: isPlayed ? '0 0 4px var(--accent-cyan-dim)' : 'none',
                }}
              />
            );
          })}
        </div>
        {/* Playhead */}
        {duration > 0 && (
          <div
            style={{
              ...styles.playhead,
              left: `${(currentTime / duration) * 100}%`,
            }}
          />
        )}
      </div>

      {/* Controls row */}
      <div style={styles.controlsRow}>
        <div style={styles.controlGroup}>
          <button className="btn" onClick={() => skip(-5)}>
            -5s
          </button>
          <button className="btn" onClick={() => seek(currentTime - 100)}>
            -100ms
          </button>
          <button className="btn" onClick={() => seek(currentTime - 10)}>
            -10ms
          </button>
        </div>

        <div style={styles.mainControls}>
          <button
            className="btn btn-danger"
            style={{ width: '80px', fontWeight: 'bold' }}
            onClick={stop}
          >
            STOP
          </button>
          {isPlaying ? (
            <button
              className="btn btn-primary pulse-glow"
              style={{ width: '120px', fontWeight: 'bold' }}
              onClick={pause}
            >
              PAUSE
            </button>
          ) : (
            <button
              className="btn btn-primary"
              style={{
                width: '120px',
                fontWeight: 'bold',
                backgroundColor: 'var(--accent-green)',
                borderColor: 'var(--accent-green)',
                color: 'var(--bg-primary)',
              }}
              onClick={play}
              disabled={!audioUrl}
            >
              PLAY
            </button>
          )}
        </div>

        <div style={styles.controlGroup}>
          <button className="btn" onClick={() => seek(currentTime + 10)}>
            +10ms
          </button>
          <button className="btn" onClick={() => seek(currentTime + 100)}>
            +100ms
          </button>
          <button className="btn" onClick={() => skip(5)}>
            +5s
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  playerContainer: {
    backgroundColor: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-color)',
    padding: '15px 20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  topRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  speedSelector: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  label: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    fontWeight: 'bold' as const,
    marginRight: '4px',
  },
  speedBtn: {
    padding: '4px 8px',
    fontSize: '0.75rem',
  },
  activeSpeedBtn: {
    borderColor: 'var(--accent-cyan)',
    backgroundColor: 'var(--accent-cyan-dim)',
    color: 'var(--accent-cyan)',
  },
  timeDisplay: {
    fontSize: '1.25rem',
    fontWeight: 'bold' as const,
  },
  waveformContainer: {
    height: '60px',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius)',
    position: 'relative' as const,
    cursor: 'pointer',
    overflow: 'hidden' as const,
  },
  peaksWrapper: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: '0 10px',
  },
  peakBar: {
    width: '3px',
    borderRadius: '1.5px',
    transition: 'background-color 0.1s ease',
  },
  playhead: {
    position: 'absolute' as const,
    top: 0,
    bottom: 0,
    width: '2px',
    backgroundColor: 'var(--accent-cyan)',
    boxShadow: '0 0 8px #00f0ff, 0 0 15px #00f0ff',
    pointerEvents: 'none' as const,
  },
  controlsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  mainControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
};
