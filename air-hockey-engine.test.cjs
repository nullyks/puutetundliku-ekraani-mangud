'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  WIDTH, HEIGHT, RAIL, CORNER_RADIUS, GOAL_TOP, MALLET_RADIUS, PUCK_RADIUS, WIN_SCORE, createMatch, step,
} = require('./air-hockey-engine.js');

function runSteps(match, count, targets = [null, null]) {
  for (let i = 0; i < count; i++) step(match, targets);
}

function playingWith(puck, mode = 'duo') {
  const match = createMatch(mode);
  match.phase = 'play';
  Object.assign(match.puck, puck);
  return match;
}

test('faceoff starts after a delay and sends the puck to the selected half', () => {
  const match = createMatch('duo', 1);
  runSteps(match, 85);
  assert.equal(match.phase, 'faceoff');
  assert.equal(match.puck.x, WIDTH / 2);
  runSteps(match, 40);
  assert.equal(match.phase, 'play');
  assert.ok(match.puck.x > WIDTH / 2);
});

test('both mallets move independently in two dimensions and stay on their own half', () => {
  const match = createMatch('duo');
  runSteps(match, 65, [{ x: WIDTH, y: 0 }, { x: 0, y: HEIGHT }]);
  const [left, right] = match.mallets;
  assert.equal(left.x, WIDTH / 2 - MALLET_RADIUS);
  assert.equal(right.x, WIDTH / 2 + MALLET_RADIUS);
  assert.equal(left.y, RAIL + MALLET_RADIUS);
  assert.equal(right.y, HEIGHT - RAIL - MALLET_RADIUS);
  runSteps(match, 20, [null, { x: WIDTH - 100, y: 140 }]);
  assert.equal(left.x, WIDTH / 2 - MALLET_RADIUS);
  assert.equal(left.vx, 0);
  assert.ok(right.x > WIDTH / 2 + MALLET_RADIUS && right.y < HEIGHT / 2 + 160);
});

test('a moving mallet transfers momentum to a stationary puck', () => {
  const match = playingWith({ x: 212, y: HEIGHT / 2, vx: 0, vy: 0 });
  step(match, [{ x: 380, y: HEIGHT / 2 }, null]);
  assert.ok(match.puck.vx > 800);
  assert.equal(match.puck.vy, 0);
});

test('closed rails and a goal post deflect shots without scoring', () => {
  const cases = [
    { puck: { x: 300, y: RAIL + PUCK_RADIUS + 2, vx: 90, vy: -700 }, axis: 'vy' },
    { puck: { x: RAIL + PUCK_RADIUS + 2, y: 130, vx: -700, vy: 0 }, axis: 'vx' },
    { puck: { x: RAIL + PUCK_RADIUS + 2, y: GOAL_TOP + PUCK_RADIUS, vx: -950, vy: 0 }, axis: 'vy' },
  ];
  for (const { puck, axis } of cases) {
    const match = playingWith(puck);
    step(match, [null, null]);
    assert.ok(match.puck[axis] > 0);
    assert.deepEqual(match.scores, [0, 0]);
  }
});

function corners() {
  const near = RAIL + CORNER_RADIUS;
  return [
    [near, near, -1, -1], [WIDTH - near, near, 1, -1],
    [near, HEIGHT - near, -1, 1], [WIDTH - near, HEIGHT - near, 1, 1],
  ];
}

test('all four corner arcs redirect the puck into the rink', () => {
  const limit = CORNER_RADIUS - PUCK_RADIUS;
  for (const [cx, cy, sx, sy] of corners()) {
    const match = playingWith({ x: cx + sx * (limit - 2) * .8, y: cy + sy * (limit - 2) * .6, vx: sx * 730, vy: 0 });
    step(match, [null, null]);
    const { x, y, vx, vy } = match.puck;
    assert.ok(Math.hypot(x - cx, y - cy) <= limit + 1e-8);
    assert.ok(vx * sx < 0 && vy * sy < 0);
    assert.deepEqual(match.scores, [0, 0]);
  }
});

test('the puck escapes when a mallet is held against a rounded corner', () => {
  for (const [cx, cy, sx, sy] of corners()) {
    const edge = (CORNER_RADIUS - PUCK_RADIUS) / Math.SQRT2;
    const x = cx + sx * edge;
    const y = cy + sy * edge;
    const match = playingWith({ x, y, vx: 0, vy: 0 });
    const side = sx < 0 ? 0 : 1;
    Object.assign(match.mallets[side], { x: cx - sx * 48, y: cy - sy * 48 });
    const targets = [null, null];
    targets[side] = { x: sx < 0 ? 0 : WIDTH, y: sy < 0 ? 0 : HEIGHT };
    runSteps(match, 90, targets);
    const mallet = match.mallets[side];
    assert.ok(Math.hypot(mallet.x - cx, mallet.y - cy) <= CORNER_RADIUS - MALLET_RADIUS + 1e-8);
    assert.ok(Math.hypot(match.puck.x - x, match.puck.y - y) > MALLET_RADIUS + PUCK_RADIUS);
    assert.deepEqual(match.scores, [0, 0]);
  }
});

test('a puck completely past either goal line scores once and resets the faceoff', () => {
  for (const side of [0, 1]) {
    const x = side === 0 ? RAIL - PUCK_RADIUS + 2 : WIDTH - RAIL + PUCK_RADIUS - 2;
    const vx = side === 0 ? -700 : 700;
    const match = playingWith({ x, y: HEIGHT / 2, vx, vy: 0 });
    step(match, [null, null]);
    assert.equal(match.scores[1 - side], 1);
    assert.equal(match.lastGoal, 1 - side);
    assert.equal(match.serveSide, side);
    assert.equal(match.phase, 'faceoff');
    assert.equal(match.puck.x, WIDTH / 2);
    runSteps(match, 25);
    assert.equal(match.scores[1 - side], 1);
  }
});

test('the computer can hit back and ignores a right-side human target in solo mode', () => {
  const match = playingWith({ x: 667, y: HEIGHT / 2, vx: 0, vy: 0 }, 'solo');
  runSteps(match, 42, [null, { x: WIDTH, y: 0 }]);
  assert.ok(match.mallets[1].x < WIDTH - 168);
  assert.ok(match.puck.vx < -200);
});

test('the seventh goal determines the winner and stops the match', () => {
  const match = playingWith({ x: RAIL - PUCK_RADIUS + 2, y: HEIGHT / 2, vx: -650, vy: 0 });
  match.scores[1] = WIN_SCORE - 1;
  step(match, [null, null]);
  assert.equal(match.winner, 1);
  assert.equal(match.phase, 'over');
  runSteps(match, 200);
  assert.deepEqual(match.scores, [0, WIN_SCORE]);
});
