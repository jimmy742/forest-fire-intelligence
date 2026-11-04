import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import Chart from 'chart.js/auto';
import demoCsv from '../data/demo/fires_demo.csv?raw';
import { parseDemoCsv, demoDixieFires, dixieScenario, normalizeFires, toQuery, csvFor } from './data.js';
import './style.css';

const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const mode = import.meta.env.VITE_DATA_MODE || (apiBase ? 'api' : 'demo');
const demoCsvFires = parseDemoCsv(demoCsv);
const state = { fires: [], filtered: [], scenario: 'africa-demo', scenarioZones: null, selection: null, map: null, markers: [], chart: null, calendar: [], date: { from: '', to: '' }, sensor: 'all', confidence: '', zone: '', theme: localStorage.getItem('ffi-theme') || 'dark', loading: false, error: '' };
const el = (id) => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateInput = d => new Date(d).toISOString().slice(0,10);
const fmt = n => new Intl.NumberFormat('fr-FR').format(n);
function shell() {
  el('app').innerHTML = `<aside class="sidebar"><a class="brand" href="#overview"><span class="brandmark">✳</span><span>FOREST FIRE<small>INTELLIGENCE</small></span></a><div class="nav-label">ESPACE DE TRAVAIL</div><nav><a class="nav active" href="#overview">◫ <span>Vue d’ensemble</span></a><a class="nav" href="#map-section">◎ <span>Carte des feux</span></a><a class="nav" href="#calendar-section">▦ <span>Calendrier</span></a><a class="nav" href="#analysis-section">⌁ <span>Analyses</span></a></nav><div class="side-bottom"><div class="source-card"><span class="live-dot"></span><span><b id="mode-label">Mode démo</b><small id="source-label">Jeu de démonstration</small></span></div><button class="nav" id="theme-toggle">◐ <span>Changer le thème</span></button><div class="sidebar-foot">NASA FIRMS · surveillance<br/>Les détections ne confirment pas un incendie au sol.</div></div></aside><main class="main"><header class="topbar"><div class="breadcrumbs">Surveillance <span>/</span> <b>Vue d’ensemble</b></div><div class="top-actions"><span class="updated" id="updated">Chargement…</span><button class="icon-button" id="refresh" title="Actualiser les données">↻</button><button class="export-button" id="export">⇩ <span>Exporter CSV</span></button></div></header><div class="content"><section class="page-head" id="overview"><div><div class="eyebrow"><span class="live-dot"></span> <span id="origin-label">SYSTÈME DE SURVEILLANCE · FIRMS</span></div><h1>Forest Fire Intelligence</h1><p>Surveillez l’activité thermique et explorez les détections satellitaires.</p></div><div class="range-control"><label for="date-from">PÉRIODE</label><div class="date-fields"><input id="date-from" type="date" aria-label="Date de début"/><span>→</span><input id="date-to" type="date" aria-label="Date de fin"/></div></div></section><div class="notice" id="notice" hidden></div><div class="notice error" id="error" hidden></div><section class="stats-grid" id="stats"></section><section class="panel map-panel" id="map-section"><div class="panel-head"><div><div class="section-kicker">OBSERVATIONS GÉOGRAPHIQUES</div><h2>Carte des détections</h2></div><div class="map-controls"><select id="scenario-select" aria-label="Scénario de démonstration"><option value="africa-demo">Afrique centrale · démo</option><option value="dixie-2021">Dixie Fire · Californie (2021)</option></select><select id="sensor-filter" aria-label="Filtrer le capteur"><option value="all">Tous les capteurs</option><option value="VIIRS">VIIRS</option><option value="MODIS">MODIS</option></select><select id="zone-filter" aria-label="Filtrer par zone"><option value="">Toutes les zones</option></select><select id="confidence-filter" aria-label="Confiance minimale"><option value="">Toute confiance</option><option value="30">≥ 30 %</option><option value="60">≥ 60 %</option><option value="80">≥ 80 %</option></select><button class="small-button" id="roi">⌖ <span>Zone d’intérêt</span></button></div></div><div class="map-wrap"><div id="map"></div><div id="map-status" class="map-status" role="status" aria-live="polite"></div><div id="tile-status" class="tile-status" role="status" aria-live="polite" hidden><span id="tile-message"></span><button id="retry-tiles" type="button" hidden>Réessayer</button></div><div class="map-legend"><b>CAPTEUR</b><span><i class="dot viirs"></i> VIIRS</span><span><i class="dot modis"></i> MODIS</span></div></div><div class="panel-foot"><span id="fire-count">— détections</span><span id="map-hint">Cliquez sur « Zone d’intérêt » puis deux points sur la carte pour tracer un rectangle.</span></div></section><div class="lower-grid"><section class="panel" id="calendar-section"><div class="panel-head"><div><div class="section-kicker">RYTHME D’ACTIVITÉ</div><h2>Calendrier quotidien</h2></div><span class="quiet" id="peak-label"></span></div><div id="calendar" class="calendar-grid"></div><div class="calendar-legend"><span>Moins</span><i></i><i></i><i></i><i></i><span>Plus</span><span class="quiet">· Choisir un jour pour filtrer</span></div></section><section class="panel" id="analysis-section"><div class="panel-head"><div><div class="section-kicker">SÉRIES TEMPORELLES</div><h2>Activité par capteur</h2></div><span class="quiet">30 jours</span></div><div class="chart-wrap"><canvas id="trend-chart" aria-label="Graphique des détections par capteur" role="img"></canvas></div><div class="analysis-note" id="analysis-note"></div></section></div><section class="panel table-panel"><div class="panel-head"><div><div class="section-kicker">DERNIÈRES OBSERVATIONS</div><h2>Détections récentes</h2></div><span class="quiet" id="table-summary"></span></div><div class="table-scroll"><table><thead><tr><th>ZONE</th><th>DATE / HEURE UTC</th><th>CAPTEUR</th><th>CONFIANCE</th><th>FRP</th><th>COORDONNÉES</th><th>SOURCE</th></tr></thead><tbody id="fire-table"></tbody></table></div></section><footer>Sources <b id="footer-source">NASA FIRMS</b> · MODIS & VIIRS <span id="footer-note">Les points thermiques sont des signaux à examiner et ne constituent pas des confirmations au sol.</span></footer></div></main>`;
}
function showTileStatus(message, retryLabel = '') {
  el('tile-message').textContent = message;
  el('retry-tiles').textContent = retryLabel;
  el('retry-tiles').hidden = !retryLabel;
  el('tile-status').hidden = false;
}
function clearTileStatus() {
  el('tile-status').hidden = true;
  el('retry-tiles').hidden = true;
}
function cartoTileLayer() {
  return L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  });
}
function installTileLayer(provider, layer) {
  state.tileProvider = provider;
  state.tileLayer = layer;
  state.tileBatch = { loaded: 0, failed: 0 };
  layer.on('loading', () => {
    if (state.tileLayer !== layer) return;
    state.tileBatch = { loaded: 0, failed: 0 };
    clearTimeout(state.tileTimer);
    if (provider === 'osm') showTileStatus('Chargement du fond OpenStreetMap…');
    else showTileStatus('Tuiles OSM indisponibles; chargement du fond CARTO basé sur OpenStreetMap…');
    state.tileTimer = setTimeout(() => {
      if (state.tileLayer !== layer || state.tileBatch.loaded) return;
      if (provider === 'osm') useCartoFallback();
      else showTileStatus('Impossible de charger les tuiles cartographiques. Vérifiez votre connexion puis réessayez.', 'Réessayer');
    }, 10000);
  });
  layer.on('tileload', () => { if (state.tileLayer === layer) state.tileBatch.loaded += 1; });
  layer.on('tileerror', () => { if (state.tileLayer === layer) state.tileBatch.failed += 1; });
  layer.on('load', () => {
    if (state.tileLayer !== layer) return;
    clearTimeout(state.tileTimer);
    if (!state.tileBatch.loaded && state.tileBatch.failed) {
      if (provider === 'osm') useCartoFallback();
      else showTileStatus('Impossible de charger les tuiles OpenStreetMap ni le fond CARTO. Vérifiez la connexion, le pare-feu ou le bloqueur de contenu.', 'Réessayer');
    } else if (state.tileBatch.failed) {
      showTileStatus(provider === 'osm' ? 'Certaines tuiles OpenStreetMap n’ont pas pu être chargées.' : 'Certaines tuiles du fond de secours n’ont pas pu être chargées.', 'Réessayer');
    } else if (provider === 'carto') {
      showTileStatus('OpenStreetMap est inaccessible; fond CARTO basé sur OpenStreetMap chargé.', 'Réessayer OSM');
    } else clearTileStatus();
  });
  layer.addTo(state.map);
}
function useCartoFallback() {
  if (state.tileProvider !== 'osm') return;
  clearTimeout(state.tileTimer);
  if (state.tileLayer) state.map.removeLayer(state.tileLayer);
  installTileLayer('carto', cartoTileLayer());
}
function retryOpenStreetMap() {
  clearTimeout(state.tileTimer);
  if (state.tileLayer) state.map.removeLayer(state.tileLayer);
  const osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });
  installTileLayer('osm', osmLayer);
}
function initMap() {
  state.map = L.map('map', { zoomControl: false, attributionControl: true, dragging: true, touchZoom: true, scrollWheelZoom: true, doubleClickZoom: true }).setView([4.5, 15.5], 4);
  state.clusterLayer = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 38, iconCreateFunction: cluster => L.divIcon({ html: `<span>${cluster.getChildCount()}</span>`, className: 'fire-cluster', iconSize: [34, 34] }) }).addTo(state.map);
  L.control.zoom({ position: 'bottomright' }).addTo(state.map);
  el('retry-tiles').addEventListener('click', retryOpenStreetMap);
  retryOpenStreetMap();
  const mapElement = el('map');
  if ('ResizeObserver' in window) { state.mapResizeObserver = new ResizeObserver(() => { cancelAnimationFrame(state.resizeFrame); state.resizeFrame = requestAnimationFrame(() => state.map?.invalidateSize({ pan: false, debounceMoveend: true })); }); state.mapResizeObserver.observe(mapElement); }
  else window.addEventListener('resize', () => state.map?.invalidateSize({ pan: false }));
  addScenarioZones();
  state.map.on('click', e => { if (!state.roiMode) return; if (!state.roiFirst) { state.roiFirst = e.latlng; el('map-status').textContent = 'Premier point défini — cliquez pour le second.'; return; } state.selection?.remove(); state.selection = L.rectangle(L.latLngBounds(state.roiFirst, e.latlng), { color: '#f48b55', weight: 2, fillOpacity: .1 }).addTo(state.map); state.roiMode = false; state.roiFirst = null; el('map-status').textContent = 'Zone active · cliquez à nouveau sur Zone d’intérêt pour effacer.'; fetchData(); });
}
function addScenarioZones() {
  state.scenarioZones?.remove(); state.scenarioZones = null;
  if (mode === 'api' || state.scenario !== 'dixie-2021') return;
  state.scenarioZones = L.layerGroup(dixieScenario.zones.map(zone => L.circle([zone.lat, zone.lon], { radius: 6200, color: '#f18a5c', weight: 1, opacity: .72, dashArray: '4 5', fillColor: '#f18a5c', fillOpacity: .08 }).bindTooltip(esc(zone.name), { permanent: true, direction: 'center', className: 'scenario-label' }))).addTo(state.map);
}
function renderMap() {
  state.clusterLayer.clearLayers(); state.markers = [];
  for (const f of state.filtered) {
    if (state.selection && !state.selection.getBounds().contains([f.latitude, f.longitude])) continue;
    const color = f.sensor === 'MODIS' ? '#65a8f2' : '#fb8258';
    const marker = L.circleMarker([f.latitude, f.longitude], { radius: f.confidence ? 5 + f.confidence / 35 : 6, color, fillColor: color, fillOpacity: .78, weight: 1 });
    marker.bindPopup(`<div class="popup"><b>${esc(f.zone || 'Zone inconnue')}</b><br/>${esc(f.sensor)} · ${f.confidence == null ? 'Confiance indisponible' : `${esc(f.confidence)} %`}<br/>${esc(new Date(f.date).toISOString().replace('T',' ').slice(0,19))} UTC<br/>${f.frp == null ? 'FRP indisponible' : `${esc(f.frp)} MW`}<br/><span>${f.latitude.toFixed(4)}, ${f.longitude.toFixed(4)}</span><br/>Source : ${esc(f.source || (mode==='api'?'API':'DÉMO FICTIVE'))}</div>`);
    state.markers.push(marker);
  }
  state.clusterLayer.addLayers(state.markers);
}
function filterFires() {
  state.filtered = state.fires.filter(f => (!state.selection || state.selection.getBounds().contains([f.latitude,f.longitude])) && (!state.date.from || f.date.slice(0,10) >= state.date.from) && (!state.date.to || f.date.slice(0,10) <= state.date.to) && (state.sensor === 'all' || f.sensor === state.sensor) && (!state.zone || (f.zone || '').toLocaleLowerCase().includes(state.zone.toLocaleLowerCase())) && (!state.confidence || (f.confidence != null && f.confidence >= Number(state.confidence))));
  const zones=[...new Set(state.fires.map(f=>f.zone).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr')); const zoneSelect=el('zone-filter'); if(zoneSelect){const value=state.zone;zoneSelect.innerHTML='<option value="">Toutes les zones</option>'+zones.map(z=>`<option value="${esc(z)}">${esc(z)}</option>`).join('');zoneSelect.value=value;}
  renderMap(); renderStats(); renderTable(); renderCalendar(); renderChart();
}
function renderStats() {
  const list = state.filtered, modis = list.filter(f => f.sensor === 'MODIS').length, viirs = list.filter(f => f.sensor === 'VIIRS').length;
  const byDay = Object.groupBy ? Object.groupBy(list, f => f.date.slice(0,10)) : list.reduce((a,f) => ((a[f.date.slice(0,10)] ||= []).push(f),a), {});
  const peak = Object.entries(byDay).sort((a,b)=>b[1].length-a[1].length)[0];
  const validFrp = list.filter(f => f.frp != null);
  const avg = validFrp.length ? (validFrp.reduce((s,f)=>s+f.frp,0)/validFrp.length).toFixed(1) : '—';
  el('stats').innerHTML = `<article class="stat-card"><div class="stat-top"><span>DÉTECTIONS FILTRÉES</span><i>◎</i></div><strong>${fmt(list.length)}</strong><small>${state.fires.length ? `sur ${fmt(state.fires.length)} observations chargées` : 'aucune observation pour ces filtres'}</small></article><article class="stat-card"><div class="stat-top"><span>RÉPARTITION CAPTEURS</span><i>◉</i></div><strong>${fmt(viirs)} <span class="stat-divider">/</span> ${fmt(modis)}</strong><small><i class="dot viirs"></i> VIIRS <i class="dot modis"></i> MODIS</small></article><article class="stat-card"><div class="stat-top"><span>FRP MOYENNE</span><i>ϟ</i></div><strong>${avg}<span class="unit"> MW</span></strong><small>${validFrp.length ? `sur ${validFrp.length} mesures disponibles` : 'données FRP indisponibles'}</small></article><article class="stat-card"><div class="stat-top"><span>PIC D’ACTIVITÉ</span><i>⌁</i></div><strong class="peak-number">${peak ? fmt(peak[1].length) : '—'}</strong><small>${peak ? new Date(`${peak[0]}T00:00:00Z`).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',timeZone:'UTC'}) : 'aucune activité recensée'}</small></article>`;
  el('fire-count').textContent = `${fmt(state.filtered.length)} détection${state.filtered.length > 1 ? 's' : ''}${state.filtered.length !== state.fires.length ? ' filtrée(s)' : ''}`;
}
function renderTable() {
  const rows = [...state.filtered].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,10);
  el('fire-table').innerHTML = rows.length ? rows.map(f=>`<tr><td><b>${esc(f.zone || 'Zone inconnue')}</b></td><td>${new Date(f.date).toLocaleString('fr-FR',{timeZone:'UTC',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})} <small>UTC</small></td><td><span class="sensor-tag ${f.sensor.toLowerCase()}">${esc(f.sensor)}</span></td><td>${f.confidence == null ? '—' : `${esc(f.confidence)} %`}</td><td>${f.frp == null ? '—' : `${esc(f.frp)} MW`}</td><td class="coords">${f.latitude.toFixed(3)}, ${f.longitude.toFixed(3)}</td><td><span class="source-tag">${esc(f.source?.includes('NOT_NASA')?'FICTIF · NON NASA':f.source || (mode==='api'?'API':'DÉMO FICTIVE'))}</span></td></tr>`).join('') : '<tr><td colspan="7" class="empty">Aucune détection ne correspond aux filtres.</td></tr>';
  el('table-summary').textContent = `${rows.length} affichée${rows.length > 1 ? 's' : ''} · ${state.filtered.length} au total`;
}
function renderCalendar() {
  const latest = state.fires.reduce((date, fire) => Math.max(date, Date.parse(fire.date)), 0);
  const end = state.date.to ? new Date(`${state.date.to}T12:00:00Z`) : latest ? new Date(latest) : new Date();
  const start = state.date.from ? new Date(`${state.date.from}T12:00:00Z`) : new Date(end.getTime()-29*864e5);
  const days = Math.min(120, Math.max(1, Math.ceil((end-start)/864e5)+1));
  const counts = {}; for (const f of state.fires) { const d = f.date.slice(0,10); if (d >= dateInput(start) && d <= dateInput(end)) counts[d] = (counts[d]||0)+1; }
  const apiDays = state.calendar?.days ?? state.calendar?.calendar ?? state.calendar?.data; if (Array.isArray(apiDays)) for (const item of apiDays) { const day=item.date ?? item.day ?? item.acq_date; const n=Number(item.count ?? item.detections ?? item.fires ?? 0); if(day && Number.isFinite(n)) counts[String(day).slice(0,10)]=n; }
  const max = Math.max(1,...Object.values(counts)); let peak = ['',0];
  el('calendar').innerHTML = Array.from({length:days},(_,i)=>{ const d = new Date(start.getTime()+i*864e5), key = dateInput(d), n = counts[key]||0; if (n>peak[1]) peak=[key,n]; const level=n===0?0:Math.min(4,Math.ceil(n/max*4)); return `<button class="calendar-cell lv${level} ${key===state.date.selected?'selected':''}" data-day="${key}" title="${new Date(`${key}T00:00:00Z`).toLocaleDateString('fr-FR',{day:'numeric',month:'long',timeZone:'UTC'})} · ${n} détection${n>1?'s':''}" aria-label="${key}, ${n} détections"></button>`; }).join('');
  el('peak-label').textContent = peak[1] ? `Pic : ${new Date(`${peak[0]}T00:00:00Z`).toLocaleDateString('fr-FR',{day:'numeric',month:'short',timeZone:'UTC'})} · ${peak[1]}` : `${days} jours`;
  el('calendar').onclick = e => { const cell=e.target.closest('[data-day]'); if (!cell) return; if (state.date.selected === cell.dataset.day) { state.date.selected=''; el('date-from').value=''; el('date-to').value=''; state.date.from=''; state.date.to=''; } else { state.date.selected=cell.dataset.day; state.date.from=cell.dataset.day; state.date.to=cell.dataset.day; el('date-from').value=state.date.from; el('date-to').value=state.date.to; } filterFires(); };
}
function renderChart() {
  const ctx=el('trend-chart'); if(state.chart)state.chart.destroy();
  const latest=state.filtered.reduce((date,fire)=>Math.max(date,Date.parse(fire.date)),0);
  const end=state.date.to?new Date(`${state.date.to}T12:00:00Z`):latest?new Date(latest):new Date(), days=30, start=new Date(end.getTime()-(days-1)*864e5);
  const labels=Array.from({length:days},(_,i)=>new Date(start.getTime()+i*864e5).toISOString().slice(5,10));
  const grouped=(sensor)=>labels.map((_,i)=>{const key=dateInput(new Date(start.getTime()+i*864e5)); return state.filtered.filter(f=>f.sensor===sensor&&f.date.slice(0,10)===key).length;});
  const apiSeries=state.apiStatistics?.timeseries ?? state.apiStatistics?.series;
  const apiValues=(sensor)=>Array.isArray(apiSeries)?labels.map((_,i)=>{const key=dateInput(new Date(start.getTime()+i*864e5));const point=apiSeries.find(p=>(p.date??p.day)===key);return Number(point?.[sensor.toLowerCase()] ?? point?.[sensor] ?? point?.[sensor.toLowerCase()+'_count'] ?? 0);}):grouped(sensor);
  state.chart=new Chart(ctx,{type:'line',data:{labels,datasets:[{label:'VIIRS',data:apiValues('VIIRS'),borderColor:'#fb8258',backgroundColor:'#fb825822',fill:true,tension:.36,pointRadius:0,borderWidth:2},{label:'MODIS',data:apiValues('MODIS'),borderColor:'#65a8f2',backgroundColor:'#65a8f222',fill:true,tension:.36,pointRadius:0,borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#a6b0b4',usePointStyle:true,boxWidth:7,font:{family:'Inter, sans-serif',size:10}}}},scales:{x:{grid:{display:false},ticks:{color:'#7d888d',maxTicksLimit:6,font:{size:10}}},y:{beginAtZero:true,grid:{color:'rgba(145,160,165,.09)'},ticks:{color:'#7d888d',precision:0,font:{size:10}}}}}});
  const n=state.filtered.length; const anomalyRows=state.anomalies?.anomalies ?? state.anomalies?.results ?? state.anomalies?.data; const anomalyText=Array.isArray(anomalyRows)&&anomalyRows.length?` ${anomalyRows.length} anomalie(s) signalée(s) par l’API.`:''; el('analysis-note').textContent=mode==='api'?(n?`Série construite à partir des ${n} détections renvoyées par l’API.${apiSeries?' Séries temporelles fournies par /statistics.':''}${anomalyText}`:'Aucune détection disponible pour cette période.'):(n?'Mode démo : tendances illustratives uniquement. Les résultats scientifiques réels nécessitent une connexion à l’API FIRMS.':'Aucune observation dans la période sélectionnée.');
}
function updateNotices() {
  const notice=el('notice'); notice.hidden=mode==='api'; notice.innerHTML=state.scenario==='dixie-2021'?'<b>SIMULATION PÉDAGOGIQUE · Dixie Fire, Californie (2021)</b> Les points, heures, niveaux de confiance et FRP sont simulés; ils ne sont pas des observations FIRMS historiques.':'<b>MODE DÉMO · Afrique centrale</b> Les observations affichées sont synthétiques et ne représentent pas des détections NASA FIRMS.';
  el('mode-label').textContent=mode==='api'?'Connexion API':'Mode démo'; el('source-label').textContent=mode==='api'?apiBase:state.scenario==='dixie-2021'?'Simulation Dixie Fire · points fictifs':'Données synthétiques · Afrique centrale';
  el('origin-label').textContent=mode==='api'?'SYSTÈME DE SURVEILLANCE · NASA FIRMS':'DONNÉES FICTIVES · MODE DÉMO';
  el('footer-source').textContent=mode==='api'?'NASA FIRMS (API)':'Démonstration synthétique';
  el('footer-note').textContent=mode==='api'?'Les points thermiques sont des signaux à examiner et ne constituent pas des confirmations au sol.':'Aucune observation réelle NASA : toutes les valeurs de démonstration sont fictives.';
  el('scenario-select').disabled=mode==='api'; if(mode==='api') el('scenario-select').title='Scénario local disponible en mode démo uniquement';
}
async function fetchJson(path, query) { const response=await fetch(`${apiBase}${path}${query?`?${query}`:''}`,{headers:{Accept:'application/json'}}); if(!response.ok)throw new Error(`${path} · HTTP ${response.status}`); return response.json(); }
async function fetchData() {
  if(mode!=='api'){state.fires=(state.scenario==='dixie-2021'?demoDixieFires:demoCsvFires).map(x=>({...x})); state.error=''; filterFires(); el('updated').textContent=`Démo · ${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`; return; }
  el('refresh').classList.add('spinning'); el('error').hidden=true; el('updated').textContent='Chargement…';
  const filters={date_from:state.date.from,date_to:state.date.to,sensor:state.sensor==='all'?'':state.sensor,zone:state.zone,confidence_min:state.confidence};
  if(state.selection){const b=state.selection.getBounds();filters.bbox=[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()].join(',');filters.min_lon=b.getWest();filters.min_lat=b.getSouth();filters.max_lon=b.getEast();filters.max_lat=b.getNorth();}
  try {
    const [firePayload, statsResult, calResult, anomaliesResult]=await Promise.allSettled([fetchJson('/fires',toQuery(filters)),fetchJson('/statistics',toQuery(filters)),fetchJson('/calendar',toQuery(filters)),fetchJson('/anomalies',toQuery(filters))]);
    if(firePayload.status==='rejected')throw firePayload.reason;
    state.fires=normalizeFires(firePayload.value); state.apiStatistics=statsResult.status==='fulfilled'?statsResult.value:null; state.calendar=calResult.status==='fulfilled'?calResult.value:null; state.anomalies=anomaliesResult.status==='fulfilled'?anomaliesResult.value:null;
    filterFires(); el('updated').textContent=`Actualisé · ${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`;
    const unavailable=[statsResult,calResult,anomaliesResult].filter(r=>r.status==='rejected').length; if(unavailable){el('error').hidden=false;el('error').textContent=`Les données incendie sont chargées, mais ${unavailable} endpoint(s) d’analyse (/statistics, /calendar, /anomalies) sont indisponibles.`;}
  } catch(error) { state.fires=[];filterFires();el('error').hidden=false;el('error').innerHTML=`<b>Connexion API impossible.</b> ${esc(error.message)} Vérifiez VITE_API_BASE_URL et la disponibilité de <code>GET /fires</code>. Le mode réel ne bascule jamais silencieusement vers des données de démo.`;el('updated').textContent='Hors connexion'; }
  finally {el('refresh').classList.remove('spinning');}
}
function setup() {
  initMap(); updateNotices(); document.documentElement.dataset.theme=state.theme; el('scenario-select').value=state.scenario;
  el('date-from').value=state.date.from; el('date-to').value=state.date.to;
  el('scenario-select').addEventListener('change',e=>{state.scenario=e.target.value;state.selection?.remove();state.selection=null;state.date.selected='';if(state.scenario==='dixie-2021'){state.date.from=dixieScenario.from;state.date.to=dixieScenario.to;state.map.setView(dixieScenario.center,dixieScenario.zoom);}else{state.date.from='';state.date.to='';state.map.setView([4.5,15.5],4);}el('scenario-select').value=state.scenario;el('date-from').value=state.date.from;el('date-to').value=state.date.to;addScenarioZones();updateNotices();fetchData();});
  el('date-from').addEventListener('change',e=>{state.date.from=e.target.value;state.date.selected='';fetchData();});
  el('date-to').addEventListener('change',e=>{state.date.to=e.target.value;state.date.selected='';fetchData();});
  el('sensor-filter').addEventListener('change',e=>{state.sensor=e.target.value;fetchData();});
  el('zone-filter').addEventListener('change',e=>{state.zone=e.target.value;fetchData();});
  el('confidence-filter').addEventListener('change',e=>{state.confidence=e.target.value;fetchData();});
  el('refresh').addEventListener('click',fetchData);
  el('roi').addEventListener('click',()=>{if(state.selection){state.selection.remove();state.selection=null;el('map-status').textContent='';fetchData();}else{state.roiMode=true;state.roiFirst=null;el('map-status').textContent='Cliquez sur la carte pour définir le premier point.';}});
  el('export').addEventListener('click',()=>{const blob=new Blob([csvFor(state.filtered)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`forest-fire-detections-${dateInput(new Date())}.csv`;a.click();URL.revokeObjectURL(url);});
  el('theme-toggle').addEventListener('click',()=>{state.theme=state.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=state.theme;localStorage.setItem('ffi-theme',state.theme);});
  window.addEventListener('hashchange',()=>{document.querySelectorAll('.nav[href^="#"]').forEach(a=>a.classList.toggle('active',a.getAttribute('href')===location.hash));setTimeout(()=>state.map.invalidateSize({ pan: false }),100);});
  fetchData();
}
shell(); setup();
