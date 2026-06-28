import { useState } from 'react';
import { parseLyrics } from '../utils/parser';
import type { Line } from '../types/lyric';

interface LyricsEditorProps {
  rawText: string;
  setRawText: (text: string) => void;
  onParsed: (lines: Line[]) => void;
}

export function LyricsEditor({ rawText, setRawText, onParsed }: LyricsEditorProps) {
  const [info, setInfo] = useState('');

  const handleParse = () => {
    const parsedLines = parseLyrics(rawText);
    const wordCount = parsedLines.reduce((acc: number, line: Line) => acc + line.words.length, 0);
    onParsed(parsedLines);
    setInfo(`Parsed successfully: ${parsedLines.length} lines, ${wordCount} words.`);
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Raw Lyrics Editor</h3>
      <p style={styles.subtitle}>
        Paste raw text lyrics below. Blank lines will be preserved as pauses. Duplicate spaces are ignored.
      </p>

      <textarea
        style={styles.textarea}
        className="mono"
        placeholder="Paste your lyrics here...&#10;e.g.&#10;Hello darkness my old friend&#10;I've come to talk with you again"
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
      />

      <div style={styles.footer}>
        <button
          className="btn btn-primary"
          style={{ padding: '10px 20px', fontSize: '0.95rem' }}
          onClick={handleParse}
          disabled={!rawText.trim()}
        >
          Parse Lyrics
        </button>

        {info && <span style={styles.info} className="mono">{info}</span>}
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    backgroundColor: 'var(--bg-primary)',
  },
  title: {
    fontSize: '1.1rem',
    color: 'var(--accent-cyan)',
    marginBottom: '6px',
    fontWeight: 600,
  },
  subtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    marginBottom: '15px',
  },
  textarea: {
    flexGrow: 1,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius)',
    color: 'var(--text-primary)',
    padding: '15px',
    fontSize: '0.95rem',
    resize: 'none' as const,
    outline: 'none',
    lineHeight: '1.6',
    transition: 'border-color var(--transition-fast)',
  },
  footer: {
    marginTop: '15px',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  info: {
    fontSize: '0.85rem',
    color: 'var(--accent-green)',
  },
};
