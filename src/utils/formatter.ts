/**
 * Formats a duration in milliseconds into a mm:ss.xx string (where xx is hundredths of a second)
 */
export function formatTimestamp(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || isNaN(ms)) return '00:00.00';
  
  const absoluteMs = Math.max(0, ms);
  const minutes = Math.floor(absoluteMs / 60000);
  const seconds = Math.floor((absoluteMs % 60000) / 1000);
  const hundredths = Math.floor((absoluteMs % 1000) / 10);

  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');
  const xx = hundredths.toString().padStart(2, '0');

  return `${mm}:${ss}.${xx}`;
}

/**
 * Parses a mm:ss.xx or ss.xx string back into milliseconds
 */
export function parseTimestampToMs(val: string): number | null {
  const parts = val.trim().split(':');
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10);
    const secsParts = parts[1].split('.');
    const secs = parseInt(secsParts[0], 10);
    const hundredths = secsParts[1] ? parseInt(secsParts[1].padEnd(2, '0').slice(0, 2), 10) : 0;
    if (isNaN(mins) || isNaN(secs) || isNaN(hundredths)) return null;
    return mins * 60000 + secs * 1000 + hundredths * 10;
  } else if (parts.length === 1) {
    const secsParts = parts[0].split('.');
    const secs = parseInt(secsParts[0], 10);
    const hundredths = secsParts[1] ? parseInt(secsParts[1].padEnd(2, '0').slice(0, 2), 10) : 0;
    if (isNaN(secs) || isNaN(hundredths)) return null;
    return secs * 1000 + hundredths * 10;
  }
  return null;
}
