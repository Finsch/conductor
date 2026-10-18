# conductor.

A personal, local-first music library and audio player. Inspired by Bandcamp and Musicboard.
Plain HTML, CSS and JavaScript: no server, no install. Open `index.html` in Chrome or Edge.
Single-page: everything runs inside `conductor.html`, which never reloads, so the music keeps playing from page to page.
Data lives on your PC (`datastorage/`), so it works offline.

## Features

- **Collection**: grid or list, sort (added, title, artist, intensity, release, length), filters (genre families, decades, intensity, on phone, A–Z), remembered between visits. Search, **Surprise me** (random pick), **.txt export** of results.
- **Add an album**: Deezer / Discogs search, original titles and release dates (via MusicBrainz).
- **Album page**: player (Deezer previews or your own files), lyrics, ★ favourite tracks, genre/styles, moods, custom tags, intensity 1–10, **"you may also like"** (4 similar albums).
- **Listens**: counted automatically when 90 % of an album's tracks are played. Adding an album is not a listen.
- **Next up**: a to-listen list kept apart from the collection, with a top 5 priority grid.
- **Insights**: the collection in numbers, every bar links to the filtered collection.
- **audio-files**: streams your MP3/FLAC from an Android phone running **Navidrome** (Termux), over Wi-Fi or hotspot.
- **Continuous playback**: floating mini player (cover, track, play/pause, progress, ★, back to album) and an album **queue** (reorder, remove, total and remaining time).
- **Volume** (0–20, remembered) and **keyboard shortcuts**: `N` add, `S` search, `R` surprise, `Esc` back, `Z` home, `Space` play, `← →` tracks, `↑ ↓` volume, `M` mute, `?` help.

## Structure

```
conductor/
├── app/              this repo (code)
│   ├── conductor.html  single-page shell: player, mini player, queue, disk writes
│   ├── index.html    collection
│   ├── pages/        album, nextup, insights, library (audio-files)
│   ├── css/  js/  assets/
│   └── docs/         navidrome-man.md, toolkit.md
└── datastorage/      your data, outside the repo
    ├── collection.js
    ├── covers/
    └── lyrics/
```

Keep both folders side by side: the app reads and writes `../datastorage/`.

## Getting started

1. Open `app/index.html` in Chrome or Edge.
2. Bottom left: "Choisir le dossier datastorage" → `conductor/datastorage`.
3. Optional: copy `js/config.example.js` to `js/config.js` and add a Discogs token.

See `docs/toolkit.md` (services, costs) and `docs/navidrome-man.md` (phone server).
