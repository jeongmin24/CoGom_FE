import { FOCUS_SECONDS, isKnocking, remainingSeconds, useRoomStore } from './roomStore';

export function useFocusTimer() {
  const me = useRoomStore(state => state.players.find(player => player.id === state.myId));
  const now = useRoomStore(state => state.now);
  const seconds = me ? remainingSeconds(me, now) : FOCUS_SECONDS;
  const minutesText = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secondsText = String(seconds % 60).padStart(2, '0');
  const studying = me?.status === 'studying';
  const knocking = me ? isKnocking(me, now) : false;
  const progress = Math.max(0, Math.min(100, (1 - seconds / FOCUS_SECONDS) * 100));

  function toggleTimer() {
    const { pauseTimer, startTimer } = useRoomStore.getState();
    if (studying) pauseTimer();
    else startTimer();
  }

  return { time: minutesText + ':' + secondsText, studying, knocking, progress, toggleTimer };
}
