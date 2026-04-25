import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, RoundedBox, Sparkles, Cloud, ContactShadows } from '@react-three/drei';
import { useRef, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';

export type BuildingId = 'maktab' | 'shifoxona' | 'yollar' | 'chiroqlar' | 'bogcha';
export type BuildingStatus =
  | 'qurilmagan'
  | 'qurilyapti'
  | 'alo'
  | 'shikastlangan'
  | 'vayrona';

export interface BuildingState {
  status: BuildingStatus;
  isFragile: boolean;
}

export type BuildingsMap = Record<BuildingId, BuildingState>;

// ============================================================================
//  CITY CONSTANTS
// ============================================================================

// 5 plot positions on the city grid — buildings can go anywhere
export const PLOT_POSITIONS: [number, number, number][] = [
  [-3.5, 0, -3.5], // top-left
  [3.5, 0, -3.5],  // top-right
  [-3.5, 0, 0],    // middle-left
  [3.5, 0, 0],     // middle-right
  [0, 0, 3.5],     // bottom-center
];

// Muted, realistic palette — less "lego" toy colors, more like real buildings
const BUILDING_PALETTE: Record<BuildingId, { body: string; roof: string; window: string }> = {
  maktab: { body: '#d4a574', roof: '#7c4419', window: '#1e3a5f' },     // school: warm beige + brown roof
  shifoxona: { body: '#e8e4dc', roof: '#9b2c2c', window: '#3b6e8f' },  // hospital: off-white + dark red
  yollar: { body: '#2d2d33', roof: '#3d3d44', window: '#c9a849' },     // road: asphalt
  chiroqlar: { body: '#52525b', roof: '#a8a29e', window: '#fde68a' },  // lights: gray pole
  bogcha: { body: '#c2839a', roof: '#7a3650', window: '#fef3c7' },     // kindergarten: muted pink
};

// Muted house palette — real-world building colors (terracotta, ochre, sage, taupe)
const HOUSE_POSITIONS: { pos: [number, number, number]; color: string; roof: string }[] = [
  { pos: [-6, 0, -6], color: '#d4b896', roof: '#6b3818' },   // beige + brown
  { pos: [-3, 0, -6], color: '#a8b89c', roof: '#4a3320' },   // sage + brown
  { pos: [0, 0, -6], color: '#c89878', roof: '#7a2820' },    // terracotta + dark red
  { pos: [3, 0, -6], color: '#9bb4c4', roof: '#2a3548' },    // dusty blue
  { pos: [6, 0, -6], color: '#d4a574', roof: '#5d2a18' },    // ochre

  { pos: [-6, 0, -3], color: '#a09cb8', roof: '#3a2f5a' },   // muted lavender
  { pos: [6, 0, -3], color: '#b89695', roof: '#5a2030' },    // dusty rose

  { pos: [-6, 0, 0], color: '#c4ad7d', roof: '#5d3a1a' },
  { pos: [6, 0, 0], color: '#92a585', roof: '#3a4520' },     // olive

  { pos: [-6, 0, 3], color: '#b8a098', roof: '#5a3030' },
  { pos: [6, 0, 3], color: '#d6b48a', roof: '#6a3a18' },

  { pos: [-6, 0, 6], color: '#9bb0c4', roof: '#2a3850' },
  { pos: [-3, 0, 6], color: '#bb9c8a', roof: '#5a2820' },
  { pos: [3, 0, 6], color: '#a4b89c', roof: '#3a4528' },
  { pos: [6, 0, 6], color: '#cfb284', roof: '#5d3a1a' },
];

// Citizen walking paths — sidewalks on either side of horizontal/vertical roads
const CITIZEN_PATHS: { axis: 'x' | 'z'; lane: number; speed: number; color: string; size: number }[] = [
  { axis: 'x', lane: -2.7, speed: 0.45, color: '#1e40af', size: 1 },     // young man, north sidewalk
  { axis: 'x', lane: -2.5, speed: 0.6, color: '#9d174d', size: 0.85 },   // woman in red
  { axis: 'x', lane: 2.7, speed: 0.35, color: '#3730a3', size: 1 },      // student, south sidewalk
  { axis: 'x', lane: 2.5, speed: 0.5, color: '#065f46', size: 0.78 },    // child
  { axis: 'z', lane: -2.7, speed: 0.4, color: '#7c2d12', size: 1 },      // elder, west sidewalk
  { axis: 'z', lane: 2.7, speed: 0.55, color: '#0c4a6e', size: 1 },      // worker, east sidewalk
  { axis: 'x', lane: -2.5, speed: 0.3, color: '#581c87', size: 0.95 },   // grandmother
  { axis: 'z', lane: 2.5, speed: 0.65, color: '#92400e', size: 0.82 },   // child running
];

const TREE_POSITIONS: [number, number, number][] = [
  [-7.5, 0, -4.5],
  [-7.5, 0, -1.5],
  [-7.5, 0, 1.5],
  [-7.5, 0, 4.5],
  [7.5, 0, -4.5],
  [7.5, 0, -1.5],
  [7.5, 0, 1.5],
  [7.5, 0, 4.5],
  [-2, 0, 6],
  [2, 0, 6],
  [-2, 0, -7.5],
  [2, 0, -7.5],
];

// ============================================================================
//  SUB-COMPONENTS — geometry pieces
// ============================================================================

function Ground() {
  return (
    <>
      {/* Grass base — muted, more realistic green */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#7a9266" roughness={1} />
      </mesh>
      {/* Sidewalks — visible concrete bands flanking each road */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, -2.65]}>
        <planeGeometry args={[16, 0.5]} />
        <meshStandardMaterial color="#9c9a92" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 2.65]}>
        <planeGeometry args={[16, 0.5]} />
        <meshStandardMaterial color="#9c9a92" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-2.65, 0.018, 0]}>
        <planeGeometry args={[0.5, 16]} />
        <meshStandardMaterial color="#9c9a92" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2.65, 0.018, 0]}>
        <planeGeometry args={[0.5, 16]} />
        <meshStandardMaterial color="#9c9a92" roughness={0.95} />
      </mesh>
    </>
  );
}

function Citizen({
  axis, lane, speed, color, size,
}: {
  axis: 'x' | 'z'; lane: number; speed: number; color: string; size: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const offset = useRef(Math.random() * 1000);

  useFrame(() => {
    if (!ref.current) return;
    const period = 16000 / speed;
    const t = (((Date.now() + offset.current) % period) / period) * 18 - 9;
    if (axis === 'x') {
      ref.current.position.set(t, 0, lane);
      ref.current.rotation.y = t > 0 ? 0 : Math.PI;
    } else {
      ref.current.position.set(lane, 0, t);
      ref.current.rotation.y = t > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    // Gentle bobbing while walking
    const phase = (Date.now() + offset.current) * 0.008;
    ref.current.position.y = 0.02 + Math.abs(Math.sin(phase)) * 0.04;
  });

  const skin = '#e8c39e';
  return (
    <group ref={ref} scale={size}>
      {/* Legs (animated arms via swing) */}
      <mesh position={[0.05, 0.15, 0]} castShadow>
        <boxGeometry args={[0.06, 0.3, 0.08]} />
        <meshStandardMaterial color="#1c1917" roughness={0.85} />
      </mesh>
      <mesh position={[-0.05, 0.15, 0]} castShadow>
        <boxGeometry args={[0.06, 0.3, 0.08]} />
        <meshStandardMaterial color="#1c1917" roughness={0.85} />
      </mesh>
      {/* Torso (jacket) */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.18, 0.32, 0.12]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      {/* Arms */}
      <SwingingArm side={1} color={color} />
      <SwingingArm side={-1} color={color} />
      {/* Head */}
      <mesh position={[0, 0.72, 0]} castShadow>
        <sphereGeometry args={[0.085, 14, 14]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      {/* Hair cap */}
      <mesh position={[0, 0.78, 0]} castShadow>
        <sphereGeometry args={[0.09, 14, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#3a2415" roughness={0.85} />
      </mesh>
    </group>
  );
}

function SwingingArm({ side, color }: { side: 1 | -1; color: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.rotation.x = Math.sin(Date.now() * 0.008 + (side === 1 ? 0 : Math.PI)) * 0.5;
  });
  return (
    <group ref={ref} position={[side * 0.11, 0.55, 0]}>
      <mesh position={[0, -0.12, 0]} castShadow>
        <boxGeometry args={[0.05, 0.26, 0.07]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
    </group>
  );
}

function Roads() {
  return (
    <group>
      {/* Horizontal roads (X axis) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -1.7]}>
        <planeGeometry args={[16, 1.4]} />
        <meshStandardMaterial color="#27272a" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 1.7]}>
        <planeGeometry args={[16, 1.4]} />
        <meshStandardMaterial color="#27272a" />
      </mesh>
      {/* Vertical roads (Z axis) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1.7, 0.02, 0]}>
        <planeGeometry args={[1.4, 16]} />
        <meshStandardMaterial color="#27272a" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1.7, 0.02, 0]}>
        <planeGeometry args={[1.4, 16]} />
        <meshStandardMaterial color="#27272a" />
      </mesh>
      {/* Lane markings */}
      {Array.from({ length: 16 }).map((_, i) => (
        <mesh
          key={`mh-${i}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[-7.5 + i * 1, 0.03, -1.7]}
        >
          <planeGeometry args={[0.3, 0.06]} />
          <meshStandardMaterial color="#facc15" />
        </mesh>
      ))}
      {Array.from({ length: 16 }).map((_, i) => (
        <mesh
          key={`mh2-${i}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[-7.5 + i * 1, 0.03, 1.7]}
        >
          <planeGeometry args={[0.3, 0.06]} />
          <meshStandardMaterial color="#facc15" />
        </mesh>
      ))}
    </group>
  );
}

function Tree({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.z = Math.sin(Date.now() * 0.001 + position[0]) * 0.04;
    }
  });
  return (
    <group ref={ref} position={position} castShadow>
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.22, 0.9, 6]} />
        <meshStandardMaterial color="#78350f" />
      </mesh>
      <mesh position={[0, 1.4, 0]} castShadow>
        <coneGeometry args={[0.85, 1.7, 8]} />
        <meshStandardMaterial color="#16a34a" />
      </mesh>
      <mesh position={[0, 1.85, 0]} castShadow>
        <coneGeometry args={[0.55, 1.0, 8]} />
        <meshStandardMaterial color="#15803d" />
      </mesh>
    </group>
  );
}

function House({
  position, color, roof,
}: {
  position: [number, number, number];
  color: string;
  roof: string;
}) {
  return (
    <group position={position}>
      {/* Foundation strip */}
      <RoundedBox args={[1.45, 0.1, 1.45]} radius={0.01} position={[0, 0.05, 0]} castShadow>
        <meshStandardMaterial color="#5e564a" roughness={0.95} />
      </RoundedBox>
      {/* Body */}
      <RoundedBox args={[1.4, 0.9, 1.4]} radius={0.04} position={[0, 0.55, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.85} metalness={0.02} />
      </RoundedBox>
      {/* Pyramidal roof — tile-textured */}
      <mesh position={[0, 1.25, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[1.08, 0.7, 4]} />
        <meshStandardMaterial color={roof} roughness={0.95} />
      </mesh>
      {/* Chimney */}
      <mesh position={[0.45, 1.3, 0.3]} castShadow>
        <boxGeometry args={[0.15, 0.35, 0.15]} />
        <meshStandardMaterial color="#5a3025" roughness={0.95} />
      </mesh>
      {/* Door */}
      <mesh position={[0, 0.3, 0.71]}>
        <planeGeometry args={[0.3, 0.5]} />
        <meshStandardMaterial color="#3a2010" roughness={0.95} />
      </mesh>
      <mesh position={[0.08, 0.3, 0.715]}>
        <sphereGeometry args={[0.018, 6, 6]} />
        <meshStandardMaterial color="#a8a8a8" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* Windows with frames */}
      {[-0.4, 0.4].map((x, i) => (
        <group key={i} position={[x, 0.7, 0.71]}>
          <mesh>
            <planeGeometry args={[0.26, 0.26]} />
            <meshStandardMaterial color="#3a2818" />
          </mesh>
          <mesh position={[0, 0, 0.005]}>
            <planeGeometry args={[0.2, 0.2]} />
            <meshStandardMaterial color="#5fa3c4" emissive="#3b6e8f" emissiveIntensity={0.2} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[0.03, 0.2]} />
            <meshStandardMaterial color="#3a2818" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── Buildings ────────────────────────────────────────────────────────────────

function FinishedSchool({ fragile }: { fragile: boolean }) {
  const palette = BUILDING_PALETTE.maktab;
  return (
    <group>
      {/* Stone foundation */}
      <RoundedBox args={[2.4, 0.2, 1.8]} radius={0.02} position={[0, 0.1, 0]} castShadow>
        <meshStandardMaterial color="#6e655a" roughness={0.95} />
      </RoundedBox>
      {/* Main body — 2 floors */}
      <RoundedBox args={[2.2, 1.7, 1.6]} radius={0.04} position={[0, 1.05, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={palette.body} roughness={0.85} metalness={0.05} />
      </RoundedBox>
      {/* Floor divider line */}
      <mesh position={[0, 1.4, 0.81]}>
        <planeGeometry args={[2.2, 0.04]} />
        <meshStandardMaterial color="#5a4030" roughness={0.9} />
      </mesh>
      {/* Window grid — 2 rows × 4 windows */}
      {[-0.78, -0.26, 0.26, 0.78].flatMap((x) =>
        [0.85, 1.6].map((y, i) => (
          <group key={`w-${x}-${i}`} position={[x, y, 0.81]}>
            {/* Window frame */}
            <mesh>
              <planeGeometry args={[0.32, 0.42]} />
              <meshStandardMaterial color="#3a2818" roughness={0.9} />
            </mesh>
            {/* Glass */}
            <mesh position={[0, 0, 0.005]}>
              <planeGeometry args={[0.26, 0.36]} />
              <meshStandardMaterial color={palette.window} emissive={palette.window} emissiveIntensity={0.18} roughness={0.2} />
            </mesh>
            {/* Cross mullion */}
            <mesh position={[0, 0, 0.01]}>
              <planeGeometry args={[0.04, 0.36]} />
              <meshStandardMaterial color="#3a2818" />
            </mesh>
            <mesh position={[0, 0, 0.01]}>
              <planeGeometry args={[0.26, 0.04]} />
              <meshStandardMaterial color="#3a2818" />
            </mesh>
          </group>
        )),
      )}
      {/* Door */}
      <mesh position={[0, 0.55, 0.81]}>
        <planeGeometry args={[0.42, 0.7]} />
        <meshStandardMaterial color="#4a2818" roughness={0.95} />
      </mesh>
      <mesh position={[0.13, 0.55, 0.815]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.4} />
      </mesh>
      {/* School sign over door */}
      <mesh position={[0, 0.95, 0.81]}>
        <planeGeometry args={[0.6, 0.12]} />
        <meshStandardMaterial color="#1c1917" />
      </mesh>
      {/* Roof — sloped tile */}
      <mesh position={[0, 2.0, 0]} rotation={[0, 0, 0]} castShadow>
        <boxGeometry args={[2.4, 0.22, 1.8]} />
        <meshStandardMaterial color={palette.roof} roughness={0.95} />
      </mesh>
      {/* Flag pole */}
      <mesh position={[0, 2.55, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.9, 8]} />
        <meshStandardMaterial color="#a8a29e" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0.22, 2.78, 0]}>
        <planeGeometry args={[0.42, 0.26]} />
        <meshStandardMaterial color="#1e6b3a" side={THREE.DoubleSide} roughness={0.85} />
      </mesh>
      {!fragile && <Sparkles count={18} scale={[3, 2, 3]} size={2.5} speed={0.4} color="#fde68a" position={[0, 1.3, 0]} />}
      {fragile && <Cloud opacity={0.45} speed={0.4} segments={8} bounds={[1.5, 0.5, 1]} position={[0, 2.6, 0]} />}
    </group>
  );
}

function FinishedHospital({ fragile }: { fragile: boolean }) {
  const p = BUILDING_PALETTE.shifoxona;
  return (
    <group>
      {/* Stone base */}
      <RoundedBox args={[2.2, 0.18, 1.8]} radius={0.02} position={[0, 0.09, 0]} castShadow>
        <meshStandardMaterial color="#6e655a" roughness={0.95} />
      </RoundedBox>
      {/* Main 3-floor body */}
      <RoundedBox args={[2.0, 2.3, 1.6]} radius={0.04} position={[0, 1.35, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={p.body} roughness={0.7} metalness={0.05} />
      </RoundedBox>
      {/* Floor dividers */}
      {[0.95, 1.7].map((y, i) => (
        <mesh key={`fd-${i}`} position={[0, y, 0.81]}>
          <planeGeometry args={[2.0, 0.03]} />
          <meshStandardMaterial color="#a09c92" />
        </mesh>
      ))}
      {/* Red cross sign at top center */}
      <mesh position={[0, 2.0, 0.81]}>
        <planeGeometry args={[0.55, 0.14]} />
        <meshStandardMaterial color="#9b2c2c" emissive="#9b2c2c" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 2.0, 0.81]}>
        <planeGeometry args={[0.14, 0.55]} />
        <meshStandardMaterial color="#9b2c2c" emissive="#9b2c2c" emissiveIntensity={0.3} />
      </mesh>
      {/* Window grid 3 floors × 4 cols */}
      {[-0.7, -0.23, 0.23, 0.7].flatMap((x) =>
        [0.55, 1.3, 2.0].map((y, i) => (
          <group key={`hw-${x}-${i}`} position={[x, y, 0.81]}>
            <mesh>
              <planeGeometry args={[0.26, 0.32]} />
              <meshStandardMaterial color="#5a4030" />
            </mesh>
            <mesh position={[0, 0, 0.005]}>
              <planeGeometry args={[0.22, 0.28]} />
              <meshStandardMaterial color={p.window} emissive={p.window} emissiveIntensity={0.2} roughness={0.25} />
            </mesh>
          </group>
        )),
      )}
      {/* Door */}
      <mesh position={[0, 0.4, 0.81]}>
        <planeGeometry args={[0.5, 0.6]} />
        <meshStandardMaterial color="#3a2818" roughness={0.95} />
      </mesh>
      {/* Roof slab */}
      <mesh position={[0, 2.6, 0]} castShadow>
        <boxGeometry args={[2.2, 0.18, 1.8]} />
        <meshStandardMaterial color={p.roof} roughness={0.85} />
      </mesh>
      {/* HVAC unit */}
      <mesh position={[0.7, 2.78, -0.3]} castShadow>
        <boxGeometry args={[0.3, 0.18, 0.3]} />
        <meshStandardMaterial color="#5a5a5e" metalness={0.5} roughness={0.5} />
      </mesh>
      {!fragile && <Sparkles count={18} scale={[3, 2.5, 3]} size={2.5} speed={0.35} color="#dcd6c8" position={[0, 1.5, 0]} />}
      {fragile && <Cloud opacity={0.45} speed={0.4} segments={8} bounds={[1.5, 0.5, 1]} position={[0, 3, 0]} />}
    </group>
  );
}

function FinishedRoads({ fragile }: { fragile: boolean }) {
  const p = BUILDING_PALETTE.yollar;
  return (
    <group>
      {/* Highlighted asphalt patch */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
        <planeGeometry args={[2.4, 1.6]} />
        <meshStandardMaterial color={p.body} />
      </mesh>
      {/* Lane stripes */}
      {[-0.8, 0, 0.8].map((x, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.04, 0]}>
          <planeGeometry args={[0.3, 0.08]} />
          <meshStandardMaterial color={p.window} />
        </mesh>
      ))}
      {/* A passing car on this segment */}
      <PassingCar fragile={fragile} />
      {!fragile && <Sparkles count={12} scale={[2.5, 0.5, 1.5]} size={2.4} color="#facc15" position={[0, 0.3, 0]} />}
      {fragile && (
        <>
          {/* Pothole */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.5, 0.05, 0.2]}>
            <circleGeometry args={[0.18, 16]} />
            <meshStandardMaterial color="#1c1917" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.4, 0.05, -0.3]}>
            <circleGeometry args={[0.12, 16]} />
            <meshStandardMaterial color="#1c1917" />
          </mesh>
        </>
      )}
    </group>
  );
}

function PassingCar({ fragile }: { fragile: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) {
      ref.current.position.x = ((Date.now() % 5000) / 5000) * 2.4 - 1.2;
    }
  });
  return (
    <group ref={ref} position={[0, 0.2, 0]}>
      <RoundedBox args={[0.5, 0.25, 0.3]} radius={0.05} position={[0, 0, 0]}>
        <meshStandardMaterial color={fragile ? '#475569' : '#e11d48'} />
      </RoundedBox>
      <RoundedBox args={[0.3, 0.18, 0.28]} radius={0.04} position={[-0.05, 0.18, 0]}>
        <meshStandardMaterial color={fragile ? '#1e293b' : '#9f1239'} />
      </RoundedBox>
    </group>
  );
}

function FinishedLights({ fragile }: { fragile: boolean }) {
  const p = BUILDING_PALETTE.chiroqlar;
  const lampRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (lampRef.current && fragile) {
      // Flicker for fragile lights
      lampRef.current.emissiveIntensity = 0.2 + Math.random() * 0.6;
    }
  });
  return (
    <group>
      {/* Pole */}
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 2.0, 6]} />
        <meshStandardMaterial color={p.body} />
      </mesh>
      {/* Arm */}
      <mesh position={[0.3, 1.95, 0]} castShadow>
        <boxGeometry args={[0.6, 0.06, 0.06]} />
        <meshStandardMaterial color={p.body} />
      </mesh>
      {/* Lamp head */}
      <mesh position={[0.6, 1.85, 0]} castShadow>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial
          ref={lampRef}
          color={p.window}
          emissive={p.window}
          emissiveIntensity={fragile ? 0.4 : 1.2}
        />
      </mesh>
      <pointLight
        position={[0.6, 1.85, 0]}
        intensity={fragile ? 0.3 : 0.8}
        color={p.window}
        distance={4}
      />
      {!fragile && <Sparkles count={8} scale={[1.5, 1, 1.5]} size={2} color="#fef9c3" position={[0.6, 1.85, 0]} />}
    </group>
  );
}

function FinishedKindergarten({ fragile }: { fragile: boolean }) {
  const p = BUILDING_PALETTE.bogcha;
  return (
    <group>
      <RoundedBox args={[2.0, 1.4, 1.6]} radius={0.1} position={[0, 0.7, 0]} castShadow>
        <meshStandardMaterial color={p.body} />
      </RoundedBox>
      {/* Round windows */}
      {[-0.6, 0, 0.6].map((x, i) => (
        <mesh key={i} position={[x, 0.8, 0.81]}>
          <circleGeometry args={[0.18, 16]} />
          <meshStandardMaterial color={p.window} emissive={p.window} emissiveIntensity={0.3} />
        </mesh>
      ))}
      {/* Curved roof */}
      <mesh position={[0, 1.5, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[1.4, 0.6, 4]} />
        <meshStandardMaterial color={p.roof} />
      </mesh>
      {/* Slide */}
      <mesh position={[1.3, 0.4, 0]} rotation={[0, 0, -Math.PI / 4]} castShadow>
        <boxGeometry args={[0.8, 0.08, 0.4]} />
        <meshStandardMaterial color="#fbbf24" />
      </mesh>
      {!fragile && <Sparkles count={20} scale={[3, 2, 3]} size={3} speed={0.5} color="#fbcfe8" position={[0, 1, 0]} />}
      {fragile && <Cloud opacity={0.5} speed={0.4} segments={8} bounds={[1.5, 0.5, 1]} position={[0, 2, 0]} />}
    </group>
  );
}

function FinishedBuilding({ buildingId, fragile }: { buildingId: BuildingId; fragile: boolean }) {
  if (buildingId === 'maktab') return <FinishedSchool fragile={fragile} />;
  if (buildingId === 'shifoxona') return <FinishedHospital fragile={fragile} />;
  if (buildingId === 'yollar') return <FinishedRoads fragile={fragile} />;
  if (buildingId === 'chiroqlar') return <FinishedLights fragile={fragile} />;
  return <FinishedKindergarten fragile={fragile} />;
}

// ── Damaged + Ruined ─────────────────────────────────────────────────────────

function DamagedBuilding({ buildingId }: { buildingId: BuildingId }) {
  const palette = BUILDING_PALETTE[buildingId];
  return (
    <group>
      <RoundedBox args={[1.8, 1.4, 1.4]} radius={0.05} position={[0, 0.7, 0]} castShadow>
        <meshStandardMaterial color={palette.body} />
      </RoundedBox>
      <Cloud opacity={0.3} speed={0.4} segments={6} bounds={[1.5, 0.5, 1]} position={[0, 1.8, 0]} />
    </group>
  );
}

function RuinedBuilding({ buildingId }: { buildingId: BuildingId }) {
  const palette = BUILDING_PALETTE[buildingId];
  // Random rubble pile (deterministic by buildingId for stability)
  const rubble = useMemo(() => {
    const seed = buildingId.charCodeAt(0);
    const items: { p: [number, number, number]; r: [number, number, number]; s: number }[] = [];
    for (let i = 0; i < 12; i++) {
      items.push({
        p: [
          ((Math.sin(seed + i * 1.7) + 1) - 1) * 0.8,
          0.05 + Math.abs(Math.sin(seed + i)) * 0.3,
          ((Math.cos(seed + i * 2.1) + 1) - 1) * 0.8,
        ] as [number, number, number],
        r: [
          Math.sin(seed + i),
          Math.cos(seed + i * 1.3),
          Math.sin(seed + i * 0.7),
        ] as [number, number, number],
        s: 0.18 + Math.abs(Math.sin(seed + i * 0.3)) * 0.15,
      });
    }
    return items;
  }, [buildingId]);

  return (
    <group>
      {rubble.map((r, i) => (
        <mesh key={i} position={r.p} rotation={r.r} castShadow>
          <boxGeometry args={[r.s, r.s, r.s]} />
          <meshStandardMaterial color={i % 2 === 0 ? palette.body : '#3f3f46'} roughness={1} />
        </mesh>
      ))}
      <Cloud opacity={0.55} speed={0.3} segments={10} bounds={[2, 0.6, 1.5]} position={[0, 0.8, 0]} />
    </group>
  );
}

// ── Empty plot — clickable ───────────────────────────────────────────────────

function EmptyPlot({ plotIdx, onClick }: { plotIdx: number; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);
  const markerRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (markerRef.current) {
      const t = Date.now() * 0.003;
      markerRef.current.position.y = 0.55 + Math.sin(t) * 0.12;
      markerRef.current.rotation.y = t * 0.5;
    }
  });

  useEffect(() => {
    if (hovered) document.body.style.cursor = 'pointer';
    return () => { document.body.style.cursor = ''; };
  }, [hovered]);

  return (
    <group>
      {/* Soil/dirt patch */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.025, 0]}
        receiveShadow
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
      >
        <planeGeometry args={[2.2, 1.8]} />
        <meshStandardMaterial color={hovered ? '#a85a18' : '#7a4818'} roughness={1} />
      </mesh>

      {/* Glowing border ring when hovered */}
      {hovered && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <ringGeometry args={[1.05, 1.15, 32]} />
          <meshBasicMaterial color="#facc15" transparent opacity={0.6} />
        </mesh>
      )}

      {/* Floating plus sign */}
      <group ref={markerRef} position={[0, 0.55, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.6, 0.12, 0.12]} />
          <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={hovered ? 0.6 : 0.25} roughness={0.4} />
        </mesh>
        <mesh castShadow>
          <boxGeometry args={[0.12, 0.6, 0.12]} />
          <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={hovered ? 0.6 : 0.25} roughness={0.4} />
        </mesh>
      </group>

      {/* Plot number plate */}
      <mesh position={[0, 0.05, 0.85]} rotation={[-Math.PI / 4, 0, 0]}>
        <planeGeometry args={[0.4, 0.18]} />
        <meshStandardMaterial color="#1c1917" />
      </mesh>

      {/* Traffic cones at corners */}
      {[[-0.95, -0.75], [0.95, -0.75], [-0.95, 0.75], [0.95, 0.75]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.18, 0]} castShadow>
            <coneGeometry args={[0.12, 0.36, 8]} />
            <meshStandardMaterial color="#ea580c" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.18, 0]}>
            <coneGeometry args={[0.13, 0.05, 8]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── Construction site ────────────────────────────────────────────────────────

function ConstructionSite({
  buildingId,
  stage,
  fragile,
}: {
  buildingId: BuildingId;
  stage: number; // 0,1,2,3
  fragile: boolean;
}) {
  const palette = BUILDING_PALETTE[buildingId];
  const craneRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (craneRef.current) {
      craneRef.current.rotation.y = Math.sin(Date.now() * 0.001) * 0.4;
    }
  });

  // Stage scaling
  const stage1Scale = stage >= 1 ? 1 : 0;
  const stage2Scale = stage >= 2 ? 1 : 0;
  const stage3Scale = stage >= 3 ? 1 : 0;

  return (
    <group>
      {/* Foundation slab — appears at stage 1 */}
      {stage1Scale > 0 && (
        <RoundedBox
          args={[2.2, 0.15, 1.7]}
          radius={0.02}
          position={[0, 0.075, 0]}
          castShadow
        >
          <meshStandardMaterial color="#a8a29e" />
        </RoundedBox>
      )}

      {/* Walls — stage 2 */}
      {stage2Scale > 0 && (
        <Risen
          stageJustReached={stage === 2}
          position={[0, 1, 0]}
          args={[2.0, 1.5, 1.5]}
          color={palette.body}
        />
      )}

      {/* Roof + finish — stage 3 */}
      {stage3Scale > 0 && (
        <Risen
          stageJustReached={stage === 3}
          position={[0, 2, 0]}
          args={[2.2, 0.2, 1.7]}
          color={palette.roof}
          isRoof
        />
      )}

      {/* Crane (only while building) */}
      {stage < 3 && (
        <group ref={craneRef} position={[1.6, 0, 1.6]}>
          {/* Mast */}
          <mesh position={[0, 1.5, 0]} castShadow>
            <boxGeometry args={[0.1, 3, 0.1]} />
            <meshStandardMaterial color="#facc15" />
          </mesh>
          {/* Boom */}
          <mesh position={[-1, 2.8, 0]} castShadow>
            <boxGeometry args={[2, 0.1, 0.1]} />
            <meshStandardMaterial color="#facc15" />
          </mesh>
          {/* Cable */}
          <mesh position={[-1.8, 2.2, 0]}>
            <boxGeometry args={[0.02, 1.2, 0.02]} />
            <meshStandardMaterial color="#1c1917" />
          </mesh>
          {/* Hook + brick */}
          <mesh position={[-1.8, 1.6, 0]} castShadow>
            <boxGeometry args={[0.3, 0.2, 0.3]} />
            <meshStandardMaterial color={palette.body} />
          </mesh>
        </group>
      )}

      {/* Worker */}
      {stage < 3 && (
        <group position={[-1.6, 0, -1.6]}>
          <Worker />
        </group>
      )}
      {/* Second worker on the other side */}
      {stage >= 1 && stage < 3 && (
        <group position={[1.5, 0, 1.5]}>
          <Worker />
        </group>
      )}

      {/* Cement mixer with rotating drum */}
      {stage < 3 && <CementMixer />}

      {/* Brick pile */}
      {stage < 2 && <BrickPile />}

      {/* Scaffolding around the building during walls stage */}
      {stage === 2 && <Scaffolding />}

      {/* Dust */}
      {stage < 3 && (
        <Sparkles count={14} scale={[2.5, 1.2, 2]} size={2} color="#d4d0c4" speed={0.4} position={[0, 0.6, 0]} />
      )}
    </group>
  );
}

function CementMixer() {
  const drumRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (drumRef.current) drumRef.current.rotation.z = Date.now() * 0.003;
  });
  return (
    <group position={[1.5, 0, -1.6]}>
      {/* Body */}
      <mesh position={[0, 0.18, 0]} castShadow>
        <boxGeometry args={[0.4, 0.3, 0.5]} />
        <meshStandardMaterial color="#d4a020" roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Drum (rotating) */}
      <mesh ref={drumRef} position={[0, 0.45, 0]} rotation={[0.4, 0, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.22, 0.45, 12]} />
        <meshStandardMaterial color="#a8a29e" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* Wheels */}
      {[[-0.18, 0.22], [0.18, 0.22], [-0.18, -0.22], [0.18, -0.22]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.07, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 0.04, 12]} />
          <meshStandardMaterial color="#1c1917" />
        </mesh>
      ))}
    </group>
  );
}

function BrickPile() {
  const bricks = useMemo(() => {
    const arr: { p: [number, number, number]; rot: number; color: string }[] = [];
    const colors = ['#a04030', '#8a3525', '#b04835'];
    for (let i = 0; i < 8; i++) {
      arr.push({
        p: [
          Math.sin(i * 1.7) * 0.18,
          0.04 + Math.floor(i / 3) * 0.08,
          Math.cos(i * 1.3) * 0.15,
        ] as [number, number, number],
        rot: (i * 23) % Math.PI,
        color: colors[i % colors.length],
      });
    }
    return arr;
  }, []);
  return (
    <group position={[-1.5, 0, 1.5]}>
      {bricks.map((b, i) => (
        <mesh key={i} position={b.p} rotation={[0, b.rot, 0]} castShadow>
          <boxGeometry args={[0.22, 0.08, 0.12]} />
          <meshStandardMaterial color={b.color} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

function Scaffolding() {
  // 4 corner posts + horizontal cross beams forming a frame around the building
  const posts: [number, number][] = [[-1.2, 1.0], [1.2, 1.0], [-1.2, -1.0], [1.2, -1.0]];
  return (
    <group>
      {posts.map(([x, z], i) => (
        <mesh key={`p-${i}`} position={[x, 0.95, z]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 1.9, 6]} />
          <meshStandardMaterial color="#a8a29e" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      {/* Top beams (4 sides) */}
      <mesh position={[0, 1.85, 1.0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, 2.4, 6]} />
        <meshStandardMaterial color="#a8a29e" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.85, -1.0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, 2.4, 6]} />
        <meshStandardMaterial color="#a8a29e" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[1.2, 1.85, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 2.0, 6]} />
        <meshStandardMaterial color="#a8a29e" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[-1.2, 1.85, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 2.0, 6]} />
        <meshStandardMaterial color="#a8a29e" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Mid beams */}
      <mesh position={[0, 1.0, 1.0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 2.4, 6]} />
        <meshStandardMaterial color="#a8a29e" />
      </mesh>
      <mesh position={[0, 1.0, -1.0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 2.4, 6]} />
        <meshStandardMaterial color="#a8a29e" />
      </mesh>
      {/* Wooden walkway plank at mid-height */}
      <mesh position={[0, 1.05, 1.0]} castShadow>
        <boxGeometry args={[2.4, 0.04, 0.2]} />
        <meshStandardMaterial color="#8b5a2b" roughness={0.95} />
      </mesh>
    </group>
  );
}

function Risen({
  stageJustReached,
  position,
  args,
  color,
  isRoof = false,
}: {
  stageJustReached: boolean;
  position: [number, number, number];
  args: [number, number, number];
  color: string;
  isRoof?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const targetY = position[1];
  const fromY = useRef(stageJustReached ? targetY - 1.5 : targetY);

  useEffect(() => {
    fromY.current = stageJustReached ? targetY - 1.5 : targetY;
  }, [stageJustReached, targetY]);

  useFrame((_, dt) => {
    if (!ref.current) return;
    const cur = ref.current.position.y;
    const next = THREE.MathUtils.damp(cur, targetY, 6, dt);
    ref.current.position.y = next;
    // Slight squash while landing
    const k = Math.min(1, Math.abs(next - targetY) * 2);
    ref.current.scale.y = isRoof ? 1 - k * 0.5 : 1 + k * 0.1;
  });

  return (
    <group ref={ref} position={[position[0], stageJustReached ? targetY - 1.5 : targetY, position[2]]}>
      <RoundedBox args={args} radius={0.05} position={[0, 0, 0]} castShadow>
        <meshStandardMaterial color={color} />
      </RoundedBox>
    </group>
  );
}

function Worker() {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) {
      ref.current.position.x = Math.sin(Date.now() * 0.002) * 0.4;
    }
  });
  return (
    <group ref={ref}>
      {/* Body */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[0.25, 0.5, 0.18]} />
        <meshStandardMaterial color="#fb923c" />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.78, 0]} castShadow>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshStandardMaterial color="#fde68a" />
      </mesh>
      {/* Hard hat */}
      <mesh position={[0, 0.92, 0]} castShadow>
        <coneGeometry args={[0.18, 0.15, 12]} />
        <meshStandardMaterial color="#fbbf24" />
      </mesh>
    </group>
  );
}

// ============================================================================
//  PLOT NODE — index-based, supports empty (clickable) state
// ============================================================================

export interface PlotData {
  buildingId: BuildingId | null;
  state: BuildingState;
}

function PlotNode({
  plotIdx,
  plot,
  position,
  isConstructing,
  buildStage,
  onClick,
}: {
  plotIdx: number;
  plot: PlotData;
  position: [number, number, number];
  isConstructing: boolean;
  buildStage: number;
  onClick?: () => void;
}) {
  let content: React.ReactNode;
  if (!plot.buildingId || plot.state.status === 'qurilmagan') {
    content = <EmptyPlot plotIdx={plotIdx} onClick={onClick} />;
  } else if (isConstructing && plot.state.status === 'qurilyapti') {
    content = <ConstructionSite buildingId={plot.buildingId} stage={buildStage} fragile={plot.state.isFragile} />;
  } else if (plot.state.status === 'alo') {
    content = <FinishedBuilding buildingId={plot.buildingId} fragile={plot.state.isFragile} />;
  } else if (plot.state.status === 'shikastlangan') {
    content = <DamagedBuilding buildingId={plot.buildingId} />;
  } else if (plot.state.status === 'vayrona') {
    content = <RuinedBuilding buildingId={plot.buildingId} />;
  } else {
    content = <EmptyPlot plotIdx={plotIdx} onClick={onClick} />;
  }

  return <group position={position}>{content}</group>;
}

// ============================================================================
//  CARS — animated traffic
// ============================================================================

function Car({
  axis,
  z,
  speed = 1.5,
  color = '#ef4444',
}: {
  axis: 'x' | 'z';
  z: number;
  speed?: number;
  color?: string;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const t = ((Date.now() % (10000 / speed)) / (10000 / speed)) * 16 - 8;
    if (axis === 'x') ref.current.position.set(t, 0.2, z);
    else ref.current.position.set(z, 0.2, t);
  });
  return (
    <group ref={ref} rotation={axis === 'x' ? [0, 0, 0] : [0, Math.PI / 2, 0]}>
      <RoundedBox args={[0.6, 0.25, 0.32]} radius={0.05} castShadow>
        <meshStandardMaterial color={color} />
      </RoundedBox>
      <RoundedBox args={[0.32, 0.18, 0.3]} radius={0.04} position={[-0.05, 0.2, 0]} castShadow>
        <meshStandardMaterial color="#1e293b" />
      </RoundedBox>
      <mesh position={[0.18, -0.15, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.05, 8]} />
        <meshStandardMaterial color="#000" />
      </mesh>
    </group>
  );
}

// ============================================================================
//  CAMERA CONTROLLER — auto-fly to constructing plot
// ============================================================================

function CameraController({
  target,
  closeUp,
}: {
  target: [number, number, number];
  closeUp: boolean;
}) {
  const { camera } = useThree();

  useFrame((_, dt) => {
    // closeUp = constructing → zoom in low orbit; idle → tighter top-down
    const offset = closeUp ? { x: 5, y: 6, z: 5 } : { x: 7, y: 11, z: 7 };
    camera.position.x = THREE.MathUtils.damp(camera.position.x, target[0] + offset.x, 1.6, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, target[1] + offset.y, 1.6, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, target[2] + offset.z, 1.6, dt);
    camera.lookAt(target[0], target[1], target[2]);
  });

  return null;
}

// ============================================================================
//  MAIN SCENE
// ============================================================================

interface Scene3DProps {
  plots: PlotData[];                     // 5 plots
  constructingPlotIdx: number | null;
  buildStage: number;
  shakeKey: number;
  skyColor: { top: string; bot: string };
  onPlotClick?: (plotIdx: number) => void;
}

function ShakingGroup({ shakeKey, children }: { shakeKey: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const shakeStart = useRef(0);
  useEffect(() => {
    if (shakeKey > 0) shakeStart.current = Date.now();
  }, [shakeKey]);
  useFrame(() => {
    if (!ref.current) return;
    const t = (Date.now() - shakeStart.current) / 800;
    if (t < 1) {
      const k = (1 - t) * 0.25;
      ref.current.position.x = Math.sin(t * 50) * k;
      ref.current.position.z = Math.cos(t * 47) * k;
      ref.current.rotation.z = Math.sin(t * 40) * k * 0.05;
    } else {
      ref.current.position.x = 0;
      ref.current.position.z = 0;
      ref.current.rotation.z = 0;
    }
  });
  return <group ref={ref}>{children}</group>;
}

export function Scene3D({
  plots,
  constructingPlotIdx,
  buildStage,
  shakeKey,
  skyColor,
  onPlotClick,
}: Scene3DProps) {
  const cameraTarget: [number, number, number] =
    constructingPlotIdx !== null ? PLOT_POSITIONS[constructingPlotIdx] : [0, 0, 0];

  return (
    <Canvas
      shadows
      camera={{ position: [8, 12, 8], fov: 30 }}
      gl={{ antialias: true }}
      dpr={[1, 2]}
    >
      <color attach="background" args={[skyColor.top]} />
      <fog attach="fog" args={[skyColor.bot, 14, 38]} />

      <hemisphereLight args={[skyColor.top, '#7a9266', 0.55]} />
      <ambientLight intensity={0.32} />
      <directionalLight
        position={[8, 16, 5]}
        intensity={1.15}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />

      <ShakingGroup shakeKey={shakeKey}>
        <Ground />
        <Roads />

        {plots.map((plot, i) => (
          <PlotNode
            key={i}
            plotIdx={i}
            plot={plot}
            position={PLOT_POSITIONS[i]}
            isConstructing={constructingPlotIdx === i}
            buildStage={buildStage}
            onClick={onPlotClick ? () => onPlotClick(i) : undefined}
          />
        ))}

        {HOUSE_POSITIONS.map((h, i) => (
          <House key={`h-${i}`} position={h.pos} color={h.color} roof={h.roof} />
        ))}

        {TREE_POSITIONS.map((p, i) => (
          <Tree key={`t-${i}`} position={p} />
        ))}

        <Car axis="x" z={-1.85} speed={0.7} color="#a82828" />
        <Car axis="x" z={1.85} speed={1.0} color="#2c4a8a" />
        <Car axis="z" z={-1.85} speed={0.5} color="#a89028" />
        <Car axis="z" z={1.85} speed={0.8} color="#3a6a3a" />
        <Car axis="x" z={-1.85} speed={0.4} color="#5a5a60" />
        <Car axis="z" z={1.85} speed={1.1} color="#6e3a18" />

        {CITIZEN_PATHS.map((p, i) => (
          <Citizen key={`cit-${i}`} {...p} />
        ))}

        <ContactShadows position={[0, 0.05, 0]} opacity={0.4} scale={20} blur={2} far={4} />
      </ShakingGroup>

      <CameraController target={cameraTarget} closeUp={constructingPlotIdx !== null} />
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        maxPolarAngle={Math.PI / 2.5}
        minPolarAngle={Math.PI / 4.5}
        minDistance={9}
        maxDistance={16}
        target={[cameraTarget[0], cameraTarget[1], cameraTarget[2]]}
        autoRotate={constructingPlotIdx === null}
        autoRotateSpeed={0.25}
      />
    </Canvas>
  );
}
