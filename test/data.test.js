import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { normalizeFires, toQuery, csvFor, demoFires, parseDemoCsv } from '../src/data.js';

test('normalise les variantes de champs de réponse FIRMS', () => {
  const fires = normalizeFires({ fires: [{ lat: '4.2', lon: '9.7', acq_date: '2025-01-02', acq_time: '1030', satellite: 'n', confidence: '82', frp: '12', region: 'Littoral' }] });
  assert.equal(fires.length, 1);
  assert.equal(fires[0].latitude, 4.2);
  assert.equal(fires[0].longitude, 9.7);
  assert.equal(fires[0].sensor, 'N');
  assert.equal(fires[0].confidence, 82);
  assert.equal(fires[0].zone, 'Littoral');
});

test('écarte coordonnées et dates invalides', () => {
  assert.deepEqual(normalizeFires([{ lat: 'nope', lon: 3, date: '2025-02-03' }, { lat: 3, lon: 4, date: 'invalid' }]), []);
});

test('encode les filtres URL et omet les valeurs vides', () => {
  const query = toQuery({ sensor: 'VIIRS', date_from: '', bbox: [-2, 1, 5, 9], confidence_min: null });
  assert.equal(query, 'sensor=VIIRS&bbox=-2%2C1%2C5%2C9');
});

test('exporte CSV UTF-8 avec guillemets et les champs demandés', () => {
  const csv = csvFor([{ latitude: 1.2, longitude: 3.4, date: '2025-01-02T10:30:00Z', sensor: 'VIIRS', confidence: 90, frp: 12, zone: 'Zone, nord' }]);
  assert.ok(csv.startsWith('\ufeff'));
  assert.match(csv, /\"latitude\",\"longitude\",\"date\",\"time\",\"sensor\",\"confidence\",\"frp_mw\",\"daynight\",\"source\",\"zone\"/);
  assert.match(csv, /"Zone, nord"/);
  assert.ok(csv.includes('10:30:00'));
});

test('les observations locales sont explicitement identifiables comme démo', () => {
  assert.ok(demoFires.length > 0);
  assert.ok(demoFires.every(fire => fire.id.startsWith('demo-')));
});


test('charge environ 50 détections CSV fictives limitées à l’Afrique centrale', () => {
  const csv = readFileSync(new URL('../data/demo/fires_demo.csv', import.meta.url), 'utf8');
  const fires = parseDemoCsv(csv);
  assert.equal(fires.length, 50);
  assert.ok(fires.every(f => f.latitude >= -6 && f.latitude <= 10 && f.longitude >= 8 && f.longitude <= 30));
  assert.deepEqual(new Set(fires.map(f => f.sensor)), new Set(['MODIS', 'VIIRS']));
  assert.ok(fires.every(f => f.source === 'FICTIONAL_SYNTHETIC_DEMO_NOT_NASA'));
  assert.ok(fires.every(f => f.zone && ['D','N'].includes(f.daynight)));
});

test('le parseur CSV prend en charge les champs entre guillemets', () => {
  const fires = parseDemoCsv('latitude,longitude,acq_date,acq_time,satellite,confidence,frp,daynight,source,zone\r\n1.5,10.2,2025-09-01,0830,VIIRS,80,12.5,D,FICTIONAL_SYNTHETIC_DEMO_NOT_NASA,\"Zone, nord\"');
  assert.equal(fires[0].zone, 'Zone, nord');
  assert.equal(fires[0].date, '2025-09-01T08:30:00Z');
});


test('l’export des détections sélectionnées conserve uniquement les lignes filtrées et leur provenance', () => {
  const csv = readFileSync(new URL('../data/demo/fires_demo.csv', import.meta.url), 'utf8');
  const fires = parseDemoCsv(csv);
  const filtered = fires.filter(f => f.sensor === 'VIIRS' && f.zone === 'Gabon');
  const exported = csvFor(filtered);
  assert.ok(filtered.length > 0);
  assert.equal(exported.split('\r\n').length, filtered.length + 1);
  assert.ok(exported.includes('FICTIONAL_SYNTHETIC_DEMO_NOT_NASA'));
  assert.ok(exported.includes('Gabon'));
  assert.ok(!exported.includes('Cameroun'));
});
