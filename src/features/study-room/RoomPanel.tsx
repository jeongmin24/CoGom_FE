import { Coffee, LockKeyhole, Maximize2, Minimize2, Pause, Play } from 'lucide-react';
import type { Ref } from 'react';
import { MovementPad } from './MovementPad';
import { StudyRoom } from './StudyRoom';
import { useFocusTimer } from './useFocusTimer';
import './studyRoom.css';

interface RoomPanelProps {
  roomRef: Ref<HTMLElement>;
  fullscreen: boolean;
  toggleFullscreen: () => Promise<void>;
}

export function RoomPanel({ roomRef, fullscreen, toggleFullscreen }: RoomPanelProps) {
  const { time, studying, knocking, toggleTimer } = useFocusTimer();

  return <section
    ref={roomRef}
    id="cafe"
    className={'room-section paper-panel' + (fullscreen ? ' room-fullscreen' : '')}
    aria-label="3D 스터디룸"
  >
    {fullscreen && <button
      className="fullscreen-timer"
      disabled={knocking}
      aria-label={studying ? '집중 타이머 일시정지' : '집중 타이머 시작'}
      title={(studying ? '눌러서 잠깐 쉬기' : '눌러서 집중 시작') + ' · Esc로 전체 화면 나가기'}
      onClick={toggleTimer}
    >
      <span>{time}</span>{studying ? <Pause size={16} /> : <Play size={16} />}
    </button>}
    <div className="panel-heading">
      <div>
        <span className="panel-index">01 / OUR CAFE</span>
        <h2>창가의 오후 <Coffee size={18} strokeWidth={1.6} /></h2>
      </div>
      <div className="room-actions">
        <button className="room-focus-action" disabled={knocking} onClick={toggleTimer}>
          {studying ? <Pause size={14} /> : <Play size={14} />}
          <span>{studying ? '일어나기' : '집중하기'}</span>
        </button>
        <button
          className="fullscreen-button"
          aria-label={fullscreen ? '전체 화면 나가기' : '3D 공간 전체 화면으로 확대'}
          aria-pressed={fullscreen}
          title={fullscreen ? '전체 화면 나가기 (Esc)' : '전체 화면으로 확대'}
          onClick={() => void toggleFullscreen()}
        >
          {fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          <span>{fullscreen ? '나가기' : '전체 화면'}</span>
        </button>
      </div>
    </div>
    <div className="scene-wrap">
      <span className="scene-caption">
        {studying ? <><LockKeyhole size={13} /> 의자에 앉아 집중 중</> : <><i /> a cozy place to focus</>}
      </span>
      <StudyRoom />
    </div>
    <div className="room-guide">
      <MovementPad disabled={studying || knocking} />
      <span>{studying ? '일어나기를 누르면 다시 걸을 수 있어요.' : '걸으면 나무 바닥 소리와 작은 곰 발자국이 남아요.'} · 드래그로 둘러보기 · 휠/두 손가락으로 확대</span>
    </div>
  </section>;
}
