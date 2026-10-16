import { supabase } from './supabaseClient';

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

export interface PublishTarget {
  title: string;
  /** Album text such as "March Releases"; the month is read out of it. */
  album?: string;
  /** Day of the month from the release manifest, when the song came from the catalog. */
  dayOfMonth?: number;
}

export interface PublishResult {
  storagePath: string;
  storageOk: boolean;
  storageError?: string;
  dbUpdated: boolean;
  dbNote?: string;
}

export function storagePathFor(target: PublishTarget): string {
  const album = (target.album || '').toLowerCase();
  const month = MONTHS.find((m) => album.includes(m)) || 'january';
  const day = String(target.dayOfMonth ?? 1).padStart(2, '0');
  return `lyrics/${month}/${day} - ${target.title.trim()}.lrc`;
}

// ilike without wildcards is a case-insensitive exact match once % and _ are escaped.
const exactIlike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

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

/**
 * Publish an enhanced LRC to the vault as the signed-in user: the .lrc goes to the
 * releaseready bucket and the matching release row's lyrics are updated. Row-level security
 * decides what the account may write; nothing here uses a privileged key.
 */
export async function publishLRC(target: PublishTarget, lrc: string): Promise<PublishResult> {
  const title = target.title.trim();
  const storagePath = storagePathFor(target);
  const result: PublishResult = { storagePath, storageOk: false, dbUpdated: false };

  // 1. The release row: only an exact (case-insensitive) title match, and only if it is unique.
  const { data: rows, error: findError } = await supabase
    .from('releases')
    .select('id')
    .ilike('title', exactIlike(title))
    .limit(2);
  if (findError) {
    result.dbNote = `Could not look up the release: ${findError.message}`;
  } else if (!rows || rows.length === 0) {
    result.dbNote = `No release titled "${title}" in the database.`;
  } else if (rows.length > 1) {
    result.dbNote = `More than one release is titled "${title}", so none was changed.`;
  } else {
    const { data: updated, error: updateError } = await supabase
      .from('releases')
      .update({ lyrics: lrc })
      .eq('id', rows[0].id)
      .select('id');
    if (updateError) result.dbNote = `Release update failed: ${updateError.message}`;
    else if (!updated || updated.length === 0) result.dbNote = 'Your account is not allowed to update releases.';
    else result.dbUpdated = true;
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
