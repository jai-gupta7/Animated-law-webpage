/* Rough outline of the lower 48 states and state centres (lon, lat).
   Hand-traced at low detail: it is a lit "map of lights" seen from far above, not a cartographic map. */

export const OUTLINE = [
  [-124.7, 48.4], [-123.0, 49.0], [-95.2, 49.0], [-89.6, 48.0], [-84.8, 46.5], [-82.5, 45.3],
  [-82.4, 43.0], [-79.0, 43.3], [-76.3, 44.2], [-74.9, 45.0], [-71.5, 45.0], [-70.0, 46.7],
  [-67.8, 47.1], [-67.0, 44.8], [-70.2, 43.6], [-70.6, 42.0], [-71.9, 41.3], [-74.0, 40.5],
  [-74.0, 39.0], [-75.5, 38.5], [-76.0, 36.9], [-75.5, 35.2], [-77.9, 33.9], [-79.2, 33.2],
  [-81.0, 32.0], [-81.4, 30.4], [-80.0, 26.8], [-80.4, 25.2], [-81.2, 25.2], [-81.8, 26.5],
  [-82.8, 28.0], [-83.6, 29.9], [-85.3, 29.7], [-86.5, 30.4], [-88.1, 30.4], [-89.6, 30.2],
  [-89.4, 29.0], [-90.5, 29.1], [-93.8, 29.7], [-95.0, 29.2], [-97.2, 27.6], [-97.4, 25.9],
  [-99.5, 27.5], [-101.4, 29.8], [-103.0, 29.0], [-104.5, 29.6], [-106.5, 31.8], [-108.2, 31.8],
  [-108.2, 31.3], [-111.1, 31.3], [-114.8, 32.5], [-117.1, 32.5], [-118.5, 34.0], [-120.6, 34.6],
  [-121.9, 36.6], [-122.5, 37.8], [-123.8, 39.8], [-124.4, 42.0], [-124.0, 46.2],
];

export const STATES = {
  AL: ['Alabama', -86.8, 32.8], AK: ['Alaska', null, null], AZ: ['Arizona', -111.7, 34.3],
  AR: ['Arkansas', -92.4, 34.9], CA: ['California', -119.7, 37.2], CO: ['Colorado', -105.5, 39.0],
  CT: ['Connecticut', -72.7, 41.6], DE: ['Delaware', -75.5, 39.0], FL: ['Florida', -81.7, 28.6],
  GA: ['Georgia', -83.4, 32.7], HI: ['Hawaii', null, null], ID: ['Idaho', -114.6, 44.4],
  IL: ['Illinois', -89.2, 40.0], IN: ['Indiana', -86.3, 39.9], IA: ['Iowa', -93.5, 42.1],
  KS: ['Kansas', -98.4, 38.5], KY: ['Kentucky', -85.3, 37.5], LA: ['Louisiana', -92.0, 31.0],
  ME: ['Maine', -69.2, 45.4], MD: ['Maryland', -76.8, 39.0], MA: ['Massachusetts', -71.8, 42.3],
  MI: ['Michigan', -84.7, 43.6], MN: ['Minnesota', -94.3, 46.3], MS: ['Mississippi', -89.7, 32.7],
  MO: ['Missouri', -92.5, 38.4], MT: ['Montana', -109.6, 47.0], NE: ['Nebraska', -99.8, 41.5],
  NV: ['Nevada', -116.6, 39.3], NH: ['New Hampshire', -71.6, 43.7], NJ: ['New Jersey', -74.7, 40.1],
  NM: ['New Mexico', -106.1, 34.4], NY: ['New York', -75.5, 42.9], NC: ['North Carolina', -79.4, 35.6],
  ND: ['North Dakota', -100.5, 47.5], OH: ['Ohio', -82.8, 40.3], OK: ['Oklahoma', -97.5, 35.6],
  OR: ['Oregon', -120.6, 43.9], PA: ['Pennsylvania', -77.6, 40.9], RI: ['Rhode Island', -71.5, 41.7],
  SC: ['South Carolina', -80.9, 33.9], SD: ['South Dakota', -100.2, 44.4], TN: ['Tennessee', -86.3, 35.9],
  TX: ['Texas', -99.3, 31.5], UT: ['Utah', -111.7, 39.3], VT: ['Vermont', -72.7, 44.1],
  VA: ['Virginia', -78.8, 37.5], WA: ['Washington', -120.5, 47.4], WV: ['West Virginia', -80.6, 38.6],
  WI: ['Wisconsin', -89.8, 44.6], WY: ['Wyoming', -107.6, 43.0],
};

// Sample offices of the placeholder firm (D4): not real addresses.
export const OFFICES = [
  { city: 'Tampa', state: 'FL', lon: -82.46, lat: 27.95 },
  { city: 'Atlanta', state: 'GA', lon: -84.39, lat: 33.75 },
  { city: 'Charlotte', state: 'NC', lon: -80.84, lat: 35.23 },
];
// States the sample firm serves from those offices.
export const SERVED = { FL: 0, GA: 1, AL: 1, TN: 1, NC: 2, SC: 2 };

export function inOutline(lon, lat) {
  let inside = false;
  for (let i = 0, j = OUTLINE.length - 1; i < OUTLINE.length; j = i++) {
    const [xi, yi] = OUTLINE[i], [xj, yj] = OUTLINE[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
