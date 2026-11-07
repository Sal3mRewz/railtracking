# Rail Tracking Card

A Home Assistant Lovelace card that shows live departures and arrivals for any GB railway station, using the [RailFeed](https://railfeed.co.uk) live board API.

For each train it shows the advertised time, the expected time and how many minutes late it is. It also shows the platform (highlighted when it has changed) and marks cancellations, with the reason when one is given. Departed trains drop off the list, and arrived trains stay for a few minutes. It refreshes automatically and has a visual editor.

## Get an API key

Sign up at [railfeed.co.uk](https://railfeed.co.uk) and create an API key. A `public_tools` key is enough.

The card calls the API directly from your browser, so the key is saved in your dashboard config. Anyone who can edit that dashboard can read it.

## Install

### HACS

1. In HACS, open the menu (⋮) → **Custom repositories**.
2. Add this repository's URL with type **Dashboard**.
3. Find **Rail Tracking Card** in HACS and download it.
4. Refresh your browser.

### Manual

1. Download `rail-tracking-card.js` from the latest release.
2. Copy it to `/config/www/` on your Home Assistant.
3. Add `/local/rail-tracking-card.js` as a **JavaScript module** under **Settings → Dashboards → ⋮ → Resources**.

## Configuration

```yaml
type: custom:rail-tracking-card
api_key: rf_live_...
station: LDS
mode: both
rows: 6
```

| Option | Default | Description |
| --- | --- | --- |
| `api_key` | — | **Required.** Your RailFeed API key |
| `station` | — | **Required.** 3-letter station (CRS) code, e.g. `LDS`, `MAN`, `EDB` |
| `title` | station name | Card title |
| `mode` | `both` | `both`, `departures` or `arrivals` |
| `rows` | `6` | Trains shown in each list |
| `hours` | `2` | How many hours ahead to look (1–24) |
| `refresh_interval` | `60` | Seconds between updates (min 30). The card pauses while the browser tab is hidden |
| `show_platform` | `true` | Show the platform column |
| `show_reason` | `true` | Show delay and cancellation reasons |
| `show_operator` | `false` | Show the train operator |
| `api_url` | `https://railfeed.co.uk/api` | Override the API base URL |

In the visual editor, type part of a station's name (or its code) into **Station** and pick it from the list. The search uses RailFeed, so add your API key first. In YAML, `station` takes the 3-letter CRS code, which the search shows next to each name.

RailFeed allows 60 requests a minute per key. Each card makes one request per refresh, so the default of 60 seconds leaves plenty of room for several cards.

### Statuses

- **On time** (green): no delay expected.
- **+N min** (amber under 5 minutes, red from 5): the expected time is shown under the advertised one, which is struck through.
- **Cancelled** (red): the train won't run.
- **Arrived**: the train arrived in the last few minutes.

## Development

```sh
npm install
npm run build   # minifies src/ → dist/rail-tracking-card.js (commit this file)
npm run watch   # rebuild on change
```

To release, publish a GitHub release with a tag like `v1.0.0`. A workflow builds the card and attaches `rail-tracking-card.js` to the release, which HACS then installs.
