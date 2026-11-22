'use strict';

const AirHockey = (() => {
  const WIDTH = 960;
  const HEIGHT = 480;
  const STEP = 1 / 120;
  const WIN_SCORE = 7;
  const RAIL = 22;
  const GOAL_TOP = 150;
  const GOAL_BOTTOM = 330;
  const POST_RADIUS = 6;
  const MALLET_RADIUS = 31;
  const PUCK_RADIUS = 12;
  const MAX_PUCK_SPEED = 1230;
  const SERVE_DELAY = .85;
  const CENTER = WIDTH / 2;

  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

  function resetFaceoff(match, serveSide, lastGoal = null) {
    match.phase = 'faceoff';
    match.serveTime = SERVE_DELAY;
    match.serveSide = serveSide;
    match.lastGoal = lastGoal;
    match.ai = { wait: 0, strike: 0, target: null };
    Object.assign(match.puck, { x: CENTER, y: HEIGHT / 2, vx: 0, vy: 0 });
    match.mallets.forEach((mallet, side) => {
      Object.assign(mallet, { x: side === 0 ? 168 : WIDTH - 168, y: HEIGHT / 2, vx: 0, vy: 0 });
    });
  }

  function createMatch(mode, serveSide = 0) {
    const match = { mode, scores: [0, 0], winner: null, puck: {}, mallets: [{}, {}] };
    resetFaceoff(match, serveSide);
    return match;
  }

  function moveMallet(mallet, side, target, speed, dt) {
    mallet.vx = 0;
    mallet.vy = 0;
    if (!target) return;
    const edge = RAIL + MALLET_RADIUS;
    const left = side === 0 ? edge : CENTER + MALLET_RADIUS;
    const right = side === 0 ? CENTER - MALLET_RADIUS : WIDTH - edge;
    const dx = clamp(target.x, left, right) - mallet.x;
    const dy = clamp(target.y, edge, HEIGHT - edge) - mallet.y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) return;
    const portion = Math.min(1, speed * dt / distance);
    mallet.x += dx * portion;
    mallet.y += dy * portion;
    mallet.vx = dx * portion / dt;
    mallet.vy = dy * portion / dt;
  }

  function computerTarget(match, dt) {
    const ai = match.ai;
    ai.wait -= dt;
    ai.strike -= dt;
    if (ai.wait > 0) return ai.target;
    ai.wait = .11;

    const puck = match.puck;
    const mallet = match.mallets[1];
    const guardX = WIDTH - 115;
    const nearOpponent = puck.x < CENTER + 14;
    const fastThreat = puck.vx > 310 && puck.x > WIDTH - 237;
    if (nearOpponent || fastThreat) {
      ai.strike = 0;
      const timeToGuard = puck.vx > 0 ? clamp((guardX - puck.x) / puck.vx, 0, .35) : 0;
      ai.target = { x: guardX, y: clamp(puck.y + puck.vy * timeToGuard, GOAL_TOP + 10, GOAL_BOTTOM - 10) };
    } else if (ai.strike <= 0) {
      const closeToRail = puck.x > WIDTH - RAIL - MALLET_RADIUS - 30;
      const aligned = mallet.x > puck.x + 30 && Math.abs(mallet.y - puck.y) < 44;
      if (closeToRail || aligned) {
        const offset = closeToRail ? (mallet.y > puck.y ? -38 : 38) : 0;
        ai.target = { x: puck.x + (closeToRail ? -8 : -92), y: puck.y + offset };
        ai.strike = .24;
      } else {
        const aim = (match.scores[0] + match.scores[1]) % 2 === 0 ? -13 : 13;
        ai.target = { x: puck.x + 74, y: puck.y + aim };
      }
    }
    return ai.target;
  }

  function collideCircle(puck, obstacle, radius, restitution, fallbackX) {
    const dx = puck.x - obstacle.x;
    const dy = puck.y - obstacle.y;
    const distance = Math.hypot(dx, dy);
    const clearance = radius + PUCK_RADIUS;
    if (distance >= clearance) return;

    const nx = distance === 0 ? fallbackX : dx / distance;
    const ny = distance === 0 ? 0 : dy / distance;
    puck.x = obstacle.x + nx * clearance;
    puck.y = obstacle.y + ny * clearance;
    const approaching = (puck.vx - obstacle.vx) * nx + (puck.vy - obstacle.vy) * ny;
    if (approaching < 0) {
      puck.vx -= (1 + restitution) * approaching * nx;
      puck.vy -= (1 + restitution) * approaching * ny;
    }
  }

  const posts = [RAIL, WIDTH - RAIL].flatMap((x) => [GOAL_TOP, GOAL_BOTTOM].map((y) => ({ x, y, vx: 0, vy: 0 })));

  function scoreGoal(match, scorer) {
    match.scores[scorer] += 1;
    if (match.scores[scorer] === WIN_SCORE) {
      match.winner = scorer;
      match.phase = 'over';
      return;
    }
    resetFaceoff(match, 1 - scorer, scorer);
  }

  function collideRink(match) {
    const puck = match.puck;
    const inset = RAIL + PUCK_RADIUS;
    if (puck.y < inset || puck.y > HEIGHT - inset) {
      puck.vy = (puck.y < inset ? 1 : -1) * Math.abs(puck.vy) * .94;
      puck.y = clamp(puck.y, inset, HEIGHT - inset);
    }

    if (puck.x < inset + POST_RADIUS || puck.x > WIDTH - inset - POST_RADIUS) {
      for (const post of posts) collideCircle(puck, post, POST_RADIUS, .91, post.x < CENTER ? 1 : -1);
      const inGoal = puck.y >= GOAL_TOP + PUCK_RADIUS && puck.y <= GOAL_BOTTOM - PUCK_RADIUS;
      if (inGoal) {
        if (puck.x + PUCK_RADIUS < RAIL) scoreGoal(match, 1);
        else if (puck.x - PUCK_RADIUS > WIDTH - RAIL) scoreGoal(match, 0);
      } else if (puck.x < inset || puck.x > WIDTH - inset) {
        puck.vx = (puck.x < inset ? 1 : -1) * Math.abs(puck.vx) * .94;
        puck.x = clamp(puck.x, inset, WIDTH - inset);
      }
    }
  }

  function movePuck(match, dt) {
    const puck = match.puck;
    puck.x += puck.vx * dt;
    puck.y += puck.vy * dt;
    match.mallets.forEach((mallet, side) => collideCircle(puck, mallet, MALLET_RADIUS, .91, side === 0 ? 1 : -1));
    collideRink(match);

    const speed = Math.hypot(puck.vx, puck.vy);
    const drag = speed < 9 ? 0 : Math.min(1 - .34 * dt, MAX_PUCK_SPEED / speed);
    puck.vx *= drag;
    puck.vy *= drag;
  }

  function step(match, targets, dt = STEP) {
    if (match.phase === 'over') return;
    moveMallet(match.mallets[0], 0, targets[0], 1040, dt);
    if (match.mode === 'solo') moveMallet(match.mallets[1], 1, computerTarget(match, dt), 455, dt);
    else moveMallet(match.mallets[1], 1, targets[1], 1040, dt);

    if (match.phase === 'faceoff') {
      match.serveTime -= dt;
      if (match.serveTime <= 0) {
        match.phase = 'play';
        match.puck.vx = match.serveSide === 0 ? -275 : 275;
        match.puck.vy = (match.scores[0] + match.scores[1]) % 2 === 0 ? 62 : -62;
      }
      return;
    }
    movePuck(match, dt);
  }

  return { WIDTH, HEIGHT, STEP, WIN_SCORE, RAIL, GOAL_TOP, GOAL_BOTTOM, POST_RADIUS, MALLET_RADIUS, PUCK_RADIUS, createMatch, step };
})();

if (typeof module !== 'undefined') module.exports = AirHockey;
