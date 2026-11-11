import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { isJumping, isKnocking, useRoomStore } from './roomStore';

export type Direction = 'forward' | 'backward' | 'left' | 'right';
const released = { forward: false, backward: false, left: false, right: false };

export const useMovementInput = create<{
  keys: Record<Direction, boolean>;
  pointer: Direction | null;
  until: number;
}>(() => ({ keys: { ...released }, pointer: null, until: 0 }));

export function isEditing() {
  const active = document.activeElement;
  return !!document.querySelector('[role="dialog"]')
    || (active instanceof HTMLElement && (active.matches('input,textarea,select') || active.isContentEditable));
}

export function setMovementKey(direction: Direction, pressed: boolean) {
  const state = useRoomStore.getState();
  const me = state.players.find(player => player.id === state.myId);
  const locked = me?.status === 'studying' || (me?.knockUntil != null && me.knockUntil > Date.now() + state.serverOffsetMs);
  if (pressed && (isEditing() || locked)) return;
  useMovementInput.setState(state => ({ keys: { ...state.keys, [direction]: pressed } }));
}

function resetInput() {
  useMovementInput.setState({ keys: { ...released }, pointer: null, until: 0 });
}

const directions = [
  { key: 'forward', label: '위로 이동', symbol: '↑' },
  { key: 'left', label: '왼쪽으로 이동', symbol: '←' },
  { key: 'backward', label: '아래로 이동', symbol: '↓' },
  { key: 'right', label: '오른쪽으로 이동', symbol: '→' },
] as const;

export function MovementPad({ disabled = false }: { disabled?: boolean }) {
  const pressStarted = useRef(0);
  const spaceHeld = useRef(false);
  const pointer = useMovementInput(state => state.pointer);
  const me = useRoomStore(state => state.players.find(player => player.id === state.myId));
  const now = useRoomStore(state => state.now);
  const movementDisabled = disabled || !me || me.status === 'studying' || isKnocking(me, now);
  const jumpDisabled = movementDisabled || (me ? isJumping(me, now) : true);
  useEffect(() => { if (movementDisabled) resetInput(); }, [movementDisabled]);
  useEffect(() => {
    const releaseControls = () => { resetInput(); spaceHeld.current = false; };
    const onVisibility = () => { if (document.hidden) releaseControls(); };
    const onFocus = () => { if (isEditing()) releaseControls(); };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.key !== ' ') return;
      const target = event.target;
      if (event.defaultPrevented || event.isComposing || isEditing() || !(target instanceof Element)) return;
      // Space belongs to native controls outside the focused game surface.
      if (target.closest('button,a[href],[role="button"],[role="link"]') || !target.closest('.room-canvas')) return;
      event.preventDefault();
      if (event.repeat || spaceHeld.current) return;
      spaceHeld.current = true;
      useRoomStore.getState().jumpMe();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.key === ' ') spaceHeld.current = false;
    };
    window.addEventListener('blur', releaseControls);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('focusin', onFocus);
    return () => {
      window.removeEventListener('blur', releaseControls);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('focusin', onFocus);
      releaseControls();
    };
  }, []);

  return <span className="movement-pad" role="group" aria-label="곰돌이 이동 버튼">
    {directions.map(({ key, label, symbol }) => <button
      key={key}
      type="button"
      disabled={movementDisabled}
      aria-label={label}
      className={pointer === key ? 'pressed' : ''}
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        pressStarted.current = performance.now();
        useMovementInput.setState({ pointer: key, until: Infinity });
      }}
      onPointerUp={() => {
        // Even a quick click should produce a visible step.
        useMovementInput.setState({ until: Math.max(performance.now(), pressStarted.current + 160) });
      }}
      onPointerCancel={resetInput}
      onLostPointerCapture={() => {
        if (useMovementInput.getState().until === Infinity) resetInput();
      }}
      onClick={event => {
        // Enter/Space and assistive-technology activation have no pointer event.
        if (event.detail === 0) useMovementInput.setState({ pointer: key, until: performance.now() + 160 });
      }}
    >{symbol}</button>)}
    <button
      type="button"
      className="jump-button"
      aria-label="점프 (Space)"
      disabled={jumpDisabled}
      onKeyDown={event => { if (event.repeat && (event.code === 'Space' || event.key === 'Enter')) event.preventDefault(); }}
      onClick={() => {
        useRoomStore.getState().jumpMe();
        document.querySelector<HTMLElement>('.room-canvas')?.focus({ preventScroll: true });
      }}
    >점프</button>
    <span>{movementDisabled ? '잠시 이동이 잠겨 있어요' : '방향키 이동 · Space 점프'}</span>
  </span>;
}
