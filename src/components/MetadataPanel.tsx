import type { LyricsDocument } from '../types/lyric';

interface MetadataPanelProps {
  metadata: LyricsDocument['metadata'];
  onChange: (meta: LyricsDocument['metadata']) => void;
}

export function MetadataPanel({ metadata, onChange }: MetadataPanelProps) {
  const handleChange = (key: keyof LyricsDocument['metadata'], value: string | number) => {
    onChange({
      ...metadata,
      [key]: value,
    });
  };

  return (
    <div style={styles.container}>
      <h4 style={styles.title}>Track Metadata</h4>
      <div style={styles.grid}>
        
        <div style={styles.field}>
          <label style={styles.label}>Song Title</label>
          <input
            type="text"
            className="input"
            value={metadata.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="e.g. Dream"
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Artist Name</label>
          <input
            type="text"
            className="input"
            value={metadata.artist}
            onChange={(e) => handleChange('artist', e.target.value)}
            placeholder="e.g. th3scr1b3"
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Album Title</label>
          <input
            type="text"
            className="input"
            value={metadata.album || ''}
            onChange={(e) => handleChange('album', e.target.value)}
            placeholder="e.g. Afterlife"
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Created By (Author)</label>
          <input
            type="text"
            className="input"
            value={metadata.by || ''}
            onChange={(e) => handleChange('by', e.target.value)}
            placeholder="e.g. th3scr1b3 editor"
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Offset (ms)</label>
          <input
            type="number"
            className="input mono"
            value={metadata.offset || 0}
            onChange={(e) => handleChange('offset', parseInt(e.target.value, 10) || 0)}
            placeholder="0"
          />
        </div>

      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '15px 20px',
    backgroundColor: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border-color)',
  },
  title: {
    fontSize: '0.75rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    fontWeight: 'bold' as const,
    color: 'var(--text-secondary)',
    marginBottom: '10px',
  },
  grid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '15px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    flexGrow: 1,
    minWidth: '150px',
  },
  label: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    fontWeight: 'bold' as const,
  },
};
