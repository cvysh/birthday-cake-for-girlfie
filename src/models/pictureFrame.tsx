import { useTexture } from "@react-three/drei";
import type { ThreeElements } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";

type PictureFrameProps = ThreeElements["group"] & {
  image: string;
};

// The opening's longest side; the other side follows the photo's aspect ratio,
// so each frame takes the shape of its own photo.
const OPENING_LONG_SIDE = 1.3;
const WOOD = 0.11;
const DEPTH = 0.07;
const LIP = 0.03;
const TILT = 0.2; // how far the frame leans back on its easel leg
const LEG_REACH = 0.35;
const MAX_PRINT_PX = 1024; // big phone photos are downscaled to save GPU memory
const PAPER_BORDER = 0.025; // thin white print edge, as a fraction of the short side
const PAPER = "#fbfaf6";
// Set to true for a black-and-white photo-booth look.
const BLACK_AND_WHITE = false;

let woodTextures: { along: CanvasTexture; across: CanvasTexture } | null = null;

// Dark mahogany grain; `across` is the same grain turned 90° for side rails.
function getWoodTextures() {
  if (woodTextures) {
    return woodTextures;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#4b2016";
  ctx.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 70; i += 1) {
    const y = Math.random() * 128;
    ctx.strokeStyle =
      Math.random() > 0.5
        ? `rgba(30,10,6,${0.25 + Math.random() * 0.35})`
        : `rgba(140,70,45,${0.12 + Math.random() * 0.2})`;
    ctx.lineWidth = 0.5 + Math.random() * 2.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 32; x <= 512; x += 32) {
      ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 2.5);
    }
    ctx.stroke();
  }
  const along = new CanvasTexture(canvas);
  along.colorSpace = SRGBColorSpace;
  const across = along.clone();
  across.center.set(0.5, 0.5);
  across.rotation = Math.PI / 2;
  across.needsUpdate = true;
  woodTextures = { along, across };
  return woodTextures;
}

type Photo = CanvasImageSource & { width: number; height: number };

// The photo as a print: thin white paper edge, optionally black and white.
function createPrintTexture(photo: Photo) {
  const scale = Math.min(1, MAX_PRINT_PX / Math.max(photo.width, photo.height));
  const w = Math.round(photo.width * scale);
  const h = Math.round(photo.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const border = Math.round(Math.min(w, h) * PAPER_BORDER);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(photo, border, border, w - border * 2, h - border * 2);

  if (BLACK_AND_WHITE) {
    // Manual greyscale (ctx.filter isn't supported everywhere), with a touch
    // of contrast so it reads like a photo-booth print.
    const pixels = ctx.getImageData(border, border, w - border * 2, h - border * 2);
    const data = pixels.data;
    for (let i = 0; i < data.length; i += 4) {
      const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const value = Math.min(255, Math.max(0, (luminance - 128) * 1.15 + 134));
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    }
    ctx.putImageData(pixels, border, border);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// A wooden frame standing on an easel leg. The group origin is the bottom
// edge of the frame, so `position` can be placed directly on the table top.
export function PictureFrame({ image, children, ...groupProps }: PictureFrameProps) {
  const photo = useTexture(image);
  const print = useMemo(() => createPrintTexture(photo.image as Photo), [photo]);
  useEffect(() => () => print.dispose(), [print]);
  const wood = useMemo(getWoodTextures, []);

  const { width, height } = useMemo(() => {
    const img = photo.image as Photo;
    const aspect = img.width / img.height;
    return aspect >= 1
      ? { width: OPENING_LONG_SIDE, height: OPENING_LONG_SIDE / aspect }
      : { width: OPENING_LONG_SIDE * aspect, height: OPENING_LONG_SIDE };
  }, [photo]);

  const outerHeight = height + WOOD * 2;
  const outerWidth = width + WOOD * 2;

  const leg = useMemo(() => {
    // Attach point on the back of the tilted frame, 70% of the way up.
    const attachY = outerHeight * 0.7;
    const attachZ = -DEPTH / 2;
    const y = attachY * Math.cos(TILT) + attachZ * Math.sin(TILT);
    const z = -attachY * Math.sin(TILT) + attachZ * Math.cos(TILT);
    return {
      length: Math.hypot(y, LEG_REACH),
      position: [0, y / 2, z - LEG_REACH / 2] as [number, number, number],
      rotationX: -Math.atan2(LEG_REACH, y),
    };
  }, [outerHeight]);

  type Rail = { size: [number, number, number]; position: [number, number, number]; horizontal: boolean };
  const rails: Rail[] = [
    { size: [outerWidth, WOOD, DEPTH], position: [0, (height + WOOD) / 2, 0], horizontal: true },
    { size: [outerWidth, WOOD, DEPTH], position: [0, -(height + WOOD) / 2, 0], horizontal: true },
    { size: [WOOD, height, DEPTH], position: [(width + WOOD) / 2, 0, 0], horizontal: false },
    { size: [WOOD, height, DEPTH], position: [-(width + WOOD) / 2, 0, 0], horizontal: false },
  ];
  // A dark inner step between the wood and the print reads as a bevel.
  const lips: Rail[] = [
    { size: [width, LIP, 0.02], position: [0, (height - LIP) / 2, DEPTH / 2 - 0.02], horizontal: true },
    { size: [width, LIP, 0.02], position: [0, -(height - LIP) / 2, DEPTH / 2 - 0.02], horizontal: true },
    { size: [LIP, height, 0.02], position: [(width - LIP) / 2, 0, DEPTH / 2 - 0.02], horizontal: false },
    { size: [LIP, height, 0.02], position: [-(width - LIP) / 2, 0, DEPTH / 2 - 0.02], horizontal: false },
  ];

  return (
    <group {...groupProps}>
      <group rotation={[-TILT, 0, 0]}>
        <group position={[0, outerHeight / 2, 0]}>
          {rails.map(({ size, position, horizontal }, i) => (
            <mesh key={`rail-${i}`} position={position}>
              <boxGeometry args={size} />
              <meshPhysicalMaterial
                map={horizontal ? wood.along : wood.across}
                roughness={0.4}
                clearcoat={0.6}
                clearcoatRoughness={0.25}
              />
            </mesh>
          ))}
          {lips.map(({ size, position }, i) => (
            <mesh key={`lip-${i}`} position={position}>
              <boxGeometry args={size} />
              <meshStandardMaterial color="#1f0b07" roughness={0.6} />
            </mesh>
          ))}
          <mesh position={[0, 0, -DEPTH / 4]}>
            <boxGeometry args={[width, height, DEPTH / 2]} />
            <meshStandardMaterial color="#2a1a14" roughness={0.9} />
          </mesh>
          {/* Unlit so the print stays readable in the dark scene. */}
          <mesh position={[0, 0, DEPTH / 2 - 0.03]}>
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial map={print} color="#e8e0d8" toneMapped={false} />
          </mesh>
        </group>
      </group>
      <mesh position={leg.position} rotation={[leg.rotationX, 0, 0]}>
        <boxGeometry args={[0.06, leg.length, 0.03]} />
        <meshStandardMaterial color="#3a1a10" roughness={0.5} />
      </mesh>
      {children}
    </group>
  );
}
