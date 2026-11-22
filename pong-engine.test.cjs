'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { HEIGHT, WIDTH, STEP, WIN_SCORE, createGame, step } = require('./pong-engine.js');

function runSteps(game, count, targets = [null, null]) {
  for (let i = 0; i < count; i++) step(game, targets);
}

test('serve waits and then sends the ball in the selected direction', () => {
  const game = createGame('duo', -1);
  runSteps(game, 90);
  assert.equal(game.phase, 'serve');
  assert.equal(game.ball.x, WIDTH / 2);
  runSteps(game, 30);
  assert.equal(game.phase, 'rally');
  assert.ok(game.ball.x < WIDTH / 2);
});

test('player targets move both paddles independently and clamp them to the court', () => {
  const game = createGame('duo');
  runSteps(game, 50, [-100, HEIGHT + 100]);
  assert.ok(game.paddles[0] > 0 && game.paddles[0] < HEIGHT / 2);
  assert.equal(game.paddles[0] + game.paddles[1], HEIGHT);
  const left = game.paddles[0];
  runSteps(game, 25, [null, 100]);
  assert.equal(game.paddles[0], left);
  assert.ok(game.paddles[1] < HEIGHT - left);
});

test('solo opponent follows an approaching shot instead of the right-side user target', () => {
  const game = createGame('solo');
  game.phase = 'rally';
  Object.assign(game.ball, { x: 700, y: 120, vx: 350, vy: -25 });
  runSteps(game, 24, [HEIGHT, HEIGHT]);
  assert.ok(game.paddles[0] > HEIGHT / 2);
  assert.ok(game.paddles[1] < HEIGHT / 2);
});

test('the ceiling reflects the ball back down', () => {
  const game = createGame('duo');
  game.phase = 'rally';
  Object.assign(game.ball, { x: 480, y: 20, vx: 390, vy: -200 });
  step(game, [null, null]);
  assert.ok(game.ball.vy > 0);
  assert.ok(game.ball.y >= 19);
});

test('fast shots hitting either paddle bounce away without scoring', () => {
  for (const [x, vx, expectedDirection] of [[64, -850, 1], [895, 850, -1]]) {
    const game = createGame('duo');
    game.phase = 'rally';
    Object.assign(game.ball, { x, y: 250, vx, vy: 0 });
    step(game, [null, null]);
    assert.equal(Math.sign(game.ball.vx), expectedDirection);
    assert.deepEqual(game.scores, [0, 0]);
  }
});

test('missing a shot awards exactly one point and starts a fresh serve', () => {
  const game = createGame('duo');
  game.phase = 'rally';
  Object.assign(game.ball, { x: WIDTH + 5, y: 42, vx: 400, vy: 0 });
  step(game, [null, null], STEP);
  assert.deepEqual(game.scores, [1, 0]);
  assert.equal(game.phase, 'serve');
  assert.equal(game.ball.x, WIDTH / 2);
  runSteps(game, 45);
  assert.deepEqual(game.scores, [1, 0]);
});

test('the seventh point ends play and further steps leave the match over', () => {
  const game = createGame('duo');
  game.scores[1] = WIN_SCORE - 1;
  game.phase = 'rally';
  Object.assign(game.ball, { x: -5, y: 42, vx: -400, vy: 0 });
  step(game, [null, null]);
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 1);
  runSteps(game, 300);
  assert.deepEqual(game.scores, [0, WIN_SCORE]);
});
