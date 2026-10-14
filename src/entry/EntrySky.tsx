// The night globe glow without WebGL: stars, an atmosphere halo and the
// planet's dotted limb rising from the bottom edge, in one static SVG.
const W = 1440;
const H = 900;
const PLANET = { cx: 650, cy: 1500, r: 920 };

function stars() {
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: 150 }, () => {
    const x = random() * W;
    const y = random() * H;
    const bright = random();
    return {
      x,
      y,
      r: 0.4 + bright * bright * 1.1,
      o: 0.25 + bright * 0.65,
    };
  }).filter(
    ({ x, y }) => Math.hypot(x - PLANET.cx, y - PLANET.cy) > PLANET.r + 6,
  );
}

const field = stars();

function parallel(lat: number) {
  const p = (lat * Math.PI) / 180;
  const rx = PLANET.r * Math.cos(p);
  const cy = PLANET.cy - PLANET.r * Math.sin(p) * 0.94;
  return { rx, ry: rx * 0.34, cy };
}

export function EntrySky() {
  return (
    <svg
      className="entry-sky"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient
          id="entry-planet"
          cx={PLANET.cx}
          cy={PLANET.cy - PLANET.r}
          r={PLANET.r * 1.2}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" className="entry-planet-lit" />
          <stop offset="1" className="entry-planet-shade" />
        </radialGradient>
        <radialGradient
          id="entry-halo"
          cx={PLANET.cx}
          cy={PLANET.cy}
          r={PLANET.r + 220}
          gradientUnits="userSpaceOnUse"
        >
          <stop
            offset={PLANET.r / (PLANET.r + 220)}
            className="entry-halo-in"
          />
          <stop
            offset={(PLANET.r + 40) / (PLANET.r + 220)}
            className="entry-halo-mid"
          />
          <stop offset="1" className="entry-halo-out" />
        </radialGradient>
        <linearGradient id="entry-limb-fade" x1="0" x2="1">
          <stop offset="0.08" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.45" stopColor="#fff" />
          <stop offset="0.7" stopColor="#fff" />
          <stop offset="0.96" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="entry-limb-mask">
          <rect width={W} height={H} fill="url(#entry-limb-fade)" />
        </mask>
        <clipPath id="entry-planet-clip">
          <circle cx={PLANET.cx} cy={PLANET.cy} r={PLANET.r} />
        </clipPath>
      </defs>
      <g className="entry-stars">
        {field.map((star, index) => (
          <circle
            key={index}
            cx={star.x.toFixed(1)}
            cy={star.y.toFixed(1)}
            r={star.r.toFixed(2)}
            opacity={star.o.toFixed(2)}
          />
        ))}
      </g>
      <circle
        cx={PLANET.cx}
        cy={PLANET.cy}
        r={PLANET.r + 220}
        fill="url(#entry-halo)"
      />
      <circle
        cx={PLANET.cx}
        cy={PLANET.cy}
        r={PLANET.r}
        fill="url(#entry-planet)"
      />
      <g className="entry-graticule" clipPath="url(#entry-planet-clip)">
        {[8, 16, 24].map((lat) => {
          const { rx, ry, cy } = parallel(lat);
          return <ellipse key={lat} cx={PLANET.cx} cy={cy} rx={rx} ry={ry} />;
        })}
        {[0.25, 0.55, 0.82].map((share) => (
          <ellipse
            key={share}
            cx={PLANET.cx}
            cy={PLANET.cy}
            rx={PLANET.r * share}
            ry={PLANET.r}
          />
        ))}
      </g>
      <circle
        className="entry-limb"
        cx={PLANET.cx}
        cy={PLANET.cy}
        r={PLANET.r}
        mask="url(#entry-limb-mask)"
      />
    </svg>
  );
}
