/**
 * Rail Tracking Card for Home Assistant
 *
 * Shows live arrivals and departures for a GB railway station from the
 * RailFeed live board API (railfeed.co.uk), including expected times,
 * delays, cancellations and platforms.
 *
 * Example config:
 *
 *   type: custom:rail-tracking-card
 *   api_key: rf_live_...
 *   station: LDS               # CRS code of the station
 *   mode: both                 # both | departures | arrivals
 *   rows: 6
 *
 * The API is called straight from the browser, so the key is stored in the
 * dashboard config. Anyone who can edit the dashboard can read it.
 */

const DEFAULT_API_URL = "https://railfeed.co.uk/api";
const MODES = ["both", "departures", "arrivals"];
const DEFAULTS = {
  mode: "both",
  rows: 6,
  hours: 2,
  refresh_interval: 60,
};
// Arrived trains stay on the arrivals list this long.
const ARRIVED_GRACE_MINS = 5;

function parseCrs(value, field) {
  const crs = String(value ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(crs)) {
    throw new Error(`${field} must be a 3-letter station (CRS) code, e.g. LDS, got "${value}"`);
  }
  return crs;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// "HH:MM:SS" or "YYYY-MM-DD HH:MM:SS" → "HH:MM", or null.
function hhmm(value) {
  const match = /(\d{2}):(\d{2})(?::\d{2})?$/.exec(String(value ?? "").trim());
  return match ? `${match[1]}:${match[2]}` : null;
}

function timeToMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function minutesToTime(mins) {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// RailFeed gives station names in capitals, e.g. "MANCHESTER AIRPORT".
function titleCase(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/(^|[\s(.\-&/])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

// "9" and "9D" are the same platform, so only flag a change of number.
function samePlatform(a, b) {
  const base = (p) => String(p).replace(/[A-Z]+$/i, "");
  return base(a) === base(b);
}

// Order station search results: exact code first, then names starting
// with the query, then names with a word starting with it, shortest first.
function rankStations(results, query) {
  const q = query.trim().toUpperCase();
  const score = (r) => {
    const name = String(r.name ?? "").toUpperCase();
    if (r.crs === q) return 0;
    if (name.startsWith(q)) return 1;
    if (name.split(/[\s(.\-]+/).some((word) => word.startsWith(q))) return 2;
    return 3;
  };
  const seen = new Set();
  return results
    .filter((r) => r.crs && !seen.has(r.crs) && seen.add(r.crs))
    .sort((a, b) => score(a) - score(b) || a.name.length - b.name.length || a.name.localeCompare(b.name));
}

// Minutes from `a` to `b` ("HH:MM"), allowing for times either side of midnight.
function minutesBetween(a, b) {
  const s = timeToMinutes(a);
  const e = timeToMinutes(b);
  if (s === null || e === null) return null;
  let diff = e - s;
  if (diff < -720) diff += 1440;
  if (diff > 720) diff -= 1440;
  return diff;
}

class RailTrackingCard extends HTMLElement {
  setConfig(config) {
    if (!config.api_key) throw new Error("Add your RailFeed API key (api_key)");
    const mode = config.mode ?? DEFAULTS.mode;
    if (!MODES.includes(mode)) throw new Error(`mode must be one of ${MODES.join(", ")}`);

    const previous = this._config;
    this._config = {
      api_key: String(config.api_key).trim(),
      api_url: (config.api_url ?? DEFAULT_API_URL).replace(/\/+$/, ""),
      station: parseCrs(config.station, "station"),
      title: config.title,
      mode,
      rows: Math.min(Math.max(Number(config.rows ?? DEFAULTS.rows), 1), 50),
      hours: Math.min(Math.max(Math.round(Number(config.hours ?? DEFAULTS.hours)), 1), 24),
      // RailFeed caches live boards for 30s, so polling faster gains nothing.
      refresh_interval: Math.max(Number(config.refresh_interval ?? DEFAULTS.refresh_interval), 30),
      show_platform: config.show_platform !== false,
      show_operator: config.show_operator === true,
      show_reason: config.show_reason !== false,
    };

    if (!this.shadowRoot) this.attachShadow({ mode: "open" });

    // Only refetch when something that affects the request has changed.
    const requestKey = this._requestKey();
    if (!previous || requestKey !== this._lastRequestKey) {
      this._lastRequestKey = requestKey;
      this._board = null;
      this._error = null;
      if (this.isConnected) this._startPolling();
    } else if (previous.refresh_interval !== this._config.refresh_interval && this.isConnected) {
      this._startPolling();
    }
    this._render();
  }

  // Not used for the data, but HA expects cards to accept it.
  set hass(hass) {
    this._hass = hass;
  }

  connectedCallback() {
    this._onVisibility = () => {
      if (document.visibilityState === "visible" && this._isStale()) this._fetch();
    };
    document.addEventListener("visibilitychange", this._onVisibility);
    this._startPolling();
    this._render();
  }

  disconnectedCallback() {
    clearInterval(this._timer);
    this._abort?.abort();
    document.removeEventListener("visibilitychange", this._onVisibility);
  }

  getCardSize() {
    const lists = this._config?.mode === "both" ? 2 : 1;
    return 1 + lists * Math.ceil((this._config?.rows ?? DEFAULTS.rows) / 2);
  }

  static getConfigElement() {
    return document.createElement("rail-tracking-card-editor");
  }

  static getStubConfig() {
    return { api_key: "", station: "LDS", mode: "both", rows: 6 };
  }

  _requestKey() {
    const { api_key, api_url, station, mode, hours } = this._config;
    return JSON.stringify([api_key, api_url, station, mode, hours]);
  }

  _startPolling() {
    clearInterval(this._timer);
    if (!this._config) return;
    this._fetch();
    this._timer = setInterval(() => {
      // Don't use up the API quota while the dashboard isn't being looked at.
      if (document.visibilityState === "visible") this._fetch();
    }, this._config.refresh_interval * 1000);
  }

  _isStale() {
    return !this._fetchedAt || Date.now() - this._fetchedAt > this._config.refresh_interval * 1000;
  }

  async _fetch() {
    const c = this._config;
    const params = new URLSearchParams({ crs: c.station, type: c.mode, hours: String(c.hours) });

    this._abort?.abort();
    const abort = (this._abort = new AbortController());
    try {
      const res = await fetch(`${c.api_url}/live_board?${params}`, {
        headers: { "X-Api-Key": c.api_key, Accept: "application/json" },
        signal: abort.signal,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(this._errorText(res.status, body));
      this._board = body;
      this._error = null;
    } catch (err) {
      if (err.name === "AbortError") return;
      this._error = err.message || String(err);
    }
    this._fetchedAt = Date.now();
    this._render();
  }

  _errorText(status, body) {
    const code = body?.code;
    if (code === "invalid_key" || code === "no_credential" || status === 401) {
      return "RailFeed rejected the API key. Check api_key.";
    }
    if (code === "not_found" || status === 404) return `Unknown station code "${this._config.station}".`;
    if (code === "rate_limited" || status === 429) return "Too many requests. Increase refresh_interval.";
    return body?.error || `RailFeed request failed (HTTP ${status})`;
  }

  // Services from the board as rows for one list. Departures use the
  // advertised departure and destination, arrivals the advertised arrival
  // and origin. Calls with no advertised time aren't public stops, so a
  // train starting or terminating here only appears in one list.
  _servicesFor(kind) {
    const dep = kind === "departures";
    const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
    const nowText = minutesToTime(nowMins);

    return (this._board?.services ?? [])
      .filter((s) => !s.is_pass && !s.stale && s.cancel_type !== "ON CALL")
      .map((s) => {
        const scheduled = hhmm(dep ? s.public_departure : s.public_arrival);
        const actual = hhmm(dep ? s.actual_departure_uk : s.actual_arrival_uk);
        const projected = hhmm(dep ? s.projected_departure : s.projected_arrival);
        let expected = actual ?? projected;
        // Fall back to the reported delay when there's no projected time,
        // unless RailFeed has judged the train will make it up.
        if (!expected && !s.projection_suppressed && s.delay_mins > 0 && scheduled) {
          expected = minutesToTime(timeToMinutes(scheduled) + s.delay_mins);
        }
        // Operators often hide the live platform; the booked one is still public.
        const livePlatform = s.live_platform_suppressed ? null : s.live_platform;
        const reportedPlatform = livePlatform ?? s.actual_platform;
        const cancelled = s.status === "cancelled" || Boolean(s.cancel_type);
        return {
          scheduled,
          expected,
          actual,
          place: titleCase(dep ? s.destination : s.origin),
          platform: reportedPlatform ?? s.platform,
          platformChanged: Boolean(reportedPlatform && s.platform && !samePlatform(reportedPlatform, s.platform)),
          operator: s.toc_name,
          cancelled,
          reason: cancelled ? s.cancel_reason : s.late_reason,
        };
      })
      .filter((s) => {
        if (!s.scheduled) return false;
        if (!s.actual) return true;
        // Departed trains drop off; arrived ones linger briefly.
        return !dep && minutesBetween(s.actual, nowText) <= ARRIVED_GRACE_MINS;
      })
      .sort((a, b) => this._sortKey(a.scheduled, nowMins) - this._sortKey(b.scheduled, nowMins))
      .slice(0, this._config.rows);
  }

  // Treat times well before now as tomorrow, so lists that span midnight stay in order.
  _sortKey(time, nowMins) {
    const mins = timeToMinutes(time) ?? 0;
    return mins < nowMins - 720 ? mins + 1440 : mins;
  }

  _status(service, kind) {
    if (service.cancelled) return { text: "Cancelled", cls: "cancelled" };
    const late = minutesBetween(service.scheduled, service.expected);
    if (service.actual) {
      const verb = kind === "departures" ? "Departed" : "Arrived";
      return { text: verb, cls: late > 0 ? (late >= 5 ? "late" : "slight") : "ontime", time: late ? service.actual : null };
    }
    if (late > 0) return { text: `+${late} min`, cls: late >= 5 ? "late" : "slight", time: service.expected };
    return { text: "On time", cls: "ontime" };
  }

  _listHtml(kind) {
    const services = this._servicesFor(kind);
    const heading = kind === "departures" ? "Departures" : "Arrivals";
    const placeLabel = kind === "departures" ? "To" : "From";
    const { show_platform, show_operator, show_reason } = this._config;
    const hours = this._config.hours;

    const rows = services.length
      ? services
          .map((s) => {
            const status = this._status(s, kind);
            const operator = show_operator && s.operator ? `<div class="operator">${escapeHtml(s.operator)}</div>` : "";
            const reason = show_reason && s.reason && (s.cancelled || status.time)
              ? `<div class="reason">${escapeHtml(s.reason)}</div>` : "";
            return `<tr class="${status.cls}">
              <td class="time">
                <span class="${status.time || s.cancelled ? "scheduled struck" : "scheduled"}">${escapeHtml(s.scheduled)}</span>
                ${status.time ? `<span class="expected">${escapeHtml(status.time)}</span>` : ""}
              </td>
              <td class="place">${escapeHtml(s.place)}${operator}${reason}</td>
              ${show_platform ? `<td class="platform ${s.platformChanged ? "changed" : ""}"
                  ${s.platformChanged ? 'title="Platform changed"' : ""}>${escapeHtml(s.platform ?? "")}</td>` : ""}
              <td class="status"><span class="badge">${escapeHtml(status.text)}</span></td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="4" class="empty">No ${heading.toLowerCase()} in the next ${hours} hour${hours === 1 ? "" : "s"}</td></tr>`;

    return `<div class="list">
      ${this._config.mode === "both" ? `<div class="list-title">${heading}</div>` : ""}
      <table>
        <thead><tr>
          <th>Time</th><th>${placeLabel}</th>${show_platform ? "<th>Plat</th>" : ""}<th class="status">Status</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  _render() {
    if (!this._config || !this.shadowRoot) return;
    const c = this._config;
    const board = this._board;
    const title = c.title ?? (board?.station ? titleCase(board.station) : c.station);

    let body;
    if (this._error && !board) {
      body = `<div class="error">${escapeHtml(this._error)}</div>`;
    } else if (!board) {
      body = `<div class="loading">Loading…</div>`;
    } else {
      const kinds = c.mode === "both" ? ["departures", "arrivals"] : [c.mode];
      body = kinds.map((k) => this._listHtml(k)).join("");
    }

    const updated = this._fetchedAt
      ? new Date(this._fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";

    this.shadowRoot.innerHTML = `
      <style>
        ha-card { padding: 16px; }
        .header { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
        .title { font-size: 1.2em; font-weight: 500; }
        .updated { color: var(--secondary-text-color); font-size: 0.8em; white-space: nowrap; }
        .stale { color: var(--warning-color, #ffa600); }
        .list { margin-top: 12px; }
        .list-title { font-weight: 500; color: var(--secondary-text-color); margin-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 0.95em; }
        th { text-align: left; font-weight: 400; font-size: 0.8em; color: var(--secondary-text-color);
             padding: 2px 4px; }
        td { padding: 6px 4px; border-top: 1px solid var(--divider-color); vertical-align: top; }
        .time { white-space: nowrap; font-variant-numeric: tabular-nums; width: 1%; }
        .scheduled.struck { text-decoration: line-through; color: var(--secondary-text-color); }
        .expected { display: block; font-weight: 600; }
        .place { width: 100%; }
        .operator, .reason { font-size: 0.8em; color: var(--secondary-text-color); }
        .platform { text-align: center; width: 1%; font-variant-numeric: tabular-nums; }
        .platform.changed { font-weight: 700; color: var(--warning-color, #ffa600); }
        th.status, td.status { text-align: right; white-space: nowrap; width: 1%; }
        .badge { font-size: 0.85em; padding: 2px 8px; border-radius: 10px; }
        .ontime .badge { color: var(--success-color, #43a047);
                         background: color-mix(in srgb, var(--success-color, #43a047) 15%, transparent); }
        .slight .badge { color: var(--warning-color, #ffa600);
                         background: color-mix(in srgb, var(--warning-color, #ffa600) 15%, transparent); }
        .late .badge, .cancelled .badge { color: var(--error-color, #db4437);
                         background: color-mix(in srgb, var(--error-color, #db4437) 15%, transparent); }
        .late .expected { color: var(--error-color, #db4437); }
        .slight .expected { color: var(--warning-color, #ffa600); }
        .cancelled .place { color: var(--secondary-text-color); }
        .empty, .loading { color: var(--secondary-text-color); text-align: center; padding: 12px; }
        .error { color: var(--error-color, #db4437); margin-top: 12px; }
      </style>
      <ha-card>
        <div class="header">
          <div class="title">${escapeHtml(title)}</div>
          <div class="updated ${this._error && board ? "stale" : ""}"
               title="${escapeHtml(this._error ?? "")}">${this._error && board ? "⚠ " : ""}${updated}</div>
        </div>
        ${body}
      </ha-card>
    `;
  }
}

/**
 * Visual editor shown in the dashboard "Edit card" dialog.
 *
 * Fields update the config in place without re-rendering, so the cursor
 * isn't lost while typing.
 */
class RailTrackingCardEditor extends HTMLElement {
  setConfig(config) {
    // Ignore the echo of our own change coming back from HA.
    if (this._lastSent && JSON.stringify(config) === this._lastSent) return;
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
  }

  _emit() {
    const config = { ...this._config };
    this._lastSent = JSON.stringify(config);
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config },
        bubbles: true,
        composed: true,
      })
    );
  }

  _setOption(key, value, defaultValue) {
    if (value === "" || value === null || value === undefined || value === defaultValue) {
      delete this._config[key];
    } else {
      this._config[key] = value;
    }
  }

  _onInput(ev) {
    const el = ev.target;
    if (el.id === "station-search") {
      if (ev.type === "input") this._onSearch(el.value);
      return;
    }
    const key = el.dataset.key;
    if (!key) return;

    if (el.type === "checkbox") {
      this._setOption(key, el.checked, key === "show_operator" ? false : true);
    } else if (el.type === "number") {
      const number = el.value === "" ? undefined : Number(el.value);
      if (number !== undefined && Number.isNaN(number)) return;
      this._setOption(key, number, DEFAULTS[key]);
    } else {
      this._setOption(key, el.value, DEFAULTS[key]);
    }
    this._emit();
  }

  _onSearch(query) {
    clearTimeout(this._searchTimer);
    const q = query.trim();
    if (q.length < 2) {
      this._showResults([]);
      return;
    }
    this._searchTimer = setTimeout(() => this._search(q), 300);
  }

  async _search(query) {
    const apiKey = String(this._config.api_key ?? "").trim();
    if (!apiKey) {
      this._showResults([], "Add your API key above to search for stations.");
      return;
    }
    const seq = (this._searchSeq = (this._searchSeq ?? 0) + 1);
    const apiUrl = (this._config.api_url ?? DEFAULT_API_URL).replace(/\/+$/, "");
    const params = new URLSearchParams({ q: query, stations: "1" });
    try {
      const res = await fetch(`${apiUrl}/tiploc_search?${params}`, {
        headers: { "X-Api-Key": apiKey, Accept: "application/json" },
      });
      const body = await res.json().catch(() => null);
      if (seq !== this._searchSeq) return; // a newer search has started
      if (!res.ok) throw new Error(res.status === 401 ? "RailFeed rejected the API key." : body?.error);
      const results = rankStations(body?.results ?? [], query).slice(0, 8);
      this._showResults(results, results.length ? "" : `No stations match "${query}".`);
    } catch (err) {
      if (seq === this._searchSeq) this._showResults([], err.message || "Station search failed.");
    }
  }

  _showResults(results, message = "") {
    this._results = results;
    const box = this.shadowRoot?.getElementById("results");
    if (!box) return;
    box.innerHTML =
      results
        .map(
          (r, i) => `<button type="button" data-index="${i}">
            ${escapeHtml(titleCase(r.name))} <span class="crs">${escapeHtml(r.crs)}</span>
          </button>`
        )
        .join("") + (message ? `<div class="hint">${escapeHtml(message)}</div>` : "");
  }

  _pickStation(station) {
    if (!station) return;
    this._config.station = station.crs;
    this._stationLabel = `${titleCase(station.name)} (${station.crs})`;
    const input = this.shadowRoot.getElementById("station-search");
    if (input) input.value = this._stationLabel;
    this._showResults([]);
    this._emit();
  }

  _render() {
    if (!this._config) return;
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
      this.shadowRoot.addEventListener("input", (ev) => this._onInput(ev));
      this.shadowRoot.addEventListener("change", (ev) => this._onInput(ev));
      this.shadowRoot.addEventListener("click", (ev) => {
        const button = ev.target.closest("#results button[data-index]");
        if (button) this._pickStation(this._results?.[Number(button.dataset.index)]);
      });
      this.shadowRoot.addEventListener("keydown", (ev) => {
        if (ev.target.id !== "station-search") return;
        if (ev.key === "Enter") {
          ev.preventDefault();
          this._pickStation(this._results?.[0]);
        } else if (ev.key === "Escape") {
          this._showResults([]);
        }
      });
    }

    const c = this._config;
    const check = (key, label, on) =>
      `<label class="check"><input type="checkbox" data-key="${key}" ${on ? "checked" : ""}>${label}</label>`;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; }
        .wide { grid-column: 1 / -1; }
        label { display: flex; flex-direction: column; font-size: 0.85em;
                color: var(--secondary-text-color); gap: 4px; }
        label.check { flex-direction: row; align-items: center; color: var(--primary-text-color); }
        input[type=text], input[type=password], input[type=number], select {
          font: inherit; font-size: 1rem; padding: 8px; border-radius: 4px;
          border: 1px solid var(--divider-color, #ccc);
          background: var(--card-background-color, #fff); color: var(--primary-text-color);
        }
        .hint { font-size: 0.8em; color: var(--secondary-text-color); }
        #results { display: flex; flex-direction: column; margin-top: 4px; }
        #results button { font: inherit; text-align: left; cursor: pointer; padding: 8px;
                          border: none; border-bottom: 1px solid var(--divider-color, #ccc);
                          background: var(--secondary-background-color); color: var(--primary-text-color); }
        #results button:hover, #results button:focus { background: var(--divider-color, #ddd); }
        .crs { color: var(--secondary-text-color); font-size: 0.85em; margin-left: 6px; }
      </style>

      <div class="grid">
        <label class="wide">RailFeed API key
          <input type="password" data-key="api_key" value="${escapeHtml(c.api_key)}" autocomplete="off" placeholder="rf_live_…">
        </label>
        <div class="hint wide">It's saved in the dashboard config, so anyone who can edit this dashboard can see it.
          A public_tools key is enough.</div>
        <div class="wide">
          <label>Station
            <input type="text" id="station-search" autocomplete="off"
                   value="${escapeHtml(this._stationLabel?.endsWith(`(${c.station})`) ? this._stationLabel : c.station)}" placeholder="Search by name or code, e.g. York">
          </label>
          <div id="results"></div>
        </div>
        <label class="wide">Title<input type="text" data-key="title" value="${escapeHtml(c.title)}" placeholder="station name"></label>
        <label>Show
          <select data-key="mode">
            <option value="both" ${!c.mode || c.mode === "both" ? "selected" : ""}>Departures and arrivals</option>
            <option value="departures" ${c.mode === "departures" ? "selected" : ""}>Departures only</option>
            <option value="arrivals" ${c.mode === "arrivals" ? "selected" : ""}>Arrivals only</option>
          </select>
        </label>
        <label>Trains per list<input type="number" min="1" max="50" data-key="rows" value="${escapeHtml(c.rows ?? DEFAULTS.rows)}"></label>
        <label>Look ahead (hours)<input type="number" min="1" max="24" data-key="hours" value="${escapeHtml(c.hours ?? DEFAULTS.hours)}"></label>
        <label>Refresh every (seconds)<input type="number" min="30" data-key="refresh_interval" value="${escapeHtml(c.refresh_interval ?? DEFAULTS.refresh_interval)}"></label>
        ${check("show_platform", "Show platform", c.show_platform !== false)}
        ${check("show_reason", "Show delay reasons", c.show_reason !== false)}
        ${check("show_operator", "Show operator", c.show_operator === true)}
      </div>
    `;
  }
}

customElements.define("rail-tracking-card", RailTrackingCard);
customElements.define("rail-tracking-card-editor", RailTrackingCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "rail-tracking-card",
  name: "Rail Tracking Card",
  preview: false,
  description: "Live arrivals and departures for a GB railway station from RailFeed.",
});
