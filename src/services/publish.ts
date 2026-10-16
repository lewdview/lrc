import { supabase } from './supabaseClient';
import type { Timings } from '../utils/timings';

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

export interface PublishTarget {
  /** Display title (as on the main site). */
  title: string;
  /** Catalog storage title used for file names; defaults to the title. */
  fileTitle?: string;
  /** Album text such as "March Releases"; the month is read out of it. */
  album?: string;
  /** Day of the month from the release manifest, when the song came from the catalog. */
  dayOfMonth?: number;
  /** Day of the 365 project, when the song came from the catalog. */
  day?: number;
}

export interface PublishResult {
  storagePath: string;
  storageOk: boolean;
  storageError?: string;
  timingsSaved: boolean;
  timingsNote?: string;
}

export function storagePathFor(target: PublishTarget): string {
  const album = (target.album || '').toLowerCase();
  const month = MONTHS.find((m) => album.includes(m)) || 'january';
  const day = String(target.dayOfMonth ?? 1).padStart(2, '0');
  return `lyrics/${month}/${day} - ${(target.fileTitle || target.title).trim()}.lrc`;
}

type StorageError = { message?: string; statusCode?: string | number; error?: string };

function describeStorageError(err: StorageError): string {
  const msg = err.message || '';
  const code = String(err.statusCode ?? '');
  if (/bucket not found/i.test(msg)) {
    return 'The "releaseready" bucket is not on Supabase (release media lives on R2 at files.th3scr1b3.art).';
  }
  if (/row-level security/i.test(msg) || code === '403' || err.error === 'Unauthorized') {
    return 'Your account is not allowed to write to the "releaseready" bucket.';
  }
  return msg || 'Storage upload failed.';
}

/** Timings published earlier for a release day, if any. */
export async function fetchPublishedTiming(day: number): Promise<Timings | null> {
  const { data, error } = await supabase
    .from('lyric_timings')
    .select('lyrics, words, segments')
    .eq('day', day)
    .maybeSingle();
  if (error || !data || !Array.isArray(data.words) || data.words.length === 0) return null;
  return {
    lyrics: typeof data.lyrics === 'string' ? data.lyrics : '',
    words: data.words,
    segments: Array.isArray(data.segments) ? data.segments : [],
  };
}

/**
 * Publish as the signed-in user. Word timings (and the plain lyrics) go to
 * public.lyric_timings, which the main site's karaoke view reads; the enhanced .lrc goes to
 * the releaseready bucket. Row-level security decides what the account may write; nothing
 * here uses a privileged key.
 */
export async function publishLRC(target: PublishTarget, lrc: string, timings: Timings): Promise<PublishResult> {
  const storagePath = storagePathFor(target);
  const result: PublishResult = { storagePath, storageOk: false, timingsSaved: false };

  // 1. Timings, keyed by release day.
  if (!target.day) {
    result.timingsNote = 'Pick the song from the 365 catalog so the timings know which day they belong to.';
  } else if (timings.words.length === 0) {
    result.timingsNote = 'No synced words yet.';
  } else {
    const { data, error } = await supabase
      .from('lyric_timings')
      .upsert(
        {
          day: target.day,
          title: target.title.trim(),
          storage_title: (target.fileTitle || target.title).trim(),
          lyrics: timings.lyrics,
          words: timings.words,
          segments: timings.segments,
        },
        { onConflict: 'day' }
      )
      .select('day');
    if (error) result.timingsNote = `Timings not saved: ${error.message}`;
    else if (!data || data.length === 0) result.timingsNote = 'Your account is not allowed to save timings.';
    else result.timingsSaved = true;
  }

  // 2. The .lrc file.
  const file = new Blob([lrc], { type: 'text/plain;charset=utf-8' });
  const upload = (path: string) =>
    supabase.storage.from('releaseready').upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: 'text/plain;charset=utf-8',
    });

  let { error } = await upload(storagePath);
  const err = error as StorageError | null;
  // Some titles need the file name encoded; retry once unless the bucket itself is missing.
  if (err && String(err.statusCode) === '400' && !/bucket not found/i.test(err.message || '')) {
    const slash = storagePath.lastIndexOf('/');
    const encoded = storagePath.slice(0, slash + 1) + encodeURIComponent(storagePath.slice(slash + 1));
    ({ error } = await upload(encoded));
  }

  if (error) result.storageError = describeStorageError(error as StorageError);
  else result.storageOk = true;

  return result;
}
