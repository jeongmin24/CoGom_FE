import { useEffect, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X } from 'lucide-react';
import { playWakeSound } from './roomAudio';
import { useRoomStore } from './roomStore';

export function RoomToast({ roomRef, fullscreen }: { roomRef: RefObject<HTMLElement | null>; fullscreen: boolean }) {
  const toast = useRoomStore(state => state.toast);
  const dismissToast = useRoomStore(state => state.dismissToast);

  useEffect(() => {
    if (!toast) return;
    if (toast.kind === 'wake') playWakeSound();
    const timer = window.setTimeout(dismissToast, 6000);
    return () => window.clearTimeout(timer);
  }, [toast, dismissToast]);

  if (!toast) return null;

  return createPortal(
    <div className={'toast toast-' + toast.kind} role="status">
      <Bell size={19} />
      <span>{toast.message}</span>
      <button aria-label="알림 닫기" onClick={dismissToast}><X size={16} /></button>
    </div>,
    (fullscreen ? roomRef.current : null) ?? document.body,
  );
}
