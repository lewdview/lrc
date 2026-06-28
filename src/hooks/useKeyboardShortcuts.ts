import { useEffect } from 'react';

export interface KeyboardShortcutActions {
  currentTime: number;
  activeLineIndex: number;
  activeWordIndex: number;
  syncNextWord: (timestamp: number) => void;
  nudgeWordTimestamp: (lineIndex: number, wordIndex: number, deltaMs: number) => void;
  clearWordTimestamp: (lineIndex: number, wordIndex: number) => void;
  undo: () => void;
  redo: () => void;
  jumpToFirstUnsynced: () => void;
  jumpToLastWord: () => void;
  prevWord: () => void;
  nextLine: () => void;
}

export function useKeyboardShortcuts(actions: KeyboardShortcutActions, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. If user is typing in an input/textarea, ignore shortcuts
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }

      // 2. Prevent held keys from repeating
      if (e.repeat) {
        e.preventDefault();
        return;
      }

      const {
        currentTime,
        activeLineIndex,
        activeWordIndex,
        syncNextWord,
        nudgeWordTimestamp,
        clearWordTimestamp,
        undo,
        redo,
        jumpToFirstUnsynced,
        jumpToLastWord,
        prevWord,
        nextLine,
      } = actions;

      // 3. Process shortcuts
      // Space: Sync current word
      if (e.code === 'Space') {
        e.preventDefault();
        syncNextWord(currentTime);
        return;
      }

      // Cmd/Ctrl + Z / Shift + Z
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      // Arrow Keys (nudging active word timestamp)
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const delta = e.shiftKey ? -10 : -100;
        nudgeWordTimestamp(activeLineIndex, activeWordIndex, delta);
        return;
      }
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        const delta = e.shiftKey ? 10 : 100;
        nudgeWordTimestamp(activeLineIndex, activeWordIndex, delta);
        return;
      }

      // Backspace: Previous word
      if (e.code === 'Backspace') {
        e.preventDefault();
        prevWord();
        return;
      }

      // Enter: Next line
      if (e.code === 'Enter') {
        e.preventDefault();
        nextLine();
        return;
      }

      // Delete/Backspace: Clear timestamp
      if (e.code === 'Delete') {
        e.preventDefault();
        clearWordTimestamp(activeLineIndex, activeWordIndex);
        return;
      }

      // Home: Jump first unsynced word
      if (e.code === 'Home') {
        e.preventDefault();
        jumpToFirstUnsynced();
        return;
      }

      // End: Jump last word
      if (e.code === 'End') {
        e.preventDefault();
        jumpToLastWord();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [actions, enabled]);
}
