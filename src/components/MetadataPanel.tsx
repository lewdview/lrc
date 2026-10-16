import type { LyricsDocument } from '../types/lyric';

interface MetadataPanelProps {
  metadata: LyricsDocument['metadata'];
  onChange: (meta: LyricsDocument['metadata']) => void;
}

type TextKey = 'title' | 'artist' | 'album' | 'by';

const TEXT_FIELDS: Array<{ key: TextKey; label: string; placeholder: string }> = [
  { key: 'title', label: 'Title', placeholder: 'e.g. Dream' },
  { key: 'artist', label: 'Artist', placeholder: 'e.g. th3scr1b3' },
  { key: 'album', label: 'Album', placeholder: 'e.g. March Releases' },
  { key: 'by', label: 'LRC by', placeholder: 'e.g. th3scr1b3 LRC Tool' },
];

export function MetadataPanel({ metadata, onChange }: MetadataPanelProps) {
  return (
    <section className="meta" aria-label="Track metadata">
      <span className="kicker">Track metadata</span>
      {TEXT_FIELDS.map(({ key, label, placeholder }) => (
        <div className="field" key={key}>
          <label htmlFor={`meta-${key}`}>{label}</label>
          <input
            id={`meta-${key}`}
            type="text"
            className="input"
            value={metadata[key] || ''}
            onChange={(e) => onChange({ ...metadata, [key]: e.target.value })}
            placeholder={placeholder}
          />
        </div>
      ))}
      <div className="field field-narrow">
        <label htmlFor="meta-offset">Offset (ms)</label>
        <input
          id="meta-offset"
          type="number"
          className="input mono"
          value={metadata.offset || 0}
          onChange={(e) => onChange({ ...metadata, offset: parseInt(e.target.value, 10) || 0 })}
        />
      </div>
    </section>
  );
}
