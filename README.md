# conductor.

A personal, local-first music library and audio player. Inspired by Bandcamp and Musicboard.
Plain HTML, CSS and JavaScript: no server, no install. Open `index.html` in Chrome or Edge.
Single-page: everything runs inside `conductor.html`, which never reloads, so the music keeps playing from page to page.
Data lives on your PC (`datastorage/`), so it works offline.

## Features

- **Collection**: grid or list, sort (added, title, artist, intensity, release, length), filters (genre families, decades, intensity, on phone, A–Z), remembered between visits. Search, **Surprise me** (random pick), **.txt export** of results.
- **Add an album**: Deezer / Discogs search, original titles and release dates (via MusicBrainz).
- **Album page**: player (Deezer previews or your own files), lyrics, ★ favourite tracks, genre/styles, moods, custom tags, intensity 1–10, **tier S / A / B** (filter in the collection), **"you may also like"** (4 similar albums).
- **Artist page**: all their albums, total length, favourite tracks, average intensity, genres. Artist names link to it everywhere.
- **Listens**: counted automatically when 90 % of an album's tracks are played. Adding an album is not a listen.
- **Next up**: a to-listen list kept apart from the collection, with a top 5 priority grid. Drag and drop to reorder, one click to move an album to the collection.
- **Journal**: your listens month by month — a calendar of covers (today highlighted), each listen with its start time, "a year ago", the last 12 months at a glance.
- **Insights**: the collection in numbers, every bar links to the filtered collection.
- **To complete**: albums missing a cover, genre, date, tracklist, intensity or mood (dismissable per album).
- **audio-files**: streams your MP3/FLAC from an Android phone running **Navidrome** (Termux), over Wi-Fi or hotspot.
- **Continuous playback**: floating mini player (cover, track, play/pause, progress, ★, back to album) and an album **queue** (reorder, remove, total and remaining time).
- **Daily backup**: a dated copy of the collection in `datastorage/backups/`, last 7 kept.
- **Volume** (0–20, remembered) and **keyboard shortcuts**: `N` add, `S` search, `R` surprise, `Esc` back to collection, `Z` reset filters, `F` favourites filter, `H` home (reset all), `Space` play, `← →` tracks, `↑ ↓` volume, `M` mute, `?` help.

## Structure

```
conductor/
├── app/              this repo (code)
│   ├── conductor.html  single-page shell: player, mini player, queue, disk writes
│   ├── index.html    collection
│   ├── pages/        album, artist, journal, nextup, insights, complete, library (audio-files)
│   ├── css/  js/  assets/
│   └── docs/         navidrome-man.md, toolkit.md
└── datastorage/      your data, outside the repo
    ├── collection.js
    ├── covers/
    ├── lyrics/
    └── backups/      one copy per day (7 kept)
```

Keep both folders side by side: the app reads and writes `../datastorage/`.

## Getting started

1. Open `app/index.html` in Chrome or Edge.
2. Bottom left: "Choisir le dossier datastorage" → `conductor/datastorage`.
3. Optional: copy `js/config.example.js` to `js/config.js` and add a Discogs token.

See `docs/toolkit.md` (services, costs) and `docs/navidrome-man.md` (phone server).
