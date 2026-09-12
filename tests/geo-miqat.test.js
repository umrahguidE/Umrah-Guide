import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bearingDeg, destination, distanceM, normDeg } from '../src/engine/geo.js';
import { MAKKAH, miqatRadiusKm, miqatStatus } from '../src/engine/miqat.js';
import { MIQATS, ROUTES, ROUTE_GROUPS, ROUTE_STEPS } from '../src/data/content.js';

test('normDeg wraps into [-180, 180)', () => {
  assert.equal(normDeg(0), 0);
  assert.equal(normDeg(190), -170);
  assert.equal(normDeg(-190), 170);
  assert.equal(normDeg(-600), 120);
  assert.equal(normDeg(720), 0);
});

test('destination and bearing/distance agree', () => {
  const p = destination(MAKKAH, 90, 1000);
  assert.ok(Math.abs(distanceM(MAKKAH, p) - 1000) < 0.5);
  assert.ok(Math.abs(bearingDeg(MAKKAH, p) - 90) < 0.1);
  assert.ok(Math.abs(bearingDeg(MAKKAH, destination(MAKKAH, 0, 500)) - 0) < 0.1);
});

test('every route points at known Miqats and sits in a real group', () => {
  const ids = new Set(MIQATS.map((m) => m.id));
  const groups = new Set(ROUTE_GROUPS.map((g) => g.id));
  const seen = new Set();
  for (const r of ROUTES) {
    assert.ok(!seen.has(r.id), `duplicate route ${r.id}`);
    seen.add(r.id);
    for (const id of r.miqats) assert.ok(ids.has(id), `${r.id} -> ${id}`);
    assert.ok(groups.has(r.group), `${r.id} group ${r.group}`);
    assert.ok(ROUTE_STEPS[r.mode]?.length, `${r.id} has no steps for mode ${r.mode}`);
    assert.ok(r.note, `${r.id} needs a note`);
    assert.equal(r.miqats.length === 0, r.mode === 'inside', `${r.id}: only "inside" routes have no Miqat`);
  }
  assert.ok(ROUTES.length >= 25, 'the route list should cover the main origins');
  for (const g of ROUTE_GROUPS) assert.ok(ROUTES.some((r) => r.group === g.id), `group ${g.id} is empty`);
});

test('Dhul-Hulayfah is the farthest Miqat and all are within 500 km', () => {
  const radii = Object.fromEntries(MIQATS.map((m) => [m.id, miqatRadiusKm(m)]));
  assert.equal(Math.max(...Object.values(radii)), radii['dhul-hulayfah']);
  for (const km of Object.values(radii)) assert.ok(km > 40 && km < 500);
});

test('miqat status: far, approaching and reached', () => {
  const yalamlam = MIQATS.filter((m) => m.id === 'yalamlam');
  assert.equal(miqatStatus({ lat: 51.5, lng: -0.12 }, yalamlam).status, 'far');
  const near = destination(MAKKAH, 180, (miqatRadiusKm(yalamlam[0]) + 50) * 1000);
  const r = miqatStatus(near, yalamlam);
  assert.equal(r.status, 'approaching');
  assert.ok(Math.abs(r.first.kmToBoundary - 50) < 1);
  assert.equal(miqatStatus({ lat: 21.5433, lng: 39.1728 }, yalamlam).status, 'reached', 'Jeddah is inside the boundary');
});

test('with several candidates the first boundary on the way applies', () => {
  const both = MIQATS.filter((m) => ['yalamlam', 'qarn'].includes(m.id));
  const farther = both.reduce((a, b) => (miqatRadiusKm(a) > miqatRadiusKm(b) ? a : b));
  const r = miqatStatus(destination(MAKKAH, 120, 400_000), both);
  assert.equal(r.first.id, farther.id);
});
