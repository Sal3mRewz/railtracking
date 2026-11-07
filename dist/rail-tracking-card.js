var $="https://railfeed.co.uk/api",w=["both","departures","arrivals"],h={mode:"both",rows:6,hours:2,refresh_interval:60},S=5;function R(i,t){let e=String(i??"").trim().toUpperCase();if(!/^[A-Z]{3}$/.test(e))throw new Error(`${t} must be a 3-letter station (CRS) code, e.g. LDS, got "${i}"`);return e}function n(i){return String(i??"").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function g(i){let t=/(\d{2}):(\d{2})(?::\d{2})?$/.exec(String(i??"").trim());return t?`${t[1]}:${t[2]}`:null}function m(i){let t=/^(\d{1,2}):(\d{2})$/.exec(String(i??"").trim());return t?Number(t[1])*60+Number(t[2]):null}function y(i){let t=(i%1440+1440)%1440;return`${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`}function _(i){return String(i??"").toLowerCase().replace(/(^|[\s(.\-&/])([a-z])/g,(t,e,r)=>e+r.toUpperCase())}function L(i,t){let e=r=>String(r).replace(/[A-Z]+$/i,"");return e(i)===e(t)}function A(i,t){let e=t.trim().toUpperCase(),r=s=>{let a=String(s.name??"").toUpperCase();return s.crs===e?0:a.startsWith(e)?1:a.split(/[\s(.\-]+/).some(c=>c.startsWith(e))?2:3},o=new Set;return i.filter(s=>s.crs&&!o.has(s.crs)&&o.add(s.crs)).sort((s,a)=>r(s)-r(a)||s.name.length-a.name.length||s.name.localeCompare(a.name))}function x(i,t){let e=m(i),r=m(t);if(e===null||r===null)return null;let o=r-e;return o<-720&&(o+=1440),o>720&&(o-=1440),o}var b=class extends HTMLElement{setConfig(t){if(!t.api_key)throw new Error("Add your RailFeed API key (api_key)");let e=t.mode??h.mode;if(!w.includes(e))throw new Error(`mode must be one of ${w.join(", ")}`);let r=this._config;this._config={api_key:String(t.api_key).trim(),api_url:(t.api_url??$).replace(/\/+$/,""),station:R(t.station,"station"),title:t.title,mode:e,rows:Math.min(Math.max(Number(t.rows??h.rows),1),50),hours:Math.min(Math.max(Math.round(Number(t.hours??h.hours)),1),24),refresh_interval:Math.max(Number(t.refresh_interval??h.refresh_interval),30),show_platform:t.show_platform!==!1,show_operator:t.show_operator===!0,show_reason:t.show_reason!==!1},this.shadowRoot||this.attachShadow({mode:"open"});let o=this._requestKey();!r||o!==this._lastRequestKey?(this._lastRequestKey=o,this._board=null,this._error=null,this.isConnected&&this._startPolling()):r.refresh_interval!==this._config.refresh_interval&&this.isConnected&&this._startPolling(),this._render()}set hass(t){this._hass=t}connectedCallback(){this._onVisibility=()=>{document.visibilityState==="visible"&&this._isStale()&&this._fetch()},document.addEventListener("visibilitychange",this._onVisibility),this._startPolling(),this._render()}disconnectedCallback(){clearInterval(this._timer),this._abort?.abort(),document.removeEventListener("visibilitychange",this._onVisibility)}getCardSize(){return 1+(this._config?.mode==="both"?2:1)*Math.ceil((this._config?.rows??h.rows)/2)}static getConfigElement(){return document.createElement("rail-tracking-card-editor")}static getStubConfig(){return{api_key:"",station:"LDS",mode:"both",rows:6}}_requestKey(){let{api_key:t,api_url:e,station:r,mode:o,hours:s}=this._config;return JSON.stringify([t,e,r,o,s])}_startPolling(){clearInterval(this._timer),this._config&&(this._fetch(),this._timer=setInterval(()=>{document.visibilityState==="visible"&&this._fetch()},this._config.refresh_interval*1e3))}_isStale(){return!this._fetchedAt||Date.now()-this._fetchedAt>this._config.refresh_interval*1e3}async _fetch(){let t=this._config,e=new URLSearchParams({crs:t.station,type:t.mode,hours:String(t.hours)});this._abort?.abort();let r=this._abort=new AbortController;try{let o=await fetch(`${t.api_url}/live_board?${e}`,{headers:{"X-Api-Key":t.api_key,Accept:"application/json"},signal:r.signal}),s=await o.json().catch(()=>null);if(!o.ok)throw new Error(this._errorText(o.status,s));this._board=s,this._error=null}catch(o){if(o.name==="AbortError")return;this._error=o.message||String(o)}this._fetchedAt=Date.now(),this._render()}_errorText(t,e){let r=e?.code;return r==="invalid_key"||r==="no_credential"||t===401?"RailFeed rejected the API key. Check api_key.":r==="not_found"||t===404?`Unknown station code "${this._config.station}".`:r==="rate_limited"||t===429?"Too many requests. Increase refresh_interval.":e?.error||`RailFeed request failed (HTTP ${t})`}_servicesFor(t){let e=t==="departures",r=new Date().getHours()*60+new Date().getMinutes(),o=y(r);return(this._board?.services??[]).filter(s=>!s.is_pass&&!s.stale&&s.cancel_type!=="ON CALL").map(s=>{let a=g(e?s.public_departure:s.public_arrival),c=g(e?s.actual_departure_uk:s.actual_arrival_uk),u=g(e?s.projected_departure:s.projected_arrival),p=c??u;!p&&!s.projection_suppressed&&s.delay_mins>0&&a&&(p=y(m(a)+s.delay_mins));let d=(s.live_platform_suppressed?null:s.live_platform)??s.actual_platform,f=s.status==="cancelled"||!!s.cancel_type;return{scheduled:a,expected:p,actual:c,place:_(e?s.destination:s.origin),platform:d??s.platform,platformChanged:!!(d&&s.platform&&!L(d,s.platform)),operator:s.toc_name,cancelled:f,reason:f?s.cancel_reason:s.late_reason}}).filter(s=>s.scheduled?s.actual?!e&&x(s.actual,o)<=S:!0:!1).sort((s,a)=>this._sortKey(s.scheduled,r)-this._sortKey(a.scheduled,r)).slice(0,this._config.rows)}_sortKey(t,e){let r=m(t)??0;return r<e-720?r+1440:r}_status(t,e){if(t.cancelled)return{text:"Cancelled",cls:"cancelled"};let r=x(t.scheduled,t.expected);return t.actual?{text:e==="departures"?"Departed":"Arrived",cls:r>0?r>=5?"late":"slight":"ontime",time:r?t.actual:null}:r>0?{text:`+${r} min`,cls:r>=5?"late":"slight",time:t.expected}:{text:"On time",cls:"ontime"}}_listHtml(t){let e=this._servicesFor(t),r=t==="departures"?"Departures":"Arrivals",o=t==="departures"?"To":"From",{show_platform:s,show_operator:a,show_reason:c}=this._config,u=this._config.hours,p=e.length?e.map(l=>{let d=this._status(l,t),f=a&&l.operator?`<div class="operator">${n(l.operator)}</div>`:"",k=c&&l.reason&&(l.cancelled||d.time)?`<div class="reason">${n(l.reason)}</div>`:"";return`<tr class="${d.cls}">
              <td class="time">
                <span class="${d.time||l.cancelled?"scheduled struck":"scheduled"}">${n(l.scheduled)}</span>
                ${d.time?`<span class="expected">${n(d.time)}</span>`:""}
              </td>
              <td class="place">${n(l.place)}${f}${k}</td>
              ${s?`<td class="platform ${l.platformChanged?"changed":""}"
                  ${l.platformChanged?'title="Platform changed"':""}>${n(l.platform??"")}</td>`:""}
              <td class="status"><span class="badge">${n(d.text)}</span></td>
            </tr>`}).join(""):`<tr><td colspan="4" class="empty">No ${r.toLowerCase()} in the next ${u} hour${u===1?"":"s"}</td></tr>`;return`<div class="list">
      ${this._config.mode==="both"?`<div class="list-title">${r}</div>`:""}
      <table>
        <thead><tr>
          <th>Time</th><th>${o}</th>${s?"<th>Plat</th>":""}<th class="status">Status</th>
        </tr></thead>
        <tbody>${p}</tbody>
      </table>
    </div>`}_render(){if(!this._config||!this.shadowRoot)return;let t=this._config,e=this._board,r=t.title??(e?.station?_(e.station):t.station),o;this._error&&!e?o=`<div class="error">${n(this._error)}</div>`:e?o=(t.mode==="both"?["departures","arrivals"]:[t.mode]).map(c=>this._listHtml(c)).join(""):o='<div class="loading">Loading\u2026</div>';let s=this._fetchedAt?new Date(this._fetchedAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"";this.shadowRoot.innerHTML=`
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
          <div class="title">${n(r)}</div>
          <div class="updated ${this._error&&e?"stale":""}"
               title="${n(this._error??"")}">${this._error&&e?"\u26A0 ":""}${s}</div>
        </div>
        ${o}
      </ha-card>
    `}},v=class extends HTMLElement{setConfig(t){this._lastSent&&JSON.stringify(t)===this._lastSent||(this._config={...t},this._render())}set hass(t){this._hass=t}_emit(){let t={...this._config};this._lastSent=JSON.stringify(t),this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:t},bubbles:!0,composed:!0}))}_setOption(t,e,r){e===""||e===null||e===void 0||e===r?delete this._config[t]:this._config[t]=e}_onInput(t){let e=t.target;if(e.id==="station-search"){t.type==="input"&&this._onSearch(e.value);return}let r=e.dataset.key;if(r){if(e.type==="checkbox")this._setOption(r,e.checked,r!=="show_operator");else if(e.type==="number"){let o=e.value===""?void 0:Number(e.value);if(o!==void 0&&Number.isNaN(o))return;this._setOption(r,o,h[r])}else this._setOption(r,e.value,h[r]);this._emit()}}_onSearch(t){clearTimeout(this._searchTimer);let e=t.trim();if(e.length<2){this._showResults([]);return}this._searchTimer=setTimeout(()=>this._search(e),300)}async _search(t){let e=String(this._config.api_key??"").trim();if(!e){this._showResults([],"Add your API key above to search for stations.");return}let r=this._searchSeq=(this._searchSeq??0)+1,o=(this._config.api_url??$).replace(/\/+$/,""),s=new URLSearchParams({q:t,stations:"1"});try{let a=await fetch(`${o}/tiploc_search?${s}`,{headers:{"X-Api-Key":e,Accept:"application/json"}}),c=await a.json().catch(()=>null);if(r!==this._searchSeq)return;if(!a.ok)throw new Error(a.status===401?"RailFeed rejected the API key.":c?.error);let u=A(c?.results??[],t).slice(0,8);this._showResults(u,u.length?"":`No stations match "${t}".`)}catch(a){r===this._searchSeq&&this._showResults([],a.message||"Station search failed.")}}_showResults(t,e=""){this._results=t;let r=this.shadowRoot?.getElementById("results");r&&(r.innerHTML=t.map((o,s)=>`<button type="button" data-index="${s}">
            ${n(_(o.name))} <span class="crs">${n(o.crs)}</span>
          </button>`).join("")+(e?`<div class="hint">${n(e)}</div>`:""))}_pickStation(t){if(!t)return;this._config.station=t.crs,this._stationLabel=`${_(t.name)} (${t.crs})`;let e=this.shadowRoot.getElementById("station-search");e&&(e.value=this._stationLabel),this._showResults([]),this._emit()}_render(){if(!this._config)return;this.shadowRoot||(this.attachShadow({mode:"open"}),this.shadowRoot.addEventListener("input",r=>this._onInput(r)),this.shadowRoot.addEventListener("change",r=>this._onInput(r)),this.shadowRoot.addEventListener("click",r=>{let o=r.target.closest("#results button[data-index]");o&&this._pickStation(this._results?.[Number(o.dataset.index)])}),this.shadowRoot.addEventListener("keydown",r=>{r.target.id==="station-search"&&(r.key==="Enter"?(r.preventDefault(),this._pickStation(this._results?.[0])):r.key==="Escape"&&this._showResults([]))}));let t=this._config,e=(r,o,s)=>`<label class="check"><input type="checkbox" data-key="${r}" ${s?"checked":""}>${o}</label>`;this.shadowRoot.innerHTML=`
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
          <input type="password" data-key="api_key" value="${n(t.api_key)}" autocomplete="off" placeholder="rf_live_\u2026">
        </label>
        <div class="hint wide">It's saved in the dashboard config, so anyone who can edit this dashboard can see it.
          A public_tools key is enough.</div>
        <div class="wide">
          <label>Station
            <input type="text" id="station-search" autocomplete="off"
                   value="${n(this._stationLabel?.endsWith(`(${t.station})`)?this._stationLabel:t.station)}" placeholder="Search by name or code, e.g. York">
          </label>
          <div id="results"></div>
        </div>
        <label class="wide">Title<input type="text" data-key="title" value="${n(t.title)}" placeholder="station name"></label>
        <label>Show
          <select data-key="mode">
            <option value="both" ${!t.mode||t.mode==="both"?"selected":""}>Departures and arrivals</option>
            <option value="departures" ${t.mode==="departures"?"selected":""}>Departures only</option>
            <option value="arrivals" ${t.mode==="arrivals"?"selected":""}>Arrivals only</option>
          </select>
        </label>
        <label>Trains per list<input type="number" min="1" max="50" data-key="rows" value="${n(t.rows??h.rows)}"></label>
        <label>Look ahead (hours)<input type="number" min="1" max="24" data-key="hours" value="${n(t.hours??h.hours)}"></label>
        <label>Refresh every (seconds)<input type="number" min="30" data-key="refresh_interval" value="${n(t.refresh_interval??h.refresh_interval)}"></label>
        ${e("show_platform","Show platform",t.show_platform!==!1)}
        ${e("show_reason","Show delay reasons",t.show_reason!==!1)}
        ${e("show_operator","Show operator",t.show_operator===!0)}
      </div>
    `}};customElements.define("rail-tracking-card",b);customElements.define("rail-tracking-card-editor",v);window.customCards=window.customCards||[];window.customCards.push({type:"rail-tracking-card",name:"Rail Tracking Card",preview:!1,description:"Live arrivals and departures for a GB railway station from RailFeed."});
