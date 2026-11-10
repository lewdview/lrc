# Lyric Runtime · lrc.th3scr1b3.art

The sync layer of the th3scr1b3 365 ecosystem. Pick a song from the 365 catalog (or upload any
audio) and its lyrics open already timed from the release transcript. The result exports as
enhanced LRC (A2: line and word timestamps) and publishes karaoke timings to the main site.

## Three ways to time a song

- **Review** (default when a song has timings). Words worth a second look are flagged amber:
  untimed, out of order, stacked on the next word, or held too long. <kbd>N</kbd> jumps to the
  next one, the word lane shows the real waveform with one block per word (drag a block to move
  its start), <kbd>L</kbd> loops the line, <kbd>,</kbd>/<kbd>.</kbd> nudge 10 ms, <kbd>T</kbd>
  sets the selected word to the playhead.
- **Tap lines.** One <kbd>Space</kbd> when each line starts. Timed words keep their shape and
  move; untimed words are spread out by length.
- **Tap words.** The classic one tap per word.

Lyrics are edited in place: double-click a line (or <kbd>E</kbd>), <kbd>Enter</kbd> splits it,
<kbd>⌫</kbd> at the start joins it to the line above, and every word you don't change keeps its
time. "Paste lyrics…" swaps in a corrected text the same way.

The waveform is decoded from `/media/*`, a same-origin route to `files.th3scr1b3.art`
(`vercel.json` rewrite in production, Vite proxy in dev), because the CDN sends no CORS headers.

## How it fits the ecosystem

- **Layers.** The shared layer menu and cross-site visit tracking come from
  `https://th3scr1b3.art/ecosystem-bar.js` (see `index.html`). The layer list lives in the main
  site's `public/ecosystem.json`.
- **One login.** Supabase auth is stored in cookies on `.th3scr1b3.art`
  (`src/services/sharedAuthStorage.ts`, identical in the main site, PIM and the user hub). Signing
  in on https://user.th3scr1b3.art signs you in here too.
- **Publishing.** Signed-in admins (`public.is_admin()`) get a Publish button that uploads the
  `.lrc` to the `releaseready` bucket and writes it to the matching release row, as their own
  account. Row-level security decides what is allowed; the app never uses a privileged key.
- **Look.** Same brutalist neon system as pim.th3scr1b3.art/launch and the user hub: ink and
  paper, Anton / Space Grotesk / JetBrains Mono, hard offset shadows. Tokens are in
  `src/index.css`, layout in `src/App.css`.

## Data

- Catalog: `release-manifest.json`, `release-data.json` and `lyrics-fallback.json`, read from this
  deploy first and then from `https://files.th3scr1b3.art`.
- Audio: resolved through `src/data/day_file_map.json` onto the R2 CDN.
- Work in progress autosaves to `localStorage` every 5 seconds.

## Develop

```sh
npm ci
npm run dev     # http://localhost:5173 (login falls back to per-site storage off-domain)
npm run lint
npm run build
```

Optional env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_STORAGE_BASE_URL`.
