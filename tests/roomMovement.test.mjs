import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveRoomMovement } from '../src/roomMovement.ts';

function outsideTables(position) {
  for (const x of [-3, 0, 3]) {
    assert.ok(Math.hypot(position[0] - x, position[1] - 1) >= 1.05 - 1e-9,
      'position must stay outside the table at x=' + x);
  }
}

test('a short arrow press escapes the overlapping seat in all four screen directions', () => {
  for (const x of [-3, 0, 3]) {
    for (const direction of [[-1, -1], [1, 1], [-1, 1], [1, -1]]) {
      const next = resolveRoomMovement([x, 0], direction.map(value => value * 0.005));
      outsideTables(next);
      assert.ok(Math.abs(next[0] - x) > 0.001, 'tangential component must survive the collision');
      assert.ok(next[1] < 0, 'the occupied seat must recover outside the desk');
    }
  }
});

test('straight inward movement stops at the table edge', () => {
  let position = [-3, -0.5];
  for (let frame = 0; frame < 120; frame += 1) {
    position = resolveRoomMovement(position, [0, 0.01]);
    outsideTables(position);
  }
  assert.ok(position[1] <= -0.05 + 1e-6);
  assert.equal(position[0], -3);
});

test('diagonal input slides around a table instead of freezing', () => {
  let position = [-3, -0.06];
  const start = [...position];
  for (let frame = 0; frame < 80; frame += 1) {
    position = resolveRoomMovement(position, [0.012, 0.012]);
    outsideTables(position);
  }
  assert.ok(position[0] > start[0] + 0.7);
  assert.ok(position[1] > start[1] + 0.2);
});

test('a large displacement cannot tunnel through the middle of a desk', () => {
  const next = resolveRoomMovement([-3, -0.5], [0, 4]);
  outsideTables(next);
  assert.ok(next[1] <= -0.05 + 1e-6);
});

test('movement slides along both counter faces', () => {
  const alongFront = resolveRoomMovement([3, -2.04], [0.2, -0.2]);
  assert.ok(alongFront[0] > 3.15);
  assert.equal(alongFront[1], -2.05);
  const alongSide = resolveRoomMovement([1.84, -2.5], [0.2, 0.2]);
  assert.equal(alongSide[0], 1.85);
  assert.ok(alongSide[1] > -2.35);
});

test('room bounds clamp movement and counter-overlapped starting positions recover', () => {
  const lower = resolveRoomMovement([-4.9, -2.9], [-100, -100]);
  const upper = resolveRoomMovement([4.9, 3.4], [100, 100]);
  assert.ok(lower[0] >= -5 && lower[0] < -4.999);
  assert.ok(lower[1] >= -3 && lower[1] < -2.999);
  assert.ok(upper[0] <= 5 && upper[0] > 4.999);
  assert.ok(upper[1] <= 3.5 && upper[1] > 3.499);
  const next = resolveRoomMovement([2, -2.5], [-0.01, 0]);
  assert.ok(next[0] <= 1.85 || next[1] >= -2.05);
});
