import { useEffect, useMemo, useRef, useState } from 'react';
import type { Line } from '../types/lyric';
import type { Flag, WordRef } from '../utils/review';
import { peakBetween } from '../hooks/useWaveform';

interface WordLaneProps {
  lines: Line[];
  flags: Flag[];
  currentTime: number;
  isPlaying: boolean;
  selected: WordRef;
  peaks: Float32Array | null;
  zoomMs: number;
  onSelect: (line: number, word: number) => void;
  onSetTimestamp: (line: number, word: number, ms: number) => void;
  onSeek: (ms: number) => void;
}

// Longest a word block is drawn when nothing follows it soon.
const MAX_BLOCK_MS = 2000;
const LAST_BLOCK_MS = 800;

interface Block extends WordRef {
  id: string;
  text: string;
  start: number;
  end: number;
  min: number;
  max: number;
}

interface Drag {
  id: string;
  line: number;
  word: number;
  startX: number;
  origin: number;
  min: number;
  max: number;
  windowStart: number;
  ms: number;
  moved: boolean;
}

const fmt = (ms: number) => {
  const s = Math.max(0, ms) / 1000;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

/**
 * A zoomed lane of the song: the waveform with one block per timed word. Drag a block to
 * move where its word starts; click the lane to seek.
 */
export function WordLane({
  lines,
  flags,
  currentTime,
  isPlaying,
  selected,
  peaks,
  zoomMs,
  onSelect,
  onSetTimestamp,
  onSeek,
}: WordLaneProps) {
  const laneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [width, setWidth] = useState(1000);

  useEffect(() => {
    const el = laneRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 1000));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Timed words, each knowing the room it has to move in. The room comes from lyric
  // order, not time order, so a word timed out of order can be dragged across the wrong
  // neighbour to fix it; words stacked on one start can be dragged apart (moveWord pushes
  // the stacked ones along).
  const blocks = useMemo<Block[]>(() => {
    const timed: Array<WordRef & { id: string; text: string; start: number }> = [];
    lines.forEach((line, l) =>
      line.words.forEach((w, i) => {
        if (w.timestamp !== null) timed.push({ line: l, word: i, id: w.id, text: w.text, start: w.timestamp });
      })
    );
    const room = timed.map((t, i) => {
      let min = 0;
      for (let j = 0; j < i; j++) if (timed[j].start <= t.start) min = Math.max(min, timed[j].start + 10);
      let max = Number.MAX_SAFE_INTEGER;
      for (let j = i + 1; j < timed.length; j++) if (timed[j].start > t.start) max = Math.min(max, timed[j].start - 10);
      return { min, max };
    });
    const byTime = timed.map((t, i) => ({ ...t, ...room[i] })).sort((a, b) => a.start - b.start);
    return byTime.map((t, i) => {
      const next = byTime[i + 1]?.start;
      const end = next !== undefined ? Math.min(next, t.start + MAX_BLOCK_MS) : t.start + LAST_BLOCK_MS;
      return { ...t, end: Math.max(end, t.start + 1) };
    });
  }, [lines]);

  const flagged = useMemo(() => new Map(flags.map((f) => [f.id, f.reason])), [flags]);
  const selectedWord = lines[selected.line]?.words[selected.word];
  const selectedId = selectedWord?.id;

  // While playing the lane follows the playhead; paused, it frames the selected word.
  const focus = isPlaying || selectedWord?.timestamp == null ? currentTime : selectedWord.timestamp;
  const windowStart = drag ? drag.windowStart : Math.max(0, focus - zoomMs * 0.35);
  const windowEnd = windowStart + zoomMs;
  const xOf = (ms: number) => ((ms - windowStart) / zoomMs) * 100;

  // Waveform for the visible window.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const h = canvas.clientHeight || 96;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, h);
    if (!peaks) return;
    const step = 3;
    const msPerPx = zoomMs / width;
    for (let x = 0; x < width; x += step) {
      const from = windowStart + x * msPerPx;
      const v = peakBetween(peaks, from, from + step * msPerPx);
      const bar = Math.max(1, v * (h - 6));
      ctx.fillStyle = from < currentTime ? 'rgba(57,255,20,0.55)' : 'rgba(244,236,220,0.32)';
      ctx.fillRect(x, (h - bar) / 2, step - 1, bar);
    }
  }, [peaks, windowStart, zoomMs, width, currentTime]);

  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let t = Math.ceil(windowStart / 1000) * 1000; t <= windowEnd; t += 1000) out.push(t);
    return out;
  }, [windowStart, windowEnd]);

  const msFromEvent = (clientX: number, base: number) => {
    const rect = laneRef.current?.getBoundingClientRect();
    if (!rect) return base;
    return base + ((clientX - rect.left) / rect.width) * zoomMs;
  };

  const onPointerDown = (e: React.PointerEvent, b: Block) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    onSelect(b.line, b.word);
    setDrag({
      id: b.id,
      line: b.line,
      word: b.word,
      startX: e.clientX,
      origin: b.start,
      min: b.min,
      max: b.max,
      windowStart,
      ms: b.start,
      moved: false,
    });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const rect = laneRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = e.clientX - drag.startX;
    const ms = Math.round(Math.min(drag.max, Math.max(drag.min, drag.origin + (dx / rect.width) * zoomMs)));
    setDrag({ ...drag, ms, moved: drag.moved || Math.abs(dx) > 2 });
  };

  const onPointerUp = () => {
    if (!drag) return;
    if (drag.moved && drag.ms !== drag.origin) onSetTimestamp(drag.line, drag.word, drag.ms);
    else onSeek(drag.origin);
    setDrag(null);
  };

  return (
    <section className="lane" aria-label="Word timing lane">
      <div className="lane-ruler" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} style={{ left: `${xOf(t)}%` }}>
            {fmt(t)}
          </span>
        ))}
      </div>
      <div
        ref={laneRef}
        className="lane-track"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
        onClick={(e) => {
          if (!drag) onSeek(Math.max(0, msFromEvent(e.clientX, windowStart)));
        }}
      >
        <canvas ref={canvasRef} className="lane-wave" aria-hidden="true" />
        {!peaks && <span className="lane-nowave">Waveform appears once the song loads</span>}
        <div className="lane-words">
          {blocks
            .filter((b) => b.end >= windowStart && b.start <= windowEnd)
            .map((b) => {
              const live = drag?.id === b.id ? drag.ms : b.start;
              const end = drag?.id === b.id ? live + (b.end - b.start) : b.end;
              const reason = flagged.get(b.id);
              const playing = currentTime >= live && currentTime < end;
              const cls = ['lane-word', reason && 'flagged', b.id === selectedId && 'selected', playing && 'playing']
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  type="button"
                  key={b.id}
                  className={cls}
                  style={{ left: `${xOf(live)}%`, width: `calc(${((end - live) / zoomMs) * 100}% - 2px)` }}
                  title={`${b.text} · drag to move${reason ? ' · needs a look' : ''}`}
                  onPointerDown={(e) => onPointerDown(e, b)}
                  onClick={(e) => e.stopPropagation()}
                >
                  {b.text}
                </button>
              );
            })}
        </div>
        <div className="lane-head" style={{ left: `${xOf(currentTime)}%` }} aria-hidden="true" />
        {drag?.moved && (
          <div className="lane-drag-time" style={{ left: `${xOf(drag.ms)}%` }}>
            {(drag.ms / 1000).toFixed(2)}s
          </div>
        )}
      </div>
    </section>
  );
}
