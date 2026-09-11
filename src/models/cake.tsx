import type { ThreeElements } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { CanvasTexture, CylinderGeometry, SRGBColorSpace, TorusGeometry } from "three";

type CakeProps = ThreeElements["group"];

// A single tall buttercream cake on a card board. The top surface sits at
// y = 1.1, where App.tsx drops the candle.
const BOARD_Y = 0.08;
const BOARD_HEIGHT = 0.03;
const CAKE_BOTTOM = BOARD_Y + BOARD_HEIGHT;
const TOP_Y = 1.1;
const RADIUS = 1.3;

const FROSTING = "#f4edcc";
const PIPING = "#1b1412";
const HAND_FONT = '"Marker Felt", "Chalkboard SE", "Segoe Print", "Comic Sans MS", cursive';
const TOP_TEXTURE_SIZE = 2048;

// Top-texture layout, in fractions of the texture. The texture is turned so
// its top edge faces away from the opening camera; the top-right corner is
// left empty for the candle (see CANDLE_SPOT in App.tsx).
const MESSAGE = [
  { text: "HAPPY", x: 0.24, y: 0.2, size: 0.1, tilt: -0.04 },
  { text: "Birthday!", x: 0.3, y: 0.3, size: 0.1, tilt: -0.02 },
  { text: "Get", x: 0.24, y: 0.41, size: 0.11, tilt: 0.01 },
  { text: "Schwifty", x: 0.3, y: 0.51, size: 0.12, tilt: -0.01 },
];

// Deterministic pseudo-random so the frosting strokes never reshuffle.
const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

// ---------------------------------------------------------------------------
// Cartoon cut-outs, drawn in a unit space centred on the face (y points down).

type Path = (ctx: CanvasRenderingContext2D) => void;
type CutOutShape = { path: Path; fill?: string; line?: number };
type Point = [number, number];

const ellipse = (cx: number, cy: number, rx: number, ry: number): Path => (ctx) => {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
};

const poly = (points: Point[], closed = true): Path => (ctx) => {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  if (closed) {
    ctx.closePath();
  }
};

const curve = ([start, control, end]: [Point, Point, Point]): Path => (ctx) => {
  ctx.beginPath();
  ctx.moveTo(...start);
  ctx.quadraticCurveTo(...control, ...end);
};

const spikes = (cx: number, cy: number, inner: number, outer: number, fromDeg: number, toDeg: number, count: number): Path =>
  (ctx) => {
    ctx.beginPath();
    for (let i = 0; i <= count * 2; i += 1) {
      const angle = ((fromDeg + ((toDeg - fromDeg) * i) / (count * 2)) * Math.PI) / 180;
      const r = i % 2 === 0 ? inner : outer;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
  };

const wave = (x0: number, x1: number, y: number, bumps: number, amp: number): Path => (ctx) => {
  ctx.beginPath();
  ctx.moveTo(x0, y);
  const step = (x1 - x0) / bumps;
  for (let i = 0; i < bumps; i += 1) {
    ctx.quadraticCurveTo(x0 + step * (i + 0.5), y + (i % 2 === 0 ? -amp : amp), x0 + step * (i + 1), y);
  }
};

const RICK: CutOutShape[] = [
  { path: poly([[-0.62, 1], [-0.5, 0.58], [-0.2, 0.5], [0.2, 0.5], [0.5, 0.58], [0.62, 1]]), fill: "#ffffff" },
  { path: poly([[-0.2, 0.5], [0.2, 0.5], [0.12, 1], [-0.12, 1]]), fill: "#6fc3bb" },
  { path: poly([[-0.2, 0.5], [-0.3, 0.75], [-0.14, 1]], false) },
  { path: poly([[0.2, 0.5], [0.3, 0.75], [0.14, 1]], false) },
  { path: spikes(0, -0.12, 0.5, 0.82, 150, 390, 12), fill: "#8fd3e4" },
  { path: ellipse(0, 0.02, 0.42, 0.56), fill: "#c5d0bf" },
  { path: wave(-0.36, 0.36, -0.26, 5, 0.025), line: 0.04 },
  { path: ellipse(-0.17, -0.07, 0.15, 0.15), fill: "#ffffff" },
  { path: ellipse(0.16, -0.07, 0.14, 0.14), fill: "#ffffff" },
  { path: ellipse(-0.15, -0.06, 0.028, 0.028), fill: "#111111" },
  { path: ellipse(0.14, -0.06, 0.028, 0.028), fill: "#111111" },
  { path: curve([[0, 0], [0.05, 0.12], [-0.03, 0.15]]) },
  {
    path: (ctx) => {
      ctx.beginPath();
      ctx.moveTo(-0.26, 0.2);
      ctx.quadraticCurveTo(0, 0.24, 0.27, 0.19);
      ctx.quadraticCurveTo(0.2, 0.52, -0.02, 0.5);
      ctx.quadraticCurveTo(-0.24, 0.46, -0.26, 0.2);
      ctx.closePath();
    },
    fill: "#5a1a1d",
  },
  {
    path: (ctx) => {
      ctx.beginPath();
      ctx.moveTo(-0.22, 0.215);
      ctx.quadraticCurveTo(0, 0.25, 0.23, 0.205);
      ctx.lineTo(0.22, 0.26);
      ctx.quadraticCurveTo(0, 0.3, -0.21, 0.27);
      ctx.closePath();
    },
    fill: "#fdfcf5",
  },
  { path: ellipse(0.06, 0.4, 0.1, 0.055), fill: "#e98b8f" },
  {
    path: (ctx) => {
      ctx.beginPath();
      ctx.moveTo(0.2, 0.33);
      ctx.quadraticCurveTo(0.26, 0.42, 0.22, 0.5);
      ctx.quadraticCurveTo(0.18, 0.44, 0.2, 0.33);
      ctx.closePath();
    },
    fill: "#d8eef3",
  },
];

const MORTY: CutOutShape[] = [
  { path: poly([[-0.48, 1], [-0.42, 0.6], [-0.15, 0.52], [0.15, 0.52], [0.42, 0.6], [0.48, 1]]), fill: "#f5e46b" },
  { path: curve([[-0.15, 0.52], [0, 0.62], [0.15, 0.52]]) },
  { path: poly([[-0.1, 0.4], [0.1, 0.4], [0.1, 0.55], [-0.1, 0.55]]), fill: "#f4c69a" },
  { path: ellipse(0.46, 0.18, 0.07, 0.09), fill: "#f4c69a" },
  { path: ellipse(0, 0.04, 0.47, 0.46), fill: "#f4c69a" },
  {
    path: (ctx) => {
      ctx.beginPath();
      ctx.moveTo(-0.46, -0.02);
      ctx.bezierCurveTo(-0.44, -0.5, 0.35, -0.6, 0.53, -0.05);
      ctx.lineTo(0.52, 0.1);
      ctx.lineTo(0.45, 0.08);
      ctx.bezierCurveTo(0.42, -0.18, 0.02, -0.32, -0.46, -0.02);
      ctx.closePath();
    },
    fill: "#7a4a1d",
  },
  { path: ellipse(-0.17, -0.02, 0.15, 0.15), fill: "#ffffff" },
  { path: ellipse(0.16, -0.02, 0.15, 0.15), fill: "#ffffff" },
  { path: ellipse(-0.2, -0.01, 0.024, 0.024), fill: "#111111" },
  { path: ellipse(0.13, -0.01, 0.024, 0.024), fill: "#111111" },
  { path: curve([[-0.04, 0.1], [-0.08, 0.15], [-0.02, 0.16]]), line: 0.022 },
  { path: curve([[-0.13, 0.26], [0, 0.31], [0.12, 0.24]]) },
];

type Topper = { shapes: CutOutShape[]; x: number; y: number; scale: number };

// "backing" paints every shape as fat white paper; "art" paints the drawing.
function traceTopper(ctx: CanvasRenderingContext2D, { shapes, x, y, scale }: Topper, mode: "backing" | "art") {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const shape of shapes) {
    shape.path(ctx);
    if (mode === "backing") {
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 0.1;
      if (shape.fill) {
        ctx.fill();
      }
      ctx.stroke();
      continue;
    }
    if (shape.fill) {
      ctx.fillStyle = shape.fill;
      ctx.fill();
    }
    ctx.strokeStyle = "#141414";
    ctx.lineWidth = shape.line ?? 0.024;
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Top-of-cake texture: frosting, piped message, cut-out toppers.

function paintFrosting(ctx: CanvasRenderingContext2D, size: number) {
  ctx.fillStyle = FROSTING;
  ctx.fillRect(0, 0, size, size);

  // Soft spatula smears, a little lighter or darker than the base.
  for (let i = 0; i < 140; i += 1) {
    const width = size * (0.08 + rand(i + 1000) * 0.25);
    const height = size * (0.01 + rand(i + 1500) * 0.025);
    const light = rand(i + 2000) > 0.45;
    ctx.save();
    ctx.translate(rand(i) * size, rand(i + 500) * size);
    ctx.rotate((rand(i + 2500) - 0.5) * 0.3);
    ctx.scale(1, height / width);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, width / 2);
    gradient.addColorStop(0, light ? "rgba(255,252,238,0.5)" : "rgba(200,186,140,0.22)");
    gradient.addColorStop(1, "rgba(255,252,238,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(-width / 2, -width / 2, width, width);
    ctx.restore();
  }
}

function pipeMessage(ctx: CanvasRenderingContext2D, size: number) {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const line of MESSAGE) {
    const fontSize = line.size * size;
    ctx.save();
    ctx.translate(line.x * size, line.y * size);
    ctx.rotate(line.tilt);
    ctx.font = `${fontSize}px ${HAND_FONT}`;
    // Rounded stroke + fill reads as a line of piped chocolate.
    ctx.strokeStyle = PIPING;
    ctx.lineWidth = fontSize * 0.06;
    ctx.strokeText(line.text, 0, 0);
    ctx.fillStyle = PIPING;
    ctx.fillText(line.text, 0, 0);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = fontSize * 0.018;
    ctx.strokeText(line.text, -fontSize * 0.012, -fontSize * 0.018);
    ctx.restore();
  }
}

function createTopTexture() {
  const size = TOP_TEXTURE_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  paintFrosting(ctx, size);
  pipeMessage(ctx, size);

  const toppers: Topper[] = [
    { shapes: RICK, x: 0.34 * size, y: 0.73 * size, scale: 0.17 * size },
    { shapes: MORTY, x: 0.66 * size, y: 0.74 * size, scale: 0.17 * size },
  ];
  // Paper backings go on a separate layer so the whole cut-out casts one
  // shadow instead of every shape shadowing its neighbours.
  const backing = document.createElement("canvas");
  backing.width = size;
  backing.height = size;
  const backingCtx = backing.getContext("2d")!;
  toppers.forEach((topper) => traceTopper(backingCtx, topper, "backing"));
  ctx.save();
  ctx.shadowColor = "rgba(60, 40, 20, 0.35)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.drawImage(backing, 0, 0);
  ctx.restore();
  toppers.forEach((topper) => traceTopper(ctx, topper, "art"));

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// ---------------------------------------------------------------------------
// Geometry

// Open cylinder with shallow ridges running around it, like scraper marks.
function createSideGeometry() {
  const height = TOP_Y - CAKE_BOTTOM;
  const geometry = new CylinderGeometry(RADIUS, RADIUS, height, 160, 90, true);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const angle = Math.atan2(z, x);
    const ridge =
      Math.sin(y * 70 + Math.sin(angle * 3) * 1.5) * 0.004 + Math.sin(y * 23 + angle * 2) * 0.005;
    const scale = 1 + ridge / RADIUS;
    position.setXYZ(i, x * scale, y, z * scale);
  }
  geometry.computeVertexNormals();
  geometry.translate(0, CAKE_BOTTOM + height / 2, 0);
  return geometry;
}

// The uneven lip of frosting where the top meets the sides.
function createRimGeometry() {
  const geometry = new TorusGeometry(RADIUS - 0.015, 0.03, 10, 200);
  geometry.rotateX(Math.PI / 2);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const y = position.getY(i);
    if (y <= 0) {
      continue;
    }
    const angle = Math.atan2(position.getZ(i), position.getX(i));
    const lift = 0.5 + 0.5 * Math.sin(angle * 11) * Math.sin(angle * 4 + 1);
    position.setY(i, y * (1 + 0.8 * lift));
  }
  geometry.computeVertexNormals();
  geometry.translate(0, TOP_Y, 0);
  return geometry;
}

export function Cake({ children, ...groupProps }: CakeProps) {
  const topTexture = useMemo(createTopTexture, []);
  const sideGeometry = useMemo(createSideGeometry, []);
  const rimGeometry = useMemo(createRimGeometry, []);

  useEffect(
    () => () => {
      topTexture.dispose();
      sideGeometry.dispose();
      rimGeometry.dispose();
    },
    [topTexture, sideGeometry, rimGeometry]
  );

  return (
    <group {...groupProps}>
      <mesh position={[0, BOARD_Y + BOARD_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[RADIUS + 0.32, RADIUS + 0.32, BOARD_HEIGHT, 96]} />
        <meshStandardMaterial color="#f2f0ec" roughness={0.7} />
      </mesh>
      <mesh geometry={sideGeometry}>
        <meshStandardMaterial color={FROSTING} roughness={0.65} />
      </mesh>
      {/* Turned so the message reads upright from the opening camera (+x). */}
      <group position={[0, TOP_Y + 0.001, 0]} rotation={[0, Math.PI / 2, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[RADIUS, 128]} />
          <meshStandardMaterial map={topTexture} roughness={0.6} />
        </mesh>
      </group>
      <mesh geometry={rimGeometry}>
        <meshStandardMaterial color={FROSTING} roughness={0.65} />
      </mesh>
      {children}
    </group>
  );
}
