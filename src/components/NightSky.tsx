import { Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BackSide,
  Color,
  ShaderMaterial,
  Vector3,
} from "three";
import type { MeshBasicMaterial, SpriteMaterial } from "three";
import { getGlowTexture } from "../utils/glow";

type NightSkyProps = {
  /** 0 = hidden behind the intro overlay, 1 = fully visible. */
  visibility: number;
};

const SKY_RADIUS = 400;
const STAR_RADIUS = 300;
const STAR_COUNT = 2500;
const FIREFLY_COUNT = 140;
const GROUND_Y = -4;
// Low enough to sit in the top-left of the opening camera view.
const MOON_POSITION = new Vector3(-190, 60, -60);

const PERGOLA_RADIUS = 10.5;
const PERGOLA_POSTS = 6;
const POST_TOP_Y = 5;
const BULBS_PER_STRAND = 16;

const skyVertexShader = `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFragmentShader = `
  uniform float uVisibility;
  uniform vec3 uZenith;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec3 uMoonDir;
  varying vec3 vDir;
  void main() {
    vec3 dir = normalize(vDir);
    float h = clamp(dir.y, -0.2, 1.0);
    vec3 col = mix(uHorizon, uMid, smoothstep(-0.02, 0.28, h));
    col = mix(col, uZenith, smoothstep(0.28, 0.9, h));
    float moonGlow = pow(max(dot(dir, uMoonDir), 0.0), 10.0);
    col += vec3(0.16, 0.14, 0.24) * moonGlow;
    gl_FragColor = vec4(col * uVisibility, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// Shared by stars, fireflies and fairy-light bulbs: soft round sprites that
// twinkle, optionally drift, and optionally shrink with distance.
const pointsVertexShader = `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uDrift;
  uniform float uAttenuate;
  uniform float uTwinkleSpeed;
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.3 + aPhase * 12.0) * uDrift;
    p.y += sin(uTime * 0.45 + aPhase * 7.0) * uDrift * 0.6;
    p.z += cos(uTime * 0.25 + aPhase * 9.0) * uDrift;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vColor = aColor;
    vTwinkle = 0.6 + 0.4 * sin(uTime * uTwinkleSpeed * (0.6 + aPhase) + aPhase * 6.2831);
    gl_PointSize = aSize * uPixelRatio * mix(1.0, 20.0 / max(-mv.z, 0.1), uAttenuate);
    gl_Position = projectionMatrix * mv;
  }
`;

const pointsFragmentShader = `
  uniform float uVisibility;
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.5, 0.0, d);
    float alpha = core * core * uVisibility;
    gl_FragColor = vec4(vColor * vTwinkle * uVisibility, alpha);
  }
`;

type PointsOptions = {
  drift: number;
  attenuate: boolean;
  twinkleSpeed: number;
};

function createPointsMaterial({ drift, attenuate, twinkleSpeed }: PointsOptions) {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uVisibility: { value: 0 },
      uDrift: { value: drift },
      uAttenuate: { value: attenuate ? 1 : 0 },
      uTwinkleSpeed: { value: twinkleSpeed },
    },
    vertexShader: pointsVertexShader,
    fragmentShader: pointsFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

type PointCloud = {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  phases: Float32Array;
};

function allocateCloud(count: number): PointCloud {
  return {
    positions: new Float32Array(count * 3),
    colors: new Float32Array(count * 3),
    sizes: new Float32Array(count),
    phases: new Float32Array(count),
  };
}

function buildStars(): PointCloud {
  const cloud = allocateCloud(STAR_COUNT);
  const tint = new Color();
  for (let i = 0; i < STAR_COUNT; i += 1) {
    // Bias toward the upper sky; a few sit just under the horizon line.
    const y = -0.05 + Math.pow(Math.random(), 0.8) * 1.05;
    const theta = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - y * y);
    cloud.positions.set(
      [Math.cos(theta) * r * STAR_RADIUS, y * STAR_RADIUS, Math.sin(theta) * r * STAR_RADIUS],
      i * 3
    );
    tint.setHSL(0.08 + Math.random() * 0.6, 0.35, 0.85);
    cloud.colors.set([tint.r, tint.g, tint.b], i * 3);
    cloud.sizes[i] = Math.random() < 0.06 ? 3.5 + Math.random() * 2 : 1 + Math.random() * 1.8;
    cloud.phases[i] = Math.random();
  }
  return cloud;
}

function buildFireflies(): PointCloud {
  const cloud = allocateCloud(FIREFLY_COUNT);
  const warm = new Color("#ffc86b");
  for (let i = 0; i < FIREFLY_COUNT; i += 1) {
    const radius = 5 + Math.random() * 10;
    const theta = Math.random() * Math.PI * 2;
    cloud.positions.set(
      [Math.cos(theta) * radius, GROUND_Y + 1 + Math.random() * 8, Math.sin(theta) * radius],
      i * 3
    );
    cloud.colors.set([warm.r, warm.g, warm.b], i * 3);
    cloud.sizes[i] = 5 + Math.random() * 7;
    cloud.phases[i] = Math.random();
  }
  return cloud;
}

type Strand = { wire: Vector3[] };

// Fairy-light strands hanging between the pergola posts: one ring around the
// table plus three sagging strands that cross above it.
function buildStrands(): { strands: Strand[]; bulbs: PointCloud; posts: Vector3[] } {
  const posts = Array.from({ length: PERGOLA_POSTS }, (_, i) => {
    const angle = (i / PERGOLA_POSTS) * Math.PI * 2 + Math.PI / PERGOLA_POSTS;
    return new Vector3(Math.cos(angle) * PERGOLA_RADIUS, POST_TOP_Y, Math.sin(angle) * PERGOLA_RADIUS);
  });

  const pairs: Array<[number, number, number]> = [];
  for (let i = 0; i < PERGOLA_POSTS; i += 1) {
    pairs.push([i, (i + 1) % PERGOLA_POSTS, 1.3]);
  }
  for (let i = 0; i < PERGOLA_POSTS / 2; i += 1) {
    pairs.push([i, i + PERGOLA_POSTS / 2, 2.4]);
  }

  const bulbs = allocateCloud(pairs.length * BULBS_PER_STRAND);
  const bulbColors = ["#ffd9a0", "#ffc38a", "#ffe8c4", "#ffb3c1"].map((c) => new Color(c));
  const strands: Strand[] = [];
  let bulbIndex = 0;

  for (const [a, b, sag] of pairs) {
    const start = posts[a];
    const end = posts[b];
    const pointAt = (t: number) => {
      const p = start.clone().lerp(end, t);
      p.y -= sag * 4 * t * (1 - t);
      return p;
    };
    strands.push({ wire: Array.from({ length: 33 }, (_, i) => pointAt(i / 32)) });

    for (let i = 0; i < BULBS_PER_STRAND; i += 1) {
      const p = pointAt((i + 0.5) / BULBS_PER_STRAND);
      p.y -= 0.08;
      const color = bulbColors[bulbIndex % bulbColors.length];
      bulbs.positions.set([p.x, p.y, p.z], bulbIndex * 3);
      bulbs.colors.set([color.r, color.g, color.b], bulbIndex * 3);
      bulbs.sizes[bulbIndex] = 14;
      bulbs.phases[bulbIndex] = Math.random();
      bulbIndex += 1;
    }
  }

  return { strands, bulbs, posts };
}

function CloudPoints({ cloud, material }: { cloud: PointCloud; material: ShaderMaterial }) {
  return (
    <points frustumCulled={false} material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[cloud.positions, 3]} />
        <bufferAttribute attach="attributes-aColor" args={[cloud.colors, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[cloud.sizes, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[cloud.phases, 1]} />
      </bufferGeometry>
    </points>
  );
}

export function NightSky({ visibility }: NightSkyProps) {
  const pixelRatio = useThree((state) => state.viewport.dpr);
  const moonRef = useRef<MeshBasicMaterial>(null);
  const haloRef = useRef<SpriteMaterial>(null);
  const glow = useMemo(() => getGlowTexture(), []);

  const stars = useMemo(buildStars, []);
  const fireflies = useMemo(buildFireflies, []);
  const { strands, bulbs, posts } = useMemo(buildStrands, []);

  const skyMaterial = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uVisibility: { value: 0 },
          uZenith: { value: new Color("#03030d") },
          uMid: { value: new Color("#0d0a26") },
          uHorizon: { value: new Color("#2e1538") },
          uMoonDir: { value: MOON_POSITION.clone().normalize() },
        },
        vertexShader: skyVertexShader,
        fragmentShader: skyFragmentShader,
        side: BackSide,
        depthWrite: false,
      }),
    []
  );
  const starMaterial = useMemo(
    () => createPointsMaterial({ drift: 0, attenuate: false, twinkleSpeed: 1.5 }),
    []
  );
  const fireflyMaterial = useMemo(
    () => createPointsMaterial({ drift: 0.6, attenuate: true, twinkleSpeed: 2.2 }),
    []
  );
  const bulbMaterial = useMemo(
    () => createPointsMaterial({ drift: 0, attenuate: true, twinkleSpeed: 0.8 }),
    []
  );

  useEffect(() => {
    const materials = [skyMaterial, starMaterial, fireflyMaterial, bulbMaterial];
    return () => materials.forEach((material) => material.dispose());
  }, [skyMaterial, starMaterial, fireflyMaterial, bulbMaterial]);

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    skyMaterial.uniforms.uVisibility.value = visibility;
    for (const material of [starMaterial, fireflyMaterial, bulbMaterial]) {
      material.uniforms.uTime.value = time;
      material.uniforms.uPixelRatio.value = pixelRatio;
      material.uniforms.uVisibility.value = visibility;
    }
    if (moonRef.current) {
      moonRef.current.opacity = visibility;
    }
    if (haloRef.current) {
      haloRef.current.opacity = 0.45 * visibility;
    }
  });

  return (
    // Hidden entirely during the intro; lit meshes and wires would otherwise
    // show through the typing overlay.
    <group visible={visibility > 0.01}>
      <mesh material={skyMaterial} renderOrder={-1}>
        <sphereGeometry args={[SKY_RADIUS, 48, 24]} />
      </mesh>
      <CloudPoints cloud={stars} material={starMaterial} />

      <mesh position={MOON_POSITION}>
        <sphereGeometry args={[9, 32, 16]} />
        {/* fog={false}: the moon is far beyond the fog range and would turn dark. */}
        <meshBasicMaterial ref={moonRef} color="#fff3d6" transparent toneMapped={false} fog={false} />
      </mesh>
      <sprite position={MOON_POSITION} scale={85}>
        <spriteMaterial
          ref={haloRef}
          map={glow}
          color="#b9b2ff"
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          fog={false}
        />
      </sprite>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y, 0]} receiveShadow>
        <circleGeometry args={[90, 64]} />
        <meshStandardMaterial color="#120a14" roughness={0.95} />
      </mesh>

      {posts.map((top, i) => (
        <mesh key={`post-${i}`} position={[top.x, (top.y + GROUND_Y) / 2, top.z]}>
          <cylinderGeometry args={[0.1, 0.13, top.y - GROUND_Y, 10]} />
          <meshStandardMaterial color="#2b1a14" roughness={0.8} />
        </mesh>
      ))}
      {strands.map((strand, i) => (
        <Line key={`strand-${i}`} points={strand.wire} color="#3a2630" lineWidth={1} />
      ))}
      <CloudPoints cloud={bulbs} material={bulbMaterial} />
      <pointLight position={[0, 3.2, 0]} color="#ffb877" intensity={10 * visibility} distance={22} decay={1.4} />

      <CloudPoints cloud={fireflies} material={fireflyMaterial} />
    </group>
  );
}
