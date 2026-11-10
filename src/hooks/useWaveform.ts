import { useEffect, useState } from 'react';

/** Peak level (0–1) for every 10 ms of the song. */
export const PEAK_MS = 10;

export interface Waveform {
  peaks: Float32Array | null;
  status: 'idle' | 'loading' | 'ready' | 'unavailable';
}

const MEDIA_HOST = 'https://files.th3scr1b3.art/';

// The release CDN doesn't send CORS headers, so the browser may play its audio but not
// read it. /media/* is proxied to the CDN by this deploy (vercel.json, vite.config.ts),
// which makes the bytes same-origin and decodable.
function readableUrl(url: string): string {
  if (url.startsWith(MEDIA_HOST)) return `/media/${url.slice(MEDIA_HOST.length)}`;
  return url;
}

async function decodePeaks(url: string, signal: AbortSignal): Promise<Float32Array> {
  const res = await fetch(readableUrl(url), { signal });
  if (!res.ok) throw new Error(`audio ${res.status}`);
  const bytes = await res.arrayBuffer();
  const Ctx = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  // Decoding needs a context; its own sample rate doesn't matter for peaks.
  const ctx = new Ctx(1, 1, 22050);
  const audio = await ctx.decodeAudioData(bytes);
  const binSize = Math.max(1, Math.round((audio.sampleRate * PEAK_MS) / 1000));
  const bins = Math.ceil(audio.length / binSize);
  const peaks = new Float32Array(bins);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const data = audio.getChannelData(c);
    for (let b = 0; b < bins; b++) {
      let max = 0;
      const end = Math.min(data.length, (b + 1) * binSize);
      for (let i = b * binSize; i < end; i++) {
        const v = data[i] < 0 ? -data[i] : data[i];
        if (v > max) max = v;
      }
      if (max > peaks[b]) peaks[b] = max;
    }
  }
  let top = 0;
  for (let b = 0; b < bins; b++) if (peaks[b] > top) top = peaks[b];
  if (top > 0) for (let b = 0; b < bins; b++) peaks[b] /= top;
  return peaks;
}

/** Decode the song once and keep its peaks for the overview and the word lane. */
export function useWaveform(audioUrl: string | null): Waveform {
  const [state, setState] = useState<Waveform & { url: string | null }>({ peaks: null, status: 'idle', url: null });

  useEffect(() => {
    if (!audioUrl) return;
    const controller = new AbortController();
    let alive = true;
    // Defer so the state change lands outside the effect body.
    queueMicrotask(() => alive && setState({ peaks: null, status: 'loading', url: audioUrl }));
    decodePeaks(audioUrl, controller.signal)
      .then((peaks) => alive && setState({ peaks, status: 'ready', url: audioUrl }))
      .catch((err) => {
        if (!alive) return;
        console.warn('Waveform unavailable:', err);
        setState({ peaks: null, status: 'unavailable', url: audioUrl });
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [audioUrl]);

  if (!audioUrl || state.url !== audioUrl) return { peaks: null, status: audioUrl ? 'loading' : 'idle' };
  return { peaks: state.peaks, status: state.status };
}

/** Max peak over [fromMs, toMs). */
export function peakBetween(peaks: Float32Array, fromMs: number, toMs: number): number {
  const a = Math.max(0, Math.floor(fromMs / PEAK_MS));
  const b = Math.min(peaks.length, Math.max(a + 1, Math.ceil(toMs / PEAK_MS)));
  let max = 0;
  for (let i = a; i < b; i++) if (peaks[i] > max) max = peaks[i];
  return max;
}
