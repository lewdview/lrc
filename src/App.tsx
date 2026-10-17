import { useState, useEffect } from 'react';
import { useAudioClock } from './hooks/useAudioClock';
import { useTapSync } from './hooks/useTapSync';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { Toolbar } from './components/Toolbar';
import { AudioPlayer } from './components/AudioPlayer';
import { LyricsEditor } from './components/LyricsEditor';
import { SyncViewport } from './components/SyncViewport';
import { Timeline } from './components/Timeline';
import { MetadataPanel } from './components/MetadataPanel';
import { StatusBar } from './components/StatusBar';
import { useAccount } from './hooks/useAccount';
import { downloadLRC } from './utils/exportLRC';
import { parseLyrics } from './utils/parser';
import type { Line, LyricsDocument } from './types/lyric';

const LOCAL_STORAGE_KEY = 'th3scr1b3_lrc_session';

export default function App() {
  const [rawText, setRawText] = useState('');
  const [viewTab, setViewTab] = useState<'editor' | 'sync'>('editor');
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Shared th3scr1b3.art login
  const account = useAccount();

  // Audio system
  const audioClock = useAudioClock();

  // Lyrics and sync system
  const tapSync = useTapSync([], { title: '', artist: '', album: '', by: '', offset: 0 });

  // Load session on mount
  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.rawText) setRawText(parsed.rawText);
        if (parsed.lines) tapSync.setLines(parsed.lines);
        if (parsed.metadata) tapSync.setMetadata(parsed.metadata);
        if (parsed.lines && parsed.lines.length > 0) {
          setViewTab('sync');
        }
      } catch (e) {
        console.error('Failed to restore session from LocalStorage', e);
      }
    }
  }, []);

  // Sync rawText back whenever lines change due to word editing
  useEffect(() => {
    if (tapSync.lines && tapSync.lines.length > 0) {
      const regeneratedRaw = tapSync.lines
        .map((line) => line.words.map((w) => w.text).join(' '))
        .join('\n');
      if (regeneratedRaw !== rawText) {
        setRawText(regeneratedRaw);
      }
    }
  }, [tapSync.lines]);

  // Autosave periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const payload = {
        rawText,
        lines: tapSync.lines,
        metadata: tapSync.metadata,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));

      const now = new Date();
      setLastSaved(
        `${now.getHours().toString().padStart(2, '0')}:${now
          .getMinutes()
          .toString()
          .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
      );
    }, 5000);

    return () => clearInterval(interval);
  }, [rawText, tapSync.lines, tapSync.metadata]);

  // Auto-scroll/advance line to follow playhead if already time-mapped
  useEffect(() => {
    if (!audioClock.isPlaying) return;

    const activeWord = tapSync.lines[tapSync.activeLineIndex]?.words?.[tapSync.activeWordIndex];
    const isReviewMode = activeWord && activeWord.timestamp !== null;

    if (!isReviewMode) return;

    let playingLineIndex = -1;
    let maxTime = -1;

    tapSync.lines.forEach((line, lIdx) => {
      line.words.forEach((word) => {
        if (word.timestamp !== null && word.timestamp <= audioClock.currentTime) {
          if (word.timestamp > maxTime) {
            maxTime = word.timestamp;
            playingLineIndex = lIdx;
          }
        }
      });
    });

    if (playingLineIndex !== -1 && playingLineIndex !== tapSync.activeLineIndex) {
      tapSync.jumpToWord(playingLineIndex, 0);
    }
  }, [
    audioClock.currentTime,
    audioClock.isPlaying,
    tapSync.lines,
    tapSync.activeLineIndex,
    tapSync.activeWordIndex,
    tapSync.jumpToWord,
  ]);

  // Handle parsing callback
  const handleLyricsParsed = (newLines: Line[]) => {
    tapSync.setLines(newLines);
    setViewTab('sync');
  };

  // Build the live doc object for exports
  const activeDocument: LyricsDocument = {
    metadata: tapSync.metadata,
    lines: tapSync.lines,
  };

  const handleDownload = () => {
    downloadLRC(activeDocument);
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the session? This will wipe your progress.')) {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      setRawText('');
      tapSync.setLines([]);
      tapSync.setMetadata({ title: '', artist: '', album: '', by: '', offset: 0 });
      audioClock.setAudioUrl(null);
      setViewTab('editor');
    }
  };

  // Keyboard shortcut actions mapping
  const keyboardActions = {
    currentTime: audioClock.currentTime,
    activeLineIndex: tapSync.activeLineIndex,
    activeWordIndex: tapSync.activeWordIndex,
    syncNextWord: tapSync.syncNextWord,
    nudgeWordTimestamp: tapSync.nudgeWordTimestamp,
    clearWordTimestamp: tapSync.clearWordTimestamp,
    undo: tapSync.undo,
    redo: tapSync.redo,
    jumpToFirstUnsynced: tapSync.jumpToFirstUnsynced,
    jumpToLastWord: tapSync.jumpToLastWord,
    prevWord: tapSync.prevWord,
    nextLine: tapSync.nextLine,
  };

  // Enable shortcuts in sync tab only
  useKeyboardShortcuts(keyboardActions, viewTab === 'sync');

  const tabs: Array<{ id: 'editor' | 'sync'; label: string; onClick: () => void }> = [
    { id: 'editor', label: 'Lyrics', onClick: () => setViewTab('editor') },
    {
      id: 'sync',
      label: 'Sync words',
      onClick: () => {
        // Parse on the way in if the text was never parsed.
        if (tapSync.lines.length === 0 && rawText.trim()) handleLyricsParsed(parseLyrics(rawText));
        else setViewTab('sync');
      },
    },
  ];

  return (
    <div className="app">
      <div className="grain" aria-hidden="true" />

      <Toolbar
        document={activeDocument}
        account={account}
        setMetadata={tapSync.setMetadata}
        setLyricsRaw={setRawText}
        setAudioUrl={audioClock.setAudioUrl}
        onDownload={handleDownload}
        onClear={handleClear}
        onImportSyncedLines={(lines) => {
          tapSync.setLines(lines);
          setViewTab('sync');
        }}
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
      />

      <nav className="tabs" role="tablist" aria-label="Workflow">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={viewTab === tab.id}
            className={`tab ${viewTab === tab.id ? 'active' : ''}`}
            onClick={tab.onClick}
          >
            <span className="tab-index">{String(i + 1).padStart(2, '0')}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="main">
        {viewTab === 'editor' ? (
          <LyricsEditor rawText={rawText} setRawText={setRawText} onParsed={handleLyricsParsed} />
        ) : (
          <div className="workspace">
            <Timeline
              lines={tapSync.lines}
              currentTime={audioClock.currentTime}
              activeLineIndex={tapSync.activeLineIndex}
              activeWordIndex={tapSync.activeWordIndex}
              onSeek={audioClock.seek}
              onNudge={tapSync.nudgeWordTimestamp}
              onSetTimestamp={tapSync.setWordTimestamp}
              onSelectWord={tapSync.jumpToWord}
              onEditWordText={tapSync.editWordText}
              onAddWord={tapSync.addWordToLine}
              onDeleteWord={tapSync.deleteWord}
            />
            <SyncViewport
              lines={tapSync.lines}
              activeLineIndex={tapSync.activeLineIndex}
              activeWordIndex={tapSync.activeWordIndex}
              currentTime={audioClock.currentTime}
              onWordClick={tapSync.jumpToWord}
              onReTimeLine={tapSync.reTimeLine}
              onEditWordText={tapSync.editWordText}
              onAddWord={tapSync.addWordToLine}
              onDeleteWord={tapSync.deleteWord}
              onAddLine={tapSync.addLine}
            />
          </div>
        )}
      </main>

      <MetadataPanel metadata={tapSync.metadata} onChange={tapSync.setMetadata} />

      <StatusBar lines={tapSync.lines} lastSaved={lastSaved} />
    </div>
  );
}
