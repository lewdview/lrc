import type { LyricsDocument } from '../types/lyric';
import { formatTimestamp } from './formatter';

/**
 * Formats a LyricsDocument into an Enhanced LRC (A2) string.
 */
export function formatEnhancedLRC(doc: LyricsDocument): string {
  const lines: string[] = [];

  // 1. Metadata Headers
  if (doc.metadata.artist) lines.push(`[ar:${doc.metadata.artist.trim()}]`);
  if (doc.metadata.title) lines.push(`[ti:${doc.metadata.title.trim()}]`);
  if (doc.metadata.album) lines.push(`[al:${doc.metadata.album.trim()}]`);
  if (doc.metadata.by) lines.push(`[by:${doc.metadata.by.trim()}]`);
  if (doc.metadata.offset !== undefined) lines.push(`[offset:${doc.metadata.offset}]`);

  // Separate metadata and lyrics with a blank line if metadata exists
  if (lines.length > 0) {
    lines.push('');
  }

  // 2. Process Lyrics Lines
  doc.lines.forEach((line) => {
    // Handle empty line
    if (line.words.length === 0) {
      lines.push('');
      return;
    }

    // Find the first synced word to use as the line timestamp
    const firstSyncedWord = line.words.find(w => w.timestamp !== null);
    const lineStartMs = firstSyncedWord?.timestamp ?? 0;
    const lineStartTag = `[${formatTimestamp(lineStartMs)}]`;

    // Process all words in the line
    let lastKnownMs = lineStartMs;
    const wordTags = line.words.map((word) => {
      const wordMs = word.timestamp !== null ? word.timestamp : lastKnownMs;
      lastKnownMs = wordMs; // Update fallback
      
      const wordTag = `<${formatTimestamp(wordMs)}>`;
      // Exactly one space after the word text as required
      return `${wordTag}${word.text} `;
    });

    lines.push(`${lineStartTag}${wordTags.join('')}`);
  });

  return lines.join('\n');
}

/**
 * Trigger browser file download of the LRC content.
 */
export function downloadLRC(doc: LyricsDocument) {
  const content = formatEnhancedLRC(doc);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const filename = `${doc.metadata.artist || 'Unknown'} - ${doc.metadata.title || 'Untitled'}.lrc`;
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
