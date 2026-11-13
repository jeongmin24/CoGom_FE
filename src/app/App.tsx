import { useEffect, useState } from 'react';
import {
  CheckCheck, ChevronRight, DoorOpen, LayoutDashboard, Leaf, LogIn, LogOut,
  PanelLeftClose, PanelLeftOpen, StickyNote, Timer, Users, Volume2, VolumeX,
} from 'lucide-react';
import type { AuthUser } from '../features/auth/authApi';
import { PostItsPanel } from '../features/post-its/PostItsPanel';
import { CompanionsPanel } from '../features/study-room/CompanionsPanel';
import { FocusPanel } from '../features/study-room/FocusPanel';
import { JoinDialog } from '../features/study-room/JoinDialog';
import { RoomPanel } from '../features/study-room/RoomPanel';
import { RoomToast } from '../features/study-room/RoomToast';
import { useRoomStore } from '../features/study-room/roomStore';
import { useRoomFullscreen } from '../features/study-room/useRoomFullscreen';
import { useRoomSession } from '../features/study-room/useRoomSession';
import { useRoomSound } from '../features/study-room/useRoomSound';
import { BearMark } from '../shared/BearMark';

const navigation = [
  { id: 'cafe', label: '스터디 카페', icon: LayoutDashboard },
  { id: 'focus', label: '집중 타이머', icon: Timer },
  { id: 'friends', label: '함께하는 친구', icon: Users },
  { id: 'notes', label: '작은 성취들', icon: StickyNote },
] as const;

const dateFormat = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });

export function App({ account, onExit }: { account?: AuthUser; onExit: () => void }) {
  const players = useRoomStore(state => state.players);
  const myName = useRoomStore(state => state.players.find(player => player.id === state.myId)?.name);
  const todoCount = useRoomStore(state => state.todos.length);
  const today = useRoomStore(state => dateFormat.format(state.now));
  const connection = useRoomStore(state => state.connection);
  const { joinOpen, setJoinOpen, nickname, setNickname, joinedName, join } = useRoomSession(account);
  const { sound, unlockSound, toggleSound } = useRoomSound();
  const { roomRef, fullscreen, toggleFullscreen, exitFullscreen } = useRoomFullscreen();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('cogom-sidebar-collapsed') !== 'false'; } catch { return true; }
  });
  const [activeSection, setActiveSection] = useState<(typeof navigation)[number]['id']>('cafe');
  const focusedCount = players.filter(player => player.status === 'studying').length;

  useEffect(() => {
    try { localStorage.setItem('cogom-sidebar-collapsed', String(sidebarCollapsed)); } catch { /* private storage may be disabled */ }
  }, [sidebarCollapsed]);

  return <div
    className={'app-shell' + (fullscreen ? ' focus-view' : '') + (sidebarCollapsed ? ' sidebar-collapsed' : '')}
    onPointerDown={unlockSound}
    onKeyDownCapture={unlockSound}
  >
    <a className="skip-link" href="#dashboard">본문으로 건너뛰기</a>
    <aside id="app-menu" className="app-sidebar" aria-label="카페 메뉴">
      <a className="wordmark" href="#cafe" aria-label="CoGom 스터디 카페">
        <BearMark /><span>co.gom<small>our little study club</small></span>
      </a>
      <div className="sidebar-label">MY WORKSPACE</div>
      <nav>{navigation.map(({ id, label, icon: Icon }) => <a
        key={id}
        href={'#' + id}
        aria-label={label}
        title={label}
        className={activeSection === id ? 'active' : ''}
        aria-current={activeSection === id ? 'location' : undefined}
        onClick={() => { setActiveSection(id); if (id !== 'cafe') void exitFullscreen(); }}
      ><Icon size={18} strokeWidth={1.7} /><span>{label}</span>{id === 'cafe' && <span className="nav-count">01</span>}</a>)}</nav>
      <div className="sidebar-note">
        <span className="tape" /><BearMark className="note-bear" />
        <p>혼자여도,<br />함께니까.</p>
        <span className="handwritten">a little focus, together.</span>
      </div>
      <div className="sidebar-profile">
        <span className="profile-avatar"><BearMark /></span>
        <div>
          <strong>{connection === 'online' && myName !== undefined ? myName : account?.nickname ?? '오늘의 나'}</strong>
          <span>{connection === 'online' ? '카페에 함께 있어요' : '천천히 시작해 볼까요?'}</span>
        </div>
        <Leaf size={16} />
      </div>
    </aside>

    <div className="main-shell">
      <header className="topbar">
        <div className="header-location">
          <button
            className="icon-button sidebar-toggle"
            aria-label={sidebarCollapsed ? '메뉴 펼치기' : '메뉴 접기'}
            aria-expanded={!sidebarCollapsed}
            aria-controls="app-menu"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >{sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button>
          <div className="breadcrumb">My workspace <ChevronRight size={13} /><strong>스터디 카페</strong></div>
        </div>
        <div className="top-actions">
          <span className="today-date">{today}</span>
          <button
            className="icon-button sound-button"
            title="발걸음 · 노크 · 알림 소리"
            aria-label={sound ? '공간 소리 끄기' : '공간 소리 켜기'}
            aria-pressed={sound}
            onClick={toggleSound}
          >{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
          <button className="join-button" onClick={() => setJoinOpen(true)}>
            <DoorOpen size={16} /><span>{joinedName ? '다시 입장' : '실시간 입장'}</span>
          </button>
          <button
            className="icon-button" type="button"
            aria-label={account ? '로그아웃' : '로그인'}
            title={account ? '로그아웃' : '로그인'}
            onClick={onExit}
          >{account ? <LogOut size={16} /> : <LogIn size={16} />}</button>
        </div>
      </header>

      <main id="dashboard">
        <section className="page-heading" aria-label="오늘의 스터디">
          <div>
            <div className="eyebrow"><span className="tiny-star">✳</span> YOUR DAILY DOSE OF FOCUS</div>
            <h1>작은 <span className="highlight-word">몰입</span>이 쌓이는 곳.</h1>
            <p>곰돌이 친구들과 함께, 오늘도 나만의 한 페이지를 채워요.</p>
          </div>
          <div className="heading-note">
            <span className="handwritten">make yourself at home</span>
            <span className={'connection-pill ' + connection}>
              <i />{connection === 'online' ? '실시간 연결' : connection === 'connecting' ? '연결 중' : '체험 모드'}
              <span>·</span>{players.length}명 함께
            </span>
          </div>
        </section>

        <div className="summary-strip" aria-label="현재 카페 현황">
          <div><span className="summary-icon"><Users size={18} /></span><span>함께하는 곰돌이</span><strong>{players.length}<small>명</small></strong></div>
          <div><span className="summary-icon"><Timer size={18} /></span><span>지금 집중 중</span><strong>{focusedCount}<small>명</small></strong></div>
          <div><span className="summary-icon"><CheckCheck size={18} /></span><span>모아둔 작은 성취</span><strong>{todoCount}<small>개</small></strong></div>
        </div>

        <div className="workspace">
          <RoomPanel roomRef={roomRef} fullscreen={fullscreen} toggleFullscreen={toggleFullscreen} />
          <FocusPanel />
        </div>
        <div className="community-grid">
          <CompanionsPanel onJoin={() => setJoinOpen(true)} />
          <PostItsPanel />
        </div>
        <footer>
          <span><BearMark /> 서두르지 않아도, 우리는 조금씩 나아가요.</span>
          <span>MADE FOR A LITTLE MORE FOCUS <Leaf size={12} /></span>
        </footer>
      </main>
    </div>
    <RoomToast roomRef={roomRef} fullscreen={fullscreen} />
    {joinOpen && <JoinDialog nickname={nickname} onNicknameChange={setNickname} onClose={() => setJoinOpen(false)} onSubmit={join} />}
  </div>;
}
