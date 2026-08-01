import React, { useState, useEffect } from 'react';
import type { LyricsDocument } from '../types/lyric';
import { formatEnhancedLRC } from '../utils/exportLRC';
import { reconstructLinesFromAnalysis } from '../utils/parser';
import {
  getSupabaseClient,
  getStoredSupabaseKey,
  setStoredSupabaseKey,
  SUPABASE_ANON_KEY,
} from '../services/supabaseClient';

interface ManifestItem {
  month: string;
  index: number;
  storageTitle: string;
  ext: string;
  audioPath: string;
  coverPath: string;
}

interface ToolbarProps {
  document: LyricsDocument;
  setMetadata: (meta: LyricsDocument['metadata']) => void;
  setLyricsRaw: (text: string) => void;
  setAudioUrl: (url: string | null) => void;
  onDownload: () => void;
  onClear: () => void;
  onImportSyncedLines: (lines: any[]) => void;
}

const STORAGE_BASE = 'https://pznmptudgicrmljjafex.supabase.co/storage/v1/object/public/releaseready';

// Helper to fetch assets locally, falling back to the Supabase storage bucket if needed
async function fetchAssetWithFallback(assetName: string) {
  try {
    const localRes = await fetch(`/${assetName}?t=${Date.now()}`);
    if (localRes.ok) {
      return await localRes.json();
    }
  } catch (err) {
    console.warn(`Local fetch for ${assetName} failed, trying Supabase storage...`, err);
  }

  // Remote fallback
  const remoteRes = await fetch(`${STORAGE_BASE}/${assetName}?t=${Date.now()}`);
  if (remoteRes.ok) {
    console.log(`Successfully fetched ${assetName} from Supabase storage bucket.`);
    return await remoteRes.json();
  }
  throw new Error(`Failed to fetch ${assetName} from both local and remote sources.`);
}

export function Toolbar({
  document: doc,
  setMetadata,
  setLyricsRaw,
  setAudioUrl,
  onDownload,
  onClear,
  onImportSyncedLines,
}: ToolbarProps) {
  const [manifest, setManifest] = useState<ManifestItem[]>([]);
  const [selectedSong, setSelectedSong] = useState<ManifestItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  // Sync Modal State
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncErrorMessage, setSyncErrorMessage] = useState('');
  const [syncTargetPath, setSyncTargetPath] = useState('');
  const [customKeyInput, setCustomKeyInput] = useState(
    getStoredSupabaseKey() === SUPABASE_ANON_KEY ? '' : getStoredSupabaseKey()
  );

  // Load manifest on mount
  const loadManifest = async () => {
    try {
      const data = await fetchAssetWithFallback('release-manifest.json');
      if (data.items) {
        setManifest(data.items);
      }
    } catch (err) {
      console.error('Failed to load release manifest:', err);
    }
  };

  useEffect(() => {
    loadManifest();
  }, []);

  // Filtered items based on search query
  const filteredSongs = searchQuery.trim()
    ? manifest.filter((item) =>
        item.storageTitle.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleSelectSong = async (song: ManifestItem) => {
    setSelectedSong(song);

    // 1. Set metadata
    setMetadata({
      title: song.storageTitle,
      artist: 'th3scr1b3',
      album: `${song.month.charAt(0).toUpperCase() + song.month.slice(1)} Releases`,
      by: 'th3scr1b3 LRC Tool',
      offset: 0,
    });

    // 2. Load lyrics and timestamps from database if available
    try {
      const releaseData = await fetchAssetWithFallback('release-data.json');
      const matchedRelease = releaseData.releases?.find(
        (r: any) => r.title.toLowerCase() === song.storageTitle.toLowerCase()
      );

      if (matchedRelease && matchedRelease.lyricsSegments && matchedRelease.lyricsWords) {
        console.log('Found word-level timestamps in database. Reconstructing...');
        const reconstructed = reconstructLinesFromAnalysis(
          matchedRelease.lyricsSegments,
          matchedRelease.lyricsWords
        );
        onImportSyncedLines(reconstructed);
        setLyricsRaw(matchedRelease.lyrics || '');
      } else {
        // Fall back to plain lyric fallback database
        console.log('No word-level timings found. Fetching fallback lyrics...');
        const lyricsDb = await fetchAssetWithFallback('lyrics-fallback.json');
        const normalizedKey = song.storageTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matched = lyricsDb[normalizedKey];
        if (matched && matched.lyrics) {
          setLyricsRaw(matched.lyrics);
        } else {
          setLyricsRaw('// No lyrics found in database. Paste your lyrics here.');
        }
      }
    } catch (err) {
      console.error('Failed to load lyrics analysis/fallback:', err);
      setLyricsRaw('// Error loading lyrics database. Paste your lyrics here.');
    }

    // 3. Resolve audio storage URL
    const paddedDay = String(song.index).padStart(2, '0');
    const fileName = `${paddedDay} - ${song.storageTitle}.${song.ext}`;
    const audioUrl = `${STORAGE_BASE}/audio/${song.month.toLowerCase()}/${encodeURIComponent(
      fileName
    )}`;

    setAudioUrl(audioUrl);
    setSearchQuery(song.storageTitle);
    setShowDropdown(false);
  };

  // Reload / Refresh active song & manifest
  const handleReload = async () => {
    setIsReloading(true);
    await loadManifest();

    if (selectedSong) {
      await handleSelectSong(selectedSong);
    } else if (doc.metadata.title) {
      // Look up current title in manifest if available
      const matched = manifest.find(
        (s) => s.storageTitle.toLowerCase() === doc.metadata.title.toLowerCase()
      );
      if (matched) {
        await handleSelectSong(matched);
      }
    }
    setIsReloading(false);
  };

  const handleLocalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioUrl(url);

      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const parts = baseName.split(' - ');
      if (parts.length === 2) {
        setMetadata({
          title: parts[1],
          artist: parts[0],
          album: '',
          by: 'LRC Tool',
          offset: 0,
        });
      } else {
        setMetadata({
          title: baseName,
          artist: 'Unknown Artist',
          album: '',
          by: 'LRC Tool',
          offset: 0,
        });
      }
    }
  };

  const handleCopyToClipboard = () => {
    const formatted = formatEnhancedLRC(doc);
    navigator.clipboard.writeText(formatted);
    alert('Copied Enhanced LRC to clipboard!');
  };

  // Execute database upload with active or custom key
  const executeSyncUpload = async (keyOverride?: string) => {
    if (!doc.metadata.title) {
      alert('Please load or enter a song title before syncing.');
      return;
    }

    setIsSyncing(true);
    setSyncStatus('idle');
    setSyncErrorMessage('');

    const formattedLrc = formatEnhancedLRC(doc);
    const month = (doc.metadata.album || 'january').toLowerCase();

    let monthPath = 'january';
    const months = [
      'january',
      'february',
      'march',
      'april',
      'may',
      'june',
      'july',
      'august',
      'september',
      'october',
      'november',
      'december',
    ];
    for (const m of months) {
      if (month.includes(m)) {
        monthPath = m;
        break;
      }
    }

    const matchedSong = manifest.find(
      (item) => item.storageTitle.toLowerCase() === doc.metadata.title.toLowerCase()
    );
    const paddedDay = matchedSong ? String(matchedSong.index).padStart(2, '0') : '01';
    const storagePath = `lyrics/${monthPath}/${paddedDay} - ${doc.metadata.title}.lrc`;
    setSyncTargetPath(storagePath);

    try {
      const activeClient = getSupabaseClient(keyOverride);
      const fileBlob = new Blob([formattedLrc], { type: 'text/plain;charset=utf-8' });

      const { error } = await activeClient.storage
        .from('releaseready')
        .upload(storagePath, fileBlob, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) throw error;

      setSyncStatus('success');
      setShowSyncModal(true);
    } catch (err: any) {
      console.error('Database Sync Error:', err);
      setSyncStatus('error');
      setSyncErrorMessage(
        err.message ||
          'Storage Row-Level Security (RLS) policy restricted anonymous write operations on the releaseready bucket.'
      );
      setShowSyncModal(true);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveKeyAndRetry = () => {
    setStoredSupabaseKey(customKeyInput);
    executeSyncUpload(customKeyInput || undefined);
  };

  return (
    <div style={styles.toolbar}>
      <div style={styles.left}>
        <div style={styles.logo}>th3scr1b3 LRC v2</div>

        {/* Song search */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="input"
            style={{ width: '220px', fontFamily: 'var(--font-mono)' }}
            placeholder="Search 365 songs..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
          />
          {showDropdown && filteredSongs.length > 0 && (
            <div style={styles.dropdown}>
              {filteredSongs.map((song) => (
                <div
                  key={`${song.month}-${song.index}`}
                  style={styles.dropdownItem}
                  onClick={() => handleSelectSong(song)}
                >
                  {song.storageTitle} ({song.month})
                </div>
              ))}
            </div>
          )}
          {showDropdown && searchQuery && filteredSongs.length === 0 && (
            <div style={styles.dropdown}>
              <div style={{ padding: '8px', color: 'var(--text-muted)' }}>No matches</div>
            </div>
          )}
        </div>

        {/* Reload / Refresh Button */}
        <button
          className="btn"
          onClick={handleReload}
          disabled={isReloading}
          title="Refresh database catalog and reload active song data"
          style={styles.reloadBtn}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              animation: isReloading ? 'spin 1s linear infinite' : 'none',
            }}
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          <span>{isReloading ? 'Reloading...' : 'Reload'}</span>
        </button>

        {/* Local File Picker */}
        <label className="btn">
          <span>Upload Audio File</span>
          <input
            type="file"
            accept="audio/*"
            style={{ display: 'none' }}
            onChange={handleLocalFile}
          />
        </label>
      </div>

      <div style={styles.right}>
        <button className="btn" onClick={() => setPreviewContent(formatEnhancedLRC(doc))}>
          Preview LRC
        </button>
        <button className="btn" onClick={handleCopyToClipboard}>
          Copy LRC
        </button>
        <button
          className="btn btn-primary"
          style={{
            backgroundColor: 'var(--accent-amber)',
            borderColor: 'var(--accent-amber)',
            color: 'var(--bg-primary)',
          }}
          onClick={() => executeSyncUpload()}
          disabled={isSyncing}
        >
          {isSyncing ? 'Syncing...' : 'Sync Database'}
        </button>
        <button className="btn btn-primary" onClick={onDownload}>
          Export LRC (.lrc)
        </button>
        <button className="btn btn-danger" onClick={onClear}>
          Reset
        </button>
      </div>

      {/* Preview Modal */}
      {previewContent !== null && (
        <div style={styles.modalOverlay} onClick={() => setPreviewContent(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3>Enhanced LRC (A2) Preview</h3>
              <button className="btn btn-danger" onClick={() => setPreviewContent(null)}>
                Close
              </button>
            </div>
            <pre style={styles.previewContainer} className="mono">
              {previewContent || '// Sync some words first to generate LRC'}
            </pre>
          </div>
        </div>
      )}

      {/* Sync & Storage Authorization Modal */}
      {showSyncModal && (
        <div style={styles.modalOverlay} onClick={() => setShowSyncModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3>Database Storage Sync</h3>
              <button className="btn btn-danger" onClick={() => setShowSyncModal(false)}>
                Close
              </button>
            </div>

            <div style={styles.syncModalBody}>
              <div style={styles.targetInfo}>
                <span style={{ color: 'var(--text-muted)' }}>Target Storage Path: </span>
                <span className="mono" style={{ color: 'var(--accent-cyan)' }}>
                  {syncTargetPath}
                </span>
              </div>

              {syncStatus === 'success' && (
                <div style={styles.successBanner}>
                  ✓ Enhanced LRC successfully uploaded to the <strong>releaseready</strong> bucket!
                </div>
              )}

              {syncStatus === 'error' && (
                <div style={styles.errorBanner}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    ⚠️ Storage Authorization Required (Anon Write Failure)
                  </div>
                  <div style={{ fontSize: '0.85rem' }}>{syncErrorMessage}</div>
                </div>
              )}

              <div style={styles.keySection}>
                <label style={styles.label}>Supabase Write Key / Service Role Key (Optional)</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <input
                    type="password"
                    className="input mono"
                    placeholder="Paste Supabase Service Key..."
                    value={customKeyInput}
                    onChange={(e) => setCustomKeyInput(e.target.value)}
                    style={{ flexGrow: 1 }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handleSaveKeyAndRetry}
                    disabled={isSyncing}
                  >
                    {isSyncing ? 'Saving...' : 'Save & Retry Sync'}
                  </button>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Key will be securely stored in your local browser storage for future sync requests.
                </div>
              </div>

              <div style={styles.fallbackSection}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                  One-Click Offline Options:
                </span>
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button className="btn" onClick={handleCopyToClipboard}>
                    📋 Copy LRC Content
                  </button>
                  <button className="btn btn-primary" onClick={onDownload}>
                    📥 Download .lrc File
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  toolbar: {
    height: '60px',
    backgroundColor: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logo: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    fontFamily: 'var(--font-sans)',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    color: 'var(--accent-cyan)',
    marginRight: '10px',
  },
  reloadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.8rem',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  dropdown: {
    position: 'absolute' as const,
    top: '40px',
    left: '0',
    width: '220px',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius)',
    zIndex: 1000,
    maxHeight: '200px',
    overflowY: 'auto' as const,
  },
  dropdownItem: {
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    transition: 'background-color 0.15s ease',
  },
  modalOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  modal: {
    width: '80%',
    maxWidth: '650px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius)',
    display: 'flex',
    flexDirection: 'column' as const,
    maxHeight: '80vh',
  },
  modalHeader: {
    padding: '15px 20px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewContainer: {
    padding: '20px',
    overflowY: 'auto' as const,
    flexGrow: 1,
    fontSize: '0.85rem',
    whiteSpace: 'pre-wrap' as const,
    color: 'var(--text-primary)',
    lineHeight: '1.6',
  },
  syncModalBody: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  targetInfo: {
    fontSize: '0.85rem',
    backgroundColor: 'var(--bg-tertiary)',
    padding: '10px 14px',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
  },
  successBanner: {
    backgroundColor: 'rgba(57, 255, 20, 0.1)',
    border: '1px solid var(--accent-green)',
    color: 'var(--accent-green)',
    padding: '12px',
    borderRadius: '6px',
    fontSize: '0.85rem',
  },
  errorBanner: {
    backgroundColor: 'rgba(255, 51, 102, 0.1)',
    border: '1px solid var(--accent-red)',
    color: 'var(--accent-red)',
    padding: '12px',
    borderRadius: '6px',
  },
  keySection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    marginTop: '6px',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: 'bold' as const,
    color: 'var(--text-secondary)',
  },
  fallbackSection: {
    borderTop: '1px solid var(--border-color)',
    paddingTop: '14px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
};
