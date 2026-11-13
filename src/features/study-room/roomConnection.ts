import { wsUrl } from '../../shared/apiBase';
import { bindRoomTransport, isKnocking, STUDY_STYLES, useRoomStore, type ClientEvent, type CompletedTodo, type Player } from './roomStore';

type IncomingPlayer = Omit<Player, 'jumpStartedAt'> & { jumpStartedAt?: number | null };

function isPlayer(value: unknown): value is IncomingPlayer {
  if (!value || typeof value !== 'object') return false;
  const player = value as Player;
  return typeof player.id === 'string' && typeof player.name === 'string'
    && Array.isArray(player.position) && player.position.length === 2 && player.position.every(Number.isFinite)
    && Number.isFinite(player.rotation) && Number.isFinite(player.remainingSeconds)
    && (player.endsAt === null || Number.isFinite(player.endsAt))
    && Number.isInteger(player.seatIndex) && player.seatIndex >= 0 && player.seatIndex < 6
    && STUDY_STYLES.includes(player.studyStyle) && Number.isFinite(player.styleChangedAt)
    && (player.knockUntil === null || Number.isFinite(player.knockUntil))
    && (player.jumpStartedAt === undefined || player.jumpStartedAt === null || Number.isFinite(player.jumpStartedAt))
    && (player.status === 'studying' || player.status === 'resting');
}

function isTodo(value: unknown): value is CompletedTodo {
  if (!value || typeof value !== 'object') return false;
  const todo = value as CompletedTodo;
  return typeof todo.id === 'string' && typeof todo.text === 'string'
    && typeof todo.authorName === 'string'
    && (typeof todo.completedAt === 'string' || Number.isFinite(todo.completedAt));
}

/** One mounted room owns the socket. Every reconnect starts from an authoritative snapshot. */
export function connectRoom(name: string, { liveOnly = false } = {}) {
  let socket: WebSocket | null = null;
  let disposed = false;
  let reconnectTimer = 0;
  let moveTimer = 0;
  let joinTimeout = 0;
  let pendingMove: Extract<ClientEvent, { type: 'move' }> | null = null;
  let lastSentAt = 0;
  let attempts = 0;
  let receivedWelcome = false;

  function discardMovement() {
    window.clearTimeout(moveTimer);
    moveTimer = 0;
    pendingMove = null;
  }

  function flushMovement() {
    window.clearTimeout(moveTimer);
    moveTimer = 0;
    if (pendingMove && socket?.readyState === WebSocket.OPEN && receivedWelcome) {
      socket.send(JSON.stringify(pendingMove));
      lastSentAt = Date.now();
    }
    pendingMove = null;
  }

  function send(event: ClientEvent): boolean {
    if (!socket || socket.readyState !== WebSocket.OPEN || !receivedWelcome) return false;
    if (event.type !== 'move') {
      // Starting focus assigns a seat on the server; an old trailing move must not follow it.
      if (event.type === 'timer_state' && event.status === 'studying') discardMovement();
      // WebSocket preserves message order, so the server checks the newest position.
      if (event.type === 'wake_up' || event.type === 'jump') flushMovement();
      socket.send(JSON.stringify(event));
      return true;
    }
    pendingMove = event;
    if (moveTimer) return true;
    const delay = Math.max(0, 100 - (Date.now() - lastSentAt));
    moveTimer = window.setTimeout(flushMovement, delay);
    return true;
  }

  function connect() {
    if (disposed) return;
    receivedWelcome = false;
    useRoomStore.getState().setConnection('connecting');
    const current = new WebSocket(wsUrl('/ws/study-room'));
    socket = current;
    current.onopen = () => {
      if (disposed || current !== socket) return;
      current.send(JSON.stringify({ type: 'join', name: name.trim().slice(0, 16) || '나' }));
      joinTimeout = window.setTimeout(() => { if (!receivedWelcome) current.close(); }, 5000);
    };
    current.onmessage = event => {
      if (disposed || current !== socket) return;
      let message: Record<string, unknown>;
      try {
        const parsed: unknown = JSON.parse(String(event.data));
        if (!parsed || typeof parsed !== 'object') return;
        message = parsed as Record<string, unknown>;
      } catch { return; }
      const state = useRoomStore.getState();
      if (message.type === 'welcome' || message.type === 'room_state') {
        if (!Array.isArray(message.players) || !message.players.every(isPlayer)
          || !Array.isArray(message.todos) || !message.todos.every(isTodo)
          || typeof message.serverNow !== 'number' || !Number.isFinite(message.serverNow)) return;
        if (message.type === 'welcome') {
          if (typeof message.selfId !== 'string') return;
          receivedWelcome = true;
          attempts = 0;
          window.clearTimeout(joinTimeout);
        }
        if (!receivedWelcome) return;
        const players: Player[] = message.players.map(player => ({ ...player, jumpStartedAt: player.jumpStartedAt ?? null }));
        state.applySnapshot(players, message.todos, message.serverNow,
          message.type === 'welcome' ? message.selfId as string : undefined);
        const synchronized = useRoomStore.getState();
        const me = synchronized.players.find(player => player.id === synchronized.myId);
        if (me && (me.status === 'studying' || isKnocking(me, message.serverNow))) discardMovement();
      } else if (message.type === 'wake_up' && message.targetId === state.myId && typeof message.fromName === 'string') {
        state.notify(message.fromName + '님이 당신을 깨웠습니다!', 'wake');
      } else if (message.type === 'wake_sent' && typeof message.targetName === 'string') {
        state.notify(message.targetName + '님에게 깨우기 알림을 보냈어요.', 'success');
      } else if (message.type === 'error' && typeof message.message === 'string') {
        state.notify(message.message, 'error');
      }
    };
    current.onerror = () => { current.close(); };
    current.onclose = () => {
      if (disposed || current !== socket) return;
      window.clearTimeout(joinTimeout);
      discardMovement();
      const wasOnline = receivedWelcome;
      receivedWelcome = false;
      if (liveOnly) {
        clearLiveRoom();
        if (wasOnline) useRoomStore.getState().notify('연결이 끊겼어요. 다시 연결하는 중이에요.');
      } else {
        useRoomStore.getState().setConnection('demo');
        if (wasOnline) useRoomStore.getState().notify('연결이 끊겨 로컬 미리보기로 전환했어요.');
      }
      const delay = Math.min(15000, 1500 * 2 ** attempts++);
      reconnectTimer = window.setTimeout(connect, delay);
    };
  }

  function clearLiveRoom() {
    useRoomStore.setState({ players: [], todos: [], myId: '', connection: 'connecting', serverOffsetMs: 0, now: Date.now() });
  }

  if (liveOnly) clearLiveRoom();
  bindRoomTransport(send);
  connect();
  return () => {
    disposed = true;
    bindRoomTransport(null);
    discardMovement();
    window.clearTimeout(reconnectTimer);
    window.clearTimeout(joinTimeout);
    if (socket) {
      socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
      socket.close();
    }
  };
}
