// Small spherical-geometry helpers; accurate to well under a metre at Haram scale.
const R = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

export function distanceM(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from `from` to `to`, degrees clockwise from north in [0, 360). */
export function bearingDeg(from, to) {
  const lat1 = rad(from.lat);
  const lat2 = rad(to.lat);
  const dLng = rad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Wraps an angle into [-180, 180). */
export function normDeg(d) {
  return ((((d + 180) % 360) + 360) % 360) - 180;
}

/** Point reached by travelling `distM` metres from `from` on `bearing`. */
export function destination(from, bearing, distM) {
  const delta = distM / R;
  const theta = rad(bearing);
  const lat1 = rad(from.lat);
  const lng1 = rad(from.lng);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(delta) + Math.cos(lat1) * Math.sin(delta) * Math.cos(theta));
  const lng2 = lng1 + Math.atan2(Math.sin(theta) * Math.sin(delta) * Math.cos(lat1), Math.cos(delta) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: deg(lat2), lng: deg(lng2) };
}

/** Local east/north metres of `p` relative to `origin` (equirectangular; fine over a few km). */
export function toLocalM(origin, p) {
  return {
    x: rad(p.lng - origin.lng) * R * Math.cos(rad(origin.lat)),
    y: rad(p.lat - origin.lat) * R,
  };
}

export function lerpPoint(a, b, t) {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}
