# conductor.

A personal, local-first music library, listening journal and audio player. Inspired by Bandcamp and Musicboard.

- **Plain HTML, CSS and JavaScript** — no server, no build, no install. Open `index.html` in Chrome or Edge.
- **Single page** — everything runs inside `conductor.html`, which never reloads: the music keeps playing while you browse.
- **Your data on your PC** — collection, notes, lyrics, covers and backups live in `datastorage/`, next to the code. Works offline.
- **Your own files** — play MP3/FLAC from an SD card, a USB stick or any PC folder, or stream them from your Android phone (Navidrome) over Wi-Fi or a USB cable.

The interface is in French.

---

## Contents

- [Features](#features)
  - [Collection](#collection) · [Album page](#album-page) · [Artist page](#artist-page) · [Next up](#next-up)
  - [Playback](#playback) · [Full screen and karaoke](#full-screen-and-karaoke) · [Lyrics](#lyrics)
  - [Your audio files](#your-audio-files) · [Journal](#journal) · [Insights and fiches à compléter](#insights-and-fiches-à-compléter) · [Wrapped](#wrapped)
  - [Data, backups and exports](#data-backups-and-exports)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Working offline](#working-offline)
- [Structure](#structure)
- [Getting started](#getting-started)
- [Documentation](#documentation)
- [Browser support and limits](#browser-support-and-limits)

---

## Features

### Collection

- **Grid or list view**, 20 albums per page, remembered between visits.
- **Sort** by date added, title, artist, intensity, release date or length.
- **Filters**: genre families (folded by default, unfold to pick genres), decades, intensity, tier (S / A / B), favourite albums, on the phone, A–Z letter. `Z` resets the filters, `H` resets everything.
- **Search** across title, artist, genre, family, styles, moods, tags and label, accents ignored:
  - `jazz+fusion` — both words present (in any field);
  - `radiohead/glass animals` — either one;
  - combinable: `jazz+fusion/ambient`.
- **Play buttons on covers** (on hover): ▶ plays the album now (the queue is kept; pause/resume on the album playing), "3 lines +" adds it to the queue (green check for 2 s). With nothing playing, a single ▶ starts the album.
- **Surprise me** (`R`): a random album.
- **.txt export** of a search or filter result.
- **No duplicates**: an album already in the collection (or in next up) is recognised when you add it again — same id, or a close name ("Remastered 2009", "[Deluxe]", "The Beatles" / "Beatles", "feat. …", "&" / "and") — and is not added twice; the add window offers to open its page instead.

### Album page

- **Player**: your own files (local folders or Navidrome) or, without files, 30-second Deezer previews.
- **Tracklist** with ★ favourite tracks and per-track **lyrics** (see [Lyrics](#lyrics)).
- **Sheet**: release date, label, genre, styles, family, moods ("ressenti"), custom tags; edit with **Modifier la fiche** (`E`), including the cover (URL, image from the PC, or the cover of your files).
- **Intensity** 1–10 and **tier S / A / B** (Masterpiece / Excellent work / Very good job — see `docs/tier-guide.md`).
- **Listens**: count and date of the last one.
- **You may also like**: 4 similar albums from your collection, refresh for others.
- **Files**: shows where the audio comes from (local folder or phone), with **relier à vos fichiers** to link the album by hand (search in your local folders and on the phone), **changer** and **délier**.

### Artist page

All their albums by release date (with the same ▶ / queue buttons on covers), total length, average intensity, genres, years, favourite tracks, copy of the album list. Artist names link to it everywhere.

### Next up

- A to-listen list kept apart from the collection.
- **Top 5** priority grid, then "on the phone" / "not on the phone" lists; drag and drop to reorder; one click moves an album to the collection.
- **Sleeping albums**: in next up for more than 3 months and never played — listed at the top, marked "endormi" on covers and in yellow in the lists.

### Playback

- **One engine for the whole site**: the music continues across pages and resumes after a reload, at the same track and second.
- **Mini player** (bottom right): cover, track, ★, previous / next, play / pause, progress, go to the album, queue, full screen, close.
- **Queue** of albums: add the same album several times, reorder by drag and drop, remove, total and remaining time ("En cours (6/11)").
- **Gapless playback**: the next track is preloaded 30 s before the end and starts exactly when the current one ends.
- **Listen counting**: an album counts as listened when 90 % of its tracks were played (each at least halfway) or after 30 min of listening. Listening time per day feeds the journal.
- **Volume** 0–20, remembered.

### Full screen and karaoke

- **Full screen** (`P` or the ⤢ button): large cover on a blurred background, track, artist, album, progress, controls, ★, *next track* and *next album*. The cursor and hints hide after 3 s without moving the mouse. `Esc` or `P` to leave.
- **Karaoke** (`K` or the microphone button): synced lyrics next to the cover — the current line is highlighted and stays centered, click a line to jump there, scroll freely (auto-scroll resumes after 4 s).
- **Manual sync** ("caler"): when only plain lyrics exist, or none (paste them), sync them by pressing `Enter` at the start of each line while listening; `Backspace` undoes the last line, `Space` pauses, `Esc` cancels. The result is saved and used forever — see `docs/calage-paroles.md`.

### Lyrics

Both the album page (plain text) and karaoke (synced) look in your files first, then on the internet, and **keep what they find** in `datastorage/` for offline use.

| Order | Album page (plain) | Karaoke (synced) |
|---|---|---|
| 1 | Your saved lyrics (`lyrics/`, incl. edited by you) | Saved synced lyrics (`lyrics-synced/`, incl. synced by hand) |
| 2 | Your files: `.lrc` next to the track, embedded tags (FLAC `LYRICS`, MP3 `USLT`), Navidrome | Your files: `.lrc`, embedded timestamped lyrics, Navidrome synced lyrics |
| 3 | Lyrics kept by the karaoke (timestamps removed) | LRCLIB synced lyrics |
| 4 | LRCLIB | Plain lyrics, ready to sync by hand |

- **Tolerant LRCLIB search**: exact match, then the title without "(feat. …)", "- Remastered 2011", "(Live …)", "Radio Edit"…, with the full artist then the main artist only, keeping only versions of a similar length.
- Plain lyrics found by the karaoke are also kept for the album page; lyrics pasted for a manual sync too.

### Your audio files

**audio-files** page.

**Local storage** — SD card, USB stick, external drive or any PC folder; add as many folders as you like.
- Pick each folder once with the Chrome/Edge folder picker (browsers don't allow a typed path); one "Autoriser" click per session afterwards.
- Each folder is scanned: title, artist, album, year, track and disc numbers and duration from FLAC/MP3 tags, otherwise from folder and file names (`Artist - Album (1997)/01 - Title.flac`). One folder = one album; `CD1`, `Disc 2`… subfolders are merged. Unchanged files are not re-read.
- Albums are matched to your collection by title and artist (ignoring "Deluxe", "Remastered"…), or linked by hand.
- Albums found in your folders but not in the collection are listed with their cover, ready to add (collection or next up).
- **Covers from your files**: `cover.jpg` / `folder.jpg` / `front.jpg`… or the image embedded in the files, copied to `datastorage/covers/`, for albums without a local cover.
- Local files play first, before the phone and Deezer.

**Phone (Navidrome)** — an Android phone running Navidrome in Termux serves your MP3/FLAC without copying them.
- **Several addresses for the same phone** — home Wi-Fi, phone hotspot, **USB cable (USB tethering, or ADB port forwarding when tethering is unavailable, e.g. no SIM card)**: add them once, conductor. uses the one that answers, at start-up and when the music stops because the network changed (the track resumes where it was). Fully offline over a USB cable.
- Albums split by Navidrome (one track with different tags) are merged back; album covers, embedded lyrics and exact durations come from the phone.
- Albums on the phone but not in the collection are listed, ready to add.

### Journal

- **Calendar** of the month with the covers of each day's listens (today highlighted); per day: copy the list (`1. [[Artist]] - [[Album]]`) and open the day's note.
- **Listening time chart** for the displayed month (with its own ‹ aujourd'hui › navigation), month total and today.
- **This month**: most played album and artist, busiest day, top 3 genres (links to the search).
- **A year ago**, **the last 12 months** heat map, **listening history** (10 per page, "aujourd'hui" / "hier").
- **Daily notes** in Markdown, Obsidian style: headings, bold / italic / underline / highlight, nested lists, tasks, `[[wiki links]]` to albums and artists (with play / queue buttons), `#tags`. Editor shortcuts (`Alt+1…6`, `Ctrl+B/I/U`, `Tab`, `Ctrl+E` preview, `I` to write), autosave, copy, search in notes, **today's note** button (`J`).
- Notes are also written as **Markdown files**, one per day, in `datastorage/journal-entries/` — editable in Obsidian; a file changed by hand is picked up at the next start.

### Insights and fiches à compléter

- **Insights**: the collection in numbers (albums, artists, total listening time, next up), families, most present artists, decades, intensity, albums to rediscover — every bar links to the filtered collection.
- **N fiches à compléter →**: albums missing a cover, genre, release date, tracklist, intensity or mood, or whose **cover is online only** (its site refused the copy, so it would be blank offline). Filter by criterion, dismiss a criterion per album (×).
- **exporter en CSV ↓**: download the whole collection as a spreadsheet.
- **wrapped**: the year in music (see below).

### Wrapped

The year in music, computed from your listens (offline). `Shift + W`, or **wrapped** in insights.

- **Release**: each year's wrapped comes out on a surprise day between 20 November and 15 December (fixed per year). A banner on the collection announces it; before that, the page shows "any day now". Past years stay available, one tab per year.
- **Contents**: listening hours and full days (with the difference from the previous year), albums and artists listened to, new albums added; the album of the year and the top 10; top artists (hours), families and genres (clickable: filter or search the collection, with "retour au wrapped").
- **Month by month**: hover a bar for hours and albums, click it for the month's wrap (top 5, families, top genres, average intensity); top 3 of each season below.
- **Records**: busiest day, longest streak, favourite time of day, most played decade, fastest adopted album, most loyal album (most consecutive months); the least played albums of the collection; the year in one sentence (moods, intensity, genres by season).
- **Demo**: when the previous year has no listens, a "démo" tab shows a full wrapped built from invented listens of your collection (nothing is saved).
- An album counts as listened when the player counted a listen (see [Playback](#playback)); "albums écoutés" counts different albums, not launches.

### Data, backups and exports

Everything is written to `datastorage/` (once the folder is authorised), a fraction of a second after each change:

- `collection.js` — albums, journal notes, listening time (read back at start-up, even offline);
- `collection.prev.js` and **daily backups** in `backups/` (last 7 kept);
- `collection.csv` — spreadsheet copy, `;` separator, opens in Excel;
- `covers/` — local copies of every cover;
- `lyrics/` and `lyrics-synced/` — plain and synced lyrics;
- `journal-entries/` — one Markdown note per day.

---

## Keyboard shortcuts

`?` shows them in the app. They work anywhere unless noted, and never while typing in a field.

| Key | Action |
|---|---|
| `N` | Add an album |
| `S` | Search |
| `R` | Surprise me (collection) |
| `Esc` | Leave a field · back to the collection |
| `Z` | Reset filters (collection) |
| `H` | Home, everything reset |
| `F` | Favourite albums filter (collection) |
| `E` | Edit the album sheet (album page) |
| `J` | Today's note (journal page) |
| `Shift + ← →` | Previous / next page (collection, journal history) |
| `Space` | Play / pause |
| `← →` | Previous / next track |
| `↑ ↓` | Volume up / down (out of 20) |
| `M` · `0` · `1` | Mute · volume to zero · volume to max |
| `T` | Queue panel (mini player open) |
| `Q` | Close the mini player |
| `P` | Full screen |
| `K` | Karaoke (full screen) |
| `O` | Open the page of the album playing |
| `Shift + W` | Wrapped: the year in music |
| `?` | Help |

Manual lyric sync: `Enter` line starts · `Backspace` undo · `Space` pause · `Esc` cancel.
Journal note editor: `I` write · `Ctrl+E` preview · `Ctrl+Enter` save.

---

## Working offline

Once albums are in the collection and your files are on a local drive (or the phone is on a USB cable), everything works without internet:

- collection, album and artist pages, covers (local copies), filters and search;
- playback of local files and Navidrome over Wi-Fi / hotspot / USB (local network only);
- full screen, karaoke and lyrics already loaded or synced;
- journal, notes, insights, wrapped, next up, exports and backups.

Needs internet: adding an album through the search (Deezer, Discogs) and completing sheets (genres, styles, tracklists), Deezer previews, lyrics never loaded before, covers whose site refused the copy (see *fiches à compléter*), Genius / Wikipedia links. Adding an album from your local folders works offline.

---

## Structure

```
conductor/
├── app/                    this repo (code)
│   ├── conductor.html      single-page shell: player, mini player, queue, full screen, disk writes
│   ├── index.html          collection
│   ├── pages/              album, artist, journal, nextup, insights, wrapped, complete, library (audio-files),
│   │                       manuals / manual (step-by-step guides), about
│   ├── css/style.css
│   ├── js/                 one file per page, plus shared modules:
│   │                       data (store), disk (datastorage), playback (engine), sdcard (local folders),
│   │                       navidrome (phone), lyrics / karaoke, cover-actions, shortcuts, volume…
│   ├── assets/
│   └── docs/               navidrome-man.md, calage-paroles.md, tier-guide.md, toolkit.md
└── datastorage/            your data, outside the repo
    ├── collection.js       collection, notes, listening time
    ├── collection.prev.js  previous version (safety net)
    ├── collection.csv      spreadsheet copy
    ├── backups/            one copy per day (7 kept)
    ├── covers/             local covers
    ├── lyrics/             plain lyrics, per album
    ├── lyrics-synced/      synced lyrics (.lrc), per album and track
    └── journal-entries/    journal notes, one .md per day
```

Keep both folders side by side: the app reads and writes `../datastorage/`.

---

## Getting started

1. Open `app/index.html` in **Chrome or Edge** (it opens the single-page shell).
2. Bottom left: **Choisir le dossier datastorage** → `conductor/datastorage`. Afterwards, one "Autoriser" click per session.
3. Optional: copy `js/config.example.js` to `js/config.js` and add a Discogs token (more search results).
4. Optional, **audio-files** page:
   - **Ajouter un dossier…** for your SD card, USB stick or music folder;
   - connect to Navidrome on your phone (see `docs/navidrome-man.md`), and add its USB address for offline streaming.

---

## Documentation

| File | Content |
|---|---|
| `docs/navidrome-man.md` | Navidrome on the phone: installation, finding the phone's address (Wi-Fi, hotspot, iPhone sharing, **USB cable**, USB without SIM via ADB), troubleshooting, tagging tips |
| `docs/calage-paroles.md` | Syncing lyrics by hand for the karaoke, step by step |
| `docs/tier-guide.md` | What S / A / B tiers mean |
| `docs/toolkit.md` | Services used, costs |

All guides are in French. They are also built into the app as step-by-step pages (book icon at the bottom of every page), next to an **About** page that presents the project to newcomers.

---

## Browser support and limits

- **Chrome or Edge** on a PC. Writing to `datastorage/` and opening local folders use the File System Access API, not available in Firefox or Safari (untested there; disk writes and local folders cannot work).
- An Android phone plugged in over USB is not seen as a drive by the browser: use its SD card in a card reader (local storage) or Navidrome over USB (tethering or ADB).
- MP3 durations from local files are computed from the file header (exact for most files, within a second or two for some).
- True sample-accurate gapless needs decoding the audio; MP3 encoder padding can leave a few milliseconds of silence. FLAC is seamless.
