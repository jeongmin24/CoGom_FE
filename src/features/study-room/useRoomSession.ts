import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { unlockRoomAudio } from './roomAudio';
import { connectRoom } from './roomConnection';
import { resetRoom, useRoomStore } from './roomStore';

export function useRoomSession(account?: { nickname: string }) {
  const accountNickname = account?.nickname;
  const [joinOpen, setJoinOpen] = useState(false);
  const [nickname, setNickname] = useState(accountNickname ?? '');
  const [joinedName, setJoinedName] = useState<string | null>(null);
  const disconnect = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    if (accountNickname) {
      disconnect.current = connectRoom(accountNickname, { liveOnly: true });
      setJoinedName(accountNickname);
    }
    return () => {
      disconnect.current?.();
      disconnect.current = null;
      resetRoom();
    };
  }, [accountNickname]);

  useEffect(() => {
    const timer = window.setInterval(() => useRoomStore.getState().tick(), 250);
    function preventPageScroll(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && (target.matches('input,textarea,select') || target.isContentEditable)) return;
      if (event.key.startsWith('Arrow')) event.preventDefault();
    }
    window.addEventListener('keydown', preventPageScroll);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('keydown', preventPageScroll);
    };
  }, []);

  function join(event: FormEvent) {
    event.preventDefault();
    const name = nickname.trim();
    if (!name) return;
    unlockRoomAudio();
    disconnect.current?.();
    disconnect.current = connectRoom(name, { liveOnly: !!account });
    setJoinedName(name);
    setJoinOpen(false);
  }

  return { joinOpen, setJoinOpen, nickname, setNickname, joinedName, join };
}
