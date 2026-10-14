// Sphere and map maths shared by the globe and the flat map. Unit sphere, +z faces the camera at 0°, 0°.
export type Vec3 = [number, number, number];

const rad = Math.PI / 180;

export function toVector(
  latitude: number,
  longitude: number,
  radius = 1,
): Vec3 {
  const phi = latitude * rad;
  const lambda = longitude * rad;
  return [
    radius * Math.cos(phi) * Math.sin(lambda),
    radius * Math.sin(phi),
    radius * Math.cos(phi) * Math.cos(lambda),
  ];
}

/** Globe rotation that turns a place to face the camera: [pitch, yaw] for Euler XYZ. */
export function facing(latitude: number, longitude: number): [number, number] {
  return [latitude * rad, -longitude * rad];
}

/**
 * Points along the great circle from a to b, lifted off the surface in an arch whose
 * height grows with the distance travelled.
 */
export function arcPoints(a: Vec3, b: Vec3, segments: number): Vec3[] {
  const dot = Math.min(
    1,
    Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]),
  );
  const angle = Math.acos(dot);
  const sin = Math.sin(angle) || 1;
  const lift = 0.04 + 0.32 * (angle / Math.PI);
  const points: Vec3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const wa = angle < 1e-6 ? 1 - t : Math.sin((1 - t) * angle) / sin;
    const wb = angle < 1e-6 ? t : Math.sin(t * angle) / sin;
    const x = a[0] * wa + b[0] * wb;
    const y = a[1] * wa + b[1] * wb;
    const z = a[2] * wa + b[2] * wb;
    const length = Math.hypot(x, y, z) || 1;
    const height = 1.004 + lift * Math.sin(Math.PI * t);
    points.push([
      (x / length) * height,
      (y / length) * height,
      (z / length) * height,
    ]);
  }
  return points;
}

/** Plate carrée: 1 unit per degree, origin at 180° W, 90° N. */
export function project(latitude: number, longitude: number): [number, number] {
  return [longitude + 180, 90 - latitude];
}

/** Golden-angle points spread evenly over the unit sphere. */
export function fibonacciPoint(index: number, count: number): Vec3 {
  const y = 1 - ((index + 0.5) * 2) / count;
  const r = Math.sqrt(1 - y * y);
  const theta = index * Math.PI * (3 - Math.sqrt(5));
  return [Math.sin(theta) * r, y, Math.cos(theta) * r];
}

export function latLonOf([x, y, z]: Vec3): [number, number] {
  return [
    Math.asin(Math.max(-1, Math.min(1, y))) / rad,
    Math.atan2(x, z) / rad,
  ];
}

/** Wraps an angle difference into [-π, π] so turns take the short way round. */
export function shortest(delta: number) {
  return delta - 2 * Math.PI * Math.round(delta / (2 * Math.PI));
}

/** CSS cubic-bezier timing as a function of progress, solved with Newton steps. */
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slope = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (progress: number) => {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;
    let t = progress;
    for (let i = 0; i < 6; i++) {
      const error = sampleX(t) - progress;
      const d = slope(t);
      if (Math.abs(error) < 1e-5 || Math.abs(d) < 1e-6) break;
      t -= error / d;
    }
    return sampleY(Math.min(1, Math.max(0, t)));
  };
}

export const ease = {
  arrive: bezier(0.22, 1, 0.36, 1),
  reveal: bezier(0.16, 1, 0.3, 1),
  camera: bezier(0.7, 0, 0.2, 1),
  exit: bezier(0.4, 0, 1, 1),
  wipe: bezier(0.65, 0, 0.35, 1),
};
