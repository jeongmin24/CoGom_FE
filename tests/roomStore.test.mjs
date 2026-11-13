import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bindRoomTransport, FOCUS_SECONDS, isJumping, isKnocking, JUMP_DURATION_MS, KNOCK_DURATION_MS,
  SEAT_POSITIONS, STUDY_STYLES, STUDY_STYLE_INTERVAL_MS, useRoomStore,
} from '../src/features/study-room/roomStore.ts';

let fixtureId = 0;
function setup(t, { connection = 'demo', offset = 0 } = {}) {
  const clock = { value: 1_700_000_000_000 };
  t.mock.method(Date, 'now', () => clock.value);
  t.mock.method(Math, 'random', () => 0);
  const suffix = ++fixtureId;
  const me = {
    id: 'me-' + suffix, name: '나', position: [0, 0], rotation: 0, status: 'resting',
    remainingSeconds: FOCUS_SECONDS, endsAt: null, seatIndex: 4, studyStyle: 'typing',
    styleChangedAt: clock.value + offset, knockUntil: null, jumpStartedAt: null,
  };
  const peer = { ...me, id: 'peer-' + suffix, name: '친구', position: [1, 0], seatIndex: 2 };
  const sent = [];
  useRoomStore.setState({ players: [me, peer], todos: [], myId: me.id, connection, now: clock.value + offset, serverOffsetMs: offset, toast: null });
  bindRoomTransport(event => { sent.push(event); return true; });
  t.after(() => bindRoomTransport(null));
  return { clock, me, peer, sent, current: () => useRoomStore.getState().players.find(player => player.id === me.id) };
}

test('demo starts with an animated studying companion and complete player fields', () => {
  const players = useRoomStore.getInitialState().players;
  assert.equal(players.length, 3);
  assert.equal(players[1].status, 'studying');
  assert.equal(players[1].studyStyle, 'headphones');
  for (const player of players) {
    assert.ok(Number.isInteger(player.seatIndex));
    assert.ok(STUDY_STYLES.includes(player.studyStyle));
    assert.ok(Number.isFinite(player.styleChangedAt));
    assert.equal(player.knockUntil, null);
    assert.equal(player.jumpStartedAt, null);
  }
});

test('starting focus seats every assigned player, chooses a new style and uses server time', t => {
  const fixture = setup(t, { offset: 2800 });
  for (let seatIndex = 0; seatIndex < 6; seatIndex++) {
    useRoomStore.setState({ players: [{ ...fixture.me, position: [4, -2], seatIndex }, fixture.peer] });
    useRoomStore.getState().startTimer();
    const player = fixture.current();
    assert.deepEqual(player.position, SEAT_POSITIONS[seatIndex]);
    assert.equal(player.rotation, seatIndex < 3 ? 0 : Math.PI);
    assert.equal(player.status, 'studying');
    assert.notEqual(player.studyStyle, fixture.me.studyStyle);
    assert.equal(player.styleChangedAt, fixture.clock.value + 2800);
    assert.equal(player.endsAt, fixture.clock.value + 2800 + FOCUS_SECONDS * 1000);
    assert.equal(player.knockUntil, null);
    const messages = fixture.sent.length;
    useRoomStore.getState().startTimer();
    assert.equal(fixture.sent.length, messages, 'starting an active timer must be idempotent');
  }
});

test('studying blocks movement and waking; pause keeps elapsed time and unlocks movement', t => {
  const fixture = setup(t, { offset: 1200 });
  useRoomStore.getState().startTimer();
  const seated = fixture.current().position;
  fixture.sent.length = 0;
  useRoomStore.getState().moveMe([1, 1], 1);
  useRoomStore.getState().wakePlayer(fixture.peer.id);
  assert.deepEqual(fixture.current().position, seated);
  assert.deepEqual(fixture.sent, []);
  fixture.clock.value += 1501;
  useRoomStore.getState().pauseTimer();
  assert.equal(fixture.current().remainingSeconds, FOCUS_SECONDS - 1);
  assert.equal(fixture.current().endsAt, null);
  useRoomStore.getState().moveMe([1, 1], 1);
  assert.deepEqual(fixture.current().position, [1, 1]);
  assert.equal(fixture.sent.at(-1).type, 'move');
});

test('expiry unlocks movement and restart restores a complete focus session', t => {
  const fixture = setup(t);
  useRoomStore.setState({ players: [{ ...fixture.me, status: 'studying', endsAt: fixture.clock.value + 1000, remainingSeconds: 1 }, fixture.peer] });
  fixture.clock.value += 1000;
  useRoomStore.getState().tick();
  assert.equal(fixture.current().status, 'resting');
  assert.equal(fixture.current().remainingSeconds, 0);
  useRoomStore.getState().moveMe([2, 2], 0);
  assert.deepEqual(fixture.current().position, [2, 2]);
  useRoomStore.getState().startTimer();
  assert.equal(fixture.current().remainingSeconds, FOCUS_SECONDS);
  useRoomStore.getState().resetTimer();
  assert.equal(fixture.current().status, 'resting');
  assert.equal(fixture.current().endsAt, null);
});

test('demo rotates studying styles at 20 seconds without immediate repeats', t => {
  const fixture = setup(t, { offset: 3000 });
  useRoomStore.setState({ players: [fixture.me, { ...fixture.peer, status: 'studying', studyStyle: 'writing', endsAt: fixture.clock.value + 3000 + 120_000 }] });
  const companion = () => useRoomStore.getState().players[1];
  fixture.clock.value += STUDY_STYLE_INTERVAL_MS - 1;
  useRoomStore.getState().tick();
  assert.equal(companion().studyStyle, 'writing');
  fixture.clock.value++;
  useRoomStore.getState().tick();
  assert.notEqual(companion().studyStyle, 'writing');
  assert.equal(companion().styleChangedAt, fixture.clock.value + 3000);
  const previous = companion().studyStyle;
  fixture.clock.value += STUDY_STYLE_INTERVAL_MS;
  useRoomStore.getState().tick();
  assert.notEqual(companion().studyStyle, previous);
  assert.equal(fixture.current().studyStyle, 'typing', 'resting bears must keep their style');
});

test('online study styles remain authoritative until a server snapshot', t => {
  const fixture = setup(t, { connection: 'online' });
  useRoomStore.setState({ players: [{ ...fixture.me, status: 'studying', endsAt: fixture.clock.value + 120_000 }, fixture.peer] });
  fixture.clock.value += STUDY_STYLE_INTERVAL_MS * 2;
  useRoomStore.getState().tick();
  assert.equal(fixture.current().studyStyle, 'typing');
  assert.equal(fixture.current().styleChangedAt, fixture.me.styleChangedAt);
});

test('accepted demo wake faces target, locks movement for 1600 ms and enforces cooldown', t => {
  const fixture = setup(t, { offset: 2000 });
  useRoomStore.getState().wakePlayer(fixture.peer.id);
  assert.equal(fixture.current().rotation, Math.PI / 2);
  assert.equal(fixture.current().knockUntil, fixture.clock.value + 2000 + KNOCK_DURATION_MS);
  assert.equal(useRoomStore.getState().toast.kind, 'success');
  useRoomStore.getState().moveMe([0.5, 0], 0);
  assert.deepEqual(fixture.current().position, [0, 0]);
  const toastId = useRoomStore.getState().toast.id;
  useRoomStore.getState().wakePlayer(fixture.peer.id);
  assert.equal(useRoomStore.getState().toast.id, toastId, 'active knock ignores another wake');
  fixture.clock.value += KNOCK_DURATION_MS;
  useRoomStore.getState().tick();
  assert.equal(fixture.current().knockUntil, null);
  assert.equal(isKnocking(fixture.current(), fixture.clock.value + 2000), false);
  useRoomStore.getState().moveMe([0.5, 0], 0);
  assert.deepEqual(fixture.current().position, [0.5, 0]);
  useRoomStore.getState().wakePlayer(fixture.peer.id);
  assert.equal(useRoomStore.getState().toast.kind, 'info');
  assert.equal(fixture.current().knockUntil, null);
  fixture.clock.value += 5000 - KNOCK_DURATION_MS;
  useRoomStore.getState().wakePlayer(fixture.peer.id);
  assert.equal(useRoomStore.getState().toast.kind, 'success');
});

test('wake rejects self, studying targets and distant targets without a knock', t => {
  const fixture = setup(t);
  useRoomStore.getState().wakePlayer(fixture.me.id);
  assert.equal(useRoomStore.getState().toast, null);
  useRoomStore.setState({ players: [fixture.me, { ...fixture.peer, status: 'studying' }] });
  useRoomStore.getState().wakePlayer(fixture.peer.id);
  assert.match(useRoomStore.getState().toast.message, /집중/);
  useRoomStore.setState({ players: [fixture.me, { ...fixture.peer, position: [2, 0] }] });
  useRoomStore.getState().wakePlayer(fixture.peer.id);
  assert.match(useRoomStore.getState().toast.message, /가까이/);
  assert.equal(fixture.current().knockUntil, null);
  assert.deepEqual(fixture.sent, []);
});

test('online wake waits for authoritative knock and failed sends can be retried', t => {
  const fixture = setup(t, { connection: 'online' });
  bindRoomTransport(() => false);
  useRoomStore.getState().wakePlayer(fixture.peer.id);
  assert.equal(useRoomStore.getState().toast.kind, 'error');
  bindRoomTransport(event => { fixture.sent.push(event); return true; });
  useRoomStore.getState().wakePlayer(fixture.peer.id);
  assert.deepEqual(fixture.sent, [{ type: 'wake_up', targetId: fixture.peer.id }]);
  assert.equal(fixture.current().knockUntil, null);
  assert.equal(fixture.current().rotation, 0);
  const serverMe = { ...fixture.me, rotation: Math.PI / 2, knockUntil: fixture.clock.value + KNOCK_DURATION_MS };
  useRoomStore.getState().applySnapshot([serverMe, fixture.peer], [], fixture.clock.value);
  assert.equal(fixture.current().knockUntil, serverMe.knockUntil);
  assert.equal(fixture.current().rotation, Math.PI / 2);
});

test('authoritative sitting or knocking bypasses recent local movement preservation', t => {
  const fixture = setup(t, { connection: 'online' });
  useRoomStore.getState().moveMe([0.5, 0], 0.5);
  useRoomStore.getState().applySnapshot([fixture.me, fixture.peer], [], fixture.clock.value);
  assert.deepEqual(fixture.current().position, [0.5, 0], 'resting movement remains smooth');
  const seated = { ...fixture.me, position: [0, 2.4], rotation: Math.PI, status: 'studying', endsAt: fixture.clock.value + 60_000 };
  useRoomStore.getState().applySnapshot([seated, fixture.peer], [], fixture.clock.value);
  assert.deepEqual(fixture.current().position, [0, 2.4]);
  assert.equal(fixture.current().rotation, Math.PI);
  useRoomStore.setState({ players: [fixture.me, fixture.peer] });
  useRoomStore.getState().moveMe([0.5, 0], 0.5);
  const knocking = { ...fixture.me, rotation: Math.PI / 2, knockUntil: fixture.clock.value + KNOCK_DURATION_MS };
  useRoomStore.getState().applySnapshot([knocking, fixture.peer], [], fixture.clock.value);
  assert.deepEqual(fixture.current().position, fixture.me.position);
  assert.equal(fixture.current().rotation, Math.PI / 2);
});

test('demo jump starts on server-adjusted time and lands at exactly 800 ms', t => {
  const fixture = setup(t, { offset: 3500 });
  useRoomStore.getState().jumpMe();
  const startedAt = fixture.clock.value + 3500;
  assert.equal(fixture.current().jumpStartedAt, startedAt);
  assert.equal(isJumping(fixture.current(), startedAt), true);
  fixture.clock.value += JUMP_DURATION_MS - 1;
  useRoomStore.getState().tick();
  assert.equal(isJumping(fixture.current(), fixture.clock.value + 3500), true);
  useRoomStore.getState().jumpMe();
  assert.equal(fixture.current().jumpStartedAt, startedAt, 'another press cannot restart an airborne jump');
  fixture.clock.value++;
  assert.equal(isJumping(fixture.current(), fixture.clock.value + 3500), false);
  useRoomStore.getState().tick();
  assert.equal(fixture.current().jumpStartedAt, null);
  useRoomStore.getState().jumpMe();
  assert.equal(fixture.current().jumpStartedAt, startedAt + JUMP_DURATION_MS);
});

test('studying and active knocks reject jumps without sending an event', t => {
  const fixture = setup(t, { connection: 'online', offset: 2000 });
  useRoomStore.setState({ players: [{ ...fixture.me, status: 'studying' }, fixture.peer] });
  useRoomStore.getState().jumpMe();
  assert.equal(fixture.current().jumpStartedAt, null);
  useRoomStore.setState({ players: [{ ...fixture.me, knockUntil: fixture.clock.value + 2000 + KNOCK_DURATION_MS }, fixture.peer] });
  useRoomStore.getState().jumpMe();
  assert.equal(fixture.current().jumpStartedAt, null);
  assert.deepEqual(fixture.sent, []);
});

test('airborne movement is allowed while wake requests are blocked', t => {
  const fixture = setup(t);
  useRoomStore.getState().jumpMe();
  const startedAt = fixture.current().jumpStartedAt;
  useRoomStore.getState().moveMe([0.5, 0], Math.PI / 2);
  assert.deepEqual(fixture.current().position, [0.5, 0]);
  assert.equal(fixture.current().jumpStartedAt, startedAt);
  useRoomStore.getState().wakePlayer(fixture.peer.id);
  assert.equal(fixture.current().knockUntil, null);
  assert.equal(useRoomStore.getState().toast, null);
  assert.deepEqual(fixture.sent.map(event => event.type), ['move']);
  fixture.clock.value += JUMP_DURATION_MS;
  useRoomStore.getState().wakePlayer(fixture.peer.id);
  assert.equal(fixture.current().knockUntil, fixture.clock.value + KNOCK_DURATION_MS);
});

test('starting focus cancels an active jump and returns to the assigned seat', t => {
  const fixture = setup(t);
  useRoomStore.getState().jumpMe();
  fixture.clock.value += 200;
  useRoomStore.getState().startTimer();
  assert.equal(fixture.current().jumpStartedAt, null);
  assert.equal(fixture.current().status, 'studying');
  assert.deepEqual(fixture.current().position, SEAT_POSITIONS[fixture.me.seatIndex]);
});

test('online jump waits for authority and a failed send can be retried', t => {
  const fixture = setup(t, { connection: 'online' });
  bindRoomTransport(() => false);
  useRoomStore.getState().jumpMe();
  assert.equal(useRoomStore.getState().toast.kind, 'error');
  assert.equal(fixture.current().jumpStartedAt, null);
  bindRoomTransport(event => { fixture.sent.push(event); return true; });
  useRoomStore.getState().jumpMe();
  assert.deepEqual(fixture.sent, [{ type: 'jump' }]);
  assert.equal(fixture.current().jumpStartedAt, null);
  const serverMe = { ...fixture.me, jumpStartedAt: fixture.clock.value };
  useRoomStore.getState().applySnapshot([serverMe, fixture.peer], [], fixture.clock.value);
  assert.equal(isJumping(fixture.current(), fixture.clock.value), true);
  useRoomStore.getState().jumpMe();
  assert.equal(fixture.sent.length, 1, 'authoritative airborne state prevents duplicate events');
});

test('jump snapshots synchronize peers while preserving recent local horizontal movement', t => {
  const fixture = setup(t, { connection: 'online' });
  useRoomStore.getState().moveMe([0.5, 0], 0.5);
  const serverNow = fixture.clock.value + 2300;
  const jumpingMe = { ...fixture.me, jumpStartedAt: serverNow };
  const jumpingPeer = { ...fixture.peer, jumpStartedAt: serverNow - 150 };
  useRoomStore.getState().applySnapshot([jumpingMe, jumpingPeer], [], serverNow);
  assert.deepEqual(fixture.current().position, [0.5, 0]);
  assert.equal(fixture.current().jumpStartedAt, serverNow);
  assert.equal(useRoomStore.getState().players[1].jumpStartedAt, serverNow - 150);
  assert.equal(useRoomStore.getState().serverOffsetMs, 2300);
  fixture.clock.value += JUMP_DURATION_MS;
  useRoomStore.getState().tick();
  assert.equal(isJumping(fixture.current(), fixture.clock.value + 2300), false);
  assert.equal(fixture.current().jumpStartedAt, serverNow, 'online fields remain authoritative until the landing snapshot');
  useRoomStore.getState().applySnapshot([fixture.me, fixture.peer], [], fixture.clock.value + 2300);
  assert.equal(fixture.current().jumpStartedAt, null);
});
