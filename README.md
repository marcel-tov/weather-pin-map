# Weather Pin Map

A small static website: click the map to drop pins, click a pin to see recent
rainfall for that spot, and review all your pins in the table below the map.

## Features
- Click anywhere on the map to add a pin (Leaflet + OpenStreetMap tiles, no API key needed).
- Pins are saved in your browser's `localStorage` — they persist across reloads,
  but stay local to this browser/device (not synced anywhere).
- Click a pin to see a popup with total rainfall and a day-by-day breakdown.
- One dropdown (7 / 14 / 30 days) controls the time range for both the pin
  popups and the table.
- The table lists every saved pin with its coordinates, total rain, and rainy-day
  count for the selected range. You can rename a pin inline, jump to it on the
  map, or remove it.
- Weather data comes from the free [Open-Meteo](https://open-meteo.com/) API
  (no API key or account required).

## Running it
No build step needed — it's plain HTML/CSS/JS.

Just open `index.html` in your browser (double-click it, or drag it into a
browser window).

If your browser blocks `fetch()` calls from a `file://` page, serve the folder
locally instead, e.g. from a terminal in this folder:

```
python3 -m http.server 8000
```

then open http://localhost:8000 in your browser.

## Files
- `index.html` — page structure
- `style.css` — styling
- `app.js` — map, pin storage, weather fetching, and table rendering logic
