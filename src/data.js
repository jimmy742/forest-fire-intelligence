const locations = [
  [0.39, 9.45, 'Gabon'], [-1.67, 29.22, 'Rwanda'], [3.85, 11.50, 'Cameroun'], [5.35, -4.01, 'Côte d’Ivoire'], [-2.04, 30.06, 'Rwanda'], [4.05, 9.70, 'Cameroun'], [-0.72, 8.78, 'Gabon'], [6.37, 2.43, 'Bénin'], [1.29, 36.82, 'Kenya'], [-3.38, 29.36, 'Burundi'], [7.95, -1.03, 'Ghana'], [-1.94, 30.06, 'Rwanda'], [4.16, 9.24, 'Cameroun'], [0.52, 12.81, 'Gabon'], [-4.32, 15.31, 'RDC'], [2.05, 14.93, 'Tchad'], [8.49, 4.54, 'Nigeria'], [-0.18, 35.0, 'Kenya'], [10.62, 14.36, 'Cameroun'], [-2.50, 28.85, 'RDC'], [6.14, 1.22, 'Togo'], [3.86, 10.13, 'Cameroun'], [-0.37, 9.45, 'Gabon'], [5.61, 0.2, 'Togo'], [12.37, -1.52, 'Burkina Faso'], [-1.32, 36.86, 'Kenya'], [1.62, 11.27, 'Guinée équatoriale'], [4.75, 7.99, 'Nigeria'], [-3.46, 29.91, 'Burundi'], [8.48, -13.23, 'Sierra Leone']
];
// Démonstration synthétique : ces valeurs illustrent l’interface et ne sont pas des observations NASA.
export const demoFires = locations.map(([lat, lon, zone], i) => ({ id: `demo-${i}`, latitude: lat, longitude: lon, date: new Date(Date.now() - ((i * 7 + 1) % 30) * 864e5).toISOString(), sensor: i % 3 === 0 ? 'MODIS' : 'VIIRS', confidence: [36, 54, 68, 79, 91, 98][i % 6], frp: [3.8, 12.4, 26.7, 8.2, 44.1, 17.5][i % 6], zone }));
export function normalizeFires(payload) {
  const rows = Array.isArray(payload) ? payload : payload?.fires ?? payload?.results ?? payload?.data;
  if (!Array.isArray(rows)) throw new Error('Format API invalide : /fires doit renvoyer une liste ou { fires: [...] }.');
  return rows.map((row, index) => {
    let date = row.date ?? row.acq_datetime ?? row.datetime;
    if (!date && row.acq_date) {
      const rawTime = String(row.acq_time ?? '0000').replace(/\D/g, '').padStart(4, '0');
      date = `${row.acq_date}T${rawTime.slice(0, 2)}:${rawTime.slice(2, 4)}:00Z`;
    }
    return { id: row.id ?? `fire-${index}`, latitude: Number(row.latitude ?? row.lat), longitude: Number(row.longitude ?? row.lon ?? row.lng), date, sensor: String(row.sensor ?? row.instrument ?? row.satellite ?? 'Inconnu').toUpperCase(), confidence: row.confidence == null ? null : Number(row.confidence), frp: row.frp == null ? null : Number(row.frp), daynight: row.daynight ?? row.day_night ?? null, source: row.source ?? null, zone: row.zone ?? row.region ?? row.country ?? null };
  }).filter(r => Number.isFinite(r.latitude) && Number.isFinite(r.longitude) && typeof r.date === 'string' && !Number.isNaN(Date.parse(r.date)));
}

export function parseDemoCsv(text) {
  const records = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); if (row.some(value => value !== '')) records.push(row); row = []; field = ''; }
    else field += char;
  }
  if (field !== '' || row.length) { row.push(field.replace(/\r$/, '')); if (row.some(value => value !== '')) records.push(row); }
  if (records.length < 2) throw new Error('Le CSV de démonstration ne contient aucune observation.');
  const headers = records.shift().map(value => value.trim());
  const required = ['latitude','longitude','acq_date','acq_time','satellite','confidence','frp','daynight','source'];
  const missing = required.filter(header => !headers.includes(header));
  if (missing.length) throw new Error(`Colonnes manquantes dans le CSV de démonstration : ${missing.join(', ')}.`);
  const rows = records.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
  const fires = normalizeFires(rows);
  if (fires.length !== rows.length) throw new Error('Le CSV de démonstration contient des coordonnées ou des dates invalides.');
  return fires.map((fire, index) => ({ ...fire, id: `csv-demo-${index}` }));
}
export function toQuery(filters) {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== '' && value != null) p.set(key, Array.isArray(value) ? value.join(',') : String(value));
  return p.toString();
}
export function csvFor(fires) {
  const quote = v => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const rows = [['latitude','longitude','date','time','sensor','confidence','frp_mw','daynight','source','zone'], ...fires.map(f => { const d = new Date(f.date); return [f.latitude, f.longitude, d.toISOString().slice(0,10), d.toISOString().slice(11,19), f.sensor, f.confidence, f.frp, f.daynight, f.source, f.zone]; })];
  return '\ufeff' + rows.map(row => row.map(quote).join(',')).join('\r\n');
}

// Local demonstration inspired by the documented 2021 Dixie Fire area.
// Coordinates, detection timestamps, confidence, and FRP below are generated for UI testing only.
const dixieZones = [
  { name: 'Feather River Canyon', lat: 39.93, lon: -121.23, count: 12 },
  { name: 'Indian Falls', lat: 40.06, lon: -121.07, count: 11 },
  { name: 'Greenville', lat: 40.14, lon: -120.95, count: 14 },
  { name: 'Chester', lat: 40.31, lon: -121.24, count: 12 },
  { name: 'Westwood', lat: 40.30, lon: -121.00, count: 9 },
  { name: 'Janesville', lat: 40.30, lon: -120.53, count: 8 }
];
export const dixieScenario = { id: 'dixie-2021', name: 'Dixie Fire · Californie, 2021', from: '2021-07-13', to: '2021-08-31', center: [40.18, -121.02], zoom: 8, zones: dixieZones };
export const demoDixieFires = dixieZones.flatMap((zone, zoneIndex) => Array.from({ length: zone.count }, (_, i) => {
  const seed = zoneIndex * 17 + i * 7;
  const daysAfterStart = Math.floor((i * 3 + zoneIndex * 5) % 43);
  const date = new Date(Date.UTC(2021, 6, 13 + daysAfterStart, 17 + (i % 7), (i * 13) % 60));
  return { id: `simulation-dixie-${zoneIndex}-${i}`, latitude: zone.lat + (Math.sin(seed) * 0.045), longitude: zone.lon + (Math.cos(seed * 1.7) * 0.055), date: date.toISOString(), sensor: (i + zoneIndex) % 3 === 0 ? 'MODIS' : 'VIIRS', confidence: [52, 63, 71, 78, 86, 93][seed % 6], frp: [6.4, 12.8, 21.3, 37.6, 48.2][(seed + 2) % 5], zone: zone.name };
}));
