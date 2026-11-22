'use strict';

const FlightControl = (() => {
  const WIDTH = 960;
  const HEIGHT = 460;
  const STEP = 1 / 60;
  const ROUND_TIME = 90;
  const SHIP_RADIUS = 13;
  const HIT_RADIUS = 29;
  const MAX_ROUTE_POINTS = 160;
  const DOCKS = [{ x: 82, y: 230, radius: 48 }, { x: 878, y: 230, radius: 48 }];
  const ASTEROID = { x: 480, y: 230, radius: 58 };
  const ENTRY_Y = [[102, 356, 66, 395], [356, 102, 395, 66]];
  const ENTRY_X = [768, 192];

  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function spawn(match, side) {
    if (match.ships.filter((ship) => ship.side === side).length >= 2) return false;
    const entries = ENTRY_Y[side];
    for (let offset = 0; offset < entries.length; offset++) {
      const index = (match.entryIndex[side] + offset) % entries.length;
      const entry = { x: ENTRY_X[side], y: entries[index] };
      if (match.ships.some((ship) => distance(ship, entry) < 70)) continue;

      match.entryIndex[side] = (index + 1) % entries.length;
      match.ships.push({
        ...entry, id: match.nextId++, side,
        speed: match.mode === 'solo' && side === 1 ? 122 : 155,
        angle: side === 0 ? Math.PI : 0,
        route: null, next: 1,
      });
      return true;
    }
    return false;
  }

  function createMatch(mode) {
    const match = {
      mode, time: ROUND_TIME, ended: false, winner: null,
      scores: [0, 0], ships: [], events: [], nextId: 1,
      entryIndex: [0, 0], spawnIn: [5, 5], aiIn: 1.15,
    };
    spawn(match, 0);
    spawn(match, 1);
    return match;
  }

  function segmentDistance(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (!lengthSquared) return distance(point, start);
    const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
    return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
  }

  function advance(ship, travel) {
    while (ship.next < ship.route.length) {
      const point = ship.route[ship.next];
      const remaining = distance(ship, point);
      if (remaining > 0) ship.angle = Math.atan2(point.y - ship.y, point.x - ship.x);
      if (travel < remaining) {
        ship.x += (point.x - ship.x) * travel / remaining;
        ship.y += (point.y - ship.y) * travel / remaining;
        return false;
      }
      ship.x = point.x;
      ship.y = point.y;
      ship.next++;
      travel -= remaining;
    }
    return true;
  }

  function predictConflict(match, ship, points) {
    if (points.length < 2) return null;
    const forecast = .12;
    const planned = { ...ship, route: points, next: 1 };
    let others = match.ships.filter((other) => other.id !== ship.id).map((other) => ({ ...other }));
    for (let seconds = 0; seconds < 16 && others.length > 0; seconds += forecast) {
      if (advance(planned, planned.speed * forecast)) break;
      others = others.filter((other) => !other.route || !advance(other, other.speed * forecast));
      if (others.some((other) => distance(planned, other) < SHIP_RADIUS * 2 + 5)) {
        return { x: planned.x, y: planned.y };
      }
    }
    return null;
  }

  function inspectRoute(match, shipId, drawing) {
    const ship = match.ships.find((item) => item.id === shipId);
    if (!ship || ship.route || match.ended || drawing.length > MAX_ROUTE_POINTS) return null;

    const points = [{ x: ship.x, y: ship.y }];
    for (const point of drawing) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
      const contained = { x: clamp(point.x, 16, WIDTH - 16), y: clamp(point.y, 16, HEIGHT - 16) };
      if (distance(points[points.length - 1], contained) >= 2) points.push(contained);
    }

    const dock = DOCKS[ship.side];
    const last = points[points.length - 1];
    const arrives = distance(last, dock) <= dock.radius;
    const wrongDock = distance(last, DOCKS[1 - ship.side]) <= DOCKS[1 - ship.side].radius;
    if (arrives && distance(last, dock) > 0) points.push({ x: dock.x, y: dock.y });
    const blocked = points.some((point, index) => index > 0
      && segmentDistance(ASTEROID, points[index - 1], point) <= ASTEROID.radius + SHIP_RADIUS + 2);
    const risk = blocked ? null : predictConflict(match, ship, points);
    return { points, arrives, wrongDock, blocked, risk };
  }

  function sendShip(match, shipId, drawing) {
    const plan = inspectRoute(match, shipId, drawing);
    if (!plan || !plan.arrives || plan.blocked) return false;
    const ship = match.ships.find((item) => item.id === shipId);
    ship.route = plan.points;
    ship.next = 1;
    return true;
  }

  function dispatchComputer(match) {
    const dock = DOCKS[1];
    for (const ship of match.ships) {
      if (ship.side !== 1 || ship.route) continue;
      const lanes = ship.y < HEIGHT / 2 ? [95, 365, 53, 407] : [365, 95, 407, 53];
      for (const y of lanes) {
        const drawing = [{ x: 333, y }, { x: 627, y }, dock];
        const plan = inspectRoute(match, ship.id, drawing);
        if (plan.arrives && !plan.blocked && !plan.risk) {
          sendShip(match, ship.id, drawing);
          return;
        }
      }
    }
  }

  function resolveTraffic(match, dt) {
    const removed = new Set();
    for (const ship of match.ships) {
      if (ship.route && advance(ship, ship.speed * dt)) {
        match.scores[ship.side]++;
        removed.add(ship.id);
        match.events.push({ type: 'docked', side: ship.side, x: ship.x, y: ship.y });
      }
    }

    for (const [index, ship] of match.ships.entries()) {
      if (removed.has(ship.id)) continue;
      for (const other of match.ships.slice(index + 1)) {
        if (removed.has(other.id) || (!ship.route && !other.route) || distance(ship, other) >= SHIP_RADIUS * 2) continue;
        removed.add(ship.id);
        removed.add(other.id);
        match.events.push({ type: 'collision', x: (ship.x + other.x) / 2, y: (ship.y + other.y) / 2 });
        break;
      }
    }

    if (removed.size) match.ships = match.ships.filter((ship) => !removed.has(ship.id));
  }

  function step(match, dt = STEP) {
    if (match.ended) return;
    match.events.length = 0;
    const elapsed = Math.min(match.time, dt);
    match.time -= elapsed;
    resolveTraffic(match, elapsed);
    if (match.time <= 1e-8) {
      match.time = 0;
      match.ended = true;
      const [left, right] = match.scores;
      match.winner = left === right ? null : Number(right > left);
      return;
    }

    for (const side of [0, 1]) {
      match.spawnIn[side] -= elapsed;
      if (match.spawnIn[side] <= 0) match.spawnIn[side] = spawn(match, side) ? 5 : .6;
    }
    if (match.mode === 'solo') {
      match.aiIn -= elapsed;
      if (match.aiIn <= 0) {
        dispatchComputer(match);
        match.aiIn = 1.05;
      }
    }
  }

  return { WIDTH, HEIGHT, STEP, ROUND_TIME, SHIP_RADIUS, HIT_RADIUS, MAX_ROUTE_POINTS, DOCKS, ASTEROID, distance, createMatch, inspectRoute, sendShip, step };
})();

if (typeof module !== 'undefined') module.exports = FlightControl;
