import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAudioClock } from './hooks/useAudioClock';
import { useTapSync } from './hooks/useTapSync';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useWaveform } from './hooks/useWaveform';
import { Toolbar } from './components/Toolbar';
import { AudioPlayer } from './components/AudioPlayer';
import { ModeBar, type SyncMode } from './components/ModeBar';
import { WordLane } from './components/WordLane';
import { LineList } from './components/LineList';
import { Inspector } from './components/Inspector';
import { TapPanel } from './components/TapPanel';
import { MetadataPanel } from './components/MetadataPanel';
import { StatusBar } from './components/StatusBar';
import { Modal } from './components/Modal';
import { useAccount } from './hooks/useAccount';
import { downloadLRC } from './utils/exportLRC';
import { parseLyrics } from './utils/parser';
import {
  computeFlags,
  lineStart,
  lineText,
  moveWord,
  nextLineStart,
  replaceLineTexts,
  shiftFromLine,
  spreadLineEvenly,
  timeLineFromTap,
  wordAt,
  type WordRef,
} from './utils/review';
import type { Line, LyricsDocument } from './types/lyric';

const LOCAL_STORAGE_KEY = 'th3scr1b3_lrc_session';
const EMPTY_META = { title: '', artist: '', album: '', by: '', offset: 0 };

const hasTimings = (lines: Line[]) => lines.some((l) => l.words.some((w) => w.timestamp !== null));

export default function App() {
  const [mode, setMode] = useState<SyncMode>('review');
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [zoomMs, setZoomMs] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 700 ? 4000 : 8000));
  const [looping, setLooping] = useState(false);
  const [pasteDraft, setPasteDraft] = useState<string | null>(null);

  const account = useAccount();
  const audioClock = useAudioClock();
  const waveform = useWaveform(audioClock.audioUrl);
  const tapSync = useTapSync([], EMPTY_META);
  const { lines } = tapSync;
  const selected: WordRef = { line: tapSync.activeLineIndex, word: tapSync.activeWordIndex };

  // Restore the last session.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.lines) && parsed.lines.length) {
        tapSync.setLines(parsed.lines);
        if (!hasTimings(parsed.lines)) setMode('lines');
      } else if (typeof parsed.rawText === 'string' && parsed.rawText.trim()) {
        tapSync.setLines(parseLyrics(parsed.rawText));
        setMode('lines');
      }
      if (parsed.metadata) tapSync.setMetadata(parsed.metadata);
    } catch (e) {
      console.error('Failed to restore session from LocalStorage', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave.
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        localStorage.setItem(
          LOCAL_STORAGE_KEY,
          JSON.stringify({ lines: tapSync.lines, metadata: tapSync.metadata })
        );
        const now = new Date();
        setLastSaved(now.toTimeString().slice(0, 8));
      } catch {
        // storage full or blocked: keep working
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [tapSync.lines, tapSync.metadata]);

  const flags = useMemo(() => computeFlags(lines), [lines]);
  const totalWords = useMemo(() => lines.reduce((n, l) => n + l.words.length, 0), [lines]);
  const flagTimes = useMemo(() => {
    const out: number[] = [];
    for (const f of flags) {
      const w = lines[f.line]?.words[f.word];
      const t = w?.timestamp ?? lineStart(lines[f.line]) ?? nextLineStart(lines, f.line);
      if (t !== null && t !== undefined) out.push(t);
    }
    return out;
  }, [flags, lines]);
  const playing = audioClock.currentTime > 0 ? wordAt(lines, audioClock.currentTime) : null;

  // ---- loop the selected line ----
  const loopRange = useMemo(() => {
    const line = lines[selected.line];
    const start = line ? lineStart(line) : null;
    if (start === null || !line) return null;
    const timed = line.words.map((w) => w.timestamp).filter((t): t is number => t !== null);
    const next = nextLineStart(lines, selected.line);
    const end = next !== null && next > start ? next : Math.max(...timed) + 1500;
    return { start: Math.max(0, start - 250), end: end + 100 };
  }, [lines, selected.line]);

  useEffect(() => {
    if (!looping || !loopRange || !audioClock.isPlaying) return;
    if (audioClock.currentTime >= loopRange.end || audioClock.currentTime < loopRange.start - 1000) {
      audioClock.seek(loopRange.start);
    }
  }, [looping, loopRange, audioClock]);

  const toggleLoop = useCallback(() => {
    setLooping((on) => {
      if (!on && loopRange) {
        audioClock.seek(loopRange.start);
        audioClock.play();
      }
      return !on;
    });
  }, [loopRange, audioClock]);

  // ---- selection ----
  const select = useCallback(
    (line: number, word: number, seek = false) => {
      tapSync.jumpToWord(line, word);
      const ts = lines[line]?.words[word]?.timestamp;
      if (seek && ts != null && !audioClock.isPlaying) audioClock.seek(ts);
    },
    [tapSync, lines, audioClock]
  );

  const selectWord = (delta: number) => {
    let { line, word } = selected;
    word += delta;
    while (line >= 0 && line < lines.length && (word < 0 || word >= lines[line].words.length)) {
      if (word < 0) {
        line -= 1;
        if (line >= 0) word = lines[line].words.length - 1;
      } else {
        line += 1;
        word = 0;
      }
    }
    if (line >= 0 && line < lines.length) select(line, Math.max(0, word), true);
  };

  const selectLine = (delta: number) => {
    const line = Math.max(0, Math.min(lines.length - 1, selected.line + delta));
    select(line, 0, true);
  };

  const nextToCheck = () => {
    if (flags.length === 0) return;
    const after = flags.find((f) => f.line > selected.line || (f.line === selected.line && f.word > selected.word));
    const f = after ?? flags[0];
    tapSync.jumpToWord(f.line, f.word);
    const ts = lines[f.line].words[f.word].timestamp ?? lineStart(lines[f.line]);
    if (ts !== null) audioClock.seek(Math.max(0, ts - 800));
  };

  // ---- edits ----
  const setTimestamp = (line: number, word: number, ms: number | null) => tapSync.setWordTimestamp(line, word, ms);

  const setNow = () => {
    const now = Math.round(audioClock.currentTime);
    tapSync.updateLines(
      (ls) => ls.map((l, i) => (i !== selected.line ? l : { ...l, words: l.words.map((w, j) => (j === selected.word ? { ...w, timestamp: now } : w)) })),
      // while playing, move on so T can follow the song word by word
      audioClock.isPlaying ? nextRef(selected) : selected
    );
  };

  function nextRef(ref: WordRef): WordRef {
    const line = lines[ref.line];
    if (line && ref.word < line.words.length - 1) return { line: ref.line, word: ref.word + 1 };
    for (let l = ref.line + 1; l < lines.length; l++) if (lines[l].words.length) return { line: l, word: 0 };
    return ref;
  }

  const nextNonEmptyLine = (from: number) => {
    for (let l = from + 1; l < lines.length; l++) if (lines[l].words.length) return l;
    return from;
  };

  const tap = () => {
    const now = Math.round(audioClock.currentTime);
    if (mode === 'words') {
      tapSync.syncNextWord(now);
      return;
    }
    tapSync.updateLines((ls) => timeLineFromTap(ls, selected.line, now), { line: nextNonEmptyLine(selected.line), word: 0 });
  };

  const tapBack = () => {
    if (mode === 'words') tapSync.prevWord();
    else {
      let l = selected.line - 1;
      while (l > 0 && lines[l].words.length === 0) l--;
      select(Math.max(0, l), 0);
    }
  };

  const replay = () => audioClock.seek(Math.max(0, audioClock.currentTime - 3000));

  const replaceLines = (start: number, count: number, texts: string[], sel: WordRef) =>
    tapSync.updateLines((ls) => replaceLineTexts(ls, start, count, texts), sel);

  // ---- loading songs and lyrics ----
  const importLines = (newLines: Line[]) => {
    tapSync.setLines(newLines);
    tapSync.jumpToWord(0, 0);
    setLooping(false);
    setMode(hasTimings(newLines) ? 'review' : 'lines');
  };

  // Plain lyrics (no timings) from the catalog: parse them straight into lines.
  const loadPlainLyrics = (text: string) => {
    if (!text.trim() || text.trim().startsWith('//')) {
      importLines([]);
      setPasteDraft('');
      return;
    }
    importLines(parseLyrics(text));
  };

  const applyPaste = () => {
    if (pasteDraft === null) return;
    const texts = pasteDraft.split(/\r?\n/);
    const next = replaceLineTexts(lines, 0, lines.length, texts, { splitRunOns: true });
    tapSync.updateLines(() => next, { line: 0, word: 0 });
    if (!hasTimings(next)) setMode('lines');
    setPasteDraft(null);
  };

  const activeDocument: LyricsDocument = { metadata: tapSync.metadata, lines };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the session? This will wipe your progress.')) {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      tapSync.setLines([]);
      tapSync.setMetadata(EMPTY_META);
      audioClock.setAudioUrl(null);
      setLooping(false);
    }
  };

  useKeyboardShortcuts(
    {
      mode,
      isPlaying: audioClock.isPlaying,
      togglePlay: () => (audioClock.isPlaying ? audioClock.pause() : audioClock.play()),
      play: audioClock.play,
      replay,
      tap,
      tapBack,
      selectWord,
      selectLine,
      nudge: (d) => tapSync.nudgeWordTimestamp(selected.line, selected.word, d),
      setNow,
      clear: () => tapSync.clearWordTimestamp(selected.line, selected.word),
      nextToCheck,
      toggleLoop,
      editLine: () => window.dispatchEvent(new Event('lrc:edit-line')),
      undo: tapSync.undo,
      redo: tapSync.redo,
    },
    pasteDraft === null
  );

  return (
    <div className="app">
      <div className="grain" aria-hidden="true" />

      <Toolbar
        document={activeDocument}
        account={account}
        setMetadata={tapSync.setMetadata}
        setLyricsRaw={loadPlainLyrics}
        setAudioUrl={audioClock.setAudioUrl}
        onDownload={() => downloadLRC(activeDocument)}
        onClear={handleClear}
        onImportSyncedLines={importLines}
      />

      <AudioPlayer
        isPlaying={audioClock.isPlaying}
        currentTime={audioClock.currentTime}
        duration={audioClock.duration}
        playbackRate={audioClock.playbackRate}
        play={audioClock.play}
        pause={audioClock.pause}
        stop={audioClock.stop}
        seek={audioClock.seek}
        skip={audioClock.skip}
        setPlaybackRate={audioClock.setPlaybackRate}
        audioUrl={audioClock.audioUrl}
        peaks={waveform.peaks}
        flagTimes={flagTimes}
        looping={looping}
        onToggleLoop={toggleLoop}
      />

      <ModeBar
        mode={mode}
        onMode={setMode}
        total={totalWords}
        toCheck={flags.length}
        onNextToCheck={nextToCheck}
        zoomMs={zoomMs}
        onZoom={setZoomMs}
        onPaste={() => setPasteDraft(lines.map(lineText).join('\n'))}
      />

      <WordLane
        lines={lines}
        flags={flags}
        currentTime={audioClock.currentTime}
        isPlaying={audioClock.isPlaying}
        selected={selected}
        peaks={waveform.peaks}
        zoomMs={zoomMs}
        onSelect={(l, w) => tapSync.jumpToWord(l, w)}
        onSetTimestamp={(l, w, ms) => tapSync.updateLines((ls) => moveWord(ls, { line: l, word: w }, ms))}
        onSeek={audioClock.seek}
      />

      <main className="main">
        <div className="workspace">
          <LineList
            lines={lines}
            flags={flags}
            selected={selected}
            playing={playing}
            onSelect={(l, w) => tapSync.jumpToWord(l, w)}
            onSeek={audioClock.seek}
            onReplaceLines={replaceLines}
          />
          {mode === 'review' ? (
            <Inspector
              lines={lines}
              flags={flags}
              selected={selected}
              playing={playing}
              currentTime={audioClock.currentTime}
              isPlaying={audioClock.isPlaying}
              onSetTimestamp={setTimestamp}
              onNudge={tapSync.nudgeWordTimestamp}
              onSpreadLine={(l) => tapSync.updateLines((ls) => spreadLineEvenly(ls, l))}
              onShiftFrom={(l, d) => tapSync.updateLines((ls) => shiftFromLine(ls, l, d))}
              onDeleteLine={(l) => replaceLines(l, 1, [], { line: Math.max(0, l - 1), word: 0 })}
            />
          ) : (
            <TapPanel
              mode={mode}
              lines={lines}
              lineIndex={selected.line}
              wordIndex={selected.word}
              isPlaying={audioClock.isPlaying}
              onTap={() => (audioClock.isPlaying ? tap() : audioClock.play())}
              onBack={tapBack}
              onReplay={replay}
            />
          )}
        </div>
      </main>

      <MetadataPanel metadata={tapSync.metadata} onChange={tapSync.setMetadata} />

      <StatusBar lines={lines} lastSaved={lastSaved} mode={mode} />

      {pasteDraft !== null && (
        <Modal title="Paste lyrics" onClose={() => setPasteDraft(null)}>
          <p className="modal-note">
            One line per sung line. Words that match the current lyrics keep their timing; new or changed words come back
            to be timed. Very long lines are split where a new sung line starts.
          </p>
          <textarea
            className="editor-text paste-text"
            aria-label="Lyrics"
            value={pasteDraft}
            placeholder="Paste the lyrics here…"
            onChange={(e) => setPasteDraft(e.target.value)}
          />
          <div className="modal-row">
            <button className="btn btn-primary btn-lg" onClick={applyPaste} disabled={!pasteDraft.trim()}>
              Use these lyrics
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
