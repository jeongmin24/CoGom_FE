import { create } from 'zustand';

export type PlayerStatus = 'studying' | 'resting';
export const STUDY_STYLES = ['writing', 'headphones', 'thinking', 'reading', 'typing'] as const;
export type StudyStyle = typeof STUDY_STYLES[number];
export type Position = [number, number];
export interface Player {
  id: string;
  name: string;
  position: Position;
  rotation: number;
  status: PlayerStatus;
  remainingSeconds: number;
  endsAt: number | null;
  seatIndex: number;
  studyStyle: StudyStyle;
  styleChangedAt: number;
  knockUntil: number | null;
  jumpStartedAt: number | null;
}
export interface CompletedTodo {
  id: string;
  text: string;
  authorName: string;
  completedAt: number | string;
}
export interface RoomToast {
  id: number;
  message: string;
  kind: 'wake' | 'success' | 'info' | 'error';
}
export type ClientEvent =
  | { type: 'move'; position: Position; rotation: number }
  | { type: 'timer_state'; status: PlayerStatus; remainingSeconds: number }
  | { type: 'wake_up'; targetId: string }
  | { type: 'jump' }
  | { type: 'todo_complete'; text: string };

export const WAKE_DISTANCE = 1.8;
export const FOCUS_SECONDS = 25 * 60;
export const STUDY_STYLE_INTERVAL_MS = 20_000;
export const KNOCK_DURATION_MS = 1600;
export const JUMP_DURATION_MS = 800;
export const SEAT_POSITIONS: readonly Position[] = [[-3, 0], [0, 0], [3, 0], [-3, 2.4], [0, 2.4], [3, 2.4]];
type Transport = (event: ClientEvent) => boolean;
let transport: Transport | null = null;
let toastSequence = 0;
let lastMoveAt = 0;
const wakeCooldowns = new Map<string, number>();

export function bindRoomTransport(next: Transport | null) {
  transport = next;
}

export function remainingSeconds(player: Player, now = Date.now()) {
  if (player.status !== 'studying' || player.endsAt === null) return player.remainingSeconds;
  return Math.max(0, Math.ceil((player.endsAt - now) / 1000));
}

export function isKnocking(player: Player, now = Date.now()) {
  return player.knockUntil !== null && player.knockUntil > now;
}

export function isJumping(player: Player, now = Date.now()) {
  return player.jumpStartedAt !== null && now < player.jumpStartedAt + JUMP_DURATION_MS;
}

function nextStudyStyle(previous: StudyStyle): StudyStyle {
  const alternatives = STUDY_STYLES.filter(style => style !== previous);
  return alternatives[Math.floor(Math.random() * alternatives.length)];
}

interface RoomState {
  players: Player[];
  todos: CompletedTodo[];
  myId: string;
  connection: 'demo' | 'connecting' | 'online';
  now: number;
  serverOffsetMs: number;
  toast: RoomToast | null;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  moveMe: (position: Position, rotation: number) => void;
  jumpMe: () => void;
  wakePlayer: (targetId: string) => void;
  completeTodo: (text: string) => void;
  simulateWake: () => void;
  dismissToast: () => void;
  notify: (message: string, kind?: RoomToast['kind']) => void;
  setConnection: (connection: RoomState['connection']) => void;
  applySnapshot: (players: Player[], todos: CompletedTodo[], serverNow: number, selfId?: string) => void;
  tick: () => void;
}

const initialNow = Date.now();
const initialPlayers: Player[] = [
  { id: 'demo-me', name: '나', position: [-3, 0], rotation: 0, status: 'resting', remainingSeconds: FOCUS_SECONDS, endsAt: null, seatIndex: 0, studyStyle: 'typing', styleChangedAt: initialNow, knockUntil: null, jumpStartedAt: null },
  { id: 'demo-yujin', name: '유진', position: [0, 0], rotation: 0, status: 'studying', remainingSeconds: 1188, endsAt: initialNow + 1188_000, seatIndex: 1, studyStyle: 'headphones', styleChangedAt: initialNow, knockUntil: null, jumpStartedAt: null },
  { id: 'demo-minseo', name: '민서', position: [3, 0], rotation: 0, status: 'resting', remainingSeconds: FOCUS_SECONDS, endsAt: null, seatIndex: 2, studyStyle: 'reading', styleChangedAt: initialNow, knockUntil: null, jumpStartedAt: null },
];

function updateTimer(status: PlayerStatus, seconds: number) {
  const state = useRoomStore.getState();
  const now = Date.now() + state.serverOffsetMs;
  const sent = transport?.({ type: 'timer_state', status, remainingSeconds: seconds });
  if (state.connection === 'online' && !sent) {
    state.notify('연결을 확인하고 다시 시도해 주세요.', 'error');
    return;
  }
  if (status === 'studying') lastMoveAt = 0;
  useRoomStore.setState({
    now,
    players: state.players.map(player => player.id === state.myId
      ? {
        ...player, status, remainingSeconds: seconds, endsAt: status === 'studying' ? now + seconds * 1000 : null,
        ...(status === 'studying' ? {
          position: [...SEAT_POSITIONS[player.seatIndex]] as Position,
          rotation: player.seatIndex < 3 ? 0 : Math.PI,
          studyStyle: nextStudyStyle(player.studyStyle), styleChangedAt: now, knockUntil: null, jumpStartedAt: null,
        } : {}),
      }
      : player),
  });
}

export const useRoomStore = create<RoomState>((set, get) => ({
  players: initialPlayers,
  todos: [
    { id: 'sample-1', text: '로그인 화면 완성!', authorName: '유진', completedAt: Date.now() },
    { id: 'sample-2', text: '오늘도 한 걸음', authorName: '민서', completedAt: Date.now() },
    { id: 'sample-3', text: '알고리즘 2문제 해결', authorName: '유진', completedAt: Date.now() },
  ],
  myId: 'demo-me',
  connection: 'demo',
  now: Date.now(),
  serverOffsetMs: 0,
  toast: null,
  startTimer() {
    const me = get().players.find(player => player.id === get().myId);
    if (!me || me.status === 'studying') return;
    updateTimer('studying', me.remainingSeconds || FOCUS_SECONDS);
  },
  pauseTimer() {
    const state = get();
    const me = state.players.find(player => player.id === state.myId);
    if (me) updateTimer('resting', remainingSeconds(me, Date.now() + state.serverOffsetMs));
  },
  resetTimer() { updateTimer('resting', FOCUS_SECONDS); },
  moveMe(position, rotation) {
    if (!position.every(Number.isFinite) || !Number.isFinite(rotation)) return;
    const state = get();
    const me = state.players.find(player => player.id === state.myId);
    if (!me || me.status === 'studying' || isKnocking(me, Date.now() + state.serverOffsetMs)) return;
    const bounded: Position = [Math.max(-5, Math.min(5, position[0])), Math.max(-3, Math.min(3.5, position[1]))];
    lastMoveAt = Date.now();
    set(state => ({ players: state.players.map(player => player.id === state.myId ? { ...player, position: bounded, rotation } : player) }));
    transport?.({ type: 'move', position: bounded, rotation });
  },
  jumpMe() {
    const state = get();
    const me = state.players.find(player => player.id === state.myId);
    const now = Date.now() + state.serverOffsetMs;
    if (!me || me.status !== 'resting' || isKnocking(me, now) || isJumping(me, now)) return;
    if (state.connection === 'online') {
      if (!transport?.({ type: 'jump' })) state.notify('연결을 확인하고 다시 시도해 주세요.', 'error');
      return;
    }
    set({ now, players: state.players.map(player => player.id === me.id ? { ...player, jumpStartedAt: now } : player) });
  },
  wakePlayer(targetId) {
    const state = get();
    const me = state.players.find(player => player.id === state.myId);
    const target = state.players.find(player => player.id === targetId);
    if (!me || !target || target.id === me.id) return;
    const now = Date.now() + state.serverOffsetMs;
    if (me.status === 'studying') {
      state.notify('잠깐 쉬어간 뒤 친구를 깨워 주세요.');
      return;
    }
    if (isKnocking(me, now) || isJumping(me, now)) return;
    if (target.status === 'studying') {
      state.notify(target.name + '님은 집중하고 있어요.');
      return;
    }
    if (Math.hypot(me.position[0] - target.position[0], me.position[1] - target.position[1]) > WAKE_DISTANCE) {
      state.notify('곰돌이 가까이 다가가서 깨워 주세요.');
      return;
    }
    if (now - (wakeCooldowns.get(targetId) ?? 0) < 5000) {
      state.notify('잠시 후 다시 깨울 수 있어요.');
      return;
    }
    if (state.connection === 'online') {
      if (!transport?.({ type: 'wake_up', targetId })) state.notify('연결을 확인하고 다시 시도해 주세요.', 'error');
    } else {
      set({
        now,
        players: state.players.map(player => player.id === me.id ? {
          ...player,
          rotation: Math.atan2(target.position[0] - me.position[0], target.position[1] - me.position[1]),
          knockUntil: now + KNOCK_DURATION_MS,
        } : player),
      });
      wakeCooldowns.set(targetId, now);
      state.notify(target.name + '님에게 깨우기 알림을 보냈어요. · 데모', 'success');
    }
  },
  completeTodo(text) {
    const cleanText = text.trim();
    if (!cleanText || cleanText.length > 70) {
      get().notify('완료한 일을 1~70자로 적어 주세요.', 'error');
      return;
    }
    const state = get();
    if (state.connection === 'online') {
      if (!transport?.({ type: 'todo_complete', text: cleanText })) state.notify('연결을 확인하고 다시 시도해 주세요.', 'error');
      return;
    }
    const me = state.players.find(player => player.id === state.myId);
    const todo: CompletedTodo = { id: crypto.randomUUID(), text: cleanText, authorName: me?.name ?? '나', completedAt: Date.now() + state.serverOffsetMs };
    set({ todos: [...state.todos, todo].slice(-12) });
    state.notify('완료한 일을 벽에 붙였어요.', 'success');
  },
  simulateWake() { get().notify('민서님이 당신을 깨웠습니다! · 알림 체험', 'wake'); },
  dismissToast() { set({ toast: null }); },
  notify(message, kind = 'info') { set({ toast: { id: ++toastSequence, message, kind } }); },
  setConnection(connection) { set({ connection }); },
  applySnapshot(players, todos, serverNow, selfId) {
    const state = get();
    const myId = selfId ?? state.myId;
    const me = state.players.find(player => player.id === myId);
    const localNow = Date.now();
    const keepLocalPosition = !selfId && me && me.status === 'resting' && !isKnocking(me, serverNow) && localNow - lastMoveAt < 200;
    const synchronizedPlayers = players.map(player => keepLocalPosition && player.id === myId && player.status === 'resting' && !isKnocking(player, serverNow)
      ? { ...player, position: me.position, rotation: me.rotation }
      : player);
    set({ players: synchronizedPlayers, todos, myId, connection: 'online', now: serverNow, serverOffsetMs: serverNow - localNow });
  },
  tick() {
    const state = get();
    const now = Date.now() + state.serverOffsetMs;
    let changed = false;
    const players = state.players.map(player => {
      let next = player;
      if (player.status === 'studying' && player.endsAt !== null && player.endsAt <= now) {
        next = { ...next, status: 'resting', remainingSeconds: 0, endsAt: null };
      } else if (state.connection !== 'online' && player.status === 'studying' && now - player.styleChangedAt >= STUDY_STYLE_INTERVAL_MS) {
        next = { ...next, studyStyle: nextStudyStyle(player.studyStyle), styleChangedAt: now };
      }
      if (player.knockUntil !== null && player.knockUntil <= now) next = { ...next, knockUntil: null };
      if (state.connection !== 'online' && player.jumpStartedAt !== null && player.jumpStartedAt + JUMP_DURATION_MS <= now) {
        next = { ...next, jumpStartedAt: null };
      }
      if (next !== player) changed = true;
      return next;
    });
    set(changed ? { now, players } : { now });
  },
}));
