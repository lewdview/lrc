# Lyric Runtime · lrc.th3scr1b3.art

The sync layer of the th3scr1b3 365 ecosystem. Pick a song from the 365 catalog (or upload any
audio), paste or load its lyrics, then tap <kbd>Space</kbd> on every word while it plays. The
result exports as enhanced LRC (A2: line and word timestamps).

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
