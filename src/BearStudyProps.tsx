import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, DoubleSide, Group, SRGBColorSpace } from 'three';
import type { StudyStyle } from './bearAnimations';

export function WritingPencil() {
  return <group position={[0, -0.59, 0.78]} rotation={[0.15, 0, -0.28]}>
    <mesh castShadow><cylinderGeometry args={[0.09, 0.09, 1.15, 6]} /><meshStandardMaterial color="#ecc65b" roughness={0.5} /></mesh>
    <mesh position={[0, -0.68, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.09, 0.22, 6]} /><meshStandardMaterial color="#bb966a" /></mesh>
    <mesh position={[0, -0.79, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.035, 0.09, 6]} /><meshStandardMaterial color="#4e4b43" /></mesh>
    <mesh position={[0, 0.63, 0]}><cylinderGeometry args={[0.095, 0.095, 0.14, 8]} /><meshStandardMaterial color="#d9a5ac" /></mesh>
  </group>;
}

export function Headphones() {
  return <group position={[0, 1.03, -0.02]}>
    <mesh castShadow><torusGeometry args={[0.47, 0.045, 8, 30, Math.PI]} /><meshStandardMaterial color="#b0b8c6" roughness={0.6} /></mesh>
    <mesh position={[0, 0.035, 0]}><torusGeometry args={[0.42, 0.025, 8, 30, Math.PI]} /><meshStandardMaterial color="#dce0e4" /></mesh>
    {[-1, 1].map(side => <group key={side} position={[side * 0.45, -0.01, 0.04]}>
      <mesh scale={[0.085, 0.21, 0.16]} castShadow><sphereGeometry args={[1, 16, 16]} /><meshStandardMaterial color="#aeb7c8" roughness={0.55} metalness={0.15} /></mesh>
      <mesh position={[-side * 0.045, 0, 0]} scale={[0.04, 0.17, 0.13]}><sphereGeometry args={[1, 12, 12]} /><meshStandardMaterial color="#707782" /></mesh>
    </group>)}
  </group>;
}

function Page({ width = 0.26 }: { width?: number }) {
  return <group>
    <mesh><boxGeometry args={[width, 0.023, 0.37]} /><meshStandardMaterial color="#fff5dd" /></mesh>
    {[-0.1, -0.04, 0.02, 0.08].map(z => <mesh key={z} position={[0, 0.0125, z]}><boxGeometry args={[width * 0.75, 0.003, 0.007]} /><meshStandardMaterial color="#abae9e" /></mesh>)}
  </group>;
}

function Book({ changedAt }: { changedAt: number }) {
  const page = useRef<Group>(null);
  useFrame(() => {
    if (!page.current) return;
    const phase = ((Date.now() - changedAt) % 6000 + 6000) / 6000;
    page.current.rotation.z = phase < 0.28 ? Math.PI * phase / 0.28 : Math.PI;
  });
  return <group position={[0, 0.99, 0.53]} rotation={[-0.38, 0, 0]}>
    <mesh position={[0, -0.026, 0]} castShadow><boxGeometry args={[0.62, 0.035, 0.43]} /><meshStandardMaterial color="#9eac82" /></mesh>
    <group position={[-0.15, 0, 0]} rotation={[0, 0, 0.1]}><Page /></group>
    <group position={[0.15, 0, 0]} rotation={[0, 0, -0.1]}><Page /></group>
    <group ref={page} position={[0, 0.033, 0]}><mesh position={[0.14, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.27, 0.36]} /><meshStandardMaterial color="#fff8e6" side={DoubleSide} /></mesh></group>
  </group>;
}

export function StudyDeskProps({ style, changedAt }: { style: StudyStyle; changedAt: number }) {
  if (style === 'writing') return <group position={[0.17, 0.89, 0.53]} rotation={[0, -0.12, 0]}>
    <mesh position={[0, -0.018, 0]} castShadow><boxGeometry args={[0.55, 0.025, 0.44]} /><meshStandardMaterial color="#d9aa91" /></mesh>
    <Page width={0.49} />
    <mesh position={[-0.22, 0.015, 0]}><boxGeometry args={[0.015, 0.012, 0.4]} /><meshStandardMaterial color="#877764" /></mesh>
  </group>;
  if (style === 'reading') return <Book changedAt={changedAt} />;
  if (style === 'typing') return <group position={[0, 0.89, 0.5]}>
    <mesh castShadow><boxGeometry args={[0.65, 0.035, 0.26]} /><meshStandardMaterial color="#c7c3d0" /></mesh>
    {[0, 1, 2].flatMap(row => [0, 1, 2, 3, 4, 5, 6].map(column => <mesh key={row + '-' + column} position={[-0.26 + column * 0.086, 0.024, -0.075 + row * 0.075]}><boxGeometry args={[0.062, 0.013, 0.048]} /><meshStandardMaterial color="#f0edee" /></mesh>))}
  </group>;
  return null;
}

export function ThoughtBubble() {
  const root = useRef<Group>(null);
  useFrame(({ clock }) => { if (root.current) root.current.position.y = 1.65 + Math.sin(clock.elapsedTime * 1.5) * 0.035; });
  return <group ref={root} position={[-0.53, 1.65, 0.1]}>
    <mesh scale={[0.23, 0.15, 0.09]}><sphereGeometry args={[1, 16, 12]} /><meshStandardMaterial color="#fffdf2" /></mesh>
    <mesh position={[0.14, -0.18, 0]}><sphereGeometry args={[0.047, 10, 10]} /><meshStandardMaterial color="#fffdf2" /></mesh>
    {[-0.09, 0, 0.09].map(x => <mesh key={x} position={[x, 0, 0.09]}><sphereGeometry args={[0.017, 8, 8]} /><meshStandardMaterial color="#514e47" /></mesh>)}
  </group>;
}

export function KnockBubble() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 192; canvas.height = 96;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#fff2bb'; context.beginPath(); context.roundRect(3, 3, 186, 90, 20); context.fill();
    context.strokeStyle = '#6c644b'; context.lineWidth = 3; context.stroke();
    context.font = '700 47px "Malgun Gothic", sans-serif'; context.fillStyle = '#453f34'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText('톡톡!', 96, 48);
    const result = new CanvasTexture(canvas); result.colorSpace = SRGBColorSpace; return result;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return <sprite position={[0.48, 1.27, 0.4]} scale={[0.64, 0.32, 1]} renderOrder={21} raycast={() => {}}><spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} /></sprite>;
}
