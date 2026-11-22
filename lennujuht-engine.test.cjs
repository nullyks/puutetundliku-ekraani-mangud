'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  ASTEROID, FIELD_RADIUS, WIDTH, HEIGHT, DOCKS, ROUND_TIME, STEP,
  createMatch, distance, inspectRoute, sendShip, step,
} = require('./lennujuht-engine.js');

function run(match, seconds) {
  for (let i = 0; i < Math.round(seconds / STEP); i++) step(match);
}

function route(side, y) {
  return side === 0
    ? [{ x: 630, y }, { x: 330, y }, DOCKS[0]]
    : [{ x: 330, y }, { x: 630, y }, DOCKS[1]];
}

test('one ship enters per team and the board stays limited to four ships', () => {
  const match = createMatch('duo');
  assert.deepEqual(match.ships.map((ship) => ship.side), [0, 1]);
  assert.equal(match.time, ROUND_TIME);
  run(match, 20);
  assert.equal(match.ships.length, 4);
  assert.equal(new Set(match.ships.map((ship) => ship.id)).size, 4);
});

test('unfinished drawings and the wrong dock leave the ship waiting', () => {
  const match = createMatch('duo');
  const ship = match.ships[0];
  assert.equal(sendShip(match, ship.id, [{ x: 720, y: 120 }]), false);
  assert.equal(inspectRoute(match, ship.id, [DOCKS[1]]).wrongDock, true);
  assert.equal(sendShip(match, ship.id, [DOCKS[1]]), false);
  assert.equal(ship.route, null);
});

test('a route segment intersects the asteroid even with waypoints outside the obstacle', () => {
  const match = createMatch('duo');
  const ship = match.ships[0];
  const drawing = [{ x: 620, y: ASTEROID.y }, { x: 340, y: ASTEROID.y }, DOCKS[0]];
  const plan = inspectRoute(match, ship.id, drawing);
  assert.ok(plan.arrives && plan.blocked);
  assert.equal(sendShip(match, ship.id, drawing), false);
  assert.equal(ship.route, null);
});

test('the asteroid and its field stay away from the edges throughout the round', () => {
  const match = createMatch('duo');
  const initial = match.asteroid;
  for (let frame = 0; frame < ROUND_TIME / STEP; frame++) {
    const previous = match.asteroid;
    step(match);
    const { x, y } = match.asteroid;
    assert.ok(distance(previous, match.asteroid) < 20 * STEP);
    assert.ok(Math.min(x, WIDTH - x, y, HEIGHT - y) > FIELD_RADIUS + 20);
    if (frame === 299) assert.ok(distance(initial, match.asteroid) > 40);
  }
});

test('gravity pulls a nearby flight inward and the simulated flight follows its preview', () => {
  const match = createMatch('duo');
  const ship = match.ships[0];
  assert.equal(inspectRoute(match, ship.id, route(0, 45)).deflected, false);

  const drawing = route(0, 145);
  const plan = inspectRoute(match, ship.id, drawing);
  assert.ok(plan.deflected && !plan.blocked);
  assert.ok(sendShip(match, ship.id, drawing));
  run(match, 2);
  assert.ok(ship.y > 150);
  assert.ok(distance(ship, plan.trajectory[24]) < 1e-8);
  run(match, 6);
  assert.equal(match.scores[0], 1);
});

test('arrival time changes whether the same drawn route would hit the asteroid', () => {
  const match = createMatch('duo');
  const ship = match.ships[0];
  const drawing = route(0, 170);
  assert.ok(inspectRoute(match, ship.id, drawing).hazard);
  run(match, 5);
  assert.equal(inspectRoute(match, ship.id, drawing).hazard, null);
});

test('a route inside the correct dock snaps to its center and scores only on arrival', () => {
  const match = createMatch('duo');
  const ship = match.ships[0];
  const drawing = route(0, 96);
  drawing[2] = { x: DOCKS[0].x + 25, y: DOCKS[0].y - 12 };
  assert.equal(sendShip(match, ship.id, drawing), true);
  assert.deepEqual(ship.route.at(-1), { x: DOCKS[0].x, y: DOCKS[0].y });
  run(match, 2);
  assert.deepEqual(match.scores, [0, 0]);
  assert.ok(ship.x < 768 && ship.x > DOCKS[0].x);
  run(match, 6);
  assert.deepEqual(match.scores, [1, 0]);
  assert.ok(!match.ships.includes(ship));
});

test('two ships on different lanes can complete routes simultaneously', () => {
  const match = createMatch('duo');
  const [left, right] = match.ships;
  assert.equal(sendShip(match, left.id, route(0, 96)), true);
  assert.equal(inspectRoute(match, right.id, route(1, 365)).risk, null);
  assert.equal(sendShip(match, right.id, route(1, 365)), true);
  run(match, 8);
  assert.deepEqual(match.scores, [1, 1]);
});

test('a conflict warning marks converging routes and the collision removes both ships', () => {
  const match = createMatch('duo');
  const [left, right] = match.ships;
  Object.assign(left, { x: 620, y: 100 });
  Object.assign(right, { x: 340, y: 100 });
  assert.equal(sendShip(match, left.id, route(0, 100)), true);
  const warning = inspectRoute(match, right.id, route(1, 100));
  assert.ok(warning.risk);
  assert.equal(sendShip(match, right.id, route(1, 100)), true);
  run(match, 1.2);
  assert.equal(match.ships.length, 0);
  assert.deepEqual(match.scores, [0, 0]);
});

test('the solo computer delivers a ship without moving the human team', () => {
  const match = createMatch('solo');
  const human = match.ships[0];
  run(match, 11);
  assert.ok(match.scores[1] > 0);
  assert.equal(human.route, null);
  assert.equal(match.scores[0], 0);
});

test('time limit freezes a win or tie and closes further route planning', () => {
  for (const [scores, winner] of [[[2, 1], 0], [[0, 3], 1], [[1, 1], null]]) {
    const match = createMatch('duo');
    match.time = STEP * 2;
    match.scores = scores;
    const ship = match.ships[0];
    run(match, 1);
    assert.equal(match.time, 0);
    assert.equal(match.ended, true);
    assert.equal(match.winner, winner);
    assert.equal(sendShip(match, ship.id, route(0, 100)), false);
  }
});
