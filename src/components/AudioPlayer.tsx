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

const PEAKS = 120;
// Deterministic decorative waveform (no audio decoding).
const PEAK_HEIGHTS = Array.from({ length: PEAKS }, (_, i) => Math.max(15, ((i * 37) % 100) % 85));

const formatTimer = (ms: number) => {
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const millis = Math.floor(ms % 1000);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
};

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
  const progress = duration > 0 ? currentTime / duration : 0;

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!waveformRef.current || duration === 0) return;
    const rect = waveformRef.current.getBoundingClientRect();
    seek(((e.clientX - rect.left) / rect.width) * duration);
  };

  return (
    <section className="transport" aria-label="Playback">
      <div className="transport-row">
        <div className="transport-group" role="group" aria-label="Playback speed">
          <span className="kicker">Speed</span>
          {[0.25, 0.5, 0.75, 1.0, 1.25].map((rate) => (
            <button
              key={rate}
              className={`btn btn-sm ${playbackRate === rate ? 'btn-on' : ''}`}
              aria-pressed={playbackRate === rate}
              onClick={() => setPlaybackRate(rate)}
            >
              {rate}x
            </button>
          ))}
        </div>

        <div className="clock" aria-live="off">
          <span className="clock-now">{formatTimer(currentTime)}</span>
          <span className="clock-sep"> / </span>
          <span className="clock-total">{formatTimer(duration)}</span>
        </div>
      </div>

      <div
        ref={waveformRef}
        className="wave"
        onClick={handleWaveformClick}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(currentTime)}
      >
        <div className="wave-peaks">
          {PEAK_HEIGHTS.map((height, i) => (
            <div
              key={i}
              className={`wave-peak ${duration > 0 && i / PEAKS <= progress ? 'played' : ''}`}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        {duration > 0 && <div className="wave-head" style={{ left: `${progress * 100}%` }} />}
        {!audioUrl && <div className="wave-empty">Pick a song or upload audio</div>}
      </div>

      <div className="transport-row">
        <div className="transport-group">
          <button className="btn btn-sm" onClick={() => skip(-5)}>-5s</button>
          <button className="btn btn-sm" onClick={() => seek(currentTime - 100)}>-100ms</button>
          <button className="btn btn-sm" onClick={() => seek(currentTime - 10)}>-10ms</button>
        </div>

        <div className="transport-group">
          <button className="btn btn-danger btn-transport" onClick={stop}>
            Stop
          </button>
          {isPlaying ? (
            <button className="btn btn-primary btn-transport" onClick={pause}>
              Pause
            </button>
          ) : (
            <button className="btn btn-go btn-transport" onClick={play} disabled={!audioUrl}>
              Play
            </button>
          )}
        </div>

        <div className="transport-group">
          <button className="btn btn-sm" onClick={() => seek(currentTime + 10)}>+10ms</button>
          <button className="btn btn-sm" onClick={() => seek(currentTime + 100)}>+100ms</button>
          <button className="btn btn-sm" onClick={() => skip(5)}>+5s</button>
        </div>
      </div>
    </section>
  );
}
