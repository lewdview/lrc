import { useEffect, useRef } from 'react';
import type { SyncMode } from '../components/ModeBar';

export interface KeyboardShortcutActions {
  mode: SyncMode;
  isPlaying: boolean;
  togglePlay: () => void;
  play: () => void;
  replay: () => void;
  /** Space in a tap mode while the song plays. */
  tap: () => void;
  /** Backspace in a tap mode: step back one line or word. */
  tapBack: () => void;
  selectWord: (delta: number) => void;
  selectLine: (delta: number) => void;
  nudge: (deltaMs: number) => void;
  setNow: () => void;
  clear: () => void;
  nextToCheck: () => void;
  toggleLoop: () => void;
  editLine: () => void;
  undo: () => void;
  redo: () => void;
}

export const SHORTCUTS: Record<SyncMode, Array<[string, string]>> = {
  review: [
    ['Space', 'Play / pause'],
    ['← →', 'Prev / next word'],
    [', .', 'Nudge 10ms (⇧ 100ms)'],
    ['T', 'Word starts now'],
    ['N', 'Next to check'],
    ['L', 'Loop line'],
    ['E', 'Edit line'],
  ],
  lines: [
    ['Space', 'Line starts now'],
    ['⌫', 'Back a line'],
    ['R', 'Back 3s'],
    ['P', 'Play / pause'],
    ['Ctrl Z', 'Undo'],
  ],
  words: [
    ['Space', 'Word starts now'],
    ['⌫', 'Back a word'],
    ['R', 'Back 3s'],
    ['P', 'Play / pause'],
    ['Ctrl Z', 'Undo'],
  ],
};

export function useKeyboardShortcuts(actions: KeyboardShortcutActions, enabled: boolean = true) {
  // Read the latest actions without re-binding the listener on every render.
  const ref = useRef(actions);
  useEffect(() => {
    ref.current = actions;
  });

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (
        el &&
        (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }
      if (e.altKey) return;

      const a = ref.current;
      const tapMode = a.mode !== 'review';
      const key = e.key;

      if ((e.metaKey || e.ctrlKey) && key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) a.redo();
        else a.undo();
        return;
      }
      if (e.metaKey || e.ctrlKey) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (e.repeat) return;
        if (!tapMode) a.togglePlay();
        else if (!a.isPlaying) a.play();
        else a.tap();
        return;
      }
      if (e.repeat && !['ArrowLeft', 'ArrowRight', ',', '.', '<', '>'].includes(key)) return;

      switch (key) {
        case 'Backspace':
          if (tapMode) {
            e.preventDefault();
            a.tapBack();
          }
          return;
        case 'ArrowLeft':
          e.preventDefault();
          a.selectWord(-1);
          return;
        case 'ArrowRight':
          e.preventDefault();
          a.selectWord(1);
          return;
        case 'ArrowUp':
          e.preventDefault();
          a.selectLine(-1);
          return;
        case 'ArrowDown':
          e.preventDefault();
          a.selectLine(1);
          return;
        case ',':
        case '<':
          e.preventDefault();
          a.nudge(e.shiftKey ? -100 : -10);
          return;
        case '.':
        case '>':
          e.preventDefault();
          a.nudge(e.shiftKey ? 100 : 10);
          return;
        case 'Delete':
          e.preventDefault();
          a.clear();
          return;
      }

      switch (key.toLowerCase()) {
        case 't':
          e.preventDefault();
          a.setNow();
          return;
        case 'n':
          e.preventDefault();
          a.nextToCheck();
          return;
        case 'l':
          e.preventDefault();
          a.toggleLoop();
          return;
        case 'e':
          e.preventDefault();
          a.editLine();
          return;
        case 'r':
          e.preventDefault();
          a.replay();
          return;
        case 'p':
          e.preventDefault();
          a.togglePlay();
          return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}
