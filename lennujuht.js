'use strict';

const {
  WIDTH, HEIGHT, STEP, SHIP_RADIUS, HIT_RADIUS, MAX_ROUTE_POINTS, DOCKS, ASTEROID, FIELD_RADIUS,
  distance, createMatch, inspectRoute, sendShip, step,
} = FlightControl;

const radar = document.querySelector('#radar');
const brush = radar.getContext('2d');
const soloButton = document.querySelector('#solo');
const pauseButton = document.querySelector('#pause');
const resumeButton = document.querySelector('#resume');
const replayButton = document.querySelector('#replay');
const fullscreenButton = document.querySelector('#fullscreen');
const teamNames = ['#left-label', '#right-label'].map((selector) => document.querySelector(selector));
const scores = ['#left-score', '#right-score'].map((selector) => document.querySelector(selector));
const clock = document.querySelector('#clock');
const status = document.querySelector('#status');
const overlays = ['menu', 'paused', 'finished'].map((id) => document.getElementById(id));
const teamColors = ['#affe96', '#ffce75'];
const danger = '#ff8c91';
const drafts = new Map();
const signals = [];

let match = createMatch('duo');
let view = 'menu';
let selected = null;
let notice = null;
let lastFrame = 0;
let accumulator = 0;
let timeToForecast = 0;

function circle(pen, x, y, radius) {
  pen.beginPath();
  pen.arc(x, y, radius, 0, Math.PI * 2);
}

function makeMap() {
  const image = document.createElement('canvas');
  image.width = WIDTH;
  image.height = HEIGHT;
  const pen = image.getContext('2d');
  const ground = pen.createLinearGradient(0, 0, WIDTH, HEIGHT);
  ground.addColorStop(0, '#112a36');
  ground.addColorStop(.52, '#0c1a28');
  ground.addColorStop(1, '#18232f');
  pen.fillStyle = ground;
  pen.fillRect(0, 0, WIDTH, HEIGHT);

  pen.lineWidth = 1;
  pen.strokeStyle = '#52717b35';
  pen.beginPath();
  for (let x = 0; x <= WIDTH; x += 32) { pen.moveTo(x, 0); pen.lineTo(x, HEIGHT); }
  for (let y = 0; y <= HEIGHT; y += 32) { pen.moveTo(0, y); pen.lineTo(WIDTH, y); }
  pen.stroke();
  pen.fillStyle = '#c9e6f069';
  for (let i = 0; i < 95; i++) pen.fillRect((97 * i + 37) % WIDTH, (283 * i + 71) % HEIGHT, i % 8 ? 1 : 2, i % 8 ? 1 : 2);
  pen.strokeStyle = '#7b99a36b';
  pen.strokeRect(13, 13, WIDTH - 26, HEIGHT - 26);
  return image;
}

function makeAsteroidArt() {
  const image = document.createElement('canvas');
  const center = FIELD_RADIUS + 3;
  image.width = center * 2;
  image.height = center * 2;
  const pen = image.getContext('2d');
  const glow = pen.createRadialGradient(center, center, ASTEROID.radius, center, center, FIELD_RADIUS);
  glow.addColorStop(0, '#9e7ad846');
  glow.addColorStop(1, '#9e7ad804');
  pen.fillStyle = glow;
  circle(pen, center, center, FIELD_RADIUS);
  pen.fill();
  pen.strokeStyle = '#c2a2eb9c';
  pen.setLineDash([6, 8]);
  pen.stroke();
  pen.strokeStyle = '#b695d96a';
  circle(pen, center, center, 116);
  pen.stroke();
  pen.strokeStyle = '#ff9fa18c';
  pen.setLineDash([6, 6]);
  circle(pen, center, center, ASTEROID.radius + SHIP_RADIUS + 2);
  pen.stroke();
  pen.setLineDash([]);

  const rock = [[-46,-7],[-34,-39],[-8,-53],[25,-47],[46,-31],[54,2],[38,28],[20,48],[-10,52],[-38,32],[-50,10]];
  pen.beginPath();
  rock.forEach(([x, y], i) => pen[i === 0 ? 'moveTo' : 'lineTo'](center + x, center + y));
  pen.closePath();
  pen.fillStyle = '#4b3b4b';
  pen.fill();
  pen.lineWidth = 2;
  pen.strokeStyle = '#b47881';
  pen.stroke();
  pen.fillStyle = '#614a58';
  for (const [x, y, radius] of [[-17,-17,13],[22,-5,9],[-6,21,11]]) {
    circle(pen, center + x, center + y, radius);
    pen.fill();
  }
  pen.fillStyle = '#e5b3b7';
  pen.textAlign = 'center';
  pen.font = 'bold 12px monospace';
  pen.fillText('ASTEROID', center, center + 94);
  return image;
}

const map = makeMap();
const asteroidArt = makeAsteroidArt();

function trace(start, points, from, color, width, dashed = false) {
  brush.lineWidth = width;
  brush.strokeStyle = color;
  brush.lineJoin = 'round';
  brush.lineCap = 'round';
  brush.setLineDash(dashed ? [8, 6] : []);
  brush.beginPath();
  brush.moveTo(start.x, start.y);
  for (let i = from; i < points.length; i++) brush.lineTo(points[i].x, points[i].y);
  brush.stroke();
  brush.setLineDash([]);
}

function renderDock(dock, side, highlighted) {
  const { x, y, radius } = dock;
  const color = teamColors[side];
  brush.fillStyle = color + (highlighted ? '35' : '17');
  brush.strokeStyle = color + (highlighted ? 'ff' : 'ac');
  brush.lineWidth = highlighted ? 3 : 2;
  circle(brush, x, y, radius);
  brush.fill();
  brush.stroke();
  brush.strokeStyle = color + '75';
  circle(brush, x, y, radius - 8);
  brush.stroke();
  brush.fillStyle = color;
  brush.textAlign = 'center';
  brush.font = 'bold 16px monospace';
  brush.fillText(side === 0 ? 'DOKK A' : 'DOKK B', x, y + 6);
  brush.fillRect(x - 10, y - radius - 6, 20, 2);
  brush.fillRect(x - 10, y + radius + 4, 20, 2);
}

function renderShip(ship, highlighted) {
  const color = teamColors[ship.side];
  if (!ship.route || highlighted) {
    brush.fillStyle = '#0a1a26';
    brush.strokeStyle = color + (highlighted ? 'ff' : '85');
    brush.lineWidth = highlighted ? 2.5 : 1.5;
    circle(brush, ship.x, ship.y, 24);
    brush.fill();
    brush.stroke();
  }
  brush.save();
  brush.translate(ship.x, ship.y);
  brush.rotate(ship.angle);
  brush.fillStyle = color;
  brush.beginPath();
  brush.moveTo(16, 0);
  brush.lineTo(-11, 12);
  brush.lineTo(-7, 0);
  brush.lineTo(-11, -12);
  brush.closePath();
  brush.fill();
  if (ship.route) {
    brush.fillStyle = color + '70';
    brush.fillRect(-18, -2, 8, 4);
  }
  brush.restore();
}

function render() {
  brush.drawImage(map, 0, 0);
  const asteroid = match.asteroid;
  brush.drawImage(asteroidArt, asteroid.x - asteroidArt.width / 2, asteroid.y - asteroidArt.height / 2);
  const selectedShip = match.ships.find((ship) => ship.id === selected);
  const marked = new Set([...drafts.values()].map((draft) => draft.side));
  if (selectedShip) marked.add(selectedShip.side);
  DOCKS.forEach((dock, side) => renderDock(dock, side, marked.has(side)));

  for (const ship of match.ships) {
    if (ship.route) {
      trace(ship.course, ship.route, ship.course.next, teamColors[ship.side] + '8f', 2);
      if (distance(ship, ship.course) >= 5) trace(ship, [ship.course], 0, teamColors[ship.side] + '82', 1.5, true);
    }
  }
  for (const draft of drafts.values()) {
    const plan = draft.plan;
    const color = teamColors[draft.side];
    trace(draft.origin, draft.points, 0, color + (plan ? '54' : 'bd'), 2);
    if (plan) {
      const warn = plan.blocked || plan.risk || plan.wrongDock;
      trace(plan.trajectory[0], plan.trajectory, 1, warn ? danger : color, 3, true);
    }
    const warning = plan?.hazard ?? plan?.risk;
    if (warning) {
      brush.strokeStyle = danger;
      brush.lineWidth = 2;
      circle(brush, warning.x, warning.y, 14);
      brush.stroke();
    }
  }
  const drawing = new Set([...drafts.values()].map((draft) => draft.id));
  for (const ship of match.ships) renderShip(ship, ship.id === selected || drawing.has(ship.id));
  for (const signal of signals) {
    brush.strokeStyle = signal.type === 'docked' ? teamColors[signal.side] : danger;
    brush.globalAlpha = signal.life / .7;
    brush.lineWidth = 2;
    circle(brush, signal.x, signal.y, 52 - signal.life * 55);
    brush.stroke();
  }
  brush.globalAlpha = 1;
}

function setText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}

function refreshHud() {
  match.scores.forEach((score, side) => setText(scores[side], String(score)));
  const seconds = Math.ceil(match.time);
  const text = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  if (clock.textContent !== text) {
    clock.textContent = text;
    clock.dateTime = `PT${seconds}S`;
  }
  clock.classList.toggle('urgent', seconds <= 15);
}

function refreshStatus() {
  let text = '';
  let tone = '';
  if (view === 'playing') {
    const plans = [...drafts.values()].map((draft) => draft.plan).filter(Boolean);
    if (plans.some((plan) => plan.blocked)) {
      text = 'Trajektoor tabaks asteroidi. Joonista kaugemalt.';
      tone = 'danger';
    } else if (plans.some((plan) => plan.wrongDock)) {
      text = 'Vali laevaga sama värvi dokk.';
      tone = 'danger';
    } else if (plans.some((plan) => plan.risk)) {
      text = 'Võimalik kokkupõrge. Vaata punast ringi.';
      tone = 'danger';
    } else if (plans.some((plan) => plan.arrives)) {
      text = 'Tõsta sõrm, et laev teele saata.';
      tone = 'ready';
    } else if (plans.some((plan) => plan.deflected)) {
      text = 'Gravitatsioon painutab trajektoori.';
    } else if (notice) {
      ({ text, tone } = notice);
    } else {
      text = 'Lohista laevalt sama värvi dokki.';
    }
  }
  setText(status, text);
  if (status.dataset.tone !== tone) status.dataset.tone = tone;
}

function notify(text, tone = '') {
  notice = { text, tone, life: 2.2 };
}

function setView(next) {
  for (const id of drafts.keys()) if (radar.hasPointerCapture(id)) radar.releasePointerCapture(id);
  drafts.clear();
  selected = null;
  view = next;
  accumulator = 0;
  for (const overlay of overlays) overlay.hidden = overlay.id !== next;
  pauseButton.disabled = next !== 'playing';
  const focus = { menu: soloButton, paused: resumeButton, finished: replayButton }[next];
  if (focus && document.hasFocus()) focus.focus({ preventScroll: true });
  refreshHud();
  refreshStatus();
  render();
}

function reset(mode) {
  match = createMatch(mode);
  notice = null;
  signals.length = 0;
  setText(teamNames[0], mode === 'solo' ? 'Sina' : 'Roheline');
  setText(teamNames[1], mode === 'solo' ? 'Arvuti' : 'Kollane');
}

function start(mode) {
  reset(mode);
  setView('playing');
}

function backToMenu() {
  reset('duo');
  setView('menu');
}

function finish() {
  const labels = match.mode === 'solo' ? ['Sina võitsid!', 'Arvuti võitis!'] : ['Roheline võitis!', 'Kollane võitis!'];
  setText(document.querySelector('#winner'), match.winner == null ? 'Viik' : labels[match.winner]);
  setText(document.querySelector('#final-score'), `${match.scores[0]} : ${match.scores[1]}`);
  setView('finished');
}

function animate(time) {
  const dt = Math.min((time - lastFrame) / 1000, .08);
  lastFrame = time;
  if (view === 'playing') {
    accumulator += dt;
    while (accumulator >= STEP) {
      step(match);
      accumulator -= STEP;
      for (const event of match.events) {
        signals.push({ ...event, life: .7 });
        if (event.type === 'collision') notify('Kokkupõrge. Mõlemad laevad kadusid.', 'danger');
        if (event.type === 'asteroid') notify('Laev tabas asteroidi.', 'danger');
      }
      if (match.ended) { finish(); break; }
    }
    if (view === 'playing') {
      timeToForecast -= dt;
      if (timeToForecast <= 0) {
        for (const draft of drafts.values()) draft.plan = inspectRoute(match, draft.id, draft.points);
        timeToForecast = .09;
      }
      if (notice && (notice.life -= dt) <= 0) notice = null;
      for (let i = signals.length - 1; i >= 0; i--) if ((signals[i].life -= dt) <= 0) signals.splice(i, 1);
      refreshHud();
      refreshStatus();
      render();
    }
  }
  requestAnimationFrame(animate);
}

function position(event) {
  const bounds = radar.getBoundingClientRect();
  return { x: (event.clientX - bounds.left) * WIDTH / bounds.width, y: (event.clientY - bounds.top) * HEIGHT / bounds.height };
}

function collect(draft, point, minimumDistance) {
  const last = draft.points[draft.points.length - 1] ?? draft.origin;
  if (distance(last, point) < minimumDistance) return;
  if (draft.points.length === MAX_ROUTE_POINTS) draft.points[MAX_ROUTE_POINTS - 1] = point;
  else draft.points.push(point);
}

radar.addEventListener('pointerdown', (event) => {
  if (view !== 'playing' || event.button !== 0) return;
  const point = position(event);
  const busy = new Set([...drafts.values()].map((draft) => draft.id));
  const ship = match.ships.filter((item) => !item.route && !busy.has(item.id)
    && (item.side === 0 || match.mode === 'duo') && distance(item, point) <= HIT_RADIUS)
    .sort((a, b) => distance(a, point) - distance(b, point))[0];
  if (!ship) return;

  const origin = { x: ship.x, y: ship.y };
  selected = ship.id;
  notice = null;
  drafts.set(event.pointerId, { id: ship.id, side: ship.side, origin, down: point, points: [], plan: null });
  timeToForecast = 0;
  radar.setPointerCapture(event.pointerId);
});

radar.addEventListener('pointermove', (event) => {
  const draft = drafts.get(event.pointerId);
  if (!draft) return;
  const samples = event.getCoalescedEvents?.();
  for (const sample of samples?.length ? samples : [event]) {
    const point = position(sample);
    if (draft.points.length || distance(draft.down, point) >= 9) collect(draft, point, 7);
  }
});

radar.addEventListener('pointerup', (event) => {
  const draft = drafts.get(event.pointerId);
  if (!draft) return;
  drafts.delete(event.pointerId);
  const end = position(event);
  if (draft.points.length === 0 && distance(draft.down, end) < 9) {
    notify(`Laev valitud. Selle siht on dokk ${draft.side === 0 ? 'A' : 'B'}.`);
    return;
  }
  collect(draft, end, .1);
  const plan = inspectRoute(match, draft.id, draft.points);
  if (!plan) notify('Laev on juba liikunud. Vali uus laev.');
  else if (plan.blocked) notify('Trajektoor tabaks asteroidi. Joonista kaugemalt.', 'danger');
  else if (!plan.arrives) notify('Lõpeta rada sama värvi dokis.', 'danger');
  else if (sendShip(match, draft.id, draft.points)) {
    if (selected === draft.id) selected = null;
    if (plan.risk) notify('Laev on teel. Marsruudil on kokkupõrke oht.', 'danger');
    else notify('Laev on teel.', 'ready');
  }
});

for (const type of ['pointercancel', 'lostpointercapture']) {
  radar.addEventListener(type, (event) => drafts.delete(event.pointerId));
}
radar.addEventListener('contextmenu', (event) => event.preventDefault());

for (const [id, action] of [
  ['solo', () => start('solo')], ['duo', () => start('duo')], ['pause', () => setView('paused')],
  ['resume', () => setView('playing')], ['replay', () => start(match.mode)],
  ['pause-menu', backToMenu], ['end-menu', backToMenu],
]) document.getElementById(id).addEventListener('click', action);

window.addEventListener('keydown', (event) => {
  if (event.code !== 'Escape' || event.repeat) return;
  if (view === 'playing') setView('paused');
  else if (view === 'paused') setView('playing');
});
window.addEventListener('blur', () => { if (view === 'playing') setView('paused'); });

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
  const title = document.fullscreenElement ? 'Välju täisekraanilt' : 'Täisekraan';
  fullscreenButton.title = title;
  fullscreenButton.setAttribute('aria-label', title);
});

backToMenu();
requestAnimationFrame(animate);
