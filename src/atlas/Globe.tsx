import { useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  LinearFilter,
  LinearSRGBColorSpace,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from "three";
import { arcPoints, ease, facing, shortest, toVector } from "./geo";
import type { Land } from "./land";
import type { AtlasModel, PlaceNode } from "./model";
import { palette } from "./palette";
import * as glsl from "./shaders";

export type Layout = "wide" | "medium" | "tablet" | "phone";
export type GlobeProps = {
  atlas: AtlasModel;
  land: Land | null;
  selectedPlace: string | null;
  focusPlace: string | null;
  year: number | null;
  day: boolean;
  reduced: boolean;
  layout: Layout;
  portal: boolean;
  introStart: number | null;
  active: boolean;
  /** Seconds since the page loaded when each place first appeared; drives the "new import lands" pulse. */
  born: Record<string, number>;
  thumbnails: Record<string, { src: string; title: string; meta: string }>;
  onPick: (placeId: string) => void;
  onReady: () => void;
  onLost: () => void;
  /** "panel" frames the globe for a side panel or band, such as the Timeline's, instead of the Atlas page. */
  framing?: "atlas" | "panel";
  /** False leaves the globe display-only: no drag, zoom or picking, and touch scrolls the page. */
  interactive?: boolean;
};

const SPIN_IDLE = (3 * Math.PI) / 180;
const FOV = 35;
const DIVE_FOV = 28;
const DIVE_DISTANCE = 1.5;

type Screen = { x: number; y: number; visible: number };
type Tween = { from: number; to: number; start: number; duration: number };
type Controller = {
  pitch: number;
  yaw: number;
  pitchVelocity: number;
  yawVelocity: number;
  following: boolean;
  dragging: boolean;
  inertiaX: number;
  inertiaY: number;
  zoom: number;
  zoomTarget: number;
  dive: Tween;
  day: Tween;
  frame: { x: number; y: number; r: number } | null;
  screens: Screen[];
};

// Shader output is not colour-managed, so palette hex values go in unconverted.
const color = (value: string) =>
  new Color().setStyle(value, LinearSRGBColorSpace);
const pair = (key: keyof typeof palette) => [
  color(palette[key][0]),
  color(palette[key][1]),
];
const seconds = () => performance.now() / 1000;

function tweenValue(tween: Tween, now: number, curve: (t: number) => number) {
  if (tween.duration <= 0) return tween.to;
  const t = Math.min(1, Math.max(0, (now - tween.start) / tween.duration));
  return tween.from + (tween.to - tween.from) * curve(t);
}

function retarget(tween: Tween, to: number, now: number, duration: number) {
  if (tween.to === to) return;
  tween.from = tweenValue(tween, now, (t) => t);
  tween.to = to;
  tween.start = now;
  tween.duration = duration;
}

/** Where the globe sits on screen for each layout: centre and radius in CSS pixels. */
function frameFor(
  layout: Layout,
  width: number,
  height: number,
  portal: boolean,
  framing: "atlas" | "panel" = "atlas",
) {
  if (framing === "panel")
    // A short band shows the globe's upper cap; a tall panel shows the whole globe high up.
    return height < 360
      ? { x: width * 0.62, y: height * 0.8, r: Math.min(width * 0.55, height) }
      : {
          x: width * 0.6,
          y: height * 0.38,
          r: Math.min(width * 0.56, height * 0.36),
        };
  if (portal) {
    if (layout === "wide" || layout === "medium") {
      const dossier = layout === "wide" ? 520 : 440;
      return { x: (width - dossier) / 2, y: height * 0.52, r: height * 0.46 };
    }
    return { x: width / 2, y: height * 0.3, r: width * 0.5 };
  }
  if (layout === "wide") {
    const left = 360;
    const right = width - 336;
    return {
      x: (left + right) / 2 + width * 0.025,
      y: height * 0.5,
      r: Math.min(height * 0.47, (right - left) * 0.62),
    };
  }
  if (layout === "medium") {
    const left = 290;
    const right = width - 300;
    return {
      x: (left + right) / 2,
      y: height * 0.5,
      r: Math.min(height * 0.42, (right - left) * 0.62),
    };
  }
  if (layout === "tablet")
    return {
      x: width / 2,
      y: height * 0.42,
      r: Math.min(width * 0.44, height * 0.33),
    };
  return {
    x: width / 2,
    y: height * 0.36,
    r: Math.min(width * 0.56, height * 0.3),
  };
}

function buildArcs(atlas: AtlasModel, phone: boolean) {
  const byId = new Map(atlas.places.map((place) => [place.id, place]));
  const segments = phone ? 40 : 64;
  const sides = 6;
  const radius = phone ? 0.006 : 0.0045;
  const ringSize = sides + 1;
  const perArc = (segments + 1) * ringSize;
  const count = atlas.journeys.length;
  const position = new Float32Array(count * perArc * 3);
  const normal = new Float32Array(count * perArc * 3);
  const along = new Float32Array(count * perArc);
  const seed = new Float32Array(count * perArc);
  const order = new Float32Array(count * perArc);
  const index: number[] = [];
  const stagger = count > 1 ? Math.min(0.09, 0.9 / (count - 1)) : 0;
  atlas.journeys.forEach((journey, arc) => {
    const from = byId.get(journey.from)!;
    const to = byId.get(journey.to)!;
    const points = arcPoints(
      toVector(from.latitude, from.longitude),
      toVector(to.latitude, to.longitude),
      segments,
    );
    const random = (Math.sin(arc * 12.9898) * 43758.5453) % 1;
    points.forEach((point, i) => {
      const next = points[Math.min(points.length - 1, i + 1)];
      const previous = points[Math.max(0, i - 1)];
      const tangent = new Vector3(
        next[0] - previous[0],
        next[1] - previous[1],
        next[2] - previous[2],
      ).normalize();
      const up = new Vector3(...point).normalize();
      const side = new Vector3().crossVectors(tangent, up).normalize();
      up.crossVectors(side, tangent).normalize();
      for (let s = 0; s < ringSize; s++) {
        const angle = (s / sides) * Math.PI * 2;
        const nx = Math.cos(angle) * up.x + Math.sin(angle) * side.x;
        const ny = Math.cos(angle) * up.y + Math.sin(angle) * side.y;
        const nz = Math.cos(angle) * up.z + Math.sin(angle) * side.z;
        const v = arc * perArc + i * ringSize + s;
        position.set(
          [
            point[0] + nx * radius,
            point[1] + ny * radius,
            point[2] + nz * radius,
          ],
          v * 3,
        );
        normal.set([nx, ny, nz], v * 3);
        along[v] = i / segments;
        seed[v] = Math.abs(random);
        order[v] = arc * stagger;
      }
      if (i < segments)
        for (let s = 0; s < sides; s++) {
          const a = arc * perArc + i * ringSize + s;
          const b = a + ringSize;
          index.push(a, b, a + 1, b, b + 1, a + 1);
        }
    });
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(position, 3));
  geometry.setAttribute("normal", new BufferAttribute(normal, 3));
  geometry.setAttribute("aT", new BufferAttribute(along, 1));
  geometry.setAttribute("aSeed", new BufferAttribute(seed, 1));
  geometry.setAttribute("aOrder", new BufferAttribute(order, 1));
  for (const name of ["aLit", "aLitFrom", "aHot", "aBorn"])
    geometry.setAttribute(
      name,
      new BufferAttribute(new Float32Array(count * perArc), 1),
    );
  geometry.setIndex(index);
  return { geometry, perArc };
}

function fill(
  geometry: BufferGeometry,
  name: string,
  values: number[],
  stride: number,
) {
  const attribute = geometry.getAttribute(name) as BufferAttribute;
  const array = attribute.array as Float32Array;
  values.forEach((value, i) => array.fill(value, i * stride, (i + 1) * stride));
  attribute.needsUpdate = true;
}

/** Overlay draw order for label placement: selected, then focused, then the rest. */
function rank(element: HTMLElement) {
  if (!element.classList.contains("globe-label")) return -1;
  if (element.classList.contains("is-selected")) return 0;
  if (element.classList.contains("is-focus")) return 1;
  return 2;
}

function Scene(
  props: GlobeProps & {
    controller: RefObject<Controller>;
    overlay: RefObject<HTMLDivElement | null>;
  },
) {
  const { atlas, land, layout, controller, overlay } = props;
  const phone = layout === "phone" || layout === "tablet";
  const { gl, camera, size, invalidate, setDpr } = useThree();
  const globe = useRef<Group>(null);
  const stars = useRef<Group>(null);
  const flare = useRef<Mesh>(null);
  const ready = useRef(false);
  const slow = useRef({ frames: 0, total: 0, done: !phone });
  const lit = useRef({ nodes: [] as number[], arcs: [] as number[] });

  const resources = useMemo(() => {
    const texture = land ? new CanvasTexture(land.mask) : null;
    if (texture) {
      texture.minFilter = LinearFilter;
      texture.generateMipmaps = false;
    }
    const sun = new Vector3(0.96, 0.1, 0.3).normalize();
    const shared = {
      uDay: { value: props.day ? 1 : 0 },
      uExposure: { value: 1 },
      uSun: { value: sun },
    };
    const sphere = new ShaderMaterial({
      vertexShader: glsl.sphereVertex,
      fragmentShader: glsl.sphereFragment,
      transparent: true,
      uniforms: {
        ...shared,
        uLand: { value: texture },
        uLandOn: { value: texture ? 1 : 0 },
        uOceanDark0: { value: pair("oceanDark")[0] },
        uOceanLit0: { value: pair("oceanLit")[0] },
        uLand0: { value: pair("land")[0] },
        uOceanDark1: { value: pair("oceanDark")[1] },
        uOceanLit1: { value: pair("oceanLit")[1] },
        uLand1: { value: pair("land")[1] },
        uTerminator: { value: color(palette.terminator[0]) },
        uAtmosphere0: { value: pair("atmosphere")[0] },
        uAtmosphere1: { value: pair("atmosphere")[1] },
        uGraticule1: { value: pair("graticule")[1] },
      },
    });
    const dotCount = phone ? 36000 : 72000;
    const dotPositions = land ? land.dots(dotCount) : new Float32Array();
    const dotGeometry = new BufferGeometry();
    const scaled = new Float32Array(dotPositions.length);
    for (let i = 0; i < dotPositions.length; i++)
      scaled[i] = dotPositions[i] * 1.0035;
    dotGeometry.setAttribute("position", new BufferAttribute(scaled, 3));
    const dotSeeds = new Float32Array(scaled.length / 3).map(
      (_, i) => Math.sin(i * 78.233) * 0.5 + 0.5,
    );
    dotGeometry.setAttribute("aSeed", new BufferAttribute(dotSeeds, 1));
    const dots = new ShaderMaterial({
      vertexShader: glsl.dotsVertex,
      fragmentShader: glsl.dotsFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        ...shared,
        uSize: { value: Math.sqrt((4 * Math.PI) / dotCount) * 0.56 },
        uMaxSize: { value: 12 },
        uScale: { value: 800 },
        uDim0: { value: color(palette.dotDim[0]) },
        uLit0: { value: color(palette.dotLit[0]) },
        uTerminator: { value: color(palette.terminator[0]) },
        uDot1: { value: color(palette.dotLit[1]) },
      },
    });
    const atmosphere = new ShaderMaterial({
      vertexShader: glsl.atmosphereVertex,
      fragmentShader: glsl.atmosphereFragment,
      transparent: true,
      depthWrite: false,
      side: BackSide,
      uniforms: {
        ...shared,
        uBreath: { value: 1 },
        uThickness: { value: Math.sqrt(1.07 * 1.07 - 1) / 1.07 },
        uAtmosphere0: { value: pair("atmosphere")[0] },
        uAtmosphere1: { value: pair("atmosphere")[1] },
      },
    });
    const flareMaterial = new ShaderMaterial({
      vertexShader: glsl.flareVertex,
      fragmentShader: glsl.flareFragment,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uStrength: { value: 1 },
        uTerminator: { value: color(palette.terminator[0]) },
      },
    });
    const starCount = phone ? 1200 : 6000;
    const starPositions = new Float32Array(starCount * 3);
    const starSeeds = new Float32Array(starCount);
    const starSizes = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      const direction = new Vector3(
        (Math.random() * 2 - 1) * 1.1,
        (Math.random() * 2 - 1) * 0.75,
        -1,
      ).normalize();
      starPositions.set(direction.multiplyScalar(30).toArray(), i * 3);
      starSeeds[i] = Math.random();
      starSizes[i] = 0.8 + Math.pow(Math.random(), 5) * 2.4;
    }
    const starGeometry = new BufferGeometry();
    starGeometry.setAttribute(
      "position",
      new BufferAttribute(starPositions, 3),
    );
    starGeometry.setAttribute("aSeed", new BufferAttribute(starSeeds, 1));
    starGeometry.setAttribute("aSize", new BufferAttribute(starSizes, 1));
    const starMaterial = new ShaderMaterial({
      vertexShader: glsl.starsVertex,
      fragmentShader: glsl.starsFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uPixelRatio: { value: 1 },
        uTime: { value: 0 },
        uTwinkle: { value: 1 },
        uFade: { value: 1 },
        uStar: { value: color(palette.star[0]) },
      },
    });
    const sphereGeometry = new SphereGeometry(
      1,
      phone ? 64 : 128,
      phone ? 48 : 96,
    );
    const flareGeometry = new PlaneGeometry(1, 1);
    return {
      texture,
      sphere,
      sphereGeometry,
      dots,
      dotGeometry,
      atmosphere,
      flareMaterial,
      flareGeometry,
      starGeometry,
      starMaterial,
    };
    // Not rebuilt on theme: day is a uniform so the switch can crossfade.
  }, [land, phone]);

  const marks = useMemo(() => {
    const nodeGeometry = new BufferGeometry();
    const count = atlas.places.length;
    const position = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const max = Math.max(1, ...atlas.places.map((place) => place.count));
    atlas.places.forEach((place, i) => {
      position.set(toVector(place.latitude, place.longitude, 1.006), i * 3);
      sizes[i] = Math.log(1 + place.count) / Math.log(1 + max);
    });
    nodeGeometry.setAttribute("position", new BufferAttribute(position, 3));
    nodeGeometry.setAttribute("aSize", new BufferAttribute(sizes, 1));
    for (const name of ["aLit", "aLitFrom", "aSelected", "aBorn"])
      nodeGeometry.setAttribute(
        name,
        new BufferAttribute(new Float32Array(count), 1),
      );
    const nodeMaterial = new ShaderMaterial({
      vertexShader: glsl.nodesVertex,
      fragmentShader: glsl.nodesFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uDay: resources.sphere.uniforms.uDay,
        uExposure: resources.sphere.uniforms.uExposure,
        uTime: { value: 0 },
        uLitTime: { value: -10 },
        uPixelRatio: { value: 1 },
        uZoom: { value: 1 },
        uDim: { value: 1 },
        uNode0: { value: color(palette.node[0]) },
        uHot0: { value: color(palette.hot[0]) },
        uNode1: { value: color(palette.node[1]) },
      },
    });
    const arcs = buildArcs(atlas, phone);
    const arcMaterial = new ShaderMaterial({
      vertexShader: glsl.arcsVertex,
      fragmentShader: glsl.arcsFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uDay: resources.sphere.uniforms.uDay,
        uExposure: resources.sphere.uniforms.uExposure,
        uTime: { value: 0 },
        uLitTime: { value: -10 },
        uIntro: { value: 99 },
        uHotTime: { value: -10 },
        uRestart: { value: 0 },
        uPackets: { value: 1 },
        uPacketsAll: { value: phone ? 0 : 1 },
        uFocus: { value: 0 },
        uDim: { value: 1 },
        uArc0: { value: color(palette.arc[0]) },
        uArcHot0: { value: color(palette.arcHot[0]) },
        uArc1: { value: color(palette.arc[1]) },
        uArcHot1: { value: color(palette.arcHot[1]) },
      },
    });
    lit.current = { nodes: [], arcs: [] };
    const anchors = atlas.places.map(
      (place) =>
        new Vector3(...toVector(place.latitude, place.longitude, 1.006)),
    );
    const indexOf = new Map(atlas.places.map((place, i) => [place.id, i]));
    return {
      nodeGeometry,
      nodeMaterial,
      arcGeometry: arcs.geometry,
      perArc: arcs.perArc,
      arcMaterial,
      anchors,
      indexOf,
    };
  }, [atlas, phone, resources]);

  useEffect(
    () => () => {
      for (const value of Object.values(resources))
        (value as { dispose?: () => void } | null)?.dispose?.();
    },
    [resources],
  );
  useEffect(
    () => () => {
      marks.nodeGeometry.dispose();
      marks.nodeMaterial.dispose();
      marks.arcGeometry.dispose();
      marks.arcMaterial.dispose();
    },
    [marks],
  );

  // Year, selection and hover state flow into per-vertex attributes; shaders ease the change.
  useEffect(() => {
    const now = seconds();
    const places = atlas.places;
    const nodeLit = places.map((place) =>
      props.year === null || place.years[props.year] ? 1 : 0,
    );
    const arcLit = atlas.journeys.map((journey) =>
      props.year === null || journey.year === props.year ? 1 : 0,
    );
    const previous = lit.current;
    fill(
      marks.nodeGeometry,
      "aLitFrom",
      previous.nodes.length ? previous.nodes : nodeLit,
      1,
    );
    fill(marks.nodeGeometry, "aLit", nodeLit, 1);
    fill(
      marks.arcGeometry,
      "aLitFrom",
      previous.arcs.length ? previous.arcs : arcLit,
      marks.perArc,
    );
    fill(marks.arcGeometry, "aLit", arcLit, marks.perArc);
    lit.current = { nodes: nodeLit, arcs: arcLit };
    marks.nodeMaterial.uniforms.uLitTime.value = now;
    marks.arcMaterial.uniforms.uLitTime.value = now;
    marks.arcMaterial.uniforms.uRestart.value = now;
    invalidate();
  }, [atlas, marks, props.year, invalidate]);

  useEffect(() => {
    const places = atlas.places;
    fill(
      marks.nodeGeometry,
      "aSelected",
      places.map((place) => (place.id === props.selectedPlace ? 1 : 0)),
      1,
    );
    fill(
      marks.nodeGeometry,
      "aBorn",
      places.map((place) => props.born[place.id] ?? -100),
      1,
    );
    fill(
      marks.arcGeometry,
      "aBorn",
      atlas.journeys.map((journey) =>
        Math.max(
          props.born[journey.from] ?? -100,
          props.born[journey.to] ?? -100,
        ),
      ),
      marks.perArc,
    );
    invalidate();
  }, [atlas, marks, props.selectedPlace, props.born, invalidate]);

  useEffect(() => {
    const hot = props.focusPlace ?? props.selectedPlace;
    fill(
      marks.arcGeometry,
      "aHot",
      atlas.journeys.map((journey) =>
        hot && (journey.from === hot || journey.to === hot) ? 1 : 0,
      ),
      marks.perArc,
    );
    marks.arcMaterial.uniforms.uHotTime.value = seconds();
    marks.arcMaterial.uniforms.uFocus.value = props.focusPlace ? 1 : 0;
    const control = controller.current;
    if (control) control.following = true;
    invalidate();
  }, [
    atlas,
    marks,
    props.focusPlace,
    props.selectedPlace,
    controller,
    invalidate,
  ]);

  useEffect(() => {
    const control = controller.current;
    if (!control) return;
    const now = seconds();
    retarget(control.dive, props.portal ? 1 : 0, now, props.reduced ? 0 : 1.1);
    retarget(control.day, props.day ? 1 : 0, now, props.reduced ? 0 : 0.6);
    if (props.portal) control.following = true;
    invalidate();
  }, [props.portal, props.day, props.reduced, controller, invalidate]);

  useEffect(() => {
    invalidate();
  }, [props.introStart, props.layout, size.width, size.height, invalidate]);

  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => {
      event.preventDefault();
      props.onLost();
    };
    canvas.addEventListener("webglcontextlost", lost);
    return () => canvas.removeEventListener("webglcontextlost", lost);
  }, [gl]);

  const target = useMemo(() => {
    const id = props.focusPlace ?? props.selectedPlace;
    const place = atlas.places.find((item) => item.id === id);
    return place
      ? facing(Math.max(-55, Math.min(60, place.latitude)), place.longitude)
      : null;
  }, [atlas, props.focusPlace, props.selectedPlace]);

  const scratch = useMemo(
    () => ({ vector: new Vector3(), centre: new Vector3() }),
    [],
  );

  useFrame((state, rawDelta) => {
    const control = controller.current;
    const group = globe.current;
    if (!control || !group) return;
    const now = seconds();
    const delta = Math.min(rawDelta, 1 / 20);
    const animate = !props.reduced;
    const { width, height } = size;

    if (!slow.current.done) {
      slow.current.frames++;
      slow.current.total += rawDelta;
      if (slow.current.frames === 90) {
        slow.current.done = true;
        if (slow.current.total / 90 > 1 / 40) setDpr(1);
      }
    }

    // Turning: a k120 c22 m1 spring towards the focused place, or drag inertia.
    let moving = false;
    if (control.dragging) {
      moving = true;
    } else if (target && control.following) {
      if (!animate) {
        control.pitch = target[0];
        control.yaw = control.yaw + shortest(target[1] - control.yaw);
        control.pitchVelocity = control.yawVelocity = 0;
      } else {
        const steps = Math.ceil(delta / (1 / 240));
        const dt = delta / steps;
        for (let i = 0; i < steps; i++) {
          const yawError = shortest(control.yaw - target[1]);
          const pitchError = control.pitch - target[0];
          control.yawVelocity +=
            (-120 * yawError - 22 * control.yawVelocity) * dt;
          control.pitchVelocity +=
            (-120 * pitchError - 22 * control.pitchVelocity) * dt;
          control.yaw += control.yawVelocity * dt;
          control.pitch += control.pitchVelocity * dt;
        }
        moving =
          Math.abs(shortest(control.yaw - target[1])) > 1e-4 ||
          Math.abs(control.pitch - target[0]) > 1e-4 ||
          Math.abs(control.yawVelocity) > 1e-4;
      }
    } else if (
      Math.abs(control.inertiaX) > 1e-4 ||
      Math.abs(control.inertiaY) > 1e-4
    ) {
      control.yaw += control.inertiaX * delta;
      control.pitch = Math.max(
        -1.2,
        Math.min(1.2, control.pitch + control.inertiaY * delta),
      );
      const decay = Math.exp(-delta * 3.2);
      control.inertiaX *= decay;
      control.inertiaY *= decay;
      moving = true;
    } else if (!atlas.places.length && animate) {
      control.yaw += SPIN_IDLE * delta;
      moving = true;
    }
    group.rotation.set(control.pitch, control.yaw, 0, "XYZ");

    // Intro beats, in seconds since the intro started.
    const intro =
      props.introStart === null || !animate ? 99 : now - props.introStart;
    const clamp = (value: number) => Math.min(1, Math.max(0, value));
    const rise = ease.reveal(clamp((intro - 1.4) / 1.6));
    const swell = ease.arrive(clamp((intro - 1.8) / 1.2));
    const starIn = ease.arrive(clamp(intro / 0.6));
    group.scale.setScalar(0.92 + 0.08 * rise);

    // Camera: frame, user zoom and the portal dive.
    control.zoom +=
      (control.zoomTarget - control.zoom) * (1 - Math.exp(-delta * 10));
    const dive = tweenValue(control.dive, now, ease.camera);
    const day = tweenValue(control.day, now, ease.arrive);
    const orbit = frameFor(props.layout, width, height, false, props.framing);
    const landed = frameFor(props.layout, width, height, true, props.framing);
    const wanted = {
      x: orbit.x + (landed.x - orbit.x) * dive,
      y: orbit.y + (landed.y - orbit.y) * dive + height * 0.18 * (1 - rise),
      r: orbit.r * control.zoom,
    };
    if (!control.frame || !animate) control.frame = { ...wanted };
    else {
      const k = 1 - Math.exp(-delta * 9);
      control.frame.x += (wanted.x - control.frame.x) * k;
      control.frame.y += (wanted.y - control.frame.y) * k;
      control.frame.r += (wanted.r - control.frame.r) * k;
    }
    const frame = control.frame;
    const perspective = camera as PerspectiveCamera;
    perspective.fov = FOV + (DIVE_FOV - FOV) * dive;
    const focal = height / 2 / Math.tan((perspective.fov * Math.PI) / 360);
    const orbitDistance = 1 / Math.sin(Math.atan(frame.r / focal));
    const distance = orbitDistance + (DIVE_DISTANCE - orbitDistance) * dive;
    perspective.position.set(0, 0, distance);
    perspective.near = 0.01;
    perspective.far = 100;
    perspective.lookAt(0, 0, 0);
    perspective.setViewOffset(
      width,
      height,
      -(frame.x - width / 2),
      -(frame.y - height / 2),
      width,
      height,
    );
    perspective.updateProjectionMatrix();

    // Uniforms.
    const exposure = props.introStart === null || !animate ? 1 : rise;
    const pixelRatio = state.gl.getPixelRatio();
    const { sphere, dots, atmosphere, starMaterial, flareMaterial } = resources;
    sphere.uniforms.uDay.value = day;
    sphere.uniforms.uExposure.value = exposure;
    dots.uniforms.uMaxSize.value = 11 * pixelRatio;
    dots.uniforms.uScale.value =
      (height * pixelRatio) / (2 * Math.tan((perspective.fov * Math.PI) / 360));
    atmosphere.uniforms.uBreath.value =
      (0.25 + 0.75 * swell) * (1 - 0.4 * dive);
    starMaterial.uniforms.uTime.value = now;
    starMaterial.uniforms.uTwinkle.value = animate ? 1 : 0;
    starMaterial.uniforms.uFade.value =
      (1 - day) * (props.introStart === null || !animate ? 1 : starIn);
    starMaterial.uniforms.uPixelRatio.value = pixelRatio;
    marks.nodeMaterial.uniforms.uTime.value = now;
    marks.nodeMaterial.uniforms.uPixelRatio.value = pixelRatio;
    marks.nodeMaterial.uniforms.uZoom.value = Math.min(
      1.4,
      Math.max(0.7, frame.r / 420),
    );
    marks.nodeMaterial.uniforms.uDim.value = 1 - 0.8 * dive;
    marks.arcMaterial.uniforms.uTime.value = now;
    marks.arcMaterial.uniforms.uIntro.value = intro;
    marks.arcMaterial.uniforms.uPackets.value = animate ? 1 : 0;
    marks.arcMaterial.uniforms.uDim.value = 1 - 0.92 * dive;
    if (stars.current)
      stars.current.rotation.set(control.pitch * 0.04, control.yaw * 0.04, 0);

    // The sun flare sits on the limb in the sun's direction.
    if (flare.current) {
      const sun = sphere.uniforms.uSun.value as Vector3;
      const scale = group.scale.x;
      const rim =
        scale *
        Math.sqrt(Math.max(0, 1 - (scale * scale) / (distance * distance)));
      const direction = scratch.vector.set(sun.x, sun.y, 0).normalize();
      flare.current.position.set(
        direction.x * rim,
        direction.y * rim,
        (scale * scale) / distance,
      );
      flare.current.scale.setScalar(0.9 * scale);
      flareMaterial.uniforms.uStrength.value =
        (1 - day) *
        swell *
        (1 - dive) *
        (props.introStart === null || !animate ? 1 : exposure);
    }

    // Screen positions for labels, reticle, preview card and picking.
    group.updateMatrixWorld();
    const visibleLimit = 1 / distance;
    control.screens = marks.anchors.map((anchor) => {
      const world = scratch.vector.copy(anchor).applyMatrix4(group.matrixWorld);
      const normal = scratch.centre.copy(world).normalize();
      const visible = Math.min(
        1,
        Math.max(0, (normal.z - visibleLimit) / 0.12),
      );
      world.project(perspective);
      return {
        x: ((world.x + 1) / 2) * width,
        y: ((1 - world.y) / 2) * height,
        visible,
      };
    });
    const layer = overlay.current;
    if (layer) {
      // Labels are placed greedily, selected first, and skip any spot already taken.
      const placed: [number, number, number, number][] = [];
      const elements = Array.from(
        layer.querySelectorAll<HTMLElement>("[data-place]"),
      ).sort((a, b) => rank(a) - rank(b));
      for (const element of elements) {
        const screen =
          control.screens[marks.indexOf.get(element.dataset.place!) ?? -1];
        if (!screen) continue;
        let show = screen.visible * (1 - dive);
        if (element.classList.contains("globe-label") && show > 0.01) {
          const label = element.firstElementChild as HTMLElement | null;
          if (label && !element.dataset.width)
            element.dataset.width = String(
              label.offsetLeft + label.offsetWidth,
            );
          const box: [number, number, number, number] = [
            screen.x - 6,
            screen.y - 9,
            screen.x + Number(element.dataset.width || 80),
            screen.y + 9,
          ];
          const clash = placed.some(
            (other) =>
              box[0] < other[2] &&
              box[2] > other[0] &&
              box[1] < other[3] &&
              box[3] > other[1],
          );
          if (clash) show = 0;
          else placed.push(box);
        }
        element.style.transform = `translate3d(${screen.x.toFixed(1)}px, ${screen.y.toFixed(1)}px, 0)`;
        element.style.opacity = (
          show * (exposure > 0.98 ? 1 : exposure)
        ).toFixed(2);
        element.style.visibility = show > 0.01 ? "visible" : "hidden";
      }
    }

    if (!ready.current) {
      ready.current = true;
      setTimeout(props.onReady, 0);
    }
    const tweening =
      now - control.dive.start < control.dive.duration + 0.05 ||
      now - control.day.start < control.day.duration + 0.05 ||
      Math.abs(control.zoom - control.zoomTarget) > 1e-3 ||
      Math.abs(frame.x - wanted.x) +
        Math.abs(frame.y - wanted.y) +
        Math.abs(frame.r - wanted.r) >
        0.2;
    if (props.reduced && (moving || tweening)) invalidate();
  });

  return (
    <>
      <group ref={stars}>
        <points
          geometry={resources.starGeometry}
          material={resources.starMaterial}
          renderOrder={-1}
          frustumCulled={false}
        />
      </group>
      <group ref={globe}>
        <mesh
          geometry={resources.sphereGeometry}
          material={resources.sphere}
          renderOrder={0}
        />
        <points
          geometry={resources.dotGeometry}
          material={resources.dots}
          renderOrder={1}
          frustumCulled={false}
        />
        <mesh
          geometry={marks.arcGeometry}
          material={marks.arcMaterial}
          renderOrder={2}
          frustumCulled={false}
        />
        <points
          geometry={marks.nodeGeometry}
          material={marks.nodeMaterial}
          renderOrder={3}
          frustumCulled={false}
        />
        <mesh
          geometry={resources.sphereGeometry}
          material={resources.atmosphere}
          scale={1.07}
          renderOrder={4}
        />
      </group>
      <mesh
        ref={flare}
        geometry={resources.flareGeometry}
        material={resources.flareMaterial}
        renderOrder={5}
      />
    </>
  );
}

function Overlay({
  places,
  selected,
  focus,
  thumbnails,
  overlay,
}: {
  places: PlaceNode[];
  selected: string | null;
  focus: string | null;
  thumbnails: GlobeProps["thumbnails"];
  overlay: RefObject<HTMLDivElement | null>;
}) {
  const target = focus ?? selected;
  const preview = focus && focus !== selected ? thumbnails[focus] : undefined;
  return (
    <div className="globe-overlay" ref={overlay} aria-hidden="true">
      {places
        .filter((place) => !(preview && place.id === focus))
        .map((place) => (
          <span
            key={place.id}
            className={`globe-label ${place.id === selected ? "is-selected" : ""} ${place.id === focus ? "is-focus" : ""}`}
            data-place={place.id}
          >
            <span>
              {place.name}
              {place.id === selected ? ` · ${place.count}` : ""}
            </span>
          </span>
        ))}
      {target && (
        <span
          className="globe-reticle"
          data-place={target}
          key={`reticle-${target}`}
        >
          <svg viewBox="0 0 64 64" width="64" height="64">
            <circle className="reticle-ring" cx="32" cy="32" r="15" />
            <path
              className="reticle-corners"
              d="M10 18v-8h8M46 10h8v8M54 46v8h-8M18 54h-8v-8"
            />
          </svg>
        </span>
      )}
      {preview && focus && (
        <span
          className="globe-preview"
          data-place={focus}
          key={`preview-${focus}`}
        >
          <span className="globe-preview-card">
            <img src={preview.src} alt="" />
            <span>
              <b>{preview.title}</b>
              <span>{preview.meta}</span>
            </span>
          </span>
        </span>
      )}
    </div>
  );
}

export default function Globe(props: GlobeProps) {
  const controller = useRef<Controller>(null) as RefObject<Controller>;
  if (!controller.current) {
    const start = props.atlas.places.find(
      (place) => place.id === props.selectedPlace,
    );
    const [pitch, yaw] = start
      ? facing(start.latitude, start.longitude)
      : [0.35, -0.4];
    controller.current = {
      pitch,
      yaw,
      pitchVelocity: 0,
      yawVelocity: 0,
      following: true,
      dragging: false,
      inertiaX: 0,
      inertiaY: 0,
      zoom: 1,
      zoomTarget: 1,
      dive: {
        from: props.portal ? 1 : 0,
        to: props.portal ? 1 : 0,
        start: 0,
        duration: 0,
      },
      day: {
        from: props.day ? 1 : 0,
        to: props.day ? 1 : 0,
        start: 0,
        duration: 0,
      },
      frame: null,
      screens: [],
    };
  }
  const overlay = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const phone = props.layout === "phone" || props.layout === "tablet";
  const labelPlaces = useMemo(() => {
    const top = [...props.atlas.places]
      .sort((a, b) => b.count - a.count)
      .slice(0, phone ? 6 : 12);
    for (const id of [props.selectedPlace, props.focusPlace]) {
      const place = props.atlas.places.find((item) => item.id === id);
      if (place && !top.includes(place)) top.push(place);
    }
    return top;
  }, [props.atlas, props.selectedPlace, props.focusPlace, phone]);
  const pick = useRef(props.onPick);
  pick.current = props.onPick;

  // Drag to turn with inertia, wheel or pinch to zoom, tap a node to pick it.
  useEffect(() => {
    const element = root.current;
    if (!element || props.interactive === false) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let start = { x: 0, y: 0, time: 0 };
    let travelled = 0;
    let pinch = 0;
    let last = { x: 0, y: 0, time: 0 };
    const control = () => controller.current;
    const nearest = (x: number, y: number) => {
      const rect = element.getBoundingClientRect();
      let best = -1;
      let distance = 22;
      control().screens.forEach((screen, i) => {
        if (screen.visible < 0.3) return;
        const d = Math.hypot(
          screen.x - (x - rect.left),
          screen.y - (y - rect.top),
        );
        if (d < distance) {
          distance = d;
          best = i;
        }
      });
      return best;
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      element.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
      start = last = {
        x: event.clientX,
        y: event.clientY,
        time: performance.now(),
      };
      travelled = 0;
      const state = control();
      state.inertiaX = state.inertiaY = 0;
    };
    const move = (event: PointerEvent) => {
      const state = control();
      if (!pointers.has(event.pointerId)) {
        element.style.cursor =
          nearest(event.clientX, event.clientY) >= 0 ? "pointer" : "grab";
        return;
      }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const span = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch)
          state.zoomTarget = Math.max(
            0.75,
            Math.min(1.9, state.zoomTarget * (span / pinch)),
          );
        pinch = span;
        travelled = 99;
        return;
      }
      const dx = event.clientX - last.x;
      const dy = event.clientY - last.y;
      travelled += Math.abs(dx) + Math.abs(dy);
      if (travelled < 4) return;
      const r = state.frame?.r || 300;
      state.dragging = true;
      state.following = false;
      element.style.cursor = "grabbing";
      const now = performance.now();
      const dt = Math.max(1, now - last.time) / 1000;
      state.yaw += dx / r;
      state.pitch = Math.max(-1.2, Math.min(1.2, state.pitch + dy / r));
      state.inertiaX = (dx / r / dt) * 0.6 + state.inertiaX * 0.4;
      state.inertiaY = (dy / r / dt) * 0.6 + state.inertiaY * 0.4;
      last = { x: event.clientX, y: event.clientY, time: now };
    };
    const up = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.delete(event.pointerId);
      const state = control();
      if (pointers.size) return;
      pinch = 0;
      if (state.dragging) {
        state.dragging = false;
        if (performance.now() - last.time > 80)
          state.inertiaX = state.inertiaY = 0;
        element.style.cursor = "grab";
      } else if (travelled < 4 && performance.now() - start.time < 600) {
        const index = nearest(event.clientX, event.clientY);
        const place = props.atlas.places[index];
        if (place) pick.current(place.id);
      }
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const state = control();
      state.zoomTarget = Math.max(
        0.75,
        Math.min(1.9, state.zoomTarget * Math.exp(-event.deltaY * 0.0015)),
      );
    };
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", up);
    element.addEventListener("wheel", wheel, { passive: false });
    return () => {
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", up);
      element.removeEventListener("wheel", wheel);
    };
  }, [props.atlas, props.interactive]);

  return (
    <div
      className={`globe-root${props.interactive === false ? " is-static" : ""}`}
      ref={root}
    >
      <div className="globe-canvas" aria-hidden="true">
        <Canvas
          frameloop={
            !props.active ? "never" : props.reduced ? "demand" : "always"
          }
          dpr={[1, phone ? 1.5 : 2]}
          camera={{ position: [0, 0, 3.2], fov: FOV, near: 0.01, far: 100 }}
          gl={{
            antialias: !phone,
            alpha: true,
            powerPreference: "high-performance",
          }}
          style={{ touchAction: props.interactive === false ? "auto" : "none" }}
        >
          <Scene {...props} controller={controller} overlay={overlay} />
        </Canvas>
      </div>
      <Overlay
        places={labelPlaces}
        selected={props.selectedPlace}
        focus={props.focusPlace}
        thumbnails={props.thumbnails}
        overlay={overlay}
      />
    </div>
  );
}
