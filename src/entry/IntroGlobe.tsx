import { useEffect, useRef, useState } from "react";

const R = 240;
const TILT = (30 * Math.PI) / 180;
const BASE_TURN = -18;
const STEP_TURN = 20;
const DURATION = 480;

type Vec = [number, number, number];
type Screen = { x: number; y: number; front: boolean };

// Illustrative nodes across Europe and western Asia; they carry no names or data.
const nodes: [number, number][] = [
  [33, 35],
  [14, 50],
  [-4, 40],
  [24, 61],
  [45, 25],
  [62, 43],
];
const arcs: [number, number][] = [
  [0, 1],
  [1, 2],
  [1, 3],
  [0, 4],
  [0, 5],
  [3, 5],
];

const rad = (degrees: number) => (degrees * Math.PI) / 180;

function vector(lon: number, lat: number): Vec {
  const l = rad(lon);
  const p = rad(lat);
  return [Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l)];
}

function project([x, y, z]: Vec, turn: number): Screen {
  const t = rad(turn);
  const x1 = x * Math.cos(t) + z * Math.sin(t);
  const z1 = -x * Math.sin(t) + z * Math.cos(t);
  const y2 = y * Math.cos(TILT) - z1 * Math.sin(TILT);
  const z2 = y * Math.sin(TILT) + z1 * Math.cos(TILT);
  return { x: R * x1, y: -R * y2, front: z2 > -0.02 };
}

function path(points: Screen[]) {
  let d = "";
  let open = false;
  for (const point of points) {
    if (!point.front) {
      open = false;
      continue;
    }
    d += `${open ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    open = true;
  }
  return d;
}

function range(from: number, to: number, step: number) {
  const values: number[] = [];
  for (let value = from; value <= to + 1e-9; value += step) values.push(value);
  return values;
}

function arc(a: Vec, b: Vec, turn: number) {
  const angle = Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  return range(0, 1, 1 / 24).map((t) => {
    const lift = 1 + 0.35 * angle * Math.sin(Math.PI * t);
    const mixed = a.map((value, i) => value * (1 - t) + b[i] * t) as Vec;
    const length = Math.hypot(...mixed);
    return project(mixed.map((value) => (value / length) * lift) as Vec, turn);
  });
}

function geometry(turn: number) {
  const meridians = range(-180, 150, 30).map((lon) =>
    path(range(-90, 90, 6).map((lat) => project(vector(lon, lat), turn))),
  );
  const parallels = range(-60, 60, 30).map((lat) =>
    path(range(-180, 180, 6).map((lon) => project(vector(lon, lat), turn))),
  );
  const points = nodes.map(([lon, lat]) => project(vector(lon, lat), turn));
  const lines = arcs.map(([a, b]) =>
    path(arc(vector(...nodes[a]), vector(...nodes[b]), turn)),
  );
  return { grid: [...meridians, ...parallels].join(""), points, lines };
}

const bezier = (s: number, a: number, b: number) =>
  3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
const slope = (s: number, a: number, b: number) =>
  3 * a * (1 - s) ** 2 + 6 * (b - a) * s * (1 - s) + 3 * (1 - b) * s * s;

/** cubic-bezier(.22, 1, .36, 1), the Motion sheet's arrive curve. */
export function arrive(t: number) {
  let s = t;
  for (let i = 0; i < 8; i++) {
    const d = slope(s, 0.22, 0.36);
    if (Math.abs(d) < 1e-6) break;
    s = Math.min(1, Math.max(0, s - (bezier(s, 0.22, 0.36) - t) / d));
  }
  return bezier(s, 1, 1);
}

export function IntroGlobe({
  beat,
  reduced,
}: {
  beat: number;
  reduced: boolean;
}) {
  const target = BASE_TURN - beat * STEP_TURN;
  const [turn, setTurn] = useState(target);
  const shown = useRef(target);
  useEffect(() => {
    const origin = shown.current;
    if (reduced || origin === target) {
      shown.current = target;
      setTurn(target);
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min(1, (now - start) / DURATION);
      shown.current = origin + (target - origin) * arrive(progress);
      setTurn(shown.current);
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, reduced]);
  const { grid, points, lines } = geometry(turn);
  const home = points[0];
  return (
    <svg
      className="intro-globe"
      viewBox="-320 -320 640 640"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="intro-globe-body" cx="38%" cy="30%" r="75%">
          <stop offset="0" className="intro-globe-lit" />
          <stop offset="1" className="intro-globe-shade" />
        </radialGradient>
        <radialGradient id="intro-globe-halo" r="50%">
          <stop offset="0.72" className="intro-globe-halo-in" />
          <stop offset="0.8" className="intro-globe-halo-mid" />
          <stop offset="1" className="intro-globe-halo-out" />
        </radialGradient>
      </defs>
      <circle r="318" fill="url(#intro-globe-halo)" />
      <circle r={R} className="intro-globe-body" />
      <path d={grid} className="intro-globe-grid" />
      <path
        d={`M${-R * Math.cos(rad(30))} ${-R * Math.sin(rad(30))}A${R} ${R} 0 0 1 ${R} 0`}
        className="intro-globe-limb"
      />
      <g className="intro-globe-arcs">
        {lines.map((d, index) => (
          <path key={index} d={d} />
        ))}
      </g>
      <g className="intro-globe-nodes">
        {points.map((point, index) =>
          point.front ? (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={index === 0 ? 6.5 : 3.8}
            />
          ) : null,
        )}
      </g>
      {home.front && (
        <g transform={`translate(${home.x} ${home.y})`}>
          <circle r="22" className="intro-globe-glow" />
          <circle r="15" className="intro-globe-landing" />
          <path
            d="M-20-12v-8h8M12-20h8v8M20 12v8h-8M-12 20h-8v-8"
            className="intro-globe-reticle"
          />
        </g>
      )}
    </svg>
  );
}
