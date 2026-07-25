/**
 * Convert the 2024 LGD state/UT GeoJSON into a compact, deterministic set of
 * projected SVG paths for the interactive India map.
 *
 * Usage:
 *   npx tsx scripts/map-generate.ts C:/tmp/LGD_States.geojson
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { geoMercator } from 'd3-geo';

type Point = [number, number];
type Ring = Point[];
type Polygon = Ring[];
type Geometry =
  | { type: 'Polygon'; coordinates: Polygon }
  | { type: 'MultiPolygon'; coordinates: Polygon[] };

interface SourceFeature {
  type: 'Feature';
  properties: { STNAME: string; Remarks?: string };
  geometry: Geometry;
}

interface SourceCollection {
  type: 'FeatureCollection';
  features: SourceFeature[];
}

const CODE_BY_NAME: Record<string, string> = {
  'LAKSHADWEEP': 'LD',
  'KERALA': 'KL',
  'PUDUCHERRY': 'PY',
  'TAMIL NADU': 'TN',
  'KARNATAKA': 'KA',
  'ANDHRA PRADESH': 'AP',
  'TELANGANA': 'TG',
  'CHHATTISGARH': 'CG',
  'MAHARASHTRA': 'MH',
  'DADRA,NAGAR HAVELI,DAMAN & DIU': 'DH',
  'GOA': 'GA',
  'GUJARAT': 'GJ',
  'RAJASTHAN': 'RJ',
  'JAMMU & KASHMIR': 'JK',
  'PUNJAB': 'PB',
  'CHANDIGARH': 'CH',
  'HIMACHAL PRADESH': 'HP',
  'LADAKH': 'LA',
  'UTTARAKHAND': 'UK',
  'UTTAR PRADESH': 'UP',
  'DELHI': 'DL',
  'HARYANA': 'HR',
  'MADHYA PRADESH': 'MP',
  'JHARKHAND': 'JH',
  'WEST BENGAL': 'WB',
  'SIKKIM': 'SK',
  'BIHAR': 'BR',
  'NAGALAND': 'NL',
  'ARUNACHAL PRADESH': 'AR',
  'ASSAM': 'AS',
  'MEGHALAYA': 'ML',
  'TRIPURA': 'TR',
  'MIZORAM': 'MZ',
  'MANIPUR': 'MN',
  'ODISHA': 'OD',
  'ANDAMAN & NICOBAR': 'AN',
};

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Pass the LGD_States.geojson source path.');

const collection = JSON.parse(readFileSync(sourcePath, 'utf8')) as SourceCollection;
if (collection.features.length !== 36) throw new Error(`Expected 36 states/UTs, found ${collection.features.length}.`);

function geometryPoints(geometry: Geometry): Point[] {
  return geometry.type === 'Polygon'
    ? geometry.coordinates.flat()
    : geometry.coordinates.flat(2);
}

// Fit to the coordinate cloud rather than polygon area. LGD rings use the
// opposite winding order from d3-geo's spherical convention; fitting the
// polygons directly would treat their complements as the intended geometry.
const projection = geoMercator().fitExtent(
  [[34, 24], [666, 736]],
  {
    type: 'MultiPoint',
    coordinates: collection.features.flatMap((feature) => geometryPoints(feature.geometry)),
  } as any,
);

const sqSegmentDistance = (point: Point, start: Point, end: Point) => {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = end[0];
      y = end[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
};

function simplifyStep(points: Point[], first: number, last: number, tolerance: number, output: Point[]) {
  let maxDistance = tolerance;
  let index = 0;
  for (let i = first + 1; i < last; i += 1) {
    const distance = sqSegmentDistance(points[i], points[first], points[last]);
    if (distance > maxDistance) {
      index = i;
      maxDistance = distance;
    }
  }
  if (maxDistance > tolerance) {
    if (index - first > 1) simplifyStep(points, first, index, tolerance, output);
    output.push(points[index]);
    if (last - index > 1) simplifyStep(points, index, last, tolerance, output);
  }
}

function simplify(points: Point[], tolerance = 0.85) {
  if (points.length <= 4) return points;
  const output = [points[0]];
  simplifyStep(points, 0, points.length - 1, tolerance * tolerance, output);
  output.push(points[points.length - 1]);
  return output;
}

const n = (value: number) => Number(value.toFixed(1));

function ringPath(ring: Ring) {
  const projected = ring
    .map((coordinate) => projection(coordinate) as Point | null)
    .filter((coordinate): coordinate is Point => coordinate !== null);
  if (
    projected.length > 1
    && projected[0][0] === projected[projected.length - 1][0]
    && projected[0][1] === projected[projected.length - 1][1]
  ) projected.pop();

  if (projected.length < 3) return '';

  let farthestIndex = 1;
  let farthestDistance = 0;
  for (let i = 1; i < projected.length; i += 1) {
    const dx = projected[i][0] - projected[0][0];
    const dy = projected[i][1] - projected[0][1];
    const distance = dx * dx + dy * dy;
    if (distance > farthestDistance) {
      farthestDistance = distance;
      farthestIndex = i;
    }
  }

  const firstArc = simplify(projected.slice(0, farthestIndex + 1));
  const secondArc = simplify([...projected.slice(farthestIndex), projected[0]]);
  const simplified = [...firstArc.slice(0, -1), ...secondArc.slice(0, -1)];
  let points = simplified;
  if (points.length < 3) {
    let thirdIndex = 1;
    let thirdDistance = 0;
    for (let i = 1; i < projected.length; i += 1) {
      const distance = sqSegmentDistance(projected[i], projected[0], projected[farthestIndex]);
      if (distance > thirdDistance) {
        thirdDistance = distance;
        thirdIndex = i;
      }
    }
    points = [projected[0], projected[farthestIndex], projected[thirdIndex]];
  }
  if (points.length < 3) return '';
  return `M${points.map(([x, y]) => `${n(x)},${n(y)}`).join('L')}Z`;
}

function geometryPath(geometry: Geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.map((polygon) => polygon.map(ringPath).join('')).join('');
}

const records = collection.features.map((feature) => {
  const name = feature.properties.STNAME.trim().toUpperCase();
  const code = CODE_BY_NAME[name];
  if (!code) throw new Error(`No site code mapping for ${name}.`);
  const projectedPoints = geometryPoints(feature.geometry)
    .map((coordinate) => projection(coordinate) as Point | null)
    .filter((coordinate): coordinate is Point => coordinate !== null);
  const xs = projectedPoints.map(([x]) => x);
  const ys = projectedPoints.map(([, y]) => y);
  const centroid: Point = [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  ];
  return {
    code,
    name: feature.properties.Remarks?.trim() || name,
    path: geometryPath(feature.geometry),
    label: [n(centroid[0]), n(centroid[1])] as Point,
  };
}).sort((a, b) => a.code.localeCompare(b.code));

const emptyRecords = records.filter((record) => !record.path);
if (emptyRecords.length) throw new Error(`Empty state/UT paths: ${emptyRecords.map((record) => record.code).join(', ')}`);

const output = `/**
 * Generated from Bharatlas' 2024 Local Government Directory state/UT layer.
 * Source: https://bharatlas.com/view/lgd_states
 * Licence: CC0-1.0 / CC-BY-4.0
 * Regenerate with scripts/map-generate.ts; do not hand-edit path data.
 */
export interface IndiaMapPath {
  code: string;
  name: string;
  path: string;
  label: [number, number];
}

export const INDIA_MAP_VIEWBOX = '0 0 700 760';
export const INDIA_MAP_PATHS: IndiaMapPath[] = ${JSON.stringify(records)};
`;

writeFileSync('src/data/india-map.ts', output);
console.log(`[map] wrote ${records.length} state/UT paths to src/data/india-map.ts`);
