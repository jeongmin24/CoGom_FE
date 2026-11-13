import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useAnimations, useCursor, useGLTF } from '@react-three/drei';
import {
  CanvasTexture,
  Group,
  LinearFilter,
  LoopOnce,
  LoopRepeat,
  MathUtils,
  Sprite,
  SRGBColorSpace,
} from 'three';
import { prepareBear, type StudyStyle } from './bearAnimations';
import { Headphones, KnockBubble, StudyDeskProps, ThoughtBubble, WritingPencil } from './BearStudyProps';
import { JUMP_DURATION_MS, useRoomStore } from './roomStore';

interface AvatarPlayer {
  id: string;
  name: string;
  position: [number, number];
  rotation: number;
  status: 'studying' | 'resting';
  seatIndex?: number;
  studyStyle?: StudyStyle;
  styleChangedAt?: number;
  knockUntil?: number | null;
  jumpStartedAt?: number | null;
}

interface BearAvatarProps {
  player: AvatarPlayer;
  isSelf: boolean;
  onWake: (id: string) => void;
}

const modelPath = '/models/bear.glb';

function Nameplate({ name }: { name: string }) {
  const sprite = useRef<Sprite>(null);
  const compact = useThree((state) => state.size.width < 480);
  const label = useMemo(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('이름표를 그릴 수 없습니다.');
    const letters = Array.from(name.trim());
    const displayName = compact && letters.length > 4 ? letters.slice(0, 4).join('') + '…' : name;
    const font = '500 42px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
    context.font = font;
    canvas.width = Math.ceil(context.measureText(displayName).width + 28);
    canvas.height = 66;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = font;
    context.fillStyle = '#ffffff';
    context.shadowColor = 'rgba(48, 44, 38, 0.24)';
    context.shadowBlur = 5;
    context.shadowOffsetY = 2;
    context.fillText(displayName, canvas.width / 2, canvas.height / 2);

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;
    return { texture, width: canvas.width / 3.5, height: canvas.height / 3.5 };
  }, [name, compact]);

  useEffect(() => () => label.texture.dispose(), [label]);
  useFrame(({ camera, size, viewport }) => {
    if (!sprite.current) return;
    const world = viewport.getCurrentViewport(camera);
    const labelScale = MathUtils.clamp(size.width / 460, 0.85, 1);
    sprite.current.scale.set(label.width * labelScale * world.width / size.width, label.height * labelScale * world.height / size.height, 1);
  });

  return (
    <sprite ref={sprite} position={[0, 1.82, 0]} renderOrder={20} raycast={() => {}}>
      <spriteMaterial map={label.texture} transparent opacity={0.85} depthTest={false} depthWrite={false} toneMapped={false} />
    </sprite>
  );
}

export function BearAvatar({ player, isSelf, onWake }: BearAvatarProps) {
  const { scene } = useGLTF(modelPath);
  const style = player.studyStyle ?? 'typing';
  const studying = player.status === 'studying';
  const serverOffset = useRoomStore(state => state.serverOffsetMs);
  const [knocking, setKnocking] = useState(false);
  const seatedRoot = useRef<Group>(null);
  const positionRoot = useRef<Group>(null);
  const initialPosition = useRef<[number, number, number]>([player.position[0], 0, player.position[1]]);
  const locomotionRoot = useRef<Group>(null);
  const jumpRoot = useRef<Group>(null);
  const walkingBounce = useRef(0);
  const animationRoot = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered && !isSelf);

  const prepared = useMemo(() => prepareBear(scene), [scene]);
  const { actions } = useAnimations(prepared.clips, animationRoot);

  useEffect(() => {
    const remaining = (player.knockUntil ?? 0) - Date.now() - serverOffset;
    setKnocking(!studying && remaining > 0);
    if (remaining <= 0 || studying) return;
    const timeout = window.setTimeout(() => setKnocking(false), remaining);
    return () => window.clearTimeout(timeout);
  }, [player.knockUntil, studying, serverOffset]);

  useEffect(() => {
    const name = studying ? 'Study_' + style : knocking ? 'Knock' : 'Rest';
    const action = actions[name];
    if (!action) return;
    action.reset().setLoop(knocking ? LoopOnce : LoopRepeat, knocking ? 1 : Infinity);
    action.clampWhenFinished = knocking;
    const startedAt = knocking ? (player.knockUntil ?? 0) - 1600 : player.styleChangedAt;
    if (startedAt) {
      const elapsed = Math.max(0, (Date.now() + serverOffset - startedAt) / 1000);
      action.time = knocking ? Math.min(1.59, elapsed) : elapsed % action.getClip().duration;
    }
    action.fadeIn(knocking ? 0.08 : 0.3).play();
    return () => { action.fadeOut(0.2); };
  }, [studying, style, knocking, player.styleChangedAt, player.knockUntil, serverOffset, actions]);

  useFrame((state, delta) => {
    const root = positionRoot.current;
    const locomotion = locomotionRoot.current;
    if (!root || !locomotion) return;
    const oldX = root.position.x;
    const oldZ = root.position.z;
    const smoothing = 1 - Math.exp(-14 * delta);
    root.position.x = isSelf ? player.position[0] : MathUtils.lerp(oldX, player.position[0], smoothing);
    root.position.z = isSelf ? player.position[1] : MathUtils.lerp(oldZ, player.position[1], smoothing);
    const angle = Math.atan2(Math.sin(player.rotation - root.rotation.y), Math.cos(player.rotation - root.rotation.y));
    root.rotation.y += angle * smoothing;
    const now = Date.now() + serverOffset;
    const activeKnock = (player.knockUntil ?? 0) > now;
    const jumpProgress = player.jumpStartedAt == null ? -1 : (now - player.jumpStartedAt) / JUMP_DURATION_MS;
    const airborne = !studying && !activeKnock && jumpProgress >= 0 && jumpProgress < 1;
    const jumpHeight = airborne ? 0.85 * 4 * jumpProgress * (1 - jumpProgress) : 0;
    if (jumpRoot.current) jumpRoot.current.position.y = jumpHeight;
    const moving = !studying && !activeKnock && !airborne && Math.hypot(root.position.x - oldX, root.position.z - oldZ) > 0.0005;
    const bounce = moving ? Math.abs(Math.sin(state.clock.elapsedTime * 9)) * 0.045 : 0;
    walkingBounce.current = airborne ? 0 : MathUtils.damp(walkingBounce.current, bounce, 12, delta);
    // The exact jump arc lives on its own group; damping only affects walking.
    locomotion.position.y = walkingBounce.current;
    if (seatedRoot.current) {
      seatedRoot.current.position.y = MathUtils.damp(seatedRoot.current.position.y, studying ? 0.22 : 0, 10, delta);
      seatedRoot.current.scale.y = MathUtils.damp(seatedRoot.current.scale.y, studying ? 0.9 : 1, 10, delta);
    }
  });

  function clickBear(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    if (!isSelf) onWake(player.id);
  }

  return (
    <group ref={positionRoot} position={initialPosition.current}>
      {isSelf && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
          <ringGeometry args={[0.42, 0.46, 40]} />
          <meshBasicMaterial color="#7b8b70" transparent opacity={0.8} depthWrite={false} />
        </mesh>
      )}
      <group ref={jumpRoot}>
        <group ref={locomotionRoot}>
          <group ref={seatedRoot}>
            <group
              name="BearMotion"
              ref={animationRoot}
              onClick={clickBear}
              onPointerOver={(event) => { event.stopPropagation(); setHovered(true); }}
              onPointerOut={() => setHovered(false)}
            >
              <group scale={prepared.scale}>
                <group position={prepared.offset}>
                  <primitive object={prepared.model} dispose={null} />
                </group>
              </group>
              {studying && style === 'headphones' && <Headphones />}
            </group>
          </group>
        </group>
        <Nameplate name={player.name} />
      </group>
      {studying && <StudyDeskProps style={style} changedAt={(player.styleChangedAt ?? Date.now()) - serverOffset} />}
      {studying && style === 'thinking' && <ThoughtBubble />}
      {studying && style === 'writing' && prepared.rightArm && createPortal(<WritingPencil />, prepared.rightArm)}
      {knocking && <KnockBubble />}
    </group>
  );
}

useGLTF.preload(modelPath);
