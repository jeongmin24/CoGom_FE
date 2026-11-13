import { ArrowRight, Bell, Pause, Play, RotateCcw, Timer } from 'lucide-react';
import { BearMark } from '../../shared/BearMark';
import { useRoomStore } from './roomStore';
import { useFocusTimer } from './useFocusTimer';

export function FocusPanel() {
  const { time, studying, knocking, progress, toggleTimer } = useFocusTimer();
  const resetTimer = useRoomStore(state => state.resetTimer);
  const simulateWake = useRoomStore(state => state.simulateWake);

  return <aside className="session-column" aria-label="나의 집중 도구">
    <section id="focus" className="timer-panel paper-panel">
      <div className="section-title"><span className="panel-index">02 / MY FOCUS</span><Timer size={17} /></div>
      <h2>나의 집중 시간</h2>
      <p className="section-description">한 번에 하나씩, 차근차근.</p>
      <div className="timer-character">
        <BearMark /><span className="handwritten">{studying ? 'you got this!' : 'ready when you are.'}</span>
      </div>
      <div className={'timer-display' + (studying ? ' running' : '')}>
        <span className="timer-mode"><i />{studying ? '집중하는 중' : '잠깐 쉬는 중'}</span>
        <strong aria-label="남은 집중 시간">{time}</strong>
        <span className="timer-duration">25 MIN FOCUS SESSION</span>
      </div>
      <div
        className="timer-progress"
        role="progressbar"
        aria-label="집중 시간 진행률"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
      >
        <span style={{ width: progress + '%' }} />
      </div>
      <div className="timer-buttons">
        <button
          className="primary-button"
          disabled={knocking}
          onClick={toggleTimer}
          aria-label={studying ? '타이머 일시정지' : '타이머 시작'}
        >
          {studying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          {studying ? '일어나서 쉬기' : '앉아서 집중하기'}
        </button>
        <button className="reset-button" onClick={resetTimer} aria-label="타이머 초기화"><RotateCcw size={17} /></button>
      </div>
      <p className="timer-footnote">{studying ? '착석 중에는 이동할 수 없어요.' : '준비되면 내 의자에 앉아 집중해요.'}</p>
      <div className="study-style-guide">
        <span>오늘의 공부 모션</span>
        <p>연필 필기 · 헤드폰 · 생각 정리<br />독서 · 타이핑</p>
        <small>집중 중 약 20초마다 랜덤으로 바뀌어요.</small>
      </div>
    </section>
    <section className="wake-tip">
      <span className="tape" /><span className="tip-icon"><Bell size={20} strokeWidth={1.6} /></span>
      <div>
        <span className="handwritten">a gentle nudge</span>
        <h2>친구가 졸고 있나요?</h2>
        <p>곰돌이 가까이 다가가 톡.<br />다정한 깨우기 알림을 보내요.</p>
        <button onClick={simulateWake}>알림 미리보기 <ArrowRight size={14} /></button>
      </div>
    </section>
  </aside>;
}
