var T="https://railfeed.co.uk/api",E=["both","departures","arrivals"],u={mode:"both",rows:6,hours:2,refresh_interval:60},P=5;function C(c,t){let s=String(c??"").trim().toUpperCase();if(!/^[A-Z]{3}$/.test(s))throw new Error(`${t} must be a 3-letter station (CRS) code, e.g. LDS, got "${c}"`);return s}function n(c){return String(c??"").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function f(c){let t=/(\d{2}):(\d{2})(?::\d{2})?$/.exec(String(c??"").trim());return t?`${t[1]}:${t[2]}`:null}function x(c){let t=/^(\d{1,2}):(\d{2})$/.exec(String(c??"").trim());return t?Number(t[1])*60+Number(t[2]):null}function L(c){let t=(c%1440+1440)%1440;return`${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`}function g(c){return String(c??"").toLowerCase().replace(/(^|[\s(.\-&/])([a-z])/g,(t,s,e)=>s+e.toUpperCase())}function j(c,t){let s=e=>String(e).replace(/[A-Z]+$/i,"");return s(c)===s(t)}function I(c,t){let s=t.trim().toUpperCase(),e=r=>{let i=String(r.name??"").toUpperCase();return r.crs===s?0:i.startsWith(s)?1:i.split(/[\s(.\-]+/).some(l=>l.startsWith(s))?2:3},o=new Set;return c.filter(r=>r.crs&&!o.has(r.crs)&&o.add(r.crs)).sort((r,i)=>e(r)-e(i)||r.name.length-i.name.length||r.name.localeCompare(i.name))}function $(c,t){let s=x(c),e=x(t);if(s===null||e===null)return null;let o=e-s;return o<-720&&(o+=1440),o>720&&(o-=1440),o}var k=class extends HTMLElement{setConfig(t){if(!t.api_key)throw new Error("Add your RailFeed API key (api_key)");let s=t.mode??u.mode;if(!E.includes(s))throw new Error(`mode must be one of ${E.join(", ")}`);let e=this._config;this._config={api_key:String(t.api_key).trim(),api_url:(t.api_url??T).replace(/\/+$/,""),station:C(t.station,"station"),via:t.via?C(t.via,"via"):null,title:t.title,mode:s,rows:Math.min(Math.max(Number(t.rows??u.rows),1),50),hours:Math.min(Math.max(Math.round(Number(t.hours??u.hours)),1),24),refresh_interval:Math.max(Number(t.refresh_interval??u.refresh_interval),30),show_platform:t.show_platform!==!1,show_operator:t.show_operator===!0,show_reason:t.show_reason!==!1},this.shadowRoot||(this.attachShadow({mode:"open"}),this.shadowRoot.addEventListener("click",r=>this._onRowActivate(r)),this.shadowRoot.addEventListener("keydown",r=>{(r.key==="Enter"||r.key===" ")&&this._onRowActivate(r)}));let o=this._requestKey();!e||o!==this._lastRequestKey?(this._lastRequestKey=o,this._board=null,this._error=null,this._via=null,this._expanded=null,this._stops=null,this.isConnected&&this._startPolling()):e.refresh_interval!==this._config.refresh_interval&&this.isConnected&&this._startPolling(),this._render()}set hass(t){this._hass=t}connectedCallback(){this._onVisibility=()=>{document.visibilityState==="visible"&&this._isStale()&&this._fetch()},document.addEventListener("visibilitychange",this._onVisibility),this._startPolling(),this._render()}disconnectedCallback(){clearInterval(this._timer),this._abort?.abort(),document.removeEventListener("visibilitychange",this._onVisibility)}getCardSize(){return 1+(this._config?.mode==="both"?2:1)*Math.ceil((this._config?.rows??u.rows)/2)}static getConfigElement(){return document.createElement("rail-tracking-card-editor")}static getStubConfig(){return{api_key:"",station:"LDS",mode:"both",rows:6}}_requestKey(){let{api_key:t,api_url:s,station:e,via:o,mode:r,hours:i}=this._config;return JSON.stringify([t,s,e,o,r,i])}_startPolling(){clearInterval(this._timer),this._config&&(this._fetch(),this._timer=setInterval(()=>{document.visibilityState==="visible"&&this._fetch()},this._config.refresh_interval*1e3))}_isStale(){return!this._fetchedAt||Date.now()-this._fetchedAt>this._config.refresh_interval*1e3}async _get(t,s,e){let o=this._config,r=await fetch(`${o.api_url}/${t}?${new URLSearchParams(s)}`,{headers:{"X-Api-Key":o.api_key,Accept:"application/json"},signal:e}),i=await r.json().catch(()=>null);if(!r.ok)throw new Error(this._errorText(r.status,i));return i}async _fetch(){let t=this._config;this._abort?.abort();let s=this._abort=new AbortController;try{let e=await this._get("live_board",{crs:t.station,type:t.mode,hours:String(t.hours)},s.signal);await this._loadVia(e.date,s.signal),this._board=e,this._error=null}catch(e){if(e.name==="AbortError")return;this._error=e.message||String(e)}this._fetchedAt=Date.now(),this._render(),this._expanded&&this._loadStops(this._expanded.uid)}async _loadVia(t,s){let e=this._config;if(!e.via||this._via?.date===t)return;let o={date:t},r=e.mode==="both"?["departures","arrivals"]:[e.mode];for(let i of r){let l=i==="departures",h=await this._get("services",{from:l?e.station:e.via,to:l?e.via:e.station,date:t},s);o.name=g(l?h.to:h.from),o[i]=new Map((h.services??[]).filter(d=>!(l?d.to_is_pass:d.from_is_pass)).map(d=>[d.uid,f(l?d.to_public_arrival:d.from_public_departure)]).filter(([,d])=>d))}this._via=o}_onRowActivate(t){let s=t.target.closest?.("tr.service");if(!s)return;t.preventDefault();let{uid:e,kind:o}=s.dataset;this._expanded?.uid===e&&this._expanded.kind===o?this._expanded=null:(this._expanded={uid:e,kind:o},this._stops?.uid!==e&&(this._stops={uid:e}),this._loadStops(e)),this._render()}async _loadStops(t){this._stops?.uid!==t&&(this._stops={uid:t});let s=this._stops;s.loading=!0;try{s.data=await this._get("service_live",{uid:t,date:this._board?.date??"",junctions:"0"}),s.error=null}catch(e){s.error=e.message||String(e)}s.loading=!1,this._stops===s&&this._render()}_errorText(t,s){let e=s?.code;return e==="invalid_key"||e==="no_credential"||t===401?"RailFeed rejected the API key. Check api_key.":e==="not_found"||t===404?`Unknown station code "${this._config.station}".`:e==="rate_limited"||t===429?"Too many requests. Increase refresh_interval.":s?.error||`RailFeed request failed (HTTP ${t})`}_servicesFor(t){let s=t==="departures",e=new Date().getHours()*60+new Date().getMinutes(),o=L(e);return(this._board?.services??[]).filter(r=>!r.is_pass&&!r.stale&&r.cancel_type!=="ON CALL").map(r=>{let i=f(s?r.public_departure:r.public_arrival),l=f(s?r.actual_departure_uk:r.actual_arrival_uk),h=f(s?r.projected_departure:r.projected_arrival),d=l??h;!d&&!r.projection_suppressed&&r.delay_mins>0&&i&&(d=L(x(i)+r.delay_mins));let p=(r.live_platform_suppressed?null:r.live_platform)??r.actual_platform,_=r.status==="cancelled"||!!r.cancel_type;return{uid:r.uid,viaTime:this._via?.[t]?.get(r.uid),viaIsEnd:(s?r.destination_crs:r.origin_crs)===this._config.via,scheduled:i,expected:d,actual:l,place:g(s?r.destination:r.origin),platform:p??r.platform,platformChanged:!!(p&&r.platform&&!j(p,r.platform)),operator:r.toc_name,cancelled:_,reason:_?r.cancel_reason:r.late_reason}}).filter(r=>!r.scheduled||this._config.via&&!r.viaTime?!1:r.actual?!s&&$(r.actual,o)<=P:!0).sort((r,i)=>this._sortKey(r.scheduled,e)-this._sortKey(i.scheduled,e)).slice(0,this._config.rows)}_sortKey(t,s){let e=x(t)??0;return e<s-720?e+1440:e}_status(t,s){if(t.cancelled)return{text:"Cancelled",cls:"cancelled"};let e=$(t.scheduled,t.expected);return t.actual?{text:s==="departures"?"Departed":"Arrived",cls:e>0?e>=5?"late":"slight":"ontime",time:e?t.actual:null}:e>0?{text:`+${e} min`,cls:e>=5?"late":"slight",time:t.expected}:{text:"On time",cls:"ontime"}}_listHtml(t){let s=this._servicesFor(t),e=t==="departures"?"Departures":"Arrivals",o=t==="departures"?"To":"From",{show_platform:r,show_operator:i,show_reason:l}=this._config,h=this._config.hours,d=s.length?s.map(a=>{let p=this._status(a,t),_=i&&a.operator?`<div class="operator">${n(a.operator)}</div>`:"",b=l&&a.reason&&(a.cancelled||p.time)?`<div class="reason">${n(a.reason)}</div>`:"",m=a.viaTime&&!a.viaIsEnd?`<div class="via">via ${n(this._via.name)} ${n(a.viaTime)}</div>`:"",v=this._expanded?.uid===a.uid&&this._expanded.kind===t,w=v?`<tr class="stops-row"><td colspan="${r?4:3}">${this._stopsHtml()}</td></tr>`:"";return`<tr class="${p.cls} service ${v?"open":""}" data-uid="${n(a.uid)}"
                        data-kind="${t}" tabindex="0" aria-expanded="${v}">
              <td class="time">
                <span class="${p.time||a.cancelled?"scheduled struck":"scheduled"}">${n(a.scheduled)}</span>
                ${p.time?`<span class="expected">${n(p.time)}</span>`:""}
              </td>
              <td class="place">${n(a.place)}${m}${_}${b}</td>
              ${r?`<td class="platform ${a.platformChanged?"changed":""}"
                  ${a.platformChanged?'title="Platform changed"':""}>${n(a.platform??"")}</td>`:""}
              <td class="status"><span class="badge">${n(p.text)}</span></td>
            </tr>${w}`}).join(""):`<tr><td colspan="4" class="empty">No ${e.toLowerCase()}${this._via?` via ${n(this._via.name)}`:""} in the next ${h} hour${h===1?"":"s"}</td></tr>`;return`<div class="list">
      ${this._config.mode==="both"?`<div class="list-title">${e}</div>`:""}
      <table>
        <thead><tr>
          <th>Time</th><th>${o}</th>${r?"<th>Plat</th>":""}<th class="status">Status</th>
        </tr></thead>
        <tbody>${d}</tbody>
      </table>
    </div>`}_stopsHtml(){let t=this._stops;if(!t?.data)return t?.error?`<div class="error">${n(t.error)}</div>`:'<div class="loading">Loading stops\u2026</div>';let s=this._config,e=t.data,o=e.status==="cancelled"||e.stp_cancelled===!0,r=(e.stops??[]).filter(a=>a.call_type!=="PASS"&&(a.public_arrival||a.public_departure)),i=r.findIndex(a=>a.crs===s.station),l=this._expanded?.kind==="arrivals",h=r.map((a,p)=>{let _=!a.public_departure||a.call_type==="TERMINATES"||i!==-1&&(p>i||p===i&&l),b=f(_?a.public_arrival:a.public_departure),m=f(_?a.actual_arrival_uk:a.actual_departure_uk),v=m??f(_?a.projected_arrival:a.projected_departure),w=$(b,v),R=o||a.status==="cancelled",y;R?y='<span class="stop-status late">Cancelled</span>':w>0?y=`<span class="stop-status ${w>=5?"late":"slight"}">${n(v)}</span>`:y=`<span class="stop-status ontime">${m?n(m):"On time"}</span>`;let A=(a.live_platform_suppressed?null:a.live_platform)??a.actual_platform??a.platform;return`<li class="${["stop",m?"passed":"",a.crs===s.station?"here":"",s.via&&a.crs===s.via?"via-stop":"",R?"cancelled-stop":""].join(" ")}">
          <span class="stop-time">${n(b)}</span>
          <span class="stop-name">${n(g(a.location_name))}</span>
          ${s.show_platform&&A?`<span class="stop-platform">${n(A)}</span>`:""}
          ${y}
        </li>`}).join("");return`${s.show_reason&&e.late_reason?`<div class="reason">${n(e.late_reason)}</div>`:""}<ol class="stops">${h}</ol>`}_render(){if(!this._config||!this.shadowRoot)return;let t=this._config,s=this._board,e=t.title??(s?.station?g(s.station):t.station),o=t.via?`via ${this._via?.name??t.via}`:"",r;this._error&&!s?r=`<div class="error">${n(this._error)}</div>`:s?r=(t.mode==="both"?["departures","arrivals"]:[t.mode]).map(h=>this._listHtml(h)).join(""):r='<div class="loading">Loading\u2026</div>';let i=this._fetchedAt?new Date(this._fetchedAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"";this.shadowRoot.innerHTML=`
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
        .subtitle, .via { color: var(--secondary-text-color); font-size: 0.85em; }
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
        .stop.here .stop-name, .stop.via-stop .stop-name { font-weight: 600; }
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
            <div class="title">${n(e)}</div>
            ${o?`<div class="subtitle">${n(o)}</div>`:""}
          </div>
          <div class="updated ${this._error&&s?"stale":""}"
               title="${n(this._error??"")}">${this._error&&s?"\u26A0 ":""}${i}</div>
        </div>
        ${r}
      </ha-card>
    `}},S=class extends HTMLElement{setConfig(t){this._lastSent&&JSON.stringify(t)===this._lastSent||(this._config={...t},this._render())}set hass(t){this._hass=t}_emit(){let t={...this._config};this._lastSent=JSON.stringify(t),this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:t},bubbles:!0,composed:!0}))}_setOption(t,s,e){s===""||s===null||s===void 0||s===e?delete this._config[t]:this._config[t]=s}_onInput(t){let s=t.target,e=s.dataset.search;if(e){t.type==="input"&&this._onSearch(e,s.value);return}let o=s.dataset.key;if(o){if(s.type==="checkbox")this._setOption(o,s.checked,o!=="show_operator");else if(s.type==="number"){let r=s.value===""?void 0:Number(s.value);if(r!==void 0&&Number.isNaN(r))return;this._setOption(o,r,u[o])}else this._setOption(o,s.value,u[o]);this._emit()}}_onSearch(t,s){clearTimeout(this._searchTimer);let e=s.trim();if(t==="via"&&!e&&this._config.via&&(delete this._config.via,this._emit()),e.length<2){this._showResults(t,[]);return}this._searchTimer=setTimeout(()=>this._search(t,e),300)}async _search(t,s){let e=String(this._config.api_key??"").trim();if(!e){this._showResults(t,[],"Add your API key above to search for stations.");return}let o=this._searchSeq=(this._searchSeq??0)+1,r=(this._config.api_url??T).replace(/\/+$/,""),i=new URLSearchParams({q:s,stations:"1"});try{let l=await fetch(`${r}/tiploc_search?${i}`,{headers:{"X-Api-Key":e,Accept:"application/json"}}),h=await l.json().catch(()=>null);if(o!==this._searchSeq)return;if(!l.ok)throw new Error(l.status===401?"RailFeed rejected the API key.":h?.error);let d=I(h?.results??[],s).slice(0,8);this._showResults(t,d,d.length?"":`No stations match "${s}".`)}catch(l){o===this._searchSeq&&this._showResults(t,[],l.message||"Station search failed.")}}_showResults(t,s,e=""){this._results={...this._results,[t]:s};let o=this.shadowRoot?.querySelector(`.results[data-field="${t}"]`);o&&(o.innerHTML=s.map((r,i)=>`<button type="button" data-index="${i}">
            ${n(g(r.name))} <span class="crs">${n(r.crs)}</span>
          </button>`).join("")+(e?`<div class="hint">${n(e)}</div>`:""))}_pickStation(t,s){if(!s)return;this._config[t]=s.crs;let e=`${g(s.name)} (${s.crs})`;this._labels={...this._labels,[t]:e};let o=this.shadowRoot.querySelector(`input[data-search="${t}"]`);o&&(o.value=e),this._showResults(t,[]),this._emit()}_searchField(t,s,e){let o=this._config[t]??"",r=this._labels?.[t],i=o&&r?.endsWith(`(${o})`)?r:o;return`<div class="wide">
      <label>${s}
        <input type="text" data-search="${t}" autocomplete="off"
               value="${n(i)}" placeholder="${n(e)}">
      </label>
      <div class="results" data-field="${t}"></div>
    </div>`}_render(){if(!this._config)return;this.shadowRoot||(this.attachShadow({mode:"open"}),this.shadowRoot.addEventListener("input",e=>this._onInput(e)),this.shadowRoot.addEventListener("change",e=>this._onInput(e)),this.shadowRoot.addEventListener("click",e=>{let o=e.target.closest(".results button[data-index]");if(!o)return;let r=o.closest(".results").dataset.field;this._pickStation(r,this._results?.[r]?.[Number(o.dataset.index)])}),this.shadowRoot.addEventListener("keydown",e=>{let o=e.target.dataset?.search;o&&(e.key==="Enter"?(e.preventDefault(),this._pickStation(o,this._results?.[o]?.[0])):e.key==="Escape"&&this._showResults(o,[]))}));let t=this._config,s=(e,o,r)=>`<label class="check"><input type="checkbox" data-key="${e}" ${r?"checked":""}>${o}</label>`;this.shadowRoot.innerHTML=`
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
        ${this._searchField("via","Via (optional)","Only show trains that also stop here")}
        <label class="wide">Title<input type="text" data-key="title" value="${n(t.title)}" placeholder="station name"></label>
        <label>Show
          <select data-key="mode">
            <option value="both" ${!t.mode||t.mode==="both"?"selected":""}>Departures and arrivals</option>
            <option value="departures" ${t.mode==="departures"?"selected":""}>Departures only</option>
            <option value="arrivals" ${t.mode==="arrivals"?"selected":""}>Arrivals only</option>
          </select>
        </label>
        <label>Trains per list<input type="number" min="1" max="50" data-key="rows" value="${n(t.rows??u.rows)}"></label>
        <label>Look ahead (hours)<input type="number" min="1" max="24" data-key="hours" value="${n(t.hours??u.hours)}"></label>
        <label>Refresh every (seconds)<input type="number" min="30" data-key="refresh_interval" value="${n(t.refresh_interval??u.refresh_interval)}"></label>
        ${s("show_platform","Show platform",t.show_platform!==!1)}
        ${s("show_reason","Show delay reasons",t.show_reason!==!1)}
        ${s("show_operator","Show operator",t.show_operator===!0)}
      </div>
    `}};customElements.define("rail-tracking-card",k);customElements.define("rail-tracking-card-editor",S);window.customCards=window.customCards||[];window.customCards.push({type:"rail-tracking-card",name:"Rail Tracking Card",preview:!1,description:"Live arrivals and departures for a GB railway station from RailFeed."});
