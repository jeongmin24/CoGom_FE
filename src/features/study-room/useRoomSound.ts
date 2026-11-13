import { useEffect, useState } from 'react';
import { setRoomSoundEnabled, unlockRoomAudio } from './roomAudio';

export function useRoomSound() {
  const [sound, setSound] = useState(true);

  useEffect(() => { setRoomSoundEnabled(sound); }, [sound]);

  function unlockSound() {
    if (sound) unlockRoomAudio();
  }

  function toggleSound() {
    setRoomSoundEnabled(!sound);
    if (!sound) unlockRoomAudio();
    setSound(!sound);
  }

  return { sound, unlockSound, toggleSound };
}
