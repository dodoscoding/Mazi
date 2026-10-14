import { useEffect, useRef, useState } from "react";
import type { Land } from "./land";
import { project } from "./geo";
import type { AtlasModel } from "./model";

/** The 2D atlas: the same land, places, journeys and selection laid flat (plate carrée). */
export function FlatMap({
  atlas,
  land,
  selectedPlace,
  focusPlace,
  year,
  onPick,
}: {
  atlas: AtlasModel;
  land: Land | null | undefined;
  selectedPlace: string | null;
  focusPlace: string | null;
  year: number | null;
  onPick: (placeId: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const byId = new Map(atlas.places.map((place) => [place.id, place]));
  const centre = byId.get(focusPlace ?? selectedPlace ?? "");
  const cover = Math.max(size.width / 360, size.height / 180) || 1;
  const zoom = atlas.places.length ? 2.4 : 1;
  const unit = cover * zoom;
  const halfWidth = size.width / 2 / unit;
  const halfHeight = size.height / 2 / unit;
  const [px, py] = centre
    ? project(centre.latitude, centre.longitude)
    : [180, 70];
  const fx = Math.min(360 - halfWidth, Math.max(halfWidth, px));
  const fy = Math.min(180 - halfHeight, Math.max(halfHeight, py));
  const selected = byId.get(selectedPlace ?? "");
  const label = selected
    ? `Flat map of the circle's journeys; ${selected.name}${year ? ` ${year}` : ""} selected`
    : "Flat map of the circle's journeys";
  const labels = [...atlas.places]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  if (selected && !labels.includes(selected)) labels.push(selected);
  const max = Math.max(1, ...atlas.places.map((place) => place.count));
  return (
    <div className="flat-map" ref={box}>
      {size.width > 0 && (
        <svg
          width={size.width}
          height={size.height}
          role="img"
          aria-label={label}
        >
          <defs>
            <pattern
              id="flat-dots"
              width="1.1"
              height="1.1"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="0.55" cy="0.55" r="0.26" />
            </pattern>
          </defs>
          <rect className="flat-ocean" width="100%" height="100%" />
          <g
            className="flat-world"
            style={{
              transform: `translate(${size.width / 2}px, ${size.height / 2}px) scale(${unit}) translate(${-fx}px, ${-fy}px)`,
            }}
          >
            <g className="flat-graticule">
              {Array.from({ length: 23 }, (_, i) => (
                <line
                  key={`m${i}`}
                  x1={(i + 1) * 15}
                  x2={(i + 1) * 15}
                  y1={0}
                  y2={180}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {Array.from({ length: 11 }, (_, i) => (
                <line
                  key={`p${i}`}
                  y1={(i + 1) * 15}
                  y2={(i + 1) * 15}
                  x1={0}
                  x2={360}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
            {land && (
              <>
                <path className="flat-land" d={land.path} fillRule="evenodd" />
                <path
                  className="flat-land-dots"
                  d={land.path}
                  fillRule="evenodd"
                  fill="url(#flat-dots)"
                />
              </>
            )}
            <g className="flat-arcs">
              {atlas.journeys.map((journey) => {
                const from = byId.get(journey.from)!;
                const to = byId.get(journey.to)!;
                const [x1, y1] = project(from.latitude, from.longitude);
                const [x2, y2] = project(to.latitude, to.longitude);
                const lift = Math.hypot(x2 - x1, y2 - y1) * 0.3;
                const hot =
                  journey.from === (focusPlace ?? selectedPlace) ||
                  journey.to === (focusPlace ?? selectedPlace);
                const lit = year === null || journey.year === year;
                return (
                  <path
                    key={journey.id}
                    className={`flat-arc ${hot ? "is-hot" : ""} ${lit ? "is-lit" : ""}`}
                    d={`M${x1} ${y1}Q${(x1 + x2) / 2} ${(y1 + y2) / 2 - lift} ${x2} ${y2}`}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </g>
            {atlas.places.map((place) => {
              const [x, y] = project(place.latitude, place.longitude);
              const isSelected = place.id === selectedPlace;
              const lit = year === null || !!place.years[year];
              const r = (3 + 5 * Math.sqrt(place.count / max)) / unit;
              return (
                <g
                  key={place.id}
                  className={`flat-node ${isSelected ? "is-selected" : ""} ${lit ? "is-lit" : ""}`}
                  onClick={() => onPick(place.id)}
                >
                  {isSelected && (
                    <>
                      <circle
                        className="flat-glow"
                        cx={x}
                        cy={y}
                        r={22 / unit}
                      />
                      <circle
                        className="flat-ring"
                        cx={x}
                        cy={y}
                        r={15 / unit}
                        vectorEffect="non-scaling-stroke"
                      />
                    </>
                  )}
                  <circle cx={x} cy={y} r={isSelected ? 7 / unit : r} />
                  <circle className="flat-hit" cx={x} cy={y} r={16 / unit} />
                </g>
              );
            })}
            {labels.map((place) => {
              const [x, y] = project(place.latitude, place.longitude);
              const isSelected = place.id === selectedPlace;
              return (
                <text
                  key={place.id}
                  className={`flat-label ${isSelected ? "is-selected" : ""}`}
                  x={x + 12 / unit}
                  y={y + 4 / unit}
                  style={{
                    fontSize: `${10 / unit}px`,
                    strokeWidth: `${5 / unit}px`,
                  }}
                >
                  {place.name.toUpperCase()}
                  {isSelected ? ` · ${place.count}` : ""}
                </text>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}
