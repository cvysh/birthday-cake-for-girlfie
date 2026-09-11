import { CanvasTexture, SRGBColorSpace } from "three";

let cachedGlow: CanvasTexture | null = null;

// Soft radial falloff shared by every glowing light (bulbs, moon halo, flames).
export function getGlowTexture() {
  if (cachedGlow) {
    return cachedGlow;
  }

  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.2, "rgba(255,255,255,0.6)");
  gradient.addColorStop(0.5, "rgba(255,255,255,0.14)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  cachedGlow = new CanvasTexture(canvas);
  cachedGlow.colorSpace = SRGBColorSpace;
  return cachedGlow;
}
