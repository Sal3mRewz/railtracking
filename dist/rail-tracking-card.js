var T="https://railfeed.co.uk/api",C=["both","departures","arrivals"],p={mode:"both",rows:6,hours:2,refresh_interval:60},P=5;function E(l,t){let e=String(l??"").trim().toUpperCase();if(!/^[A-Z]{3}$/.test(e))throw new Error(`${t} must be a 3-letter station (CRS) code, e.g. LDS, got "${l}"`);return e}function n(l){return String(l??"").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function f(l){let t=/(\d{2}):(\d{2})(?::\d{2})?$/.exec(String(l??"").trim());return t?`${t[1]}:${t[2]}`:null}function x(l){let t=/^(\d{1,2}):(\d{2})$/.exec(String(l??"").trim());return t?Number(t[1])*60+Number(t[2]):null}function L(l){let t=(l%1440+1440)%1440;return`${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`}function v(l){return String(l??"").toLowerCase().replace(/(^|[\s(.\-&/])([a-z])/g,(t,e,s)=>e+s.toUpperCase())}function D(l,t){let e=s=>String(s).replace(/[A-Z]+$/i,"");return e(l)===e(t)}function j(l,t){let e=t.trim().toUpperCase(),s=r=>{let i=String(r.name??"").toUpperCase();return r.crs===e?0:i.startsWith(e)?1:i.split(/[\s(.\-]+/).some(c=>c.startsWith(e))?2:3},o=new Set;return l.filter(r=>r.crs&&!o.has(r.crs)&&o.add(r.crs)).sort((r,i)=>s(r)-s(i)||r.name.length-i.name.length||r.name.localeCompare(i.name))}function $(l,t){let e=x(l),s=x(t);if(e===null||s===null)return null;let o=s-e;return o<-720&&(o+=1440),o>720&&(o-=1440),o}var k=class extends HTMLElement{setConfig(t){if(!t.api_key)throw new Error("Add your RailFeed API key (api_key)");let e=t.mode??p.mode;if(!C.includes(e))throw new Error(`mode must be one of ${C.join(", ")}`);let s=this._config;this._config={api_key:String(t.api_key).trim(),api_url:(t.api_url??T).replace(/\/+$/,""),station:E(t.station,"station"),destination:t.destination??t.via?E(t.destination??t.via,"destination"):null,title:t.title,mode:e,rows:Math.min(Math.max(Number(t.rows??p.rows),1),50),hours:Math.min(Math.max(Math.round(Number(t.hours??p.hours)),1),24),refresh_interval:Math.max(Number(t.refresh_interval??p.refresh_interval),30),show_platform:t.show_platform!==!1,show_operator:t.show_operator===!0,show_reason:t.show_reason!==!1},this.shadowRoot||(this.attachShadow({mode:"open"}),this.shadowRoot.addEventListener("click",r=>this._onRowActivate(r)),this.shadowRoot.addEventListener("keydown",r=>{(r.key==="Enter"||r.key===" ")&&this._onRowActivate(r)}));let o=this._requestKey();!s||o!==this._lastRequestKey?(this._lastRequestKey=o,this._board=null,this._error=null,this._dest=null,this._expanded=null,this._stops=null,this.isConnected&&this._startPolling()):s.refresh_interval!==this._config.refresh_interval&&this.isConnected&&this._startPolling(),this._render()}set hass(t){this._hass=t}connectedCallback(){this._onVisibility=()=>{document.visibilityState==="visible"&&this._isStale()&&this._fetch()},document.addEventListener("visibilitychange",this._onVisibility),this._startPolling(),this._render()}disconnectedCallback(){clearInterval(this._timer),this._abort?.abort(),document.removeEventListener("visibilitychange",this._onVisibility)}getCardSize(){return 1+(this._config?.mode==="both"?2:1)*Math.ceil((this._config?.rows??p.rows)/2)}static getConfigElement(){return document.createElement("rail-tracking-card-editor")}static getStubConfig(){return{api_key:"",station:"LDS",mode:"both",rows:6}}_requestKey(){let{api_key:t,api_url:e,station:s,destination:o,mode:r,hours:i}=this._config;return JSON.stringify([t,e,s,o,r,i])}_startPolling(){clearInterval(this._timer),this._config&&(this._fetch(),this._timer=setInterval(()=>{document.visibilityState==="visible"&&this._fetch()},this._config.refresh_interval*1e3))}_isStale(){return!this._fetchedAt||Date.now()-this._fetchedAt>this._config.refresh_interval*1e3}async _get(t,e,s){let o=this._config,r=await fetch(`${o.api_url}/${t}?${new URLSearchParams(e)}`,{headers:{"X-Api-Key":o.api_key,Accept:"application/json"},signal:s}),i=await r.json().catch(()=>null);if(!r.ok)throw new Error(this._errorText(r.status,i));return i}async _fetch(){let t=this._config;this._abort?.abort();let e=this._abort=new AbortController;try{let s=await this._get("live_board",{crs:t.station,type:t.mode,hours:String(t.hours)},e.signal);await this._loadDestination(s.date,e.signal),this._board=s,this._error=null}catch(s){if(s.name==="AbortError")return;this._error=s.message||String(s)}this._fetchedAt=Date.now(),this._render(),this._expanded&&this._loadStops(this._expanded.uid)}async _loadDestination(t,e){let s=this._config;if(!s.destination||s.mode==="arrivals"||this._dest?.date===t)return;let o=await this._get("services",{from:s.station,to:s.destination,date:t},e);this._dest={date:t,name:v(o.to),times:new Map((o.services??[]).filter(r=>!r.to_is_pass).map(r=>[r.uid,f(r.to_public_arrival)]).filter(([,r])=>r))}}_onRowActivate(t){let e=t.target.closest?.("tr.service");if(!e)return;t.preventDefault();let{uid:s,kind:o}=e.dataset;this._expanded?.uid===s&&this._expanded.kind===o?this._expanded=null:(this._expanded={uid:s,kind:o},this._stops?.uid!==s&&(this._stops={uid:s}),this._loadStops(s)),this._render()}async _loadStops(t){this._stops?.uid!==t&&(this._stops={uid:t});let e=this._stops;e.loading=!0;try{e.data=await this._get("service_live",{uid:t,date:this._board?.date??"",junctions:"0"}),e.error=null}catch(s){e.error=s.message||String(s)}e.loading=!1,this._stops===e&&this._render()}_errorText(t,e){let s=e?.code;return s==="invalid_key"||s==="no_credential"||t===401?"RailFeed rejected the API key. Check api_key.":s==="not_found"||t===404?`Unknown station code "${this._config.station}".`:s==="rate_limited"||t===429?"Too many requests. Increase refresh_interval.":e?.error||`RailFeed request failed (HTTP ${t})`}_servicesFor(t){let e=t==="departures",s=new Date().getHours()*60+new Date().getMinutes(),o=L(s);return(this._board?.services??[]).filter(r=>!r.is_pass&&!r.stale&&r.cancel_type!=="ON CALL").map(r=>{let i=f(e?r.public_departure:r.public_arrival),c=f(e?r.actual_departure_uk:r.actual_arrival_uk),h=f(e?r.projected_departure:r.projected_arrival),u=c??h;!u&&!r.projection_suppressed&&r.delay_mins>0&&i&&(u=L(x(i)+r.delay_mins));let d=(r.live_platform_suppressed?null:r.live_platform)??r.actual_platform,_=r.status==="cancelled"||!!r.cancel_type;return{uid:r.uid,destTime:e?this._dest?.times.get(r.uid):null,destIsEnd:r.destination_crs===this._config.destination,scheduled:i,expected:u,actual:c,place:v(e?r.destination:r.origin),platform:d??r.platform,platformChanged:!!(d&&r.platform&&!D(d,r.platform)),operator:r.toc_name,cancelled:_,reason:_?r.cancel_reason:r.late_reason}}).filter(r=>!r.scheduled||e&&this._config.destination&&!r.destTime?!1:r.actual?!e&&$(r.actual,o)<=P:!0).sort((r,i)=>this._sortKey(r.scheduled,s)-this._sortKey(i.scheduled,s)).slice(0,this._config.rows)}_sortKey(t,e){let s=x(t)??0;return s<e-720?s+1440:s}_status(t,e){if(t.cancelled)return{text:"Cancelled",cls:"cancelled"};let s=$(t.scheduled,t.expected);return t.actual?{text:e==="departures"?"Departed":"Arrived",cls:s>0?s>=5?"late":"slight":"ontime",time:s?t.actual:null}:s>0?{text:`+${s} min`,cls:s>=5?"late":"slight",time:t.expected}:{text:"On time",cls:"ontime"}}_listHtml(t){let e=this._servicesFor(t),s=t==="departures"?"Departures":"Arrivals",o=t==="departures"?"To":"From",{show_platform:r,show_operator:i,show_reason:c}=this._config,h=this._config.hours,u=e.length?e.map(a=>{let d=this._status(a,t),_=i&&a.operator?`<div class="operator">${n(a.operator)}</div>`:"",b=c&&a.reason&&(a.cancelled||d.time)?`<div class="reason">${n(a.reason)}</div>`:"",m=a.destTime?`<div class="dest">Arrives ${a.destIsEnd?"":`${n(this._dest.name)} `}${n(a.destTime)}</div>`:"",g=this._expanded?.uid===a.uid&&this._expanded.kind===t,w=g?`<tr class="stops-row"><td colspan="${r?4:3}">${this._stopsHtml()}</td></tr>`:"";return`<tr class="${d.cls} service ${g?"open":""}" data-uid="${n(a.uid)}"
                        data-kind="${t}" tabindex="0" aria-expanded="${g}">
              <td class="time">
                <span class="${d.time||a.cancelled?"scheduled struck":"scheduled"}">${n(a.scheduled)}</span>
                ${d.time?`<span class="expected">${n(d.time)}</span>`:""}
              </td>
              <td class="place">${n(a.place)}${m}${_}${b}</td>
              ${r?`<td class="platform ${a.platformChanged?"changed":""}"
                  ${a.platformChanged?'title="Platform changed"':""}>${n(a.platform??"")}</td>`:""}
              <td class="status"><span class="badge">${n(d.text)}</span></td>
            </tr>${w}`}).join(""):`<tr><td colspan="4" class="empty">No ${s.toLowerCase()}${t==="departures"&&this._dest?` to ${n(this._dest.name)}`:""} in the next ${h} hour${h===1?"":"s"}</td></tr>`;return`<div class="list">
      ${this._config.mode==="both"?`<div class="list-title">${s}</div>`:""}
      <table>
        <thead><tr>
          <th>Time</th><th>${o}</th>${r?"<th>Plat</th>":""}<th class="status">Status</th>
        </tr></thead>
        <tbody>${u}</tbody>
      </table>
    </div>`}_stopsHtml(){let t=this._stops;if(!t?.data)return t?.error?`<div class="error">${n(t.error)}</div>`:'<div class="loading">Loading stops\u2026</div>';let e=this._config,s=t.data,o=s.status==="cancelled"||s.stp_cancelled===!0,r=(s.stops??[]).filter(a=>a.call_type!=="PASS"&&(a.public_arrival||a.public_departure)),i=r.findIndex(a=>a.crs===e.station),c=this._expanded?.kind==="arrivals",h=r.map((a,d)=>{let _=!a.public_departure||a.call_type==="TERMINATES"||i!==-1&&(d>i||d===i&&c),b=f(_?a.public_arrival:a.public_departure),m=f(_?a.actual_arrival_uk:a.actual_departure_uk),g=m??f(_?a.projected_arrival:a.projected_departure),w=$(b,g),R=o||a.status==="cancelled",y;R?y='<span class="stop-status late">Cancelled</span>':w>0?y=`<span class="stop-status ${w>=5?"late":"slight"}">${n(g)}</span>`:y=`<span class="stop-status ontime">${m?n(m):"On time"}</span>`;let A=(a.live_platform_suppressed?null:a.live_platform)??a.actual_platform??a.platform;return`<li class="${["stop",m?"passed":"",a.crs===e.station?"here":"",e.destination&&a.crs===e.destination?"dest-stop":"",R?"cancelled-stop":""].join(" ")}">
          <span class="stop-time">${n(b)}</span>
          <span class="stop-name">${n(v(a.location_name))}</span>
          ${e.show_platform&&A?`<span class="stop-platform">${n(A)}</span>`:""}
          ${y}
        </li>`}).join("");return`${e.show_reason&&s.late_reason?`<div class="reason">${n(s.late_reason)}</div>`:""}<ol class="stops">${h}</ol>`}_render(){if(!this._config||!this.shadowRoot)return;let t=this._config,e=this._board,s=t.title??(e?.station?v(e.station):t.station),o=t.destination&&t.mode!=="arrivals"?`Departures to ${this._dest?.name??t.destination}`:"",r;this._error&&!e?r=`<div class="error">${n(this._error)}</div>`:e?r=(t.mode==="both"?["departures","arrivals"]:[t.mode]).map(h=>this._listHtml(h)).join(""):r='<div class="loading">Loading\u2026</div>';let i=this._fetchedAt?new Date(this._fetchedAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",hourCycle:"h23"}):"";this.shadowRoot.innerHTML=`
      <style>
        ha-card { padding: 16px; }
        .header { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
        .title { font-size: 1.2em; font-weight: 500; }
        .updated { text-align: right; white-space: nowrap; line-height: 1.1; }
        .updated-time { font-size: 1.3em; font-weight: 500; font-variant-numeric: tabular-nums; }
        .updated-label { display: block; font-size: 0.75em; color: var(--secondary-text-color); }
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
        .subtitle, .dest { color: var(--secondary-text-color); font-size: 0.85em; }
        tr.service { cursor: pointer; }
        tr.service:hover td, tr.service.open td { background: var(--secondary-background-color); }
        tr.service:focus-visible { outline: 2px solid var(--primary-color); outline-offset: -2px; }
        tr.stops-row > td { border-top: none; padding: 0 4px 8px; background: var(--secondary-background-color); }
        .stops { list-style: none; margin: 0; padding: 4px 0 0 0; }
        .stop { display: flex; align-items: baseline; gap: 8px; padding: 3px 0 3px 18px; position: relative;
                font-size: 0.9em; }
        /* Route line with a dot for each stop. */
        .stop::before { content: ""; position: absolute; left: 5px; top: 0; bottom: 0; width: 2px;
                        background: var(--divider-color); }
        .stop:first-child::before { top: 50%; }
        .stop:last-child::before { bottom: 50%; }
        .stop::after { content: ""; position: absolute; left: 2px; top: calc(50% - 4px); width: 8px; height: 8px;
                       border-radius: 50%; background: var(--card-background-color, #fff);
                       border: 2px solid var(--primary-color); box-sizing: border-box; }
        .stop.passed::after { background: var(--primary-color); }
        .stop.passed { color: var(--secondary-text-color); }
        .stop.here .stop-name, .stop.dest-stop .stop-name { font-weight: 600; }
        .stop.cancelled-stop .stop-time { text-decoration: line-through; }
        .stop-time { font-variant-numeric: tabular-nums; width: 3em; flex: none; }
        .stop-name { flex: 1; }
        .stop-platform { color: var(--secondary-text-color); font-variant-numeric: tabular-nums; }
        .stop-status { font-size: 0.85em; white-space: nowrap; }
        .stop-status.ontime { color: var(--success-color, #43a047); }
        .stop-status.slight { color: var(--warning-color, #ffa600); }
        .stop-status.late { color: var(--error-color, #db4437); }
      </style>
      <ha-card>
        <div class="header">
          <div>
            <div class="title">${n(s)}</div>
            ${o?`<div class="subtitle">${n(o)}</div>`:""}
          </div>
          ${i?`<div class="updated ${this._error&&e?"stale":""}"
               title="${n(this._error??"")}">
            <span class="updated-time">${this._error&&e?"\u26A0 ":""}${i}</span>
            <span class="updated-label">${this._error&&e?"Update failed":"Updated"}</span>
          </div>`:""}
        </div>
        ${r}
      </ha-card>
    `}},S=class extends HTMLElement{setConfig(t){var e;this._lastSent&&JSON.stringify(t)===this._lastSent||(this._config={...t},this._config.via&&((e=this._config).destination??(e.destination=this._config.via),delete this._config.via),this._render())}set hass(t){this._hass=t}_emit(){let t={...this._config};this._lastSent=JSON.stringify(t),this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:t},bubbles:!0,composed:!0}))}_setOption(t,e,s){e===""||e===null||e===void 0||e===s?delete this._config[t]:this._config[t]=e}_onInput(t){let e=t.target,s=e.dataset.search;if(s){t.type==="input"&&this._onSearch(s,e.value);return}let o=e.dataset.key;if(o){if(e.type==="checkbox")this._setOption(o,e.checked,o!=="show_operator");else if(e.type==="number"){let r=e.value===""?void 0:Number(e.value);if(r!==void 0&&Number.isNaN(r))return;this._setOption(o,r,p[o])}else this._setOption(o,e.value,p[o]);this._emit()}}_onSearch(t,e){clearTimeout(this._searchTimer);let s=e.trim();if(t==="destination"&&!s&&this._config.destination&&(delete this._config.destination,this._emit()),s.length<2){this._showResults(t,[]);return}this._searchTimer=setTimeout(()=>this._search(t,s),300)}async _search(t,e){let s=String(this._config.api_key??"").trim();if(!s){this._showResults(t,[],"Add your API key above to search for stations.");return}let o=this._searchSeq=(this._searchSeq??0)+1,r=(this._config.api_url??T).replace(/\/+$/,""),i=new URLSearchParams({q:e,stations:"1"});try{let c=await fetch(`${r}/tiploc_search?${i}`,{headers:{"X-Api-Key":s,Accept:"application/json"}}),h=await c.json().catch(()=>null);if(o!==this._searchSeq)return;if(!c.ok)throw new Error(c.status===401?"RailFeed rejected the API key.":h?.error);let u=j(h?.results??[],e).slice(0,8);this._showResults(t,u,u.length?"":`No stations match "${e}".`)}catch(c){o===this._searchSeq&&this._showResults(t,[],c.message||"Station search failed.")}}_showResults(t,e,s=""){this._results={...this._results,[t]:e};let o=this.shadowRoot?.querySelector(`.results[data-field="${t}"]`);o&&(o.innerHTML=e.map((r,i)=>`<button type="button" data-index="${i}">
            ${n(v(r.name))} <span class="crs">${n(r.crs)}</span>
          </button>`).join("")+(s?`<div class="hint">${n(s)}</div>`:""))}_pickStation(t,e){if(!e)return;this._config[t]=e.crs;let s=`${v(e.name)} (${e.crs})`;this._labels={...this._labels,[t]:s};let o=this.shadowRoot.querySelector(`input[data-search="${t}"]`);o&&(o.value=s),this._showResults(t,[]),this._emit()}_searchField(t,e,s){let o=this._config[t]??"",r=this._labels?.[t],i=o&&r?.endsWith(`(${o})`)?r:o;return`<div class="wide">
      <label>${e}
        <input type="text" data-search="${t}" autocomplete="off"
               value="${n(i)}" placeholder="${n(s)}">
      </label>
      <div class="results" data-field="${t}"></div>
    </div>`}_render(){if(!this._config)return;this.shadowRoot||(this.attachShadow({mode:"open"}),this.shadowRoot.addEventListener("input",s=>this._onInput(s)),this.shadowRoot.addEventListener("change",s=>this._onInput(s)),this.shadowRoot.addEventListener("click",s=>{let o=s.target.closest(".results button[data-index]");if(!o)return;let r=o.closest(".results").dataset.field;this._pickStation(r,this._results?.[r]?.[Number(o.dataset.index)])}),this.shadowRoot.addEventListener("keydown",s=>{let o=s.target.dataset?.search;o&&(s.key==="Enter"?(s.preventDefault(),this._pickStation(o,this._results?.[o]?.[0])):s.key==="Escape"&&this._showResults(o,[]))}));let t=this._config,e=(s,o,r)=>`<label class="check"><input type="checkbox" data-key="${s}" ${r?"checked":""}>${o}</label>`;this.shadowRoot.innerHTML=`
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
        .results { display: flex; flex-direction: column; margin-top: 4px; }
        .results button { font: inherit; text-align: left; cursor: pointer; padding: 8px;
                          border: none; border-bottom: 1px solid var(--divider-color, #ccc);
                          background: var(--secondary-background-color); color: var(--primary-text-color); }
        .results button:hover, .results button:focus { background: var(--divider-color, #ddd); }
        .crs { color: var(--secondary-text-color); font-size: 0.85em; margin-left: 6px; }
      </style>

      <div class="grid">
        <label class="wide">RailFeed API key
          <input type="password" data-key="api_key" value="${n(t.api_key)}" autocomplete="off" placeholder="rf_live_\u2026">
        </label>
        <div class="hint wide">It's saved in the dashboard config, so anyone who can edit this dashboard can see it.
          A public_tools key is enough.</div>
        ${this._searchField("station","Station","Search by name or code, e.g. York")}
        ${this._searchField("destination","Destination (optional)","Only show departures that stop here")}
        <label class="wide">Title<input type="text" data-key="title" value="${n(t.title)}" placeholder="station name"></label>
        <label>Show
          <select data-key="mode">
            <option value="both" ${!t.mode||t.mode==="both"?"selected":""}>Departures and arrivals</option>
            <option value="departures" ${t.mode==="departures"?"selected":""}>Departures only</option>
            <option value="arrivals" ${t.mode==="arrivals"?"selected":""}>Arrivals only</option>
          </select>
        </label>
        <label>Trains per list<input type="number" min="1" max="50" data-key="rows" value="${n(t.rows??p.rows)}"></label>
        <label>Look ahead (hours)<input type="number" min="1" max="24" data-key="hours" value="${n(t.hours??p.hours)}"></label>
        <label>Refresh every (seconds)<input type="number" min="30" data-key="refresh_interval" value="${n(t.refresh_interval??p.refresh_interval)}"></label>
        ${e("show_platform","Show platform",t.show_platform!==!1)}
        ${e("show_reason","Show delay reasons",t.show_reason!==!1)}
        ${e("show_operator","Show operator",t.show_operator===!0)}
      </div>
    `}};customElements.define("rail-tracking-card",k);customElements.define("rail-tracking-card-editor",S);window.customCards=window.customCards||[];window.customCards.push({type:"rail-tracking-card",name:"Rail Tracking Card",preview:!1,description:"Live arrivals and departures for a GB railway station from RailFeed."});
