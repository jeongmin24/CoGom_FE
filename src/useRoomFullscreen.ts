import { useCallback, useEffect, useRef, useState } from 'react';

/** Native fullscreen with an in-page fallback for embedded/mobile browsers. */
export function useRoomFullscreen() {
  const roomRef = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const nativeActive = useRef(false);
  const pending = useRef(false);
  const previousFocus = useRef<HTMLElement | null>(null);

  const exitFullscreen = useCallback(async () => {
    if (document.fullscreenElement === roomRef.current) {
      try { await document.exitFullscreen(); } catch { return; }
    }
    nativeActive.current = false;
    setFullscreen(false);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (pending.current) return;
    if (fullscreen) { await exitFullscreen(); return; }
    const room = roomRef.current;
    if (!room) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setFullscreen(true);
    room.querySelector<HTMLElement>('.room-canvas')?.focus({ preventScroll: true });
    if (!document.fullscreenEnabled || !room.requestFullscreen) return;
    pending.current = true;
    try {
      await room.requestFullscreen({ navigationUI: 'hide' });
      nativeActive.current = document.fullscreenElement === room;
    } catch {
      // The same room still fills the viewport when native fullscreen is unavailable.
    } finally { pending.current = false; }
  }, [fullscreen, exitFullscreen]);

  useEffect(() => {
    const changed = () => {
      if (document.fullscreenElement === roomRef.current) {
        nativeActive.current = true;
        setFullscreen(true);
      } else if (nativeActive.current) {
        nativeActive.current = false;
        setFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', changed);
    return () => { document.removeEventListener('fullscreenchange', changed); };
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void exitFullscreen();
      }
      if (event.key !== 'Tab') return;
      const room = roomRef.current;
      if (!room) return;
      const controls = [...room.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]')]
        .filter(element => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || !room.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !room.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey, true);
      if (previousFocus.current?.isConnected) previousFocus.current.focus({ preventScroll: true });
    };
  }, [fullscreen, exitFullscreen]);

  return { roomRef, fullscreen, toggleFullscreen, exitFullscreen };
}
