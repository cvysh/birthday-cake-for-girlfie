import { Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { AdditiveBlending, Color, ShaderMaterial, Vector3 } from "three";

type FairyLightsProps = {
  /** 0 = hidden behind the intro overlay, 1 = fully lit. */
  visibility: number;
};

// A pergola of six posts around the table, strung with warm bulbs: one ring of
// strands between neighbouring posts, plus three that sag across above the cake.
const FLOOR_Y = -4;
const PERGOLA_RADIUS = 10.5;
const PERGOLA_POSTS = 6;
const POST_TOP_Y = 5;
const BULBS_PER_STRAND = 16;
const BULB_COLORS = ["#ffd9a0", "#ffc38a", "#ffe8c4", "#ffb3c1"];

const bulbVertexShader = `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vColor = aColor;
    vTwinkle = 0.6 + 0.4 * sin(uTime * 0.8 * (0.6 + aPhase) + aPhase * 6.2831);
    // Shrink with distance so near bulbs read bigger than far ones.
    gl_PointSize = aSize * uPixelRatio * 20.0 / max(-mv.z, 0.1);
    gl_Position = projectionMatrix * mv;
  }
`;

const bulbFragmentShader = `
  uniform float uVisibility;
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor * vTwinkle * uVisibility, core * core * uVisibility);
  }
`;

type Bulbs = {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  phases: Float32Array;
};

function buildPergola() {
  const posts = Array.from({ length: PERGOLA_POSTS }, (_, i) => {
    const angle = (i / PERGOLA_POSTS) * Math.PI * 2 + Math.PI / PERGOLA_POSTS;
    return new Vector3(Math.cos(angle) * PERGOLA_RADIUS, POST_TOP_Y, Math.sin(angle) * PERGOLA_RADIUS);
  });

  // [from post, to post, how far the strand sags in the middle]
  const pairs: Array<[number, number, number]> = [];
  for (let i = 0; i < PERGOLA_POSTS; i += 1) {
    pairs.push([i, (i + 1) % PERGOLA_POSTS, 1.3]);
  }
  for (let i = 0; i < PERGOLA_POSTS / 2; i += 1) {
    pairs.push([i, i + PERGOLA_POSTS / 2, 2.4]);
  }

  const count = pairs.length * BULBS_PER_STRAND;
  const bulbs: Bulbs = {
    positions: new Float32Array(count * 3),
    colors: new Float32Array(count * 3),
    sizes: new Float32Array(count),
    phases: new Float32Array(count),
  };
  const palette = BULB_COLORS.map((c) => new Color(c));
  const wires: Vector3[][] = [];
  let bulb = 0;

  for (const [from, to, sag] of pairs) {
    const start = posts[from];
    const end = posts[to];
    const pointAt = (t: number) => {
      const p = start.clone().lerp(end, t);
      p.y -= sag * 4 * t * (1 - t);
      return p;
    };
    wires.push(Array.from({ length: 33 }, (_, i) => pointAt(i / 32)));

    for (let i = 0; i < BULBS_PER_STRAND; i += 1) {
      const p = pointAt((i + 0.5) / BULBS_PER_STRAND);
      const color = palette[bulb % palette.length];
      bulbs.positions.set([p.x, p.y - 0.08, p.z], bulb * 3);
      bulbs.colors.set([color.r, color.g, color.b], bulb * 3);
      bulbs.sizes[bulb] = 14;
      bulbs.phases[bulb] = Math.random();
      bulb += 1;
    }
  }

  return { posts, wires, bulbs };
}

export function FairyLights({ visibility }: FairyLightsProps) {
  const pixelRatio = useThree((state) => state.viewport.dpr);
  const { posts, wires, bulbs } = useMemo(buildPergola, []);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          uVisibility: { value: 0 },
        },
        vertexShader: bulbVertexShader,
        fragmentShader: bulbFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    []
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uPixelRatio.value = pixelRatio;
    material.uniforms.uVisibility.value = visibility;
  });

  return (
    // Hidden during the intro so the posts and wires don't show through the
    // typing overlay.
    <group visible={visibility > 0.01}>
      {posts.map((top, i) => (
        <mesh key={`post-${i}`} position={[top.x, (top.y + FLOOR_Y) / 2, top.z]}>
          <cylinderGeometry args={[0.1, 0.13, top.y - FLOOR_Y, 10]} />
          <meshStandardMaterial color="#2b1a14" roughness={0.8} />
        </mesh>
      ))}
      {wires.map((wire, i) => (
        <Line key={`wire-${i}`} points={wire} color="#3a2630" lineWidth={1} />
      ))}
      <points frustumCulled={false} material={material}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[bulbs.positions, 3]} />
          <bufferAttribute attach="attributes-aColor" args={[bulbs.colors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[bulbs.sizes, 1]} />
          <bufferAttribute attach="attributes-aPhase" args={[bulbs.phases, 1]} />
        </bufferGeometry>
      </points>
      {/* Warm glow the bulbs cast down onto the table. */}
      <pointLight position={[0, 3.2, 0]} color="#ffb877" intensity={10 * visibility} distance={22} decay={1.4} />
    </group>
  );
}
