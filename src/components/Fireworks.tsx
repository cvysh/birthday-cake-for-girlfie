import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  MathUtils,
  PointsMaterial,
  Vector3,
} from "three";
import { getGlowTexture } from "../utils/glow";

type FireworksProps = {
  isActive: boolean;
  origin?: [number, number, number];
};

const FIREWORK_COUNT = 24;
const PARTICLES_PER_FIREWORK = 80;
const TOTAL_PARTICLES = FIREWORK_COUNT * PARTICLES_PER_FIREWORK;
const GRAVITY = -3;
const DRAG = 1.2;

// Bursts go off in a ring around the scene, far enough to feel like a sky
// show but close enough to stay inside the camera's view.
const MIN_RADIUS = 50;
const MAX_RADIUS = 130;
const MIN_HEIGHT = 5;
const MAX_HEIGHT = 35;

type FireworkData = {
  positions: Float32Array;
  velocities: Float32Array;
  colors: Float32Array;
  baseColors: Float32Array;
  origins: Float32Array; // one xyz per firework
  ages: Float32Array; // one per firework; negative = waiting to launch
  lifetimes: Float32Array; // one per firework
};

const randomColor = () =>
  new Color().setHSL(Math.random(), 0.7 + Math.random() * 0.2, 0.62);

function launchFirework(data: FireworkData, firework: number, center: Vector3) {
  const angle = Math.random() * Math.PI * 2;
  const radius = MIN_RADIUS + Math.random() * (MAX_RADIUS - MIN_RADIUS);
  const ox = center.x + Math.cos(angle) * radius;
  const oy = center.y + MIN_HEIGHT + Math.random() * (MAX_HEIGHT - MIN_HEIGHT);
  const oz = center.z + Math.sin(angle) * radius;
  data.origins.set([ox, oy, oz], firework * 3);

  const color = randomColor();
  const speed = 5 + Math.random() * 3;
  const first = firework * PARTICLES_PER_FIREWORK;

  for (let p = first; p < first + PARTICLES_PER_FIREWORK; p += 1) {
    // Uniform direction on a sphere, with a little speed jitter per spark.
    const theta = Math.random() * Math.PI * 2;
    const cosPhi = Math.random() * 2 - 1;
    const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
    const sparkSpeed = speed * (0.85 + Math.random() * 0.3);
    data.velocities.set(
      [sinPhi * Math.cos(theta) * sparkSpeed, cosPhi * sparkSpeed, sinPhi * Math.sin(theta) * sparkSpeed],
      p * 3
    );
    data.baseColors.set([color.r, color.g, color.b], p * 3);
    data.colors.set([0, 0, 0], p * 3);
    data.positions.set([ox, oy, oz], p * 3);
  }

  data.lifetimes[firework] = 1.8 + Math.random() * 0.8;
  data.ages[firework] = -Math.random() * 2.5;
}

export function Fireworks({ isActive, origin = [0, 5, -14] }: FireworksProps) {
  const geometryRef = useRef<BufferGeometry>(null);
  const materialRef = useRef<PointsMaterial>(null);
  const dataRef = useRef<FireworkData | null>(null);
  const baseOrigin = useMemo(() => new Vector3(...origin), [origin]);
  const glow = useMemo(() => getGlowTexture(), []);

  if (!dataRef.current) {
    dataRef.current = {
      positions: new Float32Array(TOTAL_PARTICLES * 3),
      velocities: new Float32Array(TOTAL_PARTICLES * 3),
      colors: new Float32Array(TOTAL_PARTICLES * 3),
      baseColors: new Float32Array(TOTAL_PARTICLES * 3),
      origins: new Float32Array(FIREWORK_COUNT * 3),
      ages: new Float32Array(FIREWORK_COUNT),
      lifetimes: new Float32Array(FIREWORK_COUNT),
    };
  }

  useEffect(() => {
    const data = dataRef.current!;
    for (let f = 0; f < FIREWORK_COUNT; f += 1) {
      launchFirework(data, f, baseOrigin);
    }
  }, [baseOrigin]);

  useFrame((_, delta) => {
    const geometry = geometryRef.current;
    const material = materialRef.current;
    const data = dataRef.current;

    if (!geometry || !material || !data) {
      return;
    }

    if (!isActive) {
      material.opacity = MathUtils.damp(material.opacity, 0, 5, delta);
      return;
    }

    material.opacity = MathUtils.damp(material.opacity, 0.95, 2.5, delta);

    const { positions, velocities, colors, baseColors, origins, ages, lifetimes } = data;

    for (let f = 0; f < FIREWORK_COUNT; f += 1) {
      ages[f] += delta;
      if (ages[f] > lifetimes[f]) {
        launchFirework(data, f, baseOrigin);
        continue;
      }

      const age = ages[f];
      if (age < 0) {
        continue;
      }

      // Exponential drag: sparks burst fast, then hang and fall.
      const travel = (1 - Math.exp(-DRAG * age)) / DRAG;
      const drop = 0.5 * GRAVITY * age * age;
      const fade = Math.pow(Math.max(0, 1 - age / lifetimes[f]), 1.5);
      const [ox, oy, oz] = [origins[f * 3], origins[f * 3 + 1], origins[f * 3 + 2]];
      const first = f * PARTICLES_PER_FIREWORK;

      for (let p = first; p < first + PARTICLES_PER_FIREWORK; p += 1) {
        const i3 = p * 3;
        positions[i3] = ox + velocities[i3] * travel;
        positions[i3 + 1] = oy + velocities[i3 + 1] * travel + drop;
        positions[i3 + 2] = oz + velocities[i3 + 2] * travel;
        colors[i3] = baseColors[i3] * fade;
        colors[i3 + 1] = baseColors[i3 + 1] * fade;
        colors[i3 + 2] = baseColors[i3 + 2] * fade;
      }
    }

    (geometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
    (geometry.getAttribute("color") as BufferAttribute).needsUpdate = true;
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute attach="attributes-position" args={[dataRef.current.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[dataRef.current.colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={materialRef}
        map={glow}
        size={2.2}
        transparent
        vertexColors
        depthWrite={false}
        blending={AdditiveBlending}
        opacity={0}
        sizeAttenuation
        fog={false}
      />
    </points>
  );
}
