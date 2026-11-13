import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight, Bell, Check, CheckCheck, ChevronRight, Coffee, DoorOpen,
  LayoutDashboard, Leaf, LockKeyhole, LogIn, LogOut, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen, Pause, Play, RotateCcw, Sparkles,
  StickyNote, Timer, Users, Volume2, VolumeX, X,
} from 'lucide-react';
import { StudyRoom } from './StudyRoom';
import { MovementPad } from './MovementPad';
import { JoinDialog } from './JoinDialog';
import { connectRoom } from './roomConnection';
import { FOCUS_SECONDS, remainingSeconds, resetRoom, useRoomStore, WAKE_DISTANCE } from './roomStore';
import { playWakeSound, setRoomSoundEnabled, unlockRoomAudio } from './roomAudio';
import { useRoomFullscreen } from './useRoomFullscreen';
import { BearMark } from './BearMark';
import type { AuthUser } from './authApi';

const navigation = [
  { id: 'cafe', label: '스터디 카페', icon: LayoutDashboard },
  { id: 'focus', label: '집중 타이머', icon: Timer },
  { id: 'friends', label: '함께하는 친구', icon: Users },
  { id: 'notes', label: '작은 성취들', icon: StickyNote },
] as const;

export function App({ account, onExit }: { account?: AuthUser; onExit: () => void }) {
  const players = useRoomStore(state => state.players);
  const myId = useRoomStore(state => state.myId);
  const todos = useRoomStore(state => state.todos);
  const now = useRoomStore(state => state.now);
  const connection = useRoomStore(state => state.connection);
  const toast = useRoomStore(state => state.toast);
  const [sound, setSound] = useState(true);
  const [joinOpen, setJoinOpen] = useState(false);
  const [nickname, setNickname] = useState(account?.nickname ?? '');
  const [todo, setTodo] = useState('');
  const [joinedName, setJoinedName] = useState<string | null>(null);
  const { roomRef, fullscreen: focusView, toggleFullscreen, exitFullscreen } = useRoomFullscreen();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('cogom-sidebar-collapsed') !== 'false'; } catch { return true; }
  });
  const [activeSection, setActiveSection] = useState('cafe');
  const cleanup = useRef<(() => void) | null>(null);
  const me = players.find(player => player.id === myId);
  const seconds = me ? remainingSeconds(me, now) : FOCUS_SECONDS;
  const time = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  const studying = me?.status === 'studying';
  const knocking = me?.knockUntil != null && me.knockUntil > now;
  const focusedCount = players.filter(player => player.status === 'studying').length;
  const progress = Math.max(0, Math.min(100, (1 - seconds / FOCUS_SECONDS) * 100));
  const today = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }).format(now);

  useEffect(() => { setRoomSoundEnabled(sound); }, [sound]);
  useEffect(() => {
    try { localStorage.setItem('cogom-sidebar-collapsed', String(sidebarCollapsed)); } catch { /* private storage may be disabled */ }
  }, [sidebarCollapsed]);

  useEffect(() => {
    const timer = window.setInterval(() => useRoomStore.getState().tick(), 250);
    const preventPageScroll = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.matches('input,textarea,select') || target.isContentEditable)) return;
      if (event.key.startsWith('Arrow')) event.preventDefault();
    };
    window.addEventListener('keydown', preventPageScroll);
    return () => {
      clearInterval(timer);
      window.removeEventListener('keydown', preventPageScroll);
      cleanup.current?.();
      resetRoom();
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    if (toast.kind === 'wake') playWakeSound();
    const timer = window.setTimeout(() => useRoomStore.getState().dismissToast(), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  function join(event: FormEvent) {
    event.preventDefault();
    const name = nickname.trim();
    if (!name) return;
    unlockRoomAudio();
    cleanup.current?.();
    cleanup.current = connectRoom(name);
    setJoinedName(name);
    setJoinOpen(false);
  }

  function finishTodo(event: FormEvent) {
    event.preventDefault();
    if (!todo.trim()) return;
    useRoomStore.getState().completeTodo(todo);
    setTodo('');
  }

  return <div className={'app-shell' + (focusView ? ' focus-view' : '') + (sidebarCollapsed ? ' sidebar-collapsed' : '')} onPointerDown={() => { if (sound) unlockRoomAudio(); }} onKeyDownCapture={() => { if (sound) unlockRoomAudio(); }}>
    <a className="skip-link" href="#dashboard">본문으로 건너뛰기</a>
    <aside id="app-menu" className="app-sidebar" aria-label="카페 메뉴">
      <a className="wordmark" href="#cafe" aria-label="CoGom 스터디 카페"><BearMark /><span>co.gom<small>our little study club</small></span></a>
      <div className="sidebar-label">MY WORKSPACE</div>
      <nav>{navigation.map(({ id, label, icon: Icon }) => <a
        key={id} href={'#' + id} aria-label={label} title={label} className={activeSection === id ? 'active' : ''}
        aria-current={activeSection === id ? 'location' : undefined}
        onClick={() => { setActiveSection(id); if (id !== 'cafe') void exitFullscreen(); }}
      ><Icon size={18} strokeWidth={1.7} /><span>{label}</span>{id === 'cafe' && <span className="nav-count">01</span>}</a>)}</nav>
      <div className="sidebar-note"><span className="tape" /><BearMark className="note-bear" /><p>혼자여도,<br />함께니까.</p><span className="handwritten">a little focus, together.</span></div>
      <div className="sidebar-profile"><span className="profile-avatar"><BearMark /></span><div><strong>{connection === 'online' && me ? me.name : account?.nickname ?? '오늘의 나'}</strong><span>{connection === 'online' ? '카페에 함께 있어요' : '천천히 시작해 볼까요?'}</span></div><Leaf size={16} /></div>
    </aside>

    <div className="main-shell">
      <header className="topbar"><div className="header-location"><button className="icon-button sidebar-toggle" aria-label={sidebarCollapsed ? '메뉴 펼치기' : '메뉴 접기'} aria-expanded={!sidebarCollapsed} aria-controls="app-menu" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>{sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button><div className="breadcrumb">My workspace <ChevronRight size={13} /><strong>스터디 카페</strong></div></div><div className="top-actions">
        <span className="today-date">{today}</span>
        <button className="icon-button sound-button" title="발걸음 · 노크 · 알림 소리" aria-label={sound ? '공간 소리 끄기' : '공간 소리 켜기'} aria-pressed={sound} onClick={() => { setRoomSoundEnabled(!sound); if (!sound) unlockRoomAudio(); setSound(!sound); }}>{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
        <button className="join-button" onClick={() => setJoinOpen(true)}><DoorOpen size={16} /><span>{joinedName ? '다시 입장' : '실시간 입장'}</span></button>
        <button className="icon-button" type="button" aria-label={account ? '로그아웃' : '로그인'} title={account ? '로그아웃' : '로그인'} onClick={onExit}>{account ? <LogOut size={16} /> : <LogIn size={16} />}</button>
      </div></header>

      <main id="dashboard">
        <section className="page-heading" aria-label="오늘의 스터디"><div><div className="eyebrow"><span className="tiny-star">✳</span> YOUR DAILY DOSE OF FOCUS</div><h1>작은 <span className="highlight-word">몰입</span>이 쌓이는 곳.</h1><p>곰돌이 친구들과 함께, 오늘도 나만의 한 페이지를 채워요.</p></div><div className="heading-note"><span className="handwritten">make yourself at home</span><span className={'connection-pill ' + connection}><i />{connection === 'online' ? '실시간 연결' : connection === 'connecting' ? '연결 중' : '체험 모드'}<span>·</span>{players.length}명 함께</span></div></section>

        <div className="summary-strip" aria-label="현재 카페 현황">
          <div><span className="summary-icon"><Users size={18} /></span><span>함께하는 곰돌이</span><strong>{players.length}<small>명</small></strong></div>
          <div><span className="summary-icon"><Timer size={18} /></span><span>지금 집중 중</span><strong>{focusedCount}<small>명</small></strong></div>
          <div><span className="summary-icon"><CheckCheck size={18} /></span><span>모아둔 작은 성취</span><strong>{todos.length}<small>개</small></strong></div>
        </div>

        <div className="workspace">
          <section ref={roomRef} id="cafe" className={'room-section paper-panel' + (focusView ? ' room-fullscreen' : '')} aria-label="3D 스터디룸">
            {focusView && <button className="fullscreen-timer" disabled={knocking} aria-label={studying ? '집중 타이머 일시정지' : '집중 타이머 시작'} title={(studying ? '눌러서 잠깐 쉬기' : '눌러서 집중 시작') + ' · Esc로 전체 화면 나가기'} onClick={() => studying ? useRoomStore.getState().pauseTimer() : useRoomStore.getState().startTimer()}><span>{time}</span>{studying ? <Pause size={16} /> : <Play size={16} />}</button>}
            <div className="panel-heading"><div><span className="panel-index">01 / OUR CAFE</span><h2>창가의 오후 <Coffee size={18} strokeWidth={1.6} /></h2></div><div className="room-actions"><button className="room-focus-action" disabled={knocking} onClick={() => studying ? useRoomStore.getState().pauseTimer() : useRoomStore.getState().startTimer()}>{studying ? <Pause size={14} /> : <Play size={14} />}<span>{studying ? '일어나기' : '집중하기'}</span></button><button className="fullscreen-button" aria-label={focusView ? '전체 화면 나가기' : '3D 공간 전체 화면으로 확대'} aria-pressed={focusView} title={focusView ? '전체 화면 나가기 (Esc)' : '전체 화면으로 확대'} onClick={() => void toggleFullscreen()}>{focusView ? <Minimize2 size={17} /> : <Maximize2 size={17} />}<span>{focusView ? '나가기' : '전체 화면'}</span></button></div></div>
            <div className="scene-wrap"><span className="scene-caption">{studying ? <><LockKeyhole size={13} /> 의자에 앉아 집중 중</> : <><i /> a cozy place to focus</>}</span><StudyRoom /></div>
            <div className="room-guide"><MovementPad disabled={studying || knocking} /><span>{studying ? '일어나기를 누르면 다시 걸을 수 있어요.' : '걸으면 나무 바닥 소리와 작은 곰 발자국이 남아요.'} · 드래그로 둘러보기 · 휠/두 손가락으로 확대</span></div>
          </section>

          <aside className="session-column" aria-label="나의 집중 도구">
            <section id="focus" className="timer-panel paper-panel">
              <div className="section-title"><span className="panel-index">02 / MY FOCUS</span><Timer size={17} /></div>
              <h2>나의 집중 시간</h2><p className="section-description">한 번에 하나씩, 차근차근.</p>
              <div className="timer-character"><BearMark /><span className="handwritten">{studying ? 'you got this!' : 'ready when you are.'}</span></div>
              <div className={'timer-display' + (studying ? ' running' : '')}><span className="timer-mode"><i />{studying ? '집중하는 중' : '잠깐 쉬는 중'}</span><strong aria-label="남은 집중 시간">{time}</strong><span className="timer-duration">25 MIN FOCUS SESSION</span></div>
              <div className="timer-progress" role="progressbar" aria-label="집중 시간 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><span style={{ width: progress + '%' }} /></div>
              <div className="timer-buttons"><button className="primary-button" disabled={knocking} onClick={() => studying ? useRoomStore.getState().pauseTimer() : useRoomStore.getState().startTimer()} aria-label={studying ? '타이머 일시정지' : '타이머 시작'}>{studying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}{studying ? '일어나서 쉬기' : '앉아서 집중하기'}</button><button className="reset-button" onClick={() => useRoomStore.getState().resetTimer()} aria-label="타이머 초기화"><RotateCcw size={17} /></button></div>
              <p className="timer-footnote">{studying ? '착석 중에는 이동할 수 없어요.' : '준비되면 내 의자에 앉아 집중해요.'}</p>
              <div className="study-style-guide"><span>오늘의 공부 모션</span><p>연필 필기 · 헤드폰 · 생각 정리<br />독서 · 타이핑</p><small>집중 중 약 20초마다 랜덤으로 바뀌어요.</small></div>
            </section>
            <section className="wake-tip"><span className="tape" /><span className="tip-icon"><Bell size={20} strokeWidth={1.6} /></span><div><span className="handwritten">a gentle nudge</span><h2>친구가 졸고 있나요?</h2><p>곰돌이 가까이 다가가 톡.<br />다정한 깨우기 알림을 보내요.</p><button onClick={() => useRoomStore.getState().simulateWake()}>알림 미리보기 <ArrowRight size={14} /></button></div></section>
          </aside>
        </div>

        <div className="community-grid">
          <section id="friends" className="companions paper-panel"><div className="panel-heading"><div><span className="panel-index">03 / STUDY BUDDIES</span><h2>함께 있는 곰돌이 <span className="count-tag">{players.length}</span></h2></div><Users size={18} /></div>
            <ul>{players.map((player, index) => {
              const isMe = player.id === myId;
              const distance = me ? Math.hypot(me.position[0] - player.position[0], me.position[1] - player.position[1]) : Infinity;
              return <li key={player.id}><span className={'friend-avatar avatar-' + index % 3}><BearMark /></span><div className="friend-info"><strong>{player.name}{isMe && <small>나</small>}</strong><span className={player.status === 'studying' ? 'studying' : ''}><i />{player.status === 'studying' ? '집중 중' : '휴식 중'}</span></div>{!isMe ? <button className="wake-button" aria-label={player.name + ' 깨우기'} title={player.status === 'studying' ? '집중하고 있어요' : distance > WAKE_DISTANCE ? '곰돌이 가까이 다가가세요' : '깨우기'} onClick={() => useRoomStore.getState().wakePlayer(player.id)} disabled={player.status === 'studying'}><Bell size={15} /></button> : <span className="my-seat">내 자리</span>}</li>;
            })}</ul>
            <div className="companions-footer"><span><i />{connection === 'online' ? '같은 공간, 각자의 몰입' : '다른 창의 친구도 초대해 보세요'}</span><button onClick={() => setJoinOpen(true)} aria-label="친구와 실시간 입장"><ArrowRight size={16} /></button></div>
          </section>

          <section id="notes" className="done-section paper-panel"><div className="panel-heading"><div><span className="panel-index">04 / LITTLE WINS</span><h2>오늘의 작은 성취 <span className="count-tag">{todos.length}</span></h2></div><Sparkles size={19} strokeWidth={1.6} /></div><p className="section-description">작은 일도 좋아요. 해낸 일을 적으면 카페 벽에 붙어요.</p>
            <form onSubmit={finishTodo}><label className="sr-only" htmlFor="done-input">완료한 일</label><input id="done-input" value={todo} onChange={event => setTodo(event.target.value)} placeholder="방금 해낸 일은 무엇인가요?" maxLength={70} required /><button className="complete-button" type="submit"><Check size={16} /><span>완료하고 붙이기</span></button></form>
            <div className="sticky-list">{todos.slice(-3).reverse().map((item, index) => <article key={item.id} className={'sticky sticky-' + index % 3}><span className="note-check"><Check size={13} /></span><p>{item.text}</p><span className="note-author">— {item.authorName}</span></article>)}</div>
            {todos.length === 0 && <div className="empty-notes"><StickyNote size={24} /><span>아직은 빈 페이지.<br />첫 번째 성취를 남겨보세요.</span></div>}
            <span className="notes-caption handwritten">little by little, a little becomes a lot.</span>
          </section>
        </div>
        <footer><span><BearMark /> 서두르지 않아도, 우리는 조금씩 나아가요.</span><span>MADE FOR A LITTLE MORE FOCUS <Leaf size={12} /></span></footer>
      </main>
    </div>
    {toast && createPortal(<div className={'toast toast-' + toast.kind} role="status"><Bell size={19} /><span>{toast.message}</span><button aria-label="알림 닫기" onClick={() => useRoomStore.getState().dismissToast()}><X size={16} /></button></div>, focusView && roomRef.current ? roomRef.current : document.body)}
    {joinOpen && <JoinDialog nickname={nickname} onNicknameChange={setNickname} onClose={() => setJoinOpen(false)} onSubmit={join} />}
  </div>;
}
