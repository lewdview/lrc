import React, { useState, useEffect } from 'react';
import type { Line, LyricsDocument } from '../types/lyric';
import { formatEnhancedLRC } from '../utils/exportLRC';
import { reconstructLinesFromAnalysis } from '../utils/parser';
import { fetchPublishedTiming, publishLRC, storagePathFor, type PublishResult } from '../services/publish';
import { dayOfYear, linesToTimings, timingsToLines } from '../utils/timings';
import { signInUrl, type Account } from '../hooks/useAccount';
import { AccountChip } from './AccountChip';
import { Modal } from './Modal';
import dayFileMap from '../data/day_file_map.json';

interface ManifestItem {
  month: string;
  index: number;
  storageTitle: string;
  ext: string;
  audioPath: string;
  coverPath: string;
}

interface ReleaseEntry {
  title?: string;
  storageTitle?: string;
  manifestAudioPath?: string;
  lyrics?: string;
  lyricsSegments?: Parameters<typeof reconstructLinesFromAnalysis>[0];
  lyricsWords?: Parameters<typeof reconstructLinesFromAnalysis>[1];
}

interface DayFileEntry {
  month?: string;
  day?: number;
  dayOfMonth?: number;
  audio?: string;
}

interface ToolbarProps {
  document: LyricsDocument;
  account: Account;
  setMetadata: (meta: LyricsDocument['metadata']) => void;
  setLyricsRaw: (text: string) => void;
  setAudioUrl: (url: string | null) => void;
  onDownload: () => void;
  onClear: () => void;
  onImportSyncedLines: (lines: Line[]) => void;
}

const STORAGE_BASE =
  import.meta.env.VITE_STORAGE_BASE_URL ||
  import.meta.env.VITE_R2_URL ||
  'https://files.th3scr1b3.art';

// Fetch a catalog file from this deploy first, then from the release CDN.
async function fetchAssetWithFallback(assetName: string) {
  try {
    const localRes = await fetch(`/${assetName}?t=${Date.now()}`);
    if (localRes.ok) return await localRes.json();
  } catch (err) {
    console.warn(`Local fetch for ${assetName} failed, trying ${STORAGE_BASE}...`, err);
  }
  const remoteRes = await fetch(`${STORAGE_BASE}/${assetName}?t=${Date.now()}`);
  if (remoteRes.ok) return await remoteRes.json();
  throw new Error(`Failed to fetch ${assetName} from both local and remote sources.`);
}

function resolveAudioUrl(song: ManifestItem): string {
  const paddedDay = String(song.index).padStart(2, '0');
  const songMonth = song.month.toLowerCase();
  const map = dayFileMap as Record<string, DayFileEntry>;
  const entries = Object.values(map);
  const mapped =
    map[String(song.index)] ||
    map[paddedDay] ||
    entries.find(
      (m) => m.month?.toLowerCase() === songMonth && (m.dayOfMonth === song.index || m.day === song.index)
    ) ||
    entries.find(
      (m) => m.month?.toLowerCase() === songMonth && m.audio?.toLowerCase().includes(song.storageTitle.toLowerCase())
    );

  if (mapped?.audio) return `${STORAGE_BASE}/${mapped.audio}`;
  const fileName = `${paddedDay} - ${song.storageTitle}.mp3`;
  return `${STORAGE_BASE}/audio/${songMonth}/${encodeURIComponent(fileName)}`;
}

const same = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

// The catalog names files by storageTitle, which often differs from the release's display
// title ("Ss Take One" vs "Silent Suffocation"), so match on the storage fields first.
function findRelease(releases: ReleaseEntry[] | undefined, song: ManifestItem): ReleaseEntry | undefined {
  if (!releases) return undefined;
  return (
    releases.find((r) => same(r.storageTitle, song.storageTitle)) ||
    releases.find((r) => same(r.manifestAudioPath, song.audioPath)) ||
    releases.find((r) => same(r.title, song.storageTitle))
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function Toolbar({
  document: doc,
  account,
  setMetadata,
  setLyricsRaw,
  setAudioUrl,
  onDownload,
  onClear,
  onImportSyncedLines,
}: ToolbarProps) {
  const [manifest, setManifest] = useState<ManifestItem[]>([]);
  const [selectedSong, setSelectedSong] = useState<ManifestItem | null>(null);
  const [releaseTitle, setReleaseTitle] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isReloading, setIsReloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [showPublish, setShowPublish] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);

  const loadManifest = async () => {
    try {
      const data = await fetchAssetWithFallback('release-manifest.json');
      if (data.items) setManifest(data.items);
    } catch (err) {
      console.error('Failed to load release manifest:', err);
    }
  };

  useEffect(() => {
    void loadManifest();
  }, []);

  const query = searchQuery.trim().toLowerCase();
  const filteredSongs = query
    ? manifest.filter((item) => item.storageTitle.toLowerCase().includes(query)).slice(0, 60)
    : [];

  // The catalog song this document belongs to, if its title still matches the one picked.
  const docTitle = doc.metadata.title;
  const matchedSong =
    selectedSong && (same(docTitle, selectedSong.storageTitle) || same(docTitle, releaseTitle ?? undefined))
      ? selectedSong
      : manifest.find((item) => same(item.storageTitle, docTitle));
  const publishTarget = {
    title: docTitle,
    fileTitle: matchedSong?.storageTitle,
    album: doc.metadata.album,
    dayOfMonth: matchedSong?.index,
    day: matchedSong ? dayOfYear(matchedSong.month, matchedSong.index) ?? undefined : undefined,
  };

  const unsyncedWords = doc.lines.reduce(
    (n, line) => n + line.words.filter((w) => w.timestamp === null).length,
    0
  );

  const handleSelectSong = async (song: ManifestItem) => {
    setSelectedSong(song);
    setReleaseTitle(null);
    let title = song.storageTitle;

    // Lyrics: timings already published from here first, then the release data's word
    // timings, then the plain-text fallback.
    try {
      const day = dayOfYear(song.month, song.index);
      const [releaseData, published] = await Promise.all([
        fetchAssetWithFallback('release-data.json'),
        day ? fetchPublishedTiming(day) : Promise.resolve(null),
      ]);
      const matchedRelease = findRelease(releaseData.releases, song);
      if (matchedRelease?.title) {
        title = matchedRelease.title;
        setReleaseTitle(matchedRelease.title);
      }

      if (published) {
        onImportSyncedLines(timingsToLines(published));
        setLyricsRaw(published.lyrics);
      } else if (matchedRelease?.lyricsSegments && matchedRelease?.lyricsWords) {
        onImportSyncedLines(
          reconstructLinesFromAnalysis(matchedRelease.lyricsSegments, matchedRelease.lyricsWords)
        );
        setLyricsRaw(matchedRelease.lyrics || '');
      } else {
        const lyricsDb = await fetchAssetWithFallback('lyrics-fallback.json');
        const normalizedKey = song.storageTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
        setLyricsRaw(
          lyricsDb[normalizedKey]?.lyrics || '// No lyrics found in database. Paste your lyrics here.'
        );
      }
    } catch (err) {
      console.error('Failed to load lyrics analysis/fallback:', err);
      setLyricsRaw('// Error loading lyrics database. Paste your lyrics here.');
    }

    setMetadata({
      title,
      artist: 'th3scr1b3',
      album: `${capitalize(song.month)} Releases`,
      by: 'th3scr1b3 LRC Tool',
      offset: 0,
    });

    setAudioUrl(resolveAudioUrl(song));
    setSearchQuery(song.storageTitle);
    setShowDropdown(false);
  };

  const handleReload = async () => {
    setIsReloading(true);
    await loadManifest();
    const song =
      selectedSong || manifest.find((s) => same(s.storageTitle, doc.metadata.title));
    if (song) await handleSelectSong(song);
    setIsReloading(false);
  };

  const handleLocalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioUrl(URL.createObjectURL(file));
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const parts = baseName.split(' - ');
    setMetadata({
      title: parts.length === 2 ? parts[1] : baseName,
      artist: parts.length === 2 ? parts[0] : 'Unknown Artist',
      album: '',
      by: 'LRC Tool',
      offset: 0,
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatEnhancedLRC(doc));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setPreviewContent(formatEnhancedLRC(doc));
    }
  };

  const handlePublish = async () => {
    if (!doc.metadata.title.trim()) return;
    setIsPublishing(true);
    setPublishResult(null);
    try {
      setPublishResult(
        await publishLRC(publishTarget, formatEnhancedLRC(doc), linesToTimings(doc.lines, doc.metadata.offset))
      );
    } catch (err) {
      setPublishResult({
        storagePath: storagePathFor(publishTarget),
        storageOk: false,
        storageError: err instanceof Error ? err.message : 'Publish failed.',
        timingsSaved: false,
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const openPublish = () => {
    setPublishResult(null);
    setShowPublish(true);
  };

  return (
    <header className="toolbar">
      <div className="toolbar-group">
        <a className="brand" href="/" aria-label="Lyric Runtime home">
          <span className="kicker">
            <span className="live-dot on" aria-hidden="true" /> lrc.th3scr1b3.art · Sync
          </span>
          <span className="brand-name">
            Lyric <em>Runtime</em>
          </span>
        </a>

        <div className="search">
          <input
            type="search"
            className="input"
            placeholder="Search the 365 catalog…"
            aria-label="Search songs"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowDropdown(false);
              if (e.key === 'Enter' && filteredSongs[0]) void handleSelectSong(filteredSongs[0]);
            }}
          />
          {showDropdown && query && (
            <div className="dropdown" role="listbox">
              {filteredSongs.length > 0 ? (
                filteredSongs.map((song) => (
                  <button
                    type="button"
                    key={`${song.month}-${song.index}`}
                    className="dropdown-item"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void handleSelectSong(song)}
                  >
                    <span>{song.storageTitle}</span>
                    <span>
                      {song.month.slice(0, 3)} {String(song.index).padStart(2, '0')}
                    </span>
                  </button>
                ))
              ) : (
                <div className="dropdown-empty">
                  {manifest.length ? 'No matches' : 'Catalog not loaded yet'}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          className="btn"
          onClick={() => void handleReload()}
          disabled={isReloading}
          title="Refresh the catalog and reload the active song"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={isReloading ? 'spin' : undefined}
            aria-hidden="true"
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {isReloading ? 'Reloading' : 'Reload'}
        </button>

        <label className="btn">
          Upload audio
          <input type="file" accept="audio/*" hidden onChange={handleLocalFile} />
        </label>
      </div>

      <div className="toolbar-group">
        <button className="btn" onClick={() => setPreviewContent(formatEnhancedLRC(doc))}>
          Preview
        </button>
        <button className="btn" onClick={() => void handleCopy()}>
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
        <button className="btn btn-primary" onClick={onDownload}>
          Export .lrc
        </button>
        {account.isAdmin && (
          <button className="btn btn-amber" onClick={openPublish} title="Publish to the vault">
            Publish
          </button>
        )}
        <button className="btn btn-danger" onClick={onClear}>
          Reset
        </button>
        <AccountChip account={account} />
      </div>

      {previewContent !== null && (
        <Modal title="Enhanced LRC" onClose={() => setPreviewContent(null)}>
          <pre className="modal-pre">{previewContent || '// Sync some words first to generate LRC'}</pre>
          <div className="modal-row">
            <button className="btn" onClick={() => void handleCopy()}>
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
            <button className="btn btn-primary" onClick={onDownload}>
              Download .lrc
            </button>
          </div>
        </Modal>
      )}

      {showPublish && (
        <Modal title="Publish to the vault" onClose={() => setShowPublish(false)}>
          <p className="modal-note">
            Saves the word timings for this day so the main site&rsquo;s karaoke view follows them
            (the lyrics shown there stay plain text), and uploads the enhanced .lrc to the{' '}
            <code>releaseready</code> bucket. Both happen as your signed-in account.
          </p>
          <div className="modal-target">
            <span className="kicker">Day</span>
            <code>{publishTarget.day ?? 'not a catalog song'}</code>
            <span className="kicker">File</span>
            <code>{storagePathFor(publishTarget)}</code>
          </div>

          {!account.user && (
            <div className="banner banner-warn">
              <strong>Signed out</strong>
              <a href={signInUrl()}>Sign in on your th3scr1b3 profile</a> to publish.
            </div>
          )}

          {unsyncedWords > 0 && (
            <div className="banner banner-warn">
              <strong>{unsyncedWords} words not synced</strong>
              The karaoke view skips them; in the .lrc they take the previous word's time (or 00:00 on an unsynced line).
            </div>
          )}

          {publishResult && (
            <>
              <div className={`banner ${publishResult.storageOk ? 'banner-ok' : 'banner-err'}`}>
                <strong>File {publishResult.storageOk ? 'uploaded' : 'not uploaded'}</strong>
                {publishResult.storageOk ? publishResult.storagePath : publishResult.storageError}
              </div>
              <div className={`banner ${publishResult.timingsSaved ? 'banner-ok' : 'banner-err'}`}>
                <strong>Karaoke timings {publishResult.timingsSaved ? 'saved' : 'not saved'}</strong>
                {publishResult.timingsSaved
                  ? `Day ${publishTarget.day} now follows these timings on th3scr1b3.art.`
                  : publishResult.timingsNote}
              </div>
            </>
          )}

          <div className="modal-row">
            <button
              className="btn btn-amber btn-lg"
              onClick={() => void handlePublish()}
              disabled={isPublishing || !account.user || !doc.metadata.title.trim()}
            >
              {isPublishing ? 'Publishing…' : publishResult ? 'Publish again' : 'Publish'}
            </button>
          </div>

          <div className="divider" />
          <span className="kicker">Or keep it local</span>
          <div className="modal-row">
            <button className="btn" onClick={() => void handleCopy()}>
              {copied ? 'Copied ✓' : 'Copy LRC'}
            </button>
            <button className="btn btn-primary" onClick={onDownload}>
              Download .lrc
            </button>
          </div>
        </Modal>
      )}
    </header>
  );
}
