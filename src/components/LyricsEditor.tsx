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
    const wordCount = parsedLines.reduce((acc, line) => acc + line.words.length, 0);
    onParsed(parsedLines);
    setInfo(`Parsed ${parsedLines.length} lines, ${wordCount} words.`);
  };

  return (
    <div className="editor">
      <div className="editor-head">
        <span className="kicker kicker-hot">Step 01</span>
        <h2>Paste the words</h2>
        <p>One line per lyric line. Blank lines stay as pauses; extra spaces are ignored.</p>
      </div>

      <textarea
        className="editor-text"
        aria-label="Lyrics"
        placeholder={'Paste your lyrics here…\ne.g.\nHello darkness my old friend\nI’ve come to talk with you again'}
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
      />

      <div className="editor-foot">
        <button className="btn btn-primary btn-lg" onClick={handleParse} disabled={!rawText.trim()}>
          Parse lyrics → sync
        </button>
        {info && <span className="editor-info">{info}</span>}
      </div>
    </div>
  );
}
