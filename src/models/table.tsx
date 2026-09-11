import { useFrame } from "@react-three/fiber";
import type { ThreeElements } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Object3D,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
} from "three";
import type { InstancedMesh, PointLight, Sprite } from "three";
import { getGlowTexture } from "../utils/glow";

type TableProps = ThreeElements["group"];

const TOP_Y = 0.076;
const FLOOR_Y = -4;
const TABLE_RADIUS = 4.25;
const PETAL_COUNT = 180;
const PETAL_SHADES = ["#8b0f24", "#b0182f", "#6e0a1b", "#c9304a"];

// Angles (degrees) chosen to sit between the photo frames and the card.
const TEA_LIGHTS = [15, 55, 160, 200, 250, 335].map((deg, i) => {
  const angle = (deg * Math.PI) / 180;
  return {
    position: [Math.cos(angle) * 2.3, TOP_Y, Math.sin(angle) * 2.3] as [number, number, number],
    phase: i * 1.7,
    withLight: i % 2 === 0,
  };
});

// An open cylinder from the table edge to the floor, flared and rippled so the
// cloth looks like it hangs in folds.
function createDrapeGeometry() {
  const height = TOP_Y - FLOOR_Y;
  const geometry = new CylinderGeometry(TABLE_RADIUS, TABLE_RADIUS, height, 160, 16, true);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    // 0 at the table edge, 1 at the floor; clamped because float error can
    // dip below 0 and Math.pow of a negative base is NaN.
    const t = Math.max(0, 0.5 - y / height);
    const angle = Math.atan2(z, x);
    const spread = 1 + t * 0.07 + Math.sin(angle * 22) * 0.03 * Math.pow(t, 0.7);
    position.setXYZ(i, x * spread, y, z * spread);
  }
  geometry.computeVertexNormals();
  geometry.translate(0, TOP_Y - height / 2, 0);
  return geometry;
}

const GINGHAM_WHITE = "#fbfcff";
// Stronger than the reference's light blue: the purple moonlight greys it out.
const GINGHAM_BLUE = "rgba(70, 135, 225, 0.6)";
const CHECK_SIZE = 0.12; // world units per check

// One 2×2-check tile of blue-and-white gingham: a blue band each way, and a
// darker square where the two bands cross.
function createGinghamTile() {
  const size = 64;
  const half = size / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = GINGHAM_WHITE;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = GINGHAM_BLUE;
  ctx.fillRect(0, 0, size, half);
  ctx.fillRect(0, 0, half, size);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

function createClothTextures() {
  const tile = createGinghamTile();
  const tileSize = CHECK_SIZE * 2;
  const top = tile.clone();
  top.repeat.set((TABLE_RADIUS * 2) / tileSize, (TABLE_RADIUS * 2) / tileSize);
  top.needsUpdate = true;
  const drape = tile.clone();
  // Whole tiles around the circumference so the pattern meets at the seam.
  drape.repeat.set(Math.round((Math.PI * 2 * TABLE_RADIUS) / tileSize), (TOP_Y - FLOOR_Y) / tileSize);
  drape.needsUpdate = true;
  return { tile, top, drape };
}

function GinghamMaterial({ map }: { map: CanvasTexture }) {
  return <meshStandardMaterial map={map} roughness={0.85} side={DoubleSide} />;
}

function RosePetals() {
  const ref = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => {
    // A shallow spherical cap reads as a curled petal once flattened.
    const cap = new SphereGeometry(0.09, 10, 6, 0, Math.PI * 2, 0, 0.7);
    cap.translate(0, -0.09 * Math.cos(0.7), 0);
    cap.scale(1, 0.35, 0.75);
    return cap;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) {
      return;
    }
    const dummy = new Object3D();
    const color = new Color();
    for (let i = 0; i < PETAL_COUNT; i += 1) {
      const radius = 1.9 + Math.sqrt(Math.random()) * (TABLE_RADIUS - 2.2);
      const angle = Math.random() * Math.PI * 2;
      dummy.position.set(Math.cos(angle) * radius, TOP_Y + 0.008, Math.sin(angle) * radius);
      dummy.rotation.set(
        Math.PI + (Math.random() - 0.5) * 0.4,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.4
      );
      dummy.scale.setScalar(0.7 + Math.random() * 0.6);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.set(PETAL_SHADES[i % PETAL_SHADES.length]));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, []);

  return (
    <instancedMesh ref={ref} args={[geometry, undefined, PETAL_COUNT]}>
      <meshStandardMaterial roughness={0.6} side={DoubleSide} />
    </instancedMesh>
  );
}

type TeaLightProps = {
  position: [number, number, number];
  phase: number;
  withLight: boolean;
};

function TeaLight({ position, phase, withLight }: TeaLightProps) {
  const glowRef = useRef<Sprite>(null);
  const lightRef = useRef<PointLight>(null);
  const glow = useMemo(() => getGlowTexture(), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase;
    const flicker = 1 + Math.sin(t * 11) * 0.08 + Math.sin(t * 17.3) * 0.05;
    glowRef.current?.scale.setScalar(0.35 * flicker);
    if (lightRef.current) {
      lightRef.current.intensity = 3 * flicker;
    }
  });

  return (
    <group position={position}>
      <mesh position={[0, 0.065, 0]}>
        <cylinderGeometry args={[0.09, 0.085, 0.13, 20, 1, true]} />
        <meshStandardMaterial color="#ffc2cc" transparent opacity={0.35} roughness={0.1} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0.045, 0]}>
        <cylinderGeometry args={[0.075, 0.075, 0.08, 20]} />
        <meshStandardMaterial color="#fff4e6" emissive="#ffb070" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 0.11, 0]}>
        <coneGeometry args={[0.012, 0.045, 8]} />
        <meshBasicMaterial color="#ffd27a" toneMapped={false} />
      </mesh>
      <sprite ref={glowRef} position={[0, 0.115, 0]} scale={0.35}>
        <spriteMaterial
          map={glow}
          color="#ffb35c"
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </sprite>
      {withLight && (
        <pointLight ref={lightRef} position={[0, 0.25, 0]} color="#ffa24d" distance={2.5} decay={1.5} />
      )}
    </group>
  );
}

export function Table({ children, ...groupProps }: TableProps) {
  const drape = useMemo(createDrapeGeometry, []);
  useEffect(() => () => drape.dispose(), [drape]);
  const cloth = useMemo(createClothTextures, []);
  useEffect(
    () => () => {
      cloth.tile.dispose();
      cloth.top.dispose();
      cloth.drape.dispose();
    },
    [cloth]
  );

  return (
    <group {...groupProps}>
      <mesh position={[0, TOP_Y - 0.015, 0]}>
        <cylinderGeometry args={[TABLE_RADIUS, TABLE_RADIUS, 0.03, 160]} />
        <GinghamMaterial map={cloth.top} />
      </mesh>
      <mesh geometry={drape}>
        <GinghamMaterial map={cloth.drape} />
      </mesh>
      <RosePetals />
      {TEA_LIGHTS.map((light) => (
        <TeaLight key={light.phase} {...light} />
      ))}
      {children}
    </group>
  );
}
