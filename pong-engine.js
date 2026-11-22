'use strict';

const Pong = (() => {
  const WIDTH = 960;
  const HEIGHT = 480;
  const STEP = 1 / 120;
  const WIN_SCORE = 7;
  const PADDLE_X = [40, WIDTH - 54];
  const PADDLE_WIDTH = 14;
  const PADDLE_HEIGHT = 90;
  const BALL_RADIUS = 7;
  const INSET = 12;
  const TOP = INSET + BALL_RADIUS;
  const BOTTOM = HEIGHT - TOP;
  const SERVE_DELAY = 0.85;

  const clamp = (number, low, high) => Math.min(high, Math.max(low, number));

  function centerBall(game, direction) {
    Object.assign(game.ball, { x: WIDTH / 2, y: HEIGHT / 2, vx: 0, vy: 0 });
    game.phase = 'serve';
    game.serveTime = SERVE_DELAY;
    game.serveDirection = direction;
  }

  function createGame(mode, direction = 1) {
    const game = {
      mode,
      scores: [0, 0],
      paddles: [HEIGHT / 2, HEIGHT / 2],
      ball: {},
      winner: null,
      cpuDelay: 0,
      cpuTarget: HEIGHT / 2,
    };
    centerBall(game, direction);
    return game;
  }

  function movePaddle(game, side, target, speed, dt) {
    if (target == null) return;
    const limit = INSET + PADDLE_HEIGHT / 2;
    const y = game.paddles[side];
    const delta = clamp(target - y, -speed * dt, speed * dt);
    game.paddles[side] = clamp(y + delta, limit, HEIGHT - limit);
  }

  function launch(game) {
    game.phase = 'rally';
    game.ball.vx = 390 * game.serveDirection;
    game.ball.vy = (game.scores[0] + game.scores[1]) % 2 === 0 ? 145 : -145;
  }

  function reflectY(y) {
    const span = BOTTOM - TOP;
    const wrapped = ((y - TOP) % (2 * span) + 2 * span) % (2 * span);
    return TOP + Math.min(wrapped, 2 * span - wrapped);
  }

  function moveCpu(game, dt) {
    game.cpuDelay -= dt;
    if (game.cpuDelay <= 0) {
      const { x, y, vx, vy } = game.ball;
      game.cpuDelay = 0.18;
      game.cpuTarget = HEIGHT / 2;
      if (vx > 0 && x > WIDTH * 0.35) {
        const timeToPaddle = Math.max(0, (PADDLE_X[1] - BALL_RADIUS - x) / vx);
        const aimError = vy < 0 ? -19 : 19;
        game.cpuTarget = reflectY(y + vy * timeToPaddle) + aimError;
      }
    }
    movePaddle(game, 1, game.cpuTarget, 325, dt);
  }

  function scorePoint(game, scorer) {
    game.scores[scorer] += 1;
    if (game.scores[scorer] === WIN_SCORE) {
      game.winner = scorer;
      game.phase = 'over';
      return;
    }
    centerBall(game, scorer === 0 ? 1 : -1);
  }

  function moveBall(game, dt) {
    const ball = game.ball;
    const x = ball.x + ball.vx * dt;
    const y = ball.y + ball.vy * dt;
    const side = ball.vx < 0 ? 0 : 1;
    const face = side === 0 ? PADDLE_X[0] + PADDLE_WIDTH + BALL_RADIUS : PADDLE_X[1] - BALL_RADIUS;
    const crossedFace = side === 0 ? ball.x >= face && x < face : ball.x <= face && x > face;

    if (crossedFace) {
      const secondsToFace = (face - ball.x) / ball.vx;
      const contactY = reflectY(ball.y + ball.vy * secondsToFace);
      const offset = (contactY - game.paddles[side]) / (PADDLE_HEIGHT / 2 + BALL_RADIUS);
      if (Math.abs(offset) <= 1) {
        const angle = offset * 1.05;
        const speed = Math.min(865, Math.hypot(ball.vx, ball.vy) * 1.065 + 15);
        ball.vx = Math.cos(angle) * speed * (side === 0 ? 1 : -1);
        ball.vy = Math.sin(angle) * speed;
        ball.x = face;
        ball.y = contactY;
        return;
      }
    }

    ball.x = x;
    ball.y = reflectY(y);
    if (y <= TOP || y >= BOTTOM) ball.vy = -ball.vy;

    if (ball.x < -BALL_RADIUS) scorePoint(game, 1);
    if (ball.x > WIDTH + BALL_RADIUS) scorePoint(game, 0);
  }

  function step(game, targets, dt = STEP) {
    if (game.phase === 'over') return;
    movePaddle(game, 0, targets[0], 680, dt);
    if (game.mode === 'solo') moveCpu(game, dt);
    else movePaddle(game, 1, targets[1], 680, dt);

    if (game.phase === 'serve') {
      game.serveTime -= dt;
      if (game.serveTime <= 0) launch(game);
      return;
    }
    moveBall(game, dt);
  }

  return { WIDTH, HEIGHT, STEP, WIN_SCORE, PADDLE_X, PADDLE_WIDTH, PADDLE_HEIGHT, BALL_RADIUS, INSET, createGame, step };
})();

if (typeof module !== 'undefined') module.exports = Pong;
