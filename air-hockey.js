'use strict';

const {
  WIDTH, HEIGHT, STEP, RAIL, GOAL_TOP, GOAL_BOTTOM, POST_RADIUS, MALLET_RADIUS, PUCK_RADIUS,
  createMatch, step,
} = AirHockey;

const rink = document.querySelector('#rink');
const context = rink.getContext('2d');
const menu = document.querySelector('#menu');
const paused = document.querySelector('#paused');
const finished = document.querySelector('#finished');
const pauseButton = document.querySelector('#pause');
const resumeButton = document.querySelector('#resume');
const replayButton = document.querySelector('#replay');
const soloButton = document.querySelector('#solo');
const fullscreenButton = document.querySelector('#fullscreen');
const statusLabel = document.querySelector('#status');
const scores = ['#left-score', '#right-score'].map((selector) => document.querySelector(selector));
const labels = ['#left-label', '#right-label'].map((selector) => document.querySelector(selector));
const keyHints = ['#duo-keys', '#solo-keys'].map((selector) => document.querySelector(selector));
const colors = ['#51f8ed', '#ff6bc9'];
const keyboard = [['KeyA', 'KeyD', 'KeyW', 'KeyS'], ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']];
const movementKeys = new Set(keyboard.flat());
const pressedKeys = new Set();
const activePointers = new Map();
const targets = [null, null];

let match = createMatch('duo');
let pageMode = 'menu';
let remaining = 0;
let lastFrame = 0;

function layer(width, height) {
  const image = document.createElement('canvas');
  image.width = width;
  image.height = height;
  return image;
}

function ring(pen, x, y, radius) {
  pen.beginPath();
  pen.arc(x, y, radius, 0, 2 * Math.PI);
}

function buildRink() {
  const image = layer(WIDTH, HEIGHT);
  const pen = image.getContext('2d');
  const floor = pen.createLinearGradient(0, 0, WIDTH, 0);
  floor.addColorStop(0, '#102e3b');
  floor.addColorStop(.46, '#15162b');
  floor.addColorStop(.54, '#18142c');
  floor.addColorStop(1, '#361a39');
  pen.fillStyle = floor;
  pen.fillRect(0, 0, WIDTH, HEIGHT);

  pen.strokeStyle = '#584b732e';
  pen.beginPath();
  for (let x = 0; x < WIDTH; x += 24) { pen.moveTo(x, 0); pen.lineTo(x, HEIGHT); }
  for (let y = 0; y < HEIGHT; y += 24) { pen.moveTo(0, y); pen.lineTo(WIDTH, y); }
  pen.stroke();

  const centerY = HEIGHT / 2;
  pen.strokeStyle = '#a482cc76';
  pen.lineWidth = 2;
  ring(pen, WIDTH / 2, centerY, 62);
  pen.stroke();
  ring(pen, WIDTH / 2, centerY, 73);
  pen.stroke();
  pen.setLineDash([6, 9]);
  pen.beginPath();
  pen.moveTo(WIDTH / 2, RAIL);
  pen.lineTo(WIDTH / 2, HEIGHT - RAIL);
  pen.stroke();
  pen.setLineDash([]);

  pen.strokeStyle = '#71628c';
  pen.beginPath();
  pen.moveTo(RAIL, RAIL);
  pen.lineTo(WIDTH - RAIL, RAIL);
  pen.moveTo(RAIL, HEIGHT - RAIL);
  pen.lineTo(WIDTH - RAIL, HEIGHT - RAIL);
  pen.stroke();

  for (const [side, color] of colors.entries()) {
    const wall = side === 0 ? RAIL : WIDTH - RAIL;
    const direction = side === 0 ? 1 : -1;
    const goalX = side === 0 ? 0 : WIDTH - RAIL;
    pen.fillStyle = color + '29';
    pen.fillRect(goalX, GOAL_TOP, RAIL, GOAL_BOTTOM - GOAL_TOP);
    pen.strokeStyle = color + '70';
    pen.lineWidth = 2;
    pen.beginPath();
    pen.moveTo(wall, RAIL);
    pen.lineTo(wall, GOAL_TOP);
    pen.moveTo(wall, GOAL_BOTTOM);
    pen.lineTo(wall, HEIGHT - RAIL);
    for (let y = GOAL_TOP + 12; y < GOAL_BOTTOM; y += 12) {
      pen.moveTo(goalX, y);
      pen.lineTo(goalX + RAIL, y);
    }
    pen.stroke();

    pen.strokeStyle = color + '48';
    ring(pen, wall, centerY, 120);
    pen.stroke();
    for (const y of [134, HEIGHT - 134]) {
      const x = wall + direction * 240;
      ring(pen, x, y, 18);
      pen.stroke();
      pen.fillStyle = color + '75';
      pen.fillRect(x - 2, y - 2, 4, 4);
    }

    pen.fillStyle = color;
    for (const y of [GOAL_TOP, GOAL_BOTTOM]) {
      ring(pen, wall, y, POST_RADIUS);
      pen.fill();
    }
    for (let i = 0; i < 9; i++) {
      const x = wall + direction * (12 + 13 * i);
      pen.fillRect(x - 3, 10, 7, 2);
      pen.fillRect(x - 3, HEIGHT - 12, 7, 2);
    }
  }
  return image;
}

function makeMallet(color) {
  const size = 94;
  const image = layer(size, size);
  const pen = image.getContext('2d');
  const center = size / 2;
  const glow = pen.createRadialGradient(center, center, MALLET_RADIUS - 1, center, center, center);
  glow.addColorStop(0, color + '90');
  glow.addColorStop(1, color + '00');
  pen.fillStyle = glow;
  pen.fillRect(0, 0, size, size);
  ring(pen, center, center, MALLET_RADIUS - 2);
  pen.fillStyle = '#0c1021';
  pen.fill();
  pen.strokeStyle = color;
  pen.lineWidth = 4;
  pen.stroke();
  ring(pen, center, center, 18);
  pen.strokeStyle = color + '80';
  pen.lineWidth = 2;
  pen.stroke();
  pen.fillStyle = color;
  pen.fillRect(center - 4, center - 4, 8, 8);
  return image;
}

const floorArt = buildRink();
const malletArt = colors.map(makeMallet);

function render() {
  context.drawImage(floorArt, 0, 0);
  const { x, y, vx, vy } = match.puck;
  if (match.phase === 'faceoff' && match.lastGoal != null) {
    context.fillStyle = colors[1 - match.lastGoal] + '32';
    context.fillRect(match.lastGoal === 0 ? WIDTH - RAIL : 0, GOAL_TOP, RAIL, GOAL_BOTTOM - GOAL_TOP);
  }

  if (match.phase === 'play') {
    context.strokeStyle = '#ecfc9666';
    context.lineWidth = 6;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x - vx * .03, y - vy * .03);
    context.stroke();
  }

  match.mallets.forEach((mallet, side) => {
    const image = malletArt[side];
    context.drawImage(image, mallet.x - image.width / 2, mallet.y - image.height / 2);
  });
  ring(context, x, y, PUCK_RADIUS);
  context.fillStyle = '#e9ff91';
  context.fill();
  ring(context, x, y, 5);
  context.fillStyle = '#293333';
  context.fill();
}

function setText(element, content) {
  if (element.textContent !== content) element.textContent = content;
}

function refreshHud() {
  match.scores.forEach((score, side) => setText(scores[side], String(score).padStart(2, '0')));
  statusLabel.hidden = pageMode !== 'playing' || match.phase !== 'faceoff';
  if (!statusLabel.hidden) setText(statusLabel, match.lastGoal == null ? 'Serv' : 'Värav!');
}

function clearControls() {
  for (const id of activePointers.keys()) {
    if (rink.hasPointerCapture(id)) rink.releasePointerCapture(id);
  }
  activePointers.clear();
  targets.fill(null);
  pressedKeys.clear();
}

function show(next) {
  clearControls();
  pageMode = next;
  remaining = 0;
  menu.hidden = next !== 'menu';
  paused.hidden = next !== 'paused';
  finished.hidden = next !== 'finished';
  pauseButton.disabled = next !== 'playing';
  const focus = { menu: soloButton, paused: resumeButton, finished: replayButton }[next];
  if (focus && document.hasFocus()) focus.focus({ preventScroll: true });
  refreshHud();
  render();
}

function setLabels(solo) {
  setText(labels[0], solo ? 'Sina' : 'Vasak');
  setText(labels[1], solo ? 'Arvuti' : 'Parem');
  keyHints[0].hidden = solo;
  keyHints[1].hidden = !solo;
}

function start(mode) {
  match = createMatch(mode, Math.random() < .5 ? 0 : 1);
  setLabels(mode === 'solo');
  show('playing');
}

function backToMenu() {
  match = createMatch('duo');
  setLabels(false);
  show('menu');
}

function finishMatch() {
  const winners = match.mode === 'solo' ? ['Sina võitsid!', 'Arvuti võitis!'] : ['Vasak võitis!', 'Parem võitis!'];
  setText(document.querySelector('#winner'), winners[match.winner]);
  show('finished');
}

function targetFor(side) {
  if (targets[side]) return targets[side];
  const isPressed = (index) => pressedKeys.has(keyboard[side][index])
    || (match.mode === 'solo' && pressedKeys.has(keyboard[1][index]));
  const dx = Number(isPressed(1)) - Number(isPressed(0));
  const dy = Number(isPressed(3)) - Number(isPressed(2));
  if (dx === 0 && dy === 0) return null;
  const mallet = match.mallets[side];
  return { x: mallet.x + dx * 80, y: mallet.y + dy * 80 };
}

function animate(time) {
  const elapsed = Math.min((time - lastFrame) / 1000, .075);
  lastFrame = time;
  if (pageMode === 'playing') {
    remaining += elapsed;
    while (remaining >= STEP) {
      step(match, [targetFor(0), targetFor(1)]);
      remaining -= STEP;
      if (match.phase === 'over') {
        finishMatch();
        break;
      }
    }
    if (pageMode === 'playing') {
      refreshHud();
      render();
    }
  }
  requestAnimationFrame(animate);
}

function rinkPosition(event) {
  const bounds = rink.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left) * WIDTH / bounds.width,
    y: (event.clientY - bounds.top) * HEIGHT / bounds.height,
  };
}

rink.addEventListener('pointerdown', (event) => {
  if (pageMode !== 'playing' || event.button !== 0) return;
  const target = rinkPosition(event);
  const side = target.x < WIDTH / 2 ? 0 : 1;
  if (targets[side] || (side === 1 && match.mode === 'solo')) return;
  activePointers.set(event.pointerId, side);
  targets[side] = target;
  rink.setPointerCapture(event.pointerId);
});

rink.addEventListener('pointermove', (event) => {
  const side = activePointers.get(event.pointerId);
  if (side !== undefined) targets[side] = rinkPosition(event);
});

function releasePointer(event) {
  const side = activePointers.get(event.pointerId);
  if (side === undefined) return;
  activePointers.delete(event.pointerId);
  targets[side] = null;
}

for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) rink.addEventListener(type, releasePointer);
rink.addEventListener('contextmenu', (event) => event.preventDefault());

window.addEventListener('keydown', (event) => {
  if (pageMode === 'playing' && movementKeys.has(event.code)) {
    event.preventDefault();
    pressedKeys.add(event.code);
  }
  if (event.code === 'Escape' && !event.repeat) {
    if (pageMode === 'playing') show('paused');
    else if (pageMode === 'paused') show('playing');
  }
});
window.addEventListener('keyup', (event) => pressedKeys.delete(event.code));
window.addEventListener('blur', () => {
  if (pageMode === 'playing') show('paused');
});

soloButton.addEventListener('click', () => start('solo'));
document.querySelector('#duo').addEventListener('click', () => start('duo'));
pauseButton.addEventListener('click', () => show('paused'));
resumeButton.addEventListener('click', () => show('playing'));
replayButton.addEventListener('click', () => start(match.mode));
document.querySelector('#pause-menu').addEventListener('click', backToMenu);
document.querySelector('#end-menu').addEventListener('click', backToMenu);

fullscreenButton.hidden = !document.fullscreenEnabled;
fullscreenButton.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    fullscreenButton.title = 'Täisekraaniks vajuta F11';
  }
});
document.addEventListener('fullscreenchange', () => {
  const label = document.fullscreenElement ? 'Välju täisekraanilt' : 'Täisekraan';
  fullscreenButton.title = label;
  fullscreenButton.setAttribute('aria-label', label);
});

backToMenu();
requestAnimationFrame(animate);
