import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh, MeshBasicMaterial } from 'three';
import { JUMP_DURATION_MS, KNOCK_DURATION_MS, useRoomStore } from './roomStore';
import { playKnockSound, playWoodStep } from './roomAudio';

const POOL_SIZE = 28;
const LIFETIME = 1.8;
interface Track {
  x: number;
  z: number;
  distance: number;
  left: boolean;
  lastStep: number;
  status: string;
  knock: number | null;
  jump: number | null;
  jumpArmed: boolean;
  airborne: boolean;
}
interface Stamp { x: number; z: number; rotation: number; born: number; own: boolean; landing: boolean; }

/** A bounded pool avoids React updates and geometry allocation on every step. */
export function FloorEffects() {
  const groups = useRef<(Group | null)[]>([]);
  const tracks = useRef(new Map<string, Track>());
  const stamps = useMemo<Stamp[]>(() => Array.from({ length: POOL_SIZE }, () => ({ x: 0, z: 0, rotation: 0, born: -100, own: false, landing: false })), []);
  const next = useRef(0);

  useFrame(({ clock }) => {
    const elapsed = clock.elapsedTime;
    const state = useRoomStore.getState();
    const now = Date.now() + state.serverOffsetMs;
    const alive = new Set(state.players.map(player => player.id));
    for (const id of tracks.current.keys()) if (!alive.has(id)) tracks.current.delete(id);

    for (const player of state.players) {
      let track = tracks.current.get(player.id);
      const [x, z] = player.position;
      const locked = player.status === 'studying' || (player.knockUntil !== null && player.knockUntil > now);
      const jump = player.jumpStartedAt ?? null;
      const airborne = !locked && jump !== null && now >= jump && now < jump + JUMP_DURATION_MS;
      if (!track) {
        // Existing airborne snapshots are late joins, not locally observed takeoffs.
        track = { x, z, distance: 0, left: false, lastStep: elapsed, status: player.status, knock: null, jump, jumpArmed: false, airborne };
        tracks.current.set(player.id, track);
      }
      if (player.knockUntil && player.knockUntil > now && player.knockUntil !== track.knock) {
        playKnockSound((now - (player.knockUntil - KNOCK_DURATION_MS)) / 1000);
      }
      track.knock = player.knockUntil;
      const distance = Math.hypot(x - track.x, z - track.z);
      const jumpEnd = track.jump === null ? Infinity : track.jump + JUMP_DURATION_MS;
      const landed = player.id === state.myId && track.jumpArmed && track.airborne && !airborne && !locked
        && (jump === track.jump || jump === null) && track.status === player.status && distance <= 0.8
        && now >= jumpEnd && now - jumpEnd < 250;
      if (landed) {
        stamps[next.current] = { x, z, rotation: player.rotation, born: elapsed, own: true, landing: true };
        next.current = (next.current + 1) % POOL_SIZE;
        track.lastStep = elapsed;
        playWoodStep(false);
      }
      if (jump !== track.jump) {
        track.jump = jump;
        track.jumpArmed = jump !== null && !locked && now < jump + JUMP_DURATION_MS;
      }
      if (locked || jump === null || now >= jump + JUMP_DURATION_MS) track.jumpArmed = false;
      track.airborne = airborne;
      // Returning to a chair or receiving a new snapshot is not a footstep.
      const skipSteps = locked || airborne || landed;
      if (skipSteps || distance > 0.8 || track.status !== player.status) track.distance = 0;
      else track.distance += distance;
      if (!skipSteps && distance > 0.0001 && track.distance >= 0.5 && elapsed - track.lastStep > 0.17) {
        track.left = !track.left;
        const side = track.left ? -0.12 : 0.12;
        stamps[next.current] = {
          x: x + Math.cos(player.rotation) * side,
          z: z - Math.sin(player.rotation) * side,
          rotation: player.rotation,
          born: elapsed,
          own: player.id === state.myId,
          landing: false,
        };
        next.current = (next.current + 1) % POOL_SIZE;
        track.distance = 0;
        track.lastStep = elapsed;
        if (player.id === state.myId) playWoodStep(track.left);
      }
      track.x = x;
      track.z = z;
      track.status = player.status;
    }

    stamps.forEach((stamp, index) => {
      const group = groups.current[index];
      if (!group) return;
      const age = elapsed - stamp.born;
      group.visible = age >= 0 && age < LIFETIME;
      if (!group.visible) return;
      group.position.set(stamp.x, 0.041, stamp.z);
      group.rotation.y = stamp.rotation;
      group.scale.setScalar(stamp.landing ? 1.6 : 1);
      const fade = Math.pow(1 - age / LIFETIME, 1.3);
      group.children.forEach((child, part) => {
        const mesh = child as Mesh;
        const material = mesh.material as MeshBasicMaterial;
        material.opacity = fade * (part === 0 ? stamp.landing ? 0.7 : 0.42 : stamp.own ? 0.76 : 0.45);
        if (part === 0) mesh.scale.setScalar(1 + age * (stamp.landing ? 3.8 : 2.5));
      });
    });
  });

  return <group aria-label="걸음마다 나타나는 곰 발자국">
    {stamps.map((_, index) => <group key={index} ref={node => { groups.current[index] = node; }} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}><ringGeometry args={[0.12, 0.135, 24]} /><meshBasicMaterial color="#d1a45d" transparent opacity={0} depthWrite={false} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.77, 1]} position={[0, 0.002, -0.015]} raycast={() => {}}><circleGeometry args={[0.071, 16]} /><meshBasicMaterial color="#9d7848" transparent opacity={0} depthWrite={false} /></mesh>
      {[-0.062, 0, 0.062].map((x, toe) => <mesh key={toe} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.002, toe === 1 ? 0.103 : 0.078]} raycast={() => {}}><circleGeometry args={[0.029, 12]} /><meshBasicMaterial color="#9d7848" transparent opacity={0} depthWrite={false} /></mesh>)}
    </group>)}
  </group>;
}
