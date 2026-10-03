import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
} from "three";
import { memories } from "./memories";

function point(longitude: number, latitude: number, offset = 0) {
  const r = 5 + offset;
  return new Vector3(
    r * Math.cos(latitude) * Math.sin(longitude),
    r * Math.sin(latitude),
    r * Math.cos(latitude) * Math.cos(longitude) - 4.7,
  );
}
function ChartGrid() {
  const geometry = useMemo(() => {
    const vertices: number[] = [];
    const segment = (a: Vector3, b: Vector3) =>
      vertices.push(...a.toArray(), ...b.toArray());
    for (let x = -16; x <= 16; x++)
      for (let y = 0; y < 64; y++)
        segment(
          point(x / 16, -0.9 + (y * 1.8) / 64),
          point(x / 16, -0.9 + ((y + 1) * 1.8) / 64),
        );
    for (let y = -14; y <= 14; y++)
      for (let x = 0; x < 64; x++)
        segment(point(-1 + x / 32, y / 16), point(-1 + (x + 1) / 32, y / 16));
    return new BufferGeometry().setAttribute(
      "position",
      new Float32BufferAttribute(vertices, 3),
    );
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#496c87" transparent opacity={0.3} />
    </lineSegments>
  );
}
function MemoryPlane({
  index,
  selected,
  onSelect,
}: {
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const memory = memories[index];
  const texture = useLoader(TextureLoader, memory.photos[0].src);
  texture.colorSpace = SRGBColorSpace;
  const longitude = [0.07, -0.22, 0.18][index];
  const latitude = [0.43, 0.015, -0.43][index];
  const position = point(longitude, latitude, 0.11);
  return (
    <group position={position} rotation={[-latitude, longitude, 0]}>
      <mesh
        position={[0, 0, -0.025]}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(memory.id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <planeGeometry args={[selected ? 2.04 : 1.85, selected ? 1.4 : 1.27]} />
        <meshBasicMaterial color={selected ? "#e7a369" : "#466079"} />
      </mesh>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect(memory.id);
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <planeGeometry args={[selected ? 1.95 : 1.78, selected ? 1.3 : 1.19]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.86, 0]}>
        <circleGeometry args={[0.055, 16]} />
        <meshBasicMaterial color={selected ? "#f3b577" : "#9b775c"} />
      </mesh>
    </group>
  );
}
function Scene({
  selected,
  onSelect,
  reduced,
  visible,
  onReady,
  onLost,
}: {
  selected: string;
  onSelect: (id: string) => void;
  reduced: boolean;
  visible: boolean;
  onReady: () => void;
  onLost: () => void;
}) {
  const group = useRef<Group>(null);
  const { gl, invalidate, setFrameloop } = useThree();
  const target = (memories.findIndex((m) => m.id === selected) - 1) * 0.055;
  useEffect(() => {
    setFrameloop(visible ? "demand" : "never");
    if (visible) invalidate();
  }, [visible, setFrameloop, invalidate]);
  useEffect(() => {
    invalidate();
  }, [target, reduced, invalidate]);
  useEffect(() => {
    onReady();
    const canvas = gl.domElement;
    const lost = (event: Event) => {
      event.preventDefault();
      onLost();
    };
    canvas.addEventListener("webglcontextlost", lost);
    return () => {
      canvas.removeEventListener("webglcontextlost", lost);
      document.body.style.cursor = "";
    };
  }, [gl, onReady, onLost]);
  useFrame((_, delta) => {
    if (!group.current) return;
    const difference = target - group.current.rotation.y;
    group.current.rotation.y =
      reduced || Math.abs(difference) < 0.0001
        ? target
        : group.current.rotation.y +
          difference * (1 - Math.exp(-12 * Math.min(delta, 0.05)));
    if (!reduced && Math.abs(difference) >= 0.0001) invalidate();
  });
  return (
    <group ref={group} rotation={[0, 0, -0.055]}>
      <ambientLight intensity={1.2} />
      <directionalLight position={[2, 6, 5]} intensity={2} />
      <mesh position={[0, 0, -4.7]}>
        <sphereGeometry args={[4.98, 64, 48]} />
        <meshStandardMaterial color="#0d263a" roughness={0.9} metalness={0.2} />
      </mesh>
      <ChartGrid />
      {memories.map((memory, i) => (
        <MemoryPlane
          key={memory.id}
          index={i}
          selected={selected === memory.id}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}
class SceneBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
export default function Atlas({
  selected,
  onSelect,
  reduced,
}: {
  selected: string;
  onSelect: (id: string) => void;
  reduced: boolean;
}) {
  const [failed, setFailed] = useState(
    () => new URLSearchParams(location.search).get("scene") === "off",
  );
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [visible, setVisible] = useState(!document.hidden);
  const region = useRef<HTMLDivElement>(null);
  const callbacks = useMemo(
    () => ({ ready: () => setReady(true), lost: () => setFailed(true) }),
    [],
  );
  useEffect(() => {
    let intersecting = true;
    const update = () => setVisible(intersecting && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      update();
    });
    if (region.current) observer.observe(region.current);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return (
    <div className="atlas-scene" ref={region}>
      {failed ? (
        <div className="flat-atlas">
          <p>The atlas is in flat view.</p>
          <p>Choose a dated memory below.</p>
          <button
            onClick={() => {
              setFailed(false);
              setReady(false);
              setAttempt((a) => a + 1);
            }}
          >
            Retry 3D view
          </button>
        </div>
      ) : (
        <>
          {!ready && (
            <p className="scene-loading" role="status">
              Drawing your atlas…
            </p>
          )}
          <div className="canvas-wrap" aria-hidden="true">
            <SceneBoundary key={attempt} onError={callbacks.lost}>
              <Canvas
                frameloop="demand"
                dpr={[1, 1.5]}
                camera={{ position: [0, 0, 11], fov: 43 }}
                gl={{
                  antialias: true,
                  alpha: true,
                  powerPreference: "low-power",
                }}
                fallback={<span>3D unavailable. Choose a memory below.</span>}
              >
                <Suspense fallback={null}>
                  <Scene
                    selected={selected}
                    onSelect={onSelect}
                    reduced={reduced}
                    visible={visible}
                    onReady={callbacks.ready}
                    onLost={callbacks.lost}
                  />
                </Suspense>
              </Canvas>
            </SceneBoundary>
          </div>
          <div className="atlas-years">
            {memories.map((memory) => (
              <button
                key={memory.id}
                aria-label={`Show ${memory.date}`}
                aria-pressed={selected === memory.id}
                onClick={() => onSelect(memory.id)}
              >
                {memory.year}
                <span />
              </button>
            ))}
          </div>
        </>
      )}
      <div className="atlas-foot">
        <span>Browse through time</span>
        <p>Select a photograph or a memory below.</p>
      </div>
    </div>
  );
}
