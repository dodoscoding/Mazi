import { fibonacciPoint, latLonOf } from "./geo";

type Ring = [number, number][];
type Geometry =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] };

export type Land = {
  /** White land on black, plate carrée, north up. */
  mask: HTMLCanvasElement;
  /** Land outline in the flat map's 360 × 180 degree space. */
  path: string;
  /** Points of an even Fibonacci field that fall on land, as xyz triples. */
  dots: (count: number) => Float32Array;
};

let pending: Promise<Land | null> | undefined;

/** Loads `/land.geojson` once. Resolves null when it is missing so the globe falls back to ocean. */
export function loadLand(): Promise<Land | null> {
  pending ??= fetch("/land.geojson")
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => (data ? build(data) : null))
    .catch(() => null);
  return pending;
}

function polygons(data: { features?: { geometry?: Geometry }[] }): Ring[][] {
  const result: Ring[][] = [];
  for (const feature of data.features || []) {
    const geometry = feature.geometry;
    if (geometry?.type === "Polygon") result.push(geometry.coordinates);
    else if (geometry?.type === "MultiPolygon")
      result.push(...geometry.coordinates);
  }
  return result;
}

function build(data: { features?: { geometry?: Geometry }[] }): Land | null {
  const shapes = polygons(data);
  if (!shapes.length) return null;
  const width = 2048;
  const height = 1024;
  const mask = document.createElement("canvas");
  mask.width = width;
  mask.height = height;
  const context = mask.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.fillStyle = "#000";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#fff";
  const parts: string[] = [];
  for (const rings of shapes) {
    context.beginPath();
    for (const ring of rings) {
      ring.forEach(([lon, lat], index) => {
        const x = ((lon + 180) / 360) * width;
        const y = ((90 - lat) / 180) * height;
        if (index) context.lineTo(x, y);
        else context.moveTo(x, y);
      });
      context.closePath();
      parts.push(
        "M" +
          ring
            .map(
              ([lon, lat]) =>
                `${(lon + 180).toFixed(1)} ${(90 - lat).toFixed(1)}`,
            )
            .join("L") +
          "Z",
      );
    }
    context.fill("evenodd");
  }
  // Sample a quarter-size copy: dots are 0.7° apart, so 0.35° pixels are plenty and the copy stays small.
  const sampleWidth = width / 2;
  const sampleHeight = height / 2;
  const sample = document.createElement("canvas");
  sample.width = sampleWidth;
  sample.height = sampleHeight;
  const sampler = sample.getContext("2d", { willReadFrequently: true })!;
  sampler.drawImage(mask, 0, 0, sampleWidth, sampleHeight);
  const pixels = sampler.getImageData(0, 0, sampleWidth, sampleHeight).data;
  const isLand = (latitude: number, longitude: number) => {
    const x = Math.min(
      sampleWidth - 1,
      Math.floor(((longitude + 180) / 360) * sampleWidth),
    );
    const y = Math.min(
      sampleHeight - 1,
      Math.floor(((90 - latitude) / 180) * sampleHeight),
    );
    return pixels[(y * sampleWidth + x) * 4] > 127;
  };
  const cache = new Map<number, Float32Array>();
  return {
    mask,
    path: parts.join(""),
    dots(count) {
      const hit = cache.get(count);
      if (hit) return hit;
      const values: number[] = [];
      for (let index = 0; index < count; index++) {
        const point = fibonacciPoint(index, count);
        const [latitude, longitude] = latLonOf(point);
        if (isLand(latitude, longitude)) values.push(...point);
      }
      const result = new Float32Array(values);
      cache.set(count, result);
      return result;
    },
  };
}
