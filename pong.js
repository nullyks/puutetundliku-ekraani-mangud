'use strict';

const {
  WIDTH, HEIGHT, STEP, PADDLE_X, PADDLE_WIDTH, PADDLE_HEIGHT, BALL_RADIUS, INSET,
  createGame, step,
} = Pong;

const canvas = document.querySelector('#court');
const context = canvas.getContext('2d');
const menu = document.querySelector('#menu');
const pauseScreen = document.querySelector('#paused');
const endScreen = document.querySelector('#finished');
const pauseButton = document.querySelector('#pause');
const resumeButton = document.querySelector('#resume');
const soloButton = document.querySelector('#solo');
const replayButton = document.querySelector('#replay');
const fullscreenButton = document.querySelector('#fullscreen');
const modeLabel = document.querySelector('#mode-label');
const leftLabel = document.querySelector('#left-label');
const rightLabel = document.querySelector('#right-label');
const scoreLabels = [document.querySelector('#left-score'), document.querySelector('#right-score')];
const serveNote = document.querySelector('#serve-note');
const duoKeys = document.querySelector('#duo-keys');
const soloKeys = document.querySelector('#solo-keys');
const keyboard = [['KeyW', 'KeyS'], ['ArrowUp', 'ArrowDown']];
const pressedKeys = new Set();
const contacts = new Map();
const targets = [null, null];
const paddleColors = ['#79f5d0', '#ffba76'];

let game = createGame('duo');
let screen = 'menu';
let elapsed = 0;
let previousTime = 0;

function buildCourt() {
  const background = document.createElement('canvas');
  background.width = WIDTH;
  background.height = HEIGHT;
  const pen = background.getContext('2d');

  pen.fillStyle = '#181c28';
  pen.fillRect(0, 0, WIDTH, HEIGHT);
  pen.fillStyle = '#191f2a';
  pen.fillRect(0, 0, 158, HEIGHT);
  pen.fillStyle = '#211e29';
  pen.fillRect(WIDTH - 158, 0, 158, HEIGHT);

  pen.fillStyle = '#282d3c';
  for (let x = 0; x < WIDTH; x += 24) pen.fillRect(x, 0, 1, HEIGHT);
  for (let y = 0; y < HEIGHT; y += 24) pen.fillRect(0, y, WIDTH, 1);

  pen.strokeStyle = '#515365';
  pen.lineWidth = 2;
  pen.strokeRect(INSET, INSET, WIDTH - INSET * 2, HEIGHT - INSET * 2);
  pen.strokeStyle = '#35394b';
  pen.beginPath();
  pen.arc(WIDTH / 2, HEIGHT / 2, 57, 0, 2 * Math.PI);
  pen.stroke();

  pen.fillStyle = '#55586a';
  for (let y = INSET + 9; y < HEIGHT - INSET - 9; y += 18) {
    pen.fillRect(WIDTH / 2 - 1, y, 2, 8);
  }
  return background;
}

const courtArt = buildCourt();

function draw() {
  context.drawImage(courtArt, 0, 0);
  game.paddles.forEach((y, side) => {
    const top = Math.round(y - PADDLE_HEIGHT / 2);
    const x = PADDLE_X[side];
    context.globalAlpha = .18;
    context.fillStyle = paddleColors[side];
    context.fillRect(x - 5, top - 4, PADDLE_WIDTH + 10, PADDLE_HEIGHT + 8);
    context.globalAlpha = 1;
    context.fillRect(x, top, PADDLE_WIDTH, PADDLE_HEIGHT);
    context.fillStyle = '#fbf3e5';
    context.fillRect(x + 2, top + 2, PADDLE_WIDTH - 4, 3);
  });

  const { x, y, vx, vy } = game.ball;
  context.fillStyle = '#fff2d6';
  if (game.phase === 'rally') {
    context.globalAlpha = .15;
    context.fillRect(Math.round(x - vx * .021) - 4, Math.round(y - vy * .021) - 4, 8, 8);
    context.globalAlpha = .32;
    context.fillRect(Math.round(x - vx * .011) - 5, Math.round(y - vy * .011) - 5, 10, 10);
    context.globalAlpha = 1;
  }
  context.fillRect(Math.round(x) - BALL_RADIUS, Math.round(y) - BALL_RADIUS, BALL_RADIUS * 2, BALL_RADIUS * 2);
}

function setText(element, text) {
  if (element.textContent !== String(text)) element.textContent = text;
}

function refreshHud() {
  game.scores.forEach((score, side) => setText(scoreLabels[side], score));
  serveNote.hidden = screen !== 'playing' || game.phase !== 'serve';
}

function clearInputs() {
  for (const id of contacts.keys()) {
    if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }
  contacts.clear();
  targets.fill(null);
  pressedKeys.clear();
}

function setScreen(next) {
  clearInputs();
  screen = next;
  elapsed = 0;
  menu.hidden = screen !== 'menu';
  pauseScreen.hidden = screen !== 'paused';
  endScreen.hidden = screen !== 'finished';
  pauseButton.disabled = screen !== 'playing';
  const initialFocus = { menu: soloButton, paused: resumeButton, finished: replayButton }[screen];
  if (initialFocus && document.hasFocus()) initialFocus.focus({ preventScroll: true });
  refreshHud();
  draw();
}

function start(mode) {
  game = createGame(mode, Math.random() < .5 ? -1 : 1);
  const solo = mode === 'solo';
  setText(modeLabel, solo ? 'Arvuti vastu' : 'Kahekesi');
  setText(leftLabel, solo ? 'Sina' : 'Vasak');
  setText(rightLabel, solo ? 'Arvuti' : 'Parem');
  duoKeys.hidden = solo;
  soloKeys.hidden = !solo;
  setScreen('playing');
}

function showMenu() {
  game = createGame('duo');
  setText(modeLabel, 'Vali mänguviis');
  setText(leftLabel, 'Vasak');
  setText(rightLabel, 'Parem');
  duoKeys.hidden = false;
  soloKeys.hidden = true;
  setScreen('menu');
}

function endGame() {
  const winner = game.mode === 'solo'
    ? ['Sina võitsid!', 'Arvuti võitis!'][game.winner]
    : ['Vasak võitis!', 'Parem võitis!'][game.winner];
  setText(document.querySelector('#winner'), winner);
  setScreen('finished');
}

function getTarget(side) {
  if (targets[side] != null) return targets[side];
  const [up, down] = keyboard[side];
  const goingUp = pressedKeys.has(up) || (game.mode === 'solo' && pressedKeys.has('ArrowUp'));
  const goingDown = pressedKeys.has(down) || (game.mode === 'solo' && pressedKeys.has('ArrowDown'));
  if (goingUp === goingDown) return null;
  return goingUp ? 0 : HEIGHT;
}

function frame(time) {
  const dt = Math.min((time - previousTime) / 1000, .075);
  previousTime = time;

  if (screen === 'playing') {
    elapsed += dt;
    while (elapsed >= STEP) {
      step(game, [getTarget(0), getTarget(1)]);
      elapsed -= STEP;
      if (game.phase === 'over') {
        endGame();
        break;
      }
    }
    if (screen === 'playing') {
      refreshHud();
      draw();
    }
  }
  requestAnimationFrame(frame);
}

function position(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left) * WIDTH / bounds.width,
    y: (event.clientY - bounds.top) * HEIGHT / bounds.height,
  };
}

canvas.addEventListener('pointerdown', (event) => {
  if (screen !== 'playing' || event.button !== 0) return;
  const { x, y } = position(event);
  const side = x < WIDTH / 2 ? 0 : 1;
  if ((side === 1 && game.mode === 'solo') || targets[side] != null) return;
  contacts.set(event.pointerId, side);
  targets[side] = y;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  const side = contacts.get(event.pointerId);
  if (side !== undefined) targets[side] = position(event).y;
});

function releasePointer(event) {
  const side = contacts.get(event.pointerId);
  if (side === undefined) return;
  contacts.delete(event.pointerId);
  targets[side] = null;
}

canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('lostpointercapture', releasePointer);
canvas.addEventListener('contextmenu', (event) => event.preventDefault());

const movementKeys = new Set(keyboard.flat());
window.addEventListener('keydown', (event) => {
  if (movementKeys.has(event.code) && screen === 'playing') {
    event.preventDefault();
    pressedKeys.add(event.code);
  }
  if (event.code === 'Escape' && !event.repeat) {
    if (screen === 'playing') setScreen('paused');
    else if (screen === 'paused') setScreen('playing');
  }
});
window.addEventListener('keyup', (event) => pressedKeys.delete(event.code));
window.addEventListener('blur', () => {
  if (screen === 'playing') setScreen('paused');
});

soloButton.addEventListener('click', () => start('solo'));
document.querySelector('#duo').addEventListener('click', () => start('duo'));
pauseButton.addEventListener('click', () => setScreen('paused'));
resumeButton.addEventListener('click', () => setScreen('playing'));
replayButton.addEventListener('click', () => start(game.mode));
document.querySelector('#pause-menu').addEventListener('click', showMenu);
document.querySelector('#end-menu').addEventListener('click', showMenu);

fullscreenButton.hidden = !document.fullscreenEnabled;
fullscreenButton.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    modeLabel.textContent = 'Täisekraaniks vajuta F11';
  }
});
document.addEventListener('fullscreenchange', () => {
  const label = document.fullscreenElement ? 'Välju täisekraanilt' : 'Täisekraan';
  fullscreenButton.title = label;
  fullscreenButton.setAttribute('aria-label', label);
});

showMenu();
requestAnimationFrame(frame);
