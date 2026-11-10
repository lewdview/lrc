import { useMemo, useRef } from 'react';
import { PEAK_MS, peakBetween } from '../hooks/useWaveform';

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
  peaks: Float32Array | null;
  /** Song times (ms) of words that need a look, drawn as ticks on the overview. */
  flagTimes: number[];
  looping: boolean;
  onToggleLoop: () => void;
}

const BARS = 160;
// Placeholder bars until the song is decoded.
const FLAT = Array.from({ length: BARS }, (_, i) => 0.18 + 0.12 * Math.abs(Math.sin(i * 0.7)));

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
  peaks,
  flagTimes,
  looping,
  onToggleLoop,
}: AudioPlayerProps) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const progress = duration > 0 ? currentTime / duration : 0;

  const bars = useMemo(() => {
    if (!peaks) return FLAT;
    const total = duration > 0 ? duration : peaks.length * PEAK_MS;
    const slice = total / BARS;
    return Array.from({ length: BARS }, (_, i) => Math.max(0.04, peakBetween(peaks, i * slice, (i + 1) * slice)));
  }, [peaks, duration]);

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!waveformRef.current || duration === 0) return;
    const rect = waveformRef.current.getBoundingClientRect();
    seek(((e.clientX - rect.left) / rect.width) * duration);
  };

  return (
    <section className="transport" aria-label="Playback">
      <div className="transport-row">
        <div className="transport-group">
          {isPlaying ? (
            <button className="btn btn-primary btn-transport" onClick={pause}>
              Pause
            </button>
          ) : (
            <button className="btn btn-go btn-transport" onClick={play} disabled={!audioUrl}>
              Play
            </button>
          )}
          <button className="btn btn-sm" onClick={stop} disabled={!audioUrl}>
            Stop
          </button>
          <button className="btn btn-sm" onClick={() => skip(-3)} title="Back 3 seconds (R)">
            −3s
          </button>
          <button className="btn btn-sm" onClick={() => skip(5)}>
            +5s
          </button>
          <button
            className={`btn btn-sm ${looping ? 'btn-on' : ''}`}
            aria-pressed={looping}
            onClick={onToggleLoop}
            title="Loop the selected line (L)"
          >
            Loop line <kbd>L</kbd>
          </button>
        </div>

        <div className="clock" aria-live="off">
          <span className="clock-now">{formatTimer(currentTime)}</span>
          <span className="clock-sep"> / </span>
          <span className="clock-total">{formatTimer(duration)}</span>
        </div>

        <div className="transport-group" role="group" aria-label="Playback speed">
          <span className="kicker">Speed</span>
          {[0.5, 0.75, 1.0].map((rate) => (
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
          {bars.map((v, i) => (
            <div
              key={i}
              className={`wave-peak ${duration > 0 && i / BARS <= progress ? 'played' : ''}`}
              style={{ height: `${Math.round(v * 100)}%` }}
            />
          ))}
        </div>
        {duration > 0 &&
          flagTimes.map((t, i) => (
            <span key={i} className="wave-flag" style={{ left: `${(t / duration) * 100}%` }} aria-hidden="true" />
          ))}
        {duration > 0 && <div className="wave-head" style={{ left: `${progress * 100}%` }} />}
        {!audioUrl && <div className="wave-empty">Pick a song or upload audio</div>}
      </div>
    </section>
  );
}
