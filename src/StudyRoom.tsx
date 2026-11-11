import { Component, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { KeyboardControls, RoundedBox, useProgress } from '@react-three/drei';
import { Focus, Minus, Plus, RotateCcw } from 'lucide-react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { BearAvatar } from './BearAvatar';
import { useRoomStore } from './roomStore';
import { isEditing, setMovementKey, useMovementInput, type Direction } from './MovementPad';
import { resolveRoomMovement } from './roomMovement';
import { FloorEffects } from './FloorEffects';
import { RoomCamera, MIN_ROOM_ZOOM, MAX_ROOM_ZOOM, type CameraCommand } from './RoomCamera';

const chairColors = ['#b2bea0', '#c4b8da', '#a9bacd'];
const initialCamera = { position: [11, 11, 15] as [number, number, number], zoom: 53, near: 0.1, far: 80 };

function Box({ position, size, color, radius = 0.08 }: { position: [number, number, number]; size: [number, number, number]; color: string; radius?: number }) {
  return <RoundedBox args={size} position={position} radius={radius} smoothness={3} castShadow receiveShadow><meshStandardMaterial color={color} roughness={0.83} /></RoundedBox>;
}

function LabelPlane({ text, width, height, color = '#fff4d5', ink = '#594b3d', position, rotation = [0, 0, 0] }: { text: string; width: number; height: number; color?: string; ink?: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = Math.round(640 * height / width);
    const context = canvas.getContext('2d')!;
    context.fillStyle = color; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = ink; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.font = '600 42px "Malgun Gothic", sans-serif';
    const lines = text.split('\n');
    lines.forEach((line, index) => context.fillText(line, 320, canvas.height / 2 + (index - (lines.length - 1) / 2) * 58, 570));
    const result = new CanvasTexture(canvas); result.colorSpace = SRGBColorSpace;
    return result;
  }, [text, width, height, color, ink]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh position={position} rotation={rotation}><planeGeometry args={[width, height]} /><meshStandardMaterial map={texture} roughness={0.9} /></mesh>;
}

function Plant({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return <group position={position} scale={scale}>
    <mesh position={[0, 0.3, 0]} castShadow><cylinderGeometry args={[0.31, 0.24, 0.6, 24]} /><meshStandardMaterial color="#e7bc98" /></mesh>
    {[0, 1, 2, 3, 4].map(i => <mesh key={i} position={[Math.sin(i * 2.4) * 0.27, 0.8 + i % 2 * 0.2, Math.cos(i * 2.4) * 0.27]} rotation={[0.4, i, 0.6]} scale={[0.18, 0.48, 0.15]} castShadow><sphereGeometry args={[1, 12, 12]} /><meshStandardMaterial color={i % 2 ? '#8d9f68' : '#a5b57c'} /></mesh>)}
  </group>;
}

function Cup({ position, color = '#d8a58e' }: { position: [number, number, number]; color?: string }) {
  return <group position={position}>
    <mesh castShadow><cylinderGeometry args={[0.13, 0.1, 0.23, 20]} /><meshStandardMaterial color={color} roughness={0.5} /></mesh>
    <mesh position={[0, 0.118, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.11, 20]} /><meshStandardMaterial color="#79523b" /></mesh>
    <mesh position={[0.14, 0.01, 0]}><torusGeometry args={[0.075, 0.025, 8, 16]} /><meshStandardMaterial color={color} /></mesh>
  </group>;
}

function StudyDesk({ x, index }: { x: number; index: number }) {
  return <group position={[x, 0, 0]}>
    <mesh position={[0, 0.79, 1]} castShadow receiveShadow><cylinderGeometry args={[0.94, 0.94, 0.13, 48]} /><meshStandardMaterial color="#dfb790" /></mesh>
    <mesh position={[0, 0.39, 1]} castShadow><cylinderGeometry args={[0.13, 0.22, 0.78, 16]} /><meshStandardMaterial color="#cba17c" /></mesh>
    <Box position={[0, 0.35, -0.05]} size={[1.05, 0.18, 0.9]} color={chairColors[index]} />
    <Box position={[0, 0.75, -0.47]} size={[1.08, 0.9, 0.15]} color={chairColors[index]} radius={0.07} />
    <Box position={[0, 0.9, 0.85]} size={[0.65, 0.045, 0.47]} color="#b8b3cb" radius={0.02} />
    <group position={[0, 1.1, 1.05]} rotation={[0.2, 0, 0]}>
      <Box position={[0, 0, 0]} size={[0.65, 0.42, 0.04]} color="#c3bfd5" radius={0.02} />
      <LabelPlane position={[0, 0, -0.025]} rotation={[0, Math.PI, 0]} text={'{ co.gom }'} width={0.56} height={0.33} color="#414958" ink="#b7d7bb" />
    </group>
    <Cup position={[0.59, 0.98, 0.83]} color={index === 1 ? '#b4c69a' : '#e1b1a4'} />
  </group>;
}

function RoomGeometry() {
  const todos = useRoomStore(state => state.todos);
  return <group>
    <Box position={[0, -0.2, 0]} size={[12, 0.4, 8]} color="#e4c8a8" radius={0.13} />
    {Array.from({ length: 16 }, (_, i) => <mesh key={i} position={[0, 0.009, -3.75 + i * 0.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[11.8, 0.485]} /><meshStandardMaterial color={i % 3 ? '#edcfaa' : '#e9c5a0'} /></mesh>)}
    <Box position={[0, 2, -4]} size={[12, 4, 0.22]} color="#f2e4d3" />
    <Box position={[-6, 2, 0]} size={[0.22, 4, 8]} color="#f5e7d7" />
    <Box position={[0, 0.14, -3.83]} size={[11.8, 0.23, 0.12]} color="#d0b396" radius={0.02} />
    <Box position={[-5.84, 0.14, 0]} size={[0.12, 0.23, 7.8]} color="#d0b396" radius={0.02} />
    <mesh position={[0, 0.022, 0.35]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[3.65, 64]} /><meshStandardMaterial color="#e1dbbf" /></mesh>
    <group position={[-5.83, 2.35, -0.3]} rotation={[0, Math.PI / 2, 0]}>
      <Box position={[0, 0, 0]} size={[3.5, 2.45, 0.08]} color="#c5d8bd" />
      <mesh position={[0, 0, 0.05]}><planeGeometry args={[3.2, 2.2]} /><meshStandardMaterial color="#dce6d0" emissive="#e6e3c8" emissiveIntensity={0.22} /></mesh>
      {[-1.65, 0, 1.65].map(x => <Box key={x} position={[x, 0, 0.1]} size={[0.09, 2.4, 0.13]} color="#d6b188" radius={0.02} />)}
      {[-1.14, 0, 1.14].map(y => <Box key={y} position={[0, y, 0.1]} size={[3.4, 0.09, 0.13]} color="#d6b188" radius={0.02} />)}
      <Box position={[0, -1.32, 0.17]} size={[3.8, 0.15, 0.5]} color="#deb991" />
    </group>
    <LabelPlane position={[-2.5, 3.05, -3.87]} text={'co.gom\n함께하는 작은 몰입'} width={2.7} height={1.05} color="#f5e7d0" />
    <Box position={[2.1, 2.5, -3.84]} size={[4.2, 1.9, 0.09]} color="#cba884" />
    {todos.slice(-8).map((todo, index) => <LabelPlane key={todo.id} position={[0.65 + index % 4 * 0.96, 2.98 - Math.floor(index / 4) * 0.85, -3.77]} rotation={[0, 0, index % 2 ? -0.035 : 0.03]} text={todo.text.match(/.{1,10}/gu)?.slice(0, 3).join('\n') || todo.text} width={0.83} height={0.72} color={['#f9e6aa', '#dce5c6', '#edd7df'][index % 3]} />)}
    <Box position={[3.8, 0.7, -2.72]} size={[3.5, 1.4, 0.9]} color="#b8c2a1" />
    <Box position={[3.8, 1.45, -2.72]} size={[3.7, 0.17, 1.06]} color="#dfb58d" />
    <Box position={[4.5, 1.83, -2.76]} size={[0.75, 0.63, 0.5]} color="#eae3d7" />
    <Box position={[4.5, 1.76, -2.46]} size={[0.53, 0.21, 0.06]} color="#777669" radius={0.02} />
    <Cup position={[3.9, 1.64, -2.5]} color="#e9dccc" />
    <Cup position={[3.35, 1.64, -2.5]} />
    <Plant position={[-4.8, 0, -2.8]} scale={1.4} />
    <Plant position={[5.1, 1.54, -2.8]} scale={0.65} />
    <Plant position={[-4.95, 0, 2.6]} scale={1.15} />
    {[-3, 0, 3].map((x, i) => <StudyDesk key={x} x={x} index={i} />)}
    {[-3, 0, 3].map((x, i) => <group key={'opposite-' + x} position={[x, 0, 2.4]} rotation={[0, Math.PI, 0]}>
      <Box position={[0, 0.35, -0.05]} size={[1.05, 0.18, 0.9]} color={chairColors[i]} />
      <Box position={[0, 0.75, -0.47]} size={[1.08, 0.9, 0.15]} color={chairColors[i]} />
      <Box position={[0, 0.9, 0.85]} size={[0.6, 0.045, 0.43]} color="#b8b3cb" radius={0.02} />
      <Box position={[0, 1.1, 1.05]} size={[0.6, 0.4, 0.04]} color="#c3bfd5" radius={0.02} />
    </group>)}
    <group position={[-0.2, 3.75, -1.3]}>
      <mesh position={[0, 0.4, 0]}><cylinderGeometry args={[0.018, 0.018, 0.8, 8]} /><meshStandardMaterial color="#9f8e78" /></mesh>
      <mesh castShadow><coneGeometry args={[0.45, 0.35, 32, 1, true]} /><meshStandardMaterial color="#e6cfae" side={2} /></mesh>
      <pointLight position={[0, -0.3, 0]} intensity={5} color="#ffdfb0" distance={8} />
    </group>
  </group>;
}

function Movement() {
  useFrame(({ camera }, delta) => {
    if (isEditing()) return;
    const input = useMovementInput.getState();
    if (input.pointer && performance.now() >= input.until) useMovementInput.setState({ pointer: null });
    const pointer = performance.now() < input.until ? input.pointer : null;
    const keys = input.keys;
    const horizontal = Number(keys.right || pointer === 'right') - Number(keys.left || pointer === 'left');
    const vertical = Number(keys.backward || pointer === 'backward') - Number(keys.forward || pointer === 'forward');
    if (!horizontal && !vertical) return;
    const state = useRoomStore.getState();
    const me = state.players.find(player => player.id === state.myId);
    if (!me || me.status === 'studying' || (me.knockUntil !== null && me.knockUntil > Date.now() + state.serverOffsetMs)) return;
    const length = Math.hypot(horizontal, vertical);
    const speed = Math.min(delta, 0.05) * 2.2 / length;
    // Follow screen directions even after the user rotates the camera.
    const basis = camera.matrixWorld.elements;
    const rightLength = Math.hypot(basis[0], basis[2]);
    const rightX = basis[0] / rightLength;
    const rightZ = basis[2] / rightLength;
    const dx = (horizontal * rightX - vertical * rightZ) * speed;
    const dz = (horizontal * rightZ + vertical * rightX) * speed;
    const [x, z] = resolveRoomMovement(me.position, [dx, dz]);
    if (Math.hypot(x - me.position[0], z - me.position[1]) > 0.000001) {
      state.moveMe([x, z], Math.atan2(dx, dz));
    }
  });
  return null;
}

function RoomPlayers() {
  const players = useRoomStore(state => state.players);
  const myId = useRoomStore(state => state.myId);
  const wake = useRoomStore(state => state.wakePlayer);
  return <>{players.map(player => <BearAvatar key={player.id} player={player} isSelf={player.id === myId} onWake={wake} />)}</>;
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="scene-error"><strong>3D 공간을 불러오지 못했어요.</strong><p>WebGL을 지원하는 브라우저에서 다시 열어주세요.</p><button onClick={() => location.reload()}>다시 불러오기</button></div>;
    return this.props.children;
  }
}

export function StudyRoom() {
  const loading = useProgress(state => state.active);
  const [cameraCommand, setCameraCommand] = useState<CameraCommand | null>(null);
  const [zoom, setZoom] = useState(53);
  const reportZoom = useCallback((value: number) => setZoom(Math.round(value * 10) / 10), []);
  const changeCamera = (kind: CameraCommand['kind']) => setCameraCommand(previous => ({ kind, id: (previous?.id ?? 0) + 1 }));
  return <div className="room-canvas" role="region" tabIndex={0} aria-label="방향키로 곰돌이를 이동하는 3D 카페" onPointerDownCapture={event => event.currentTarget.focus({ preventScroll: true })}>
    <SceneBoundary>
      <KeyboardControls onChange={(name, pressed) => setMovementKey(name as Direction, pressed)} map={[{ name: 'forward', keys: ['ArrowUp'] }, { name: 'backward', keys: ['ArrowDown'] }, { name: 'left', keys: ['ArrowLeft'] }, { name: 'right', keys: ['ArrowRight'] }]}>
        <Canvas shadows dpr={[1, 1.5]} orthographic camera={initialCamera} gl={{ antialias: true }} onCreated={({ camera }) => camera.lookAt(0, 1, 0)}>
          <color attach="background" args={['#f0efe8']} />
          <ambientLight intensity={1.3} color="#fff0da" />
          <hemisphereLight args={['#fff5e8', '#c7b49e', 1.2]} />
          <directionalLight position={[-4, 9, 5]} intensity={2.3} color="#fff0d4" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} shadow-normalBias={0.035} />
          <RoomGeometry />
          <RoomCamera command={cameraCommand} onZoomChange={reportZoom} />
          <Suspense fallback={null}><RoomPlayers /></Suspense>
          <Movement />
          <FloorEffects />
        </Canvas>
      </KeyboardControls>
      <div className="room-zoom-controls" role="group" aria-label="3D 공간 확대와 축소">
        <button type="button" className="bear-closeup" onClick={() => changeCamera('self')} aria-label="내 곰돌이 가까이 보기" title="내 곰돌이 가까이 보기"><Focus size={15} /><span>내 곰돌이</span></button>
        <span className="zoom-divider" aria-hidden="true" />
        <button type="button" onClick={() => changeCamera('out')} disabled={zoom <= MIN_ROOM_ZOOM} aria-label="3D 공간 축소" title="축소"><Minus size={17} /></button>
        <button type="button" onClick={() => changeCamera('in')} disabled={zoom >= MAX_ROOM_ZOOM} aria-label="3D 공간 확대" title="확대"><Plus size={17} /></button>
        <button type="button" onClick={() => changeCamera('reset')} aria-label="카메라 시점 초기화" title="카메라 시점 초기화"><RotateCcw size={15} /></button>
      </div>
      {loading && <div className="model-loading" role="status" style={{position:'absolute',left:'50%',top:'50%',transform:'translate(-50%, -50%)'}}>곰돌이들이 오고 있어요…</div>}
    </SceneBoundary>
  </div>;
}
