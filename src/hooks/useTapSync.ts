import { useState, useCallback, useMemo } from 'react';
import type { Line, LyricsDocument, HistoryState } from '../types/lyric';

export interface UseTapSync {
  lines: Line[];
  metadata: LyricsDocument['metadata'];
  activeLineIndex: number;
  activeWordIndex: number;
  setLines: (lines: Line[]) => void;
  setMetadata: (meta: LyricsDocument['metadata']) => void;
  syncNextWord: (timestamp: number) => void;
  undo: () => void;
  redo: () => void;
  nudgeWordTimestamp: (lineIndex: number, wordIndex: number, deltaMs: number) => void;
  clearWordTimestamp: (lineIndex: number, wordIndex: number) => void;
  setWordTimestamp: (lineIndex: number, wordIndex: number, timestamp: number | null) => void;
  editWordText: (lineIndex: number, wordIndex: number, newText: string) => void;
  addWordToLine: (lineIndex: number, afterWordIndex?: number, wordText?: string) => void;
  deleteWord: (lineIndex: number, wordIndex: number) => void;
  addLine: (afterLineIndex?: number) => void;
  deleteLine: (lineIndex: number) => void;
  jumpToWord: (lineIndex: number, wordIndex: number) => void;
  jumpToFirstUnsynced: () => void;
  jumpToLastWord: () => void;
  prevWord: () => void;
  nextLine: () => void;
  reTimeLine: (lineIndex: number) => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useTapSync(initialLines: Line[] = [], initialMetadata: LyricsDocument['metadata'] = { title: '', artist: '' }): UseTapSync {
  const [lines, setLinesState] = useState<Line[]>(initialLines);
  const [metadata, setMetadataState] = useState<LyricsDocument['metadata']>(initialMetadata);

  // Focus indices
  const [activeLineIndex, setActiveLineIndex] = useState<number>(0);
  const [activeWordIndex, setActiveWordIndex] = useState<number>(0);

  // Undo / Redo Stacks
  const [undoStack, setUndoStack] = useState<HistoryState[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryState[]>([]);

  // Pushes current state to the undo stack
  const saveStateToHistory = useCallback((currentLines: Line[], currentMeta: LyricsDocument['metadata']) => {
    setUndoStack((prev) => [...prev, { lines: currentLines, metadata: currentMeta }]);
    setRedoStack([]); // Clear redo stack on new action
  }, []);

  const setLines = useCallback((newLines: Line[]) => {
    saveStateToHistory(lines, metadata);
    setLinesState(newLines);
  }, [lines, metadata, saveStateToHistory]);

  const setMetadata = useCallback((newMeta: LyricsDocument['metadata']) => {
    saveStateToHistory(lines, metadata);
    setMetadataState(newMeta);
  }, [lines, metadata, saveStateToHistory]);

  // Sync current word and advance cursor
  const syncNextWord = useCallback((timestamp: number) => {
    const newLines = lines.map((line, lIdx) => {
      if (lIdx !== activeLineIndex) return line;
      return {
        ...line,
        words: line.words.map((word, wIdx) => {
          if (wIdx !== activeWordIndex) return word;
          return { ...word, timestamp };
        }),
      };
    });

    saveStateToHistory(lines, metadata);
    setLinesState(newLines);

    // Advance pointer
    const currentLine = lines[activeLineIndex];
    if (currentLine) {
      if (activeWordIndex < currentLine.words.length - 1) {
        setActiveWordIndex(activeWordIndex + 1);
      } else if (activeLineIndex < lines.length - 1) {
        setActiveLineIndex(activeLineIndex + 1);
        setActiveWordIndex(0);
      }
    }
  }, [lines, metadata, activeLineIndex, activeWordIndex, saveStateToHistory]);

  // Navigation: Go to previous word
  const prevWord = useCallback(() => {
    if (activeWordIndex > 0) {
      setActiveWordIndex(activeWordIndex - 1);
    } else if (activeLineIndex > 0) {
      const prevLine = lines[activeLineIndex - 1];
      setActiveLineIndex(activeLineIndex - 1);
      setActiveWordIndex(prevLine.words.length > 0 ? prevLine.words.length - 1 : 0);
    }
  }, [lines, activeLineIndex, activeWordIndex]);

  // Navigation: Jump to next line
  const nextLine = useCallback(() => {
    if (activeLineIndex < lines.length - 1) {
      setActiveLineIndex(activeLineIndex + 1);
      setActiveWordIndex(0);
    }
  }, [lines, activeLineIndex]);

  // Jump to specific word
  const jumpToWord = useCallback((lineIndex: number, wordIndex: number) => {
    if (lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex];
      if (wordIndex >= 0 && wordIndex < line.words.length) {
        setActiveLineIndex(lineIndex);
        setActiveWordIndex(wordIndex);
      }
    }
  }, [lines]);

  // Jump to first unsynced word
  const jumpToFirstUnsynced = useCallback(() => {
    for (let l = 0; l < lines.length; l++) {
      const line = lines[l];
      for (let w = 0; w < line.words.length; w++) {
        if (line.words[w].timestamp === null) {
          setActiveLineIndex(l);
          setActiveWordIndex(w);
          return;
        }
      }
    }
  }, [lines]);

  // Jump to last word
  const jumpToLastWord = useCallback(() => {
    if (lines.length === 0) return;
    const lastLineIdx = lines.length - 1;
    const lastLine = lines[lastLineIdx];
    setActiveLineIndex(lastLineIdx);
    setActiveWordIndex(lastLine.words.length > 0 ? lastLine.words.length - 1 : 0);
  }, [lines]);

  // Nudge timestamp
  const nudgeWordTimestamp = useCallback((lineIndex: number, wordIndex: number, deltaMs: number) => {
    const targetLine = lines[lineIndex];
    if (!targetLine) return;
    const targetWord = targetLine.words[wordIndex];
    if (!targetWord || targetWord.timestamp === null) return;

    const newTimestamp = Math.max(0, targetWord.timestamp + deltaMs);
    const newLines = lines.map((line, lIdx) => {
      if (lIdx !== lineIndex) return line;
      return {
        ...line,
        words: line.words.map((word, wIdx) => {
          if (wIdx !== wordIndex) return word;
          return { ...word, timestamp: newTimestamp };
        }),
      };
    });

    saveStateToHistory(lines, metadata);
    setLinesState(newLines);
  }, [lines, metadata, saveStateToHistory]);

  // Clear single word timestamp
  const clearWordTimestamp = useCallback((lineIndex: number, wordIndex: number) => {
    const newLines = lines.map((line, lIdx) => {
      if (lIdx !== lineIndex) return line;
      return {
        ...line,
        words: line.words.map((word, wIdx) => {
          if (wIdx !== wordIndex) return word;
          return { ...word, timestamp: null };
        }),
      };
    });

    saveStateToHistory(lines, metadata);
    setLinesState(newLines);
  }, [lines, metadata, saveStateToHistory]);

  // Set explicit timestamp
  const setWordTimestamp = useCallback((lineIndex: number, wordIndex: number, timestamp: number | null) => {
    const newLines = lines.map((line, lIdx) => {
      if (lIdx !== lineIndex) return line;
      return {
        ...line,
        words: line.words.map((word, wIdx) => {
          if (wIdx !== wordIndex) return word;
          return { ...word, timestamp };
        }),
      };
    });

    saveStateToHistory(lines, metadata);
    setLinesState(newLines);
  }, [lines, metadata, saveStateToHistory]);

  // Edit text of a word
  const editWordText = useCallback((lineIndex: number, wordIndex: number, newText: string) => {
    const newLines = lines.map((line, lIdx) => {
      if (lIdx !== lineIndex) return line;
      return {
        ...line,
        words: line.words.map((word, wIdx) => {
          if (wIdx !== wordIndex) return word;
          return { ...word, text: newText };
        }),
      };
    });

    saveStateToHistory(lines, metadata);
    setLinesState(newLines);
  }, [lines, metadata, saveStateToHistory]);

  // Add a new word to a line
  const addWordToLine = useCallback((lineIndex: number, afterWordIndex?: number, wordText: string = 'word') => {
    const newLines = lines.map((line, lIdx) => {
      if (lIdx !== lineIndex) return line;
      const newWords = [...line.words];
      const insertIdx = afterWordIndex !== undefined ? afterWordIndex + 1 : newWords.length;
      newWords.splice(insertIdx, 0, {
        id: Math.random().toString(36).substring(2, 9),
        text: wordText,
        timestamp: null,
      });
      return { ...line, words: newWords };
    });

    saveStateToHistory(lines, metadata);
    setLinesState(newLines);
  }, [lines, metadata, saveStateToHistory]);

  // Delete a word from a line
  const deleteWord = useCallback((lineIndex: number, wordIndex: number) => {
    const newLines = lines.map((line, lIdx) => {
      if (lIdx !== lineIndex) return line;
      const newWords = line.words.filter((_, wIdx) => wIdx !== wordIndex);
      return { ...line, words: newWords };
    });

    saveStateToHistory(lines, metadata);
    setLinesState(newLines);
  }, [lines, metadata, saveStateToHistory]);

  // Add a new line
  const addLine = useCallback((afterLineIndex?: number) => {
    const newLines = [...lines];
    const insertIdx = afterLineIndex !== undefined ? afterLineIndex + 1 : newLines.length;
    newLines.splice(insertIdx, 0, {
      id: Math.random().toString(36).substring(2, 9),
      words: [{
        id: Math.random().toString(36).substring(2, 9),
        text: 'word',
        timestamp: null,
      }],
    });

    saveStateToHistory(lines, metadata);
    setLinesState(newLines);
    setActiveLineIndex(insertIdx);
    setActiveWordIndex(0);
  }, [lines, metadata, saveStateToHistory]);

  // Delete a line
  const deleteLine = useCallback((lineIndex: number) => {
    if (lines.length <= 1) return;
    const newLines = lines.filter((_, lIdx) => lIdx !== lineIndex);

    saveStateToHistory(lines, metadata);
    setLinesState(newLines);
    setActiveLineIndex((prev) => Math.min(prev, newLines.length - 1));
    setActiveWordIndex(0);
  }, [lines, metadata, saveStateToHistory]);

  // Undo Action
  const undo = useCallback(() => {
    if (undoStack.length === 0) return;

    const prevState = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, { lines, metadata }]);

    setLinesState(prevState.lines);
    setMetadataState(prevState.metadata);
  }, [undoStack, lines, metadata]);

  // Redo Action
  const redo = useCallback(() => {
    if (redoStack.length === 0) return;

    const nextState = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, { lines, metadata }]);

    setLinesState(nextState.lines);
    setMetadataState(nextState.metadata);
  }, [redoStack, lines, metadata]);

  // Reset all timestamps in a line and jump cursor there
  const reTimeLine = useCallback((lineIndex: number) => {
    const newLines = lines.map((line, lIdx) => {
      if (lIdx !== lineIndex) return line;
      return {
        ...line,
        words: line.words.map((word) => ({ ...word, timestamp: null })),
      };
    });

    saveStateToHistory(lines, metadata);
    setLinesState(newLines);
    setActiveLineIndex(lineIndex);
    setActiveWordIndex(0);
  }, [lines, metadata, saveStateToHistory]);

  const canUndo = useMemo(() => undoStack.length > 0, [undoStack]);
  const canRedo = useMemo(() => redoStack.length > 0, [redoStack]);

  return {
    lines,
    metadata,
    activeLineIndex,
    activeWordIndex,
    setLines,
    setMetadata,
    syncNextWord,
    undo,
    redo,
    nudgeWordTimestamp,
    clearWordTimestamp,
    setWordTimestamp,
    editWordText,
    addWordToLine,
    deleteWord,
    addLine,
    deleteLine,
    jumpToWord,
    jumpToFirstUnsynced,
    jumpToLastWord,
    prevWord,
    nextLine,
    reTimeLine,
    canUndo,
    canRedo,
  };
}
