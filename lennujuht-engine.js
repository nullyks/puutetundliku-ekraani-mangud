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
  const FIELD_RADIUS = 166;
  const FIELD_ACCELERATION = 215;
  const AVOIDANCE_RADIUS = ASTEROID.radius + SHIP_RADIUS + 2;
  const ENTRY_Y = [[102, 356, 66, 395], [356, 102, 395, 66]];
  const ENTRY_X = [768, 192];

  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function asteroidAt(seconds) {
    return {
      x: ASTEROID.x + 72 * Math.sin(seconds * 2 * Math.PI / 31),
      y: ASTEROID.y + 38 * Math.sin(seconds * 2 * Math.PI / 23),
      radius: ASTEROID.radius,
    };
  }

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
        route: null, course: null,
      });
      return true;
    }
    return false;
  }

  function createMatch(mode) {
    const match = {
      mode, time: ROUND_TIME, elapsed: 0, asteroid: asteroidAt(0), ended: false, winner: null,
      scores: [0, 0], ships: [], events: [], nextId: 1,
      entryIndex: [0, 0], spawnIn: [5, 5], aiIn: 1.15,
    };
    spawn(match, 0);
    spawn(match, 1);
    return match;
  }

  function startCourse(ship, points) {
    ship.route = points;
    ship.course = { x: ship.x, y: ship.y, next: 1, driftX: 0, driftY: 0, vx: 0, vy: 0 };
  }

  function advanceCourse(course, route, travel) {
    while (course.next < route.length) {
      const point = route[course.next];
      const remaining = distance(course, point);
      if (travel < remaining) {
        course.x += (point.x - course.x) * travel / remaining;
        course.y += (point.y - course.y) * travel / remaining;
        return false;
      }
      course.x = point.x;
      course.y = point.y;
      course.next++;
      travel -= remaining;
    }
    return true;
  }

  function advanceFlight(ship, dt, asteroid) {
    const course = ship.course;
    const complete = advanceCourse(course, ship.route, ship.speed * dt);
    const dx = asteroid.x - ship.x;
    const dy = asteroid.y - ship.y;
    const d = Math.hypot(dx, dy);
    const pull = d > 0 && d < FIELD_RADIUS
      ? FIELD_ACCELERATION * clamp((FIELD_RADIUS - d) / (FIELD_RADIUS - ASTEROID.radius), 0, 1) / d
      : 0;

    // The flight controller gradually steers back toward the drawn course.
    course.vx += (dx * pull - 4.5 * course.driftX - 3.4 * course.vx) * dt;
    course.vy += (dy * pull - 4.5 * course.driftY - 3.4 * course.vy) * dt;
    course.driftX += course.vx * dt;
    course.driftY += course.vy * dt;

    const x = clamp(course.x + course.driftX, SHIP_RADIUS, WIDTH - SHIP_RADIUS);
    const y = clamp(course.y + course.driftY, SHIP_RADIUS, HEIGHT - SHIP_RADIUS);
    if (x !== ship.x || y !== ship.y) ship.angle = Math.atan2(y - ship.y, x - ship.x);
    ship.x = x;
    ship.y = y;
    return complete;
  }

  function isDocked(ship) {
    const dock = DOCKS[ship.side];
    return distance(ship, dock) <= dock.radius - SHIP_RADIUS;
  }

  function predictFlight(match, ship, points) {
    const planned = { ...ship };
    startCourse(planned, points);
    let others = match.ships.filter((other) => other.id !== ship.id)
      .map((other) => ({ ...other, course: other.course && { ...other.course } }));
    const trajectory = [points[0]];
    let hazard = null;
    let risk = null;
    let deflected = false;

    for (let frame = 1; frame <= 16 / STEP && points.length > 1; frame++) {
      const asteroid = asteroidAt(match.elapsed + frame * STEP);
      const complete = advanceFlight(planned, STEP, asteroid);
      deflected ||= Math.hypot(planned.course.driftX, planned.course.driftY) >= 5;
      if (distance(planned, asteroid) <= AVOIDANCE_RADIUS) {
        hazard = { x: planned.x, y: planned.y };
        trajectory.push(hazard);
        break;
      }

      if (!risk && others.length > 0) {
        others = others.filter((other) => {
          if (!other.route) return true;
          const arrived = advanceFlight(other, STEP, asteroid) && isDocked(other);
          return !arrived && distance(other, asteroid) > ASTEROID.radius + SHIP_RADIUS;
        });
        if (others.some((other) => distance(planned, other) < SHIP_RADIUS * 2 + 5)) {
          risk = { x: planned.x, y: planned.y };
        }
      }
      if (frame % 5 === 0 || complete) trajectory.push({ x: planned.x, y: planned.y });
      if (complete) break;
    }
    return { trajectory, hazard, risk, deflected };
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
    const prediction = predictFlight(match, ship, points);
    return { points, arrives, wrongDock, ...prediction, blocked: Boolean(prediction.hazard) };
  }

  function sendShip(match, shipId, drawing) {
    const plan = inspectRoute(match, shipId, drawing);
    return dispatchPlan(match, shipId, plan);
  }

  function dispatchPlan(match, shipId, plan) {
    if (!plan || !plan.arrives || plan.blocked) return false;
    const ship = match.ships.find((item) => item.id === shipId);
    startCourse(ship, plan.points);
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
          dispatchPlan(match, ship.id, plan);
          return;
        }
      }
    }
  }

  function resolveTraffic(match, dt) {
    const removed = new Set();
    for (const ship of match.ships) {
      if (!ship.route) continue;
      const complete = advanceFlight(ship, dt, match.asteroid);
      if (distance(ship, match.asteroid) <= ASTEROID.radius + SHIP_RADIUS) {
        removed.add(ship.id);
        match.events.push({ type: 'asteroid', x: ship.x, y: ship.y });
      } else if (complete && isDocked(ship)) {
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
    match.elapsed += elapsed;
    match.asteroid = asteroidAt(match.elapsed);
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

  return { WIDTH, HEIGHT, STEP, ROUND_TIME, SHIP_RADIUS, HIT_RADIUS, MAX_ROUTE_POINTS, DOCKS, ASTEROID, FIELD_RADIUS, distance, asteroidAt, createMatch, inspectRoute, sendShip, step };
})();

if (typeof module !== 'undefined') module.exports = FlightControl;
