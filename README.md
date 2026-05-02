# Lawnsmith Plus — Kelton Action Board

Electron desktop app for the Kelton Trello action board wall display.

## Prerequisites

- Node.js 18+ — download from https://nodejs.org

## First-time setup

```
cd kelton-board-app
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" install
node create-icon.js
```

## Run the app

```
.\node_modules\electron\dist\electron.exe .
```

Or with npm (if PowerShell execution policy allows it):
```
npm start
```

## Keyboard shortcuts

| Key            | Action                  |
|----------------|-------------------------|
| F11            | Toggle fullscreen        |
| Escape         | Exit fullscreen (no quit)|
| Ctrl+Shift+Q   | Quit the app            |

## Changing config without rebuilding

Edit the top of `kelton-board.html` — the `CONFIG` block at the top of the `<script>` section. Fields:

- `BOARD_NAME` — Trello board name
- `LIST_NAME` — Your bucket/list name on the board
- `LAT` / `LON` — Location for weather (Deridder LA defaults)
- `OPEN_HOUR` / `OPEN_MIN` — Shop open time (default 7:30am)
- `CLOSE_HOUR` / `CLOSE_MIN` — Shop close time (default 5:30pm)
- `REFRESH_MS` — Trello poll interval in ms (default 45000 = 45s)
- `MENTION_USERNAME` — Trello username to watch for @mentions

## Features

- **Full-screen kiosk mode** by default — no title bar, no borders
- **Screen never sleeps** while the app is running
- **@mention detection** — polls every 45s for `@keltondecker` in board comments; plays a chime and slides in a banner. Also fires a native Windows desktop notification. Auto-dismisses after 15 minutes.
- **Native desktop notifications** — Windows toast notifications for @mentions, even when another window is in front
- **Weather widget** — 7-day Deridder LA forecast + AI weather analysis for the shop
- **AI morning briefing** — 7:30–8:00am window
- **AI end-of-day summary** — activates at 5:30pm
- **AI insights** on every card — one punchy sentence per job
- **Priority scoring** — commercial jobs ranked highest; overdue/repeat also boosted

## Phase 2 (next step — installer)

When you're ready for the `.exe` installer, Phase 2 adds:
- electron-builder to package a Windows NSIS installer
- Launch-on-startup option
- Minimize-to-tray instead of close
- Desktop shortcut on install
