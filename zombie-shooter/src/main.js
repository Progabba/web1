"use strict";

// Простая топ-даун шутер-игра на Canvas: WASD/стрелки — движение, мышь — прицел, ЛКМ — стрелять.

// Константы игровых параметров
const PLAYER_MAX_HEALTH = 100;
const PLAYER_MOVE_SPEED_PX_PER_S = 240;
const PLAYER_RADIUS_PX = 20;

const BULLET_RADIUS_PX = 4;
const BULLET_SPEED_PX_PER_S = 700;
const BULLET_FIRE_RATE_PER_S = 7; // выстрелов в секунду при зажатой ЛКМ
const BULLET_DAMAGE = 45;

const ZOMBIE_BASE_SPEED_PX_PER_S = 70; // будет расти с прогрессом
const ZOMBIE_RADIUS_MIN = 16;
const ZOMBIE_RADIUS_MAX = 26;
const ZOMBIE_HEALTH_PER_RADIUS = 8; // здоровье примерно пропорционально размеру
const ZOMBIE_CONTACT_DPS = 28; // урон игроку в секунду при контакте

const BLOOD_PARTICLES_ON_DEATH = 16;

const COLOR = {
  background: "#0d1017",
  gridDark: "#0f1320",
  gridLight: "#12162a",
  playerFill: "#4cc9f0",
  playerStroke: "#3a86ff",
  zombieFill: "#38b000",
  zombieStroke: "#2d6a4f",
  bullet: "#ffd166",
  blood: "#b11a1a",
  uiText: "#e6edf3",
  uiFaint: "#9aa4b2",
  hpBarBack: "#2b2f3a",
  hpBarFill: "#20c997",
  overlay: "rgba(0,0,0,0.55)",
};

/** @type {HTMLCanvasElement} */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Масштабирование под HiDPI
let devicePixelRatioCached = Math.max(1, window.devicePixelRatio || 1);
function resizeCanvasToWindow() {
  devicePixelRatioCached = Math.max(1, window.devicePixelRatio || 1);
  const cssWidth = window.innerWidth;
  const cssHeight = window.innerHeight;
  canvas.style.width = cssWidth + "px";
  canvas.style.height = cssHeight + "px";
  canvas.width = Math.floor(cssWidth * devicePixelRatioCached);
  canvas.height = Math.floor(cssHeight * devicePixelRatioCached);
  ctx.setTransform(devicePixelRatioCached, 0, 0, devicePixelRatioCached, 0, 0);
}
resizeCanvasToWindow();
window.addEventListener("resize", resizeCanvasToWindow);

// Утилиты
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function length(x, y) { return Math.hypot(x, y); }
function normalize(x, y) {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}
function randRange(min, max) { return min + Math.random() * (max - min); }
function randInt(min, maxInclusive) { return Math.floor(min + Math.random() * (maxInclusive - min + 1)); }
function dist2(ax, ay, bx, by) { const dx = ax - bx; const dy = ay - by; return dx * dx + dy * dy; }

// Ввод
const pressedKeys = new Set();
const mouseState = {
  x: canvas.width * 0.5 / devicePixelRatioCached,
  y: canvas.height * 0.5 / devicePixelRatioCached,
  isDown: false,
};

window.addEventListener("keydown", (e) => {
  // Предотвратить прокрутку стрелками/пробелом в браузере
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
    e.preventDefault();
  }
  pressedKeys.add(e.key.toLowerCase());
  if (gameState.isGameOver && e.key === "Enter") {
    initGame();
  }
});
window.addEventListener("keyup", (e) => pressedKeys.delete(e.key.toLowerCase()));

canvas.addEventListener("mousedown", (e) => {
  e.preventDefault();
  mouseState.isDown = true;
});
canvas.addEventListener("mouseup", () => { mouseState.isDown = false; });
canvas.addEventListener("mouseleave", () => { mouseState.isDown = false; });
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseState.x = e.clientX - rect.left;
  mouseState.y = e.clientY - rect.top;
});

// Состояние игры
const gameState = {
  player: null,
  bullets: [],
  zombies: [],
  particles: [],
  score: 0,
  isGameOver: false,
  lastShotAtMs: 0,
  lastSpawnAtMs: 0,
  elapsedMs: 0,
};

class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = PLAYER_RADIUS_PX;
    this.health = PLAYER_MAX_HEALTH;
  }
  update(dt) {
    const moveX = (pressedKeys.has("a") || pressedKeys.has("arrowleft") ? -1 : 0) + (pressedKeys.has("d") || pressedKeys.has("arrowright") ? 1 : 0);
    const moveY = (pressedKeys.has("w") || pressedKeys.has("arrowup") ? -1 : 0) + (pressedKeys.has("s") || pressedKeys.has("arrowdown") ? 1 : 0);
    let velocityX = 0, velocityY = 0;
    if (moveX !== 0 || moveY !== 0) {
      const dir = normalize(moveX, moveY);
      velocityX = dir.x * PLAYER_MOVE_SPEED_PX_PER_S * dt;
      velocityY = dir.y * PLAYER_MOVE_SPEED_PX_PER_S * dt;
    }
    this.x = clamp(this.x + velocityX, this.radius, canvas.width / devicePixelRatioCached - this.radius);
    this.y = clamp(this.y + velocityY, this.radius, canvas.height / devicePixelRatioCached - this.radius);

    // Стрельба при зажатой ЛКМ с учётом скорострельности
    if (mouseState.isDown && !gameState.isGameOver) {
      const now = performance.now();
      const intervalMs = 1000 / BULLET_FIRE_RATE_PER_S;
      if (now - gameState.lastShotAtMs >= intervalMs) {
        this.shoot();
        gameState.lastShotAtMs = now;
      }
    }
  }
  shoot() {
    const dir = normalize(mouseState.x - this.x, mouseState.y - this.y);
    const spawnX = this.x + dir.x * (this.radius + BULLET_RADIUS_PX + 1);
    const spawnY = this.y + dir.y * (this.radius + BULLET_RADIUS_PX + 1);
    gameState.bullets.push(new Bullet(spawnX, spawnY, dir.x * BULLET_SPEED_PX_PER_S, dir.y * BULLET_SPEED_PX_PER_S));
  }
  draw() {
    // Игрок
    ctx.lineWidth = 2;
    ctx.fillStyle = COLOR.playerFill;
    ctx.strokeStyle = COLOR.playerStroke;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Направление взгляда
    const dir = normalize(mouseState.x - this.x, mouseState.y - this.y);
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + dir.x * (this.radius + 10), this.y + dir.y * (this.radius + 10));
    ctx.stroke();
  }
}

class Bullet {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = BULLET_RADIUS_PX;
    this.remainingLifeMs = 1800; // самоуничтожение через ~1.8с
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.remainingLifeMs -= dt * 1000;
  }
  isOffscreen() {
    return (
      this.x < -50 || this.x > canvas.width / devicePixelRatioCached + 50 ||
      this.y < -50 || this.y > canvas.height / devicePixelRatioCached + 50 ||
      this.remainingLifeMs <= 0
    );
  }
  draw() {
    ctx.fillStyle = COLOR.bullet;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Zombie {
  constructor(x, y, radius, speed, health) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.speed = speed;
    this.health = health;
  }
  update(dt) {
    const dir = normalize(gameState.player.x - this.x, gameState.player.y - this.y);
    this.x += dir.x * this.speed * dt;
    this.y += dir.y * this.speed * dt;
  }
  draw() {
    ctx.lineWidth = 2;
    ctx.fillStyle = COLOR.zombieFill;
    ctx.strokeStyle = COLOR.zombieStroke;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

class Particle {
  constructor(x, y, vx, vy, lifeMs) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.lifeMs = lifeMs;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.98; // лёгкое замедление
    this.vy *= 0.98;
    this.lifeMs -= dt * 1000;
  }
  draw() {
    const alpha = clamp(this.lifeMs / 400, 0, 1);
    ctx.fillStyle = `rgba(177, 26, 26, ${alpha.toFixed(3)})`;
    ctx.fillRect(this.x, this.y, 2, 2);
  }
}

function spawnZombie() {
  // Сложность растёт со временем
  const elapsedSec = gameState.elapsedMs / 1000;
  const difficulty = 1 + Math.min(2.5, elapsedSec / 60); // растёт до ~3.5x за 3 мин

  // Спавн за пределами экрана по краям
  const side = randInt(0, 3); // 0: top, 1: right, 2: bottom, 3: left
  let x, y;
  const margin = 40;
  const width = canvas.width / devicePixelRatioCached;
  const height = canvas.height / devicePixelRatioCached;
  if (side === 0) { x = randRange(-margin, width + margin); y = -margin; }
  else if (side === 1) { x = width + margin; y = randRange(-margin, height + margin); }
  else if (side === 2) { x = randRange(-margin, width + margin); y = height + margin; }
  else { x = -margin; y = randRange(-margin, height + margin); }

  const radius = randRange(ZOMBIE_RADIUS_MIN, ZOMBIE_RADIUS_MAX);
  const speed = (ZOMBIE_BASE_SPEED_PX_PER_S + randRange(-10, 25)) * difficulty;
  const health = radius * ZOMBIE_HEALTH_PER_RADIUS * (0.6 + 0.5 * Math.random());
  gameState.zombies.push(new Zombie(x, y, radius, speed, health));
}

function drawBackgroundGrid() {
  const width = canvas.width / devicePixelRatioCached;
  const height = canvas.height / devicePixelRatioCached;
  ctx.fillStyle = COLOR.background;
  ctx.fillRect(0, 0, width, height);

  // Лёгкий паттерн сетки
  const grid = 48;
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += grid) {
    ctx.strokeStyle = (x / grid) % 2 === 0 ? COLOR.gridDark : COLOR.gridLight;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += grid) {
    ctx.strokeStyle = (y / grid) % 2 === 0 ? COLOR.gridDark : COLOR.gridLight;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawUI() {
  ctx.fillStyle = COLOR.uiText;
  ctx.font = "16px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
  ctx.textBaseline = "top";
  ctx.fillText(`Счёт: ${gameState.score}`, 16, 14);

  // Полоса здоровья
  const barX = 16, barY = 40, barW = 200, barH = 14;
  ctx.fillStyle = COLOR.hpBarBack;
  ctx.fillRect(barX, barY, barW, barH);
  const hpRatio = clamp(gameState.player.health / PLAYER_MAX_HEALTH, 0, 1);
  ctx.fillStyle = COLOR.hpBarFill;
  ctx.fillRect(barX, barY, Math.floor(barW * hpRatio), barH);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.strokeRect(barX - 0.5, barY - 0.5, barW + 1, barH + 1);
  ctx.fillStyle = COLOR.uiFaint;
  ctx.fillText("Здоровье", barX, barY + barH + 6);

  // Подсказки
  ctx.fillStyle = COLOR.uiFaint;
  ctx.textAlign = "right";
  ctx.fillText("WASD/стрелки — движение • Мышь — прицел • ЛКМ — стрелять", canvas.width / devicePixelRatioCached - 16, 14);
  ctx.textAlign = "left";
}

function drawCrosshair() {
  const x = mouseState.x; const y = mouseState.y;
  ctx.strokeStyle = "#ffffffaa";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y);
  ctx.moveTo(x, y - 8); ctx.lineTo(x, y + 8);
  ctx.stroke();
}

function initGame() {
  gameState.player = new Player(canvas.width * 0.5 / devicePixelRatioCached, canvas.height * 0.5 / devicePixelRatioCached);
  gameState.bullets = [];
  gameState.zombies = [];
  gameState.particles = [];
  gameState.score = 0;
  gameState.isGameOver = false;
  gameState.lastShotAtMs = 0;
  gameState.lastSpawnAtMs = 0;
  gameState.elapsedMs = 0;
  lastFrameTimeMs = performance.now();
}

let lastFrameTimeMs = performance.now();
function gameLoop(nowMs) {
  const dt = clamp((nowMs - lastFrameTimeMs) / 1000, 0, 0.05);
  lastFrameTimeMs = nowMs;
  if (!gameState.isGameOver) {
    gameState.elapsedMs += dt * 1000;
  }

  // Обновление
  gameUpdate(dt);
  // Отрисовка
  gameRender();

  requestAnimationFrame(gameLoop);
}

function gameUpdate(dt) {
  gameState.player.update(dt);

  // Спавн зомби с уменьшением интервала по мере прогресса
  if (!gameState.isGameOver) {
    const elapsedSec = gameState.elapsedMs / 1000;
    const spawnIntervalMs = clamp(1100 - elapsedSec * 6, 350, 1100); // от ~1.1с до ~0.35с
    if (performance.now() - gameState.lastSpawnAtMs >= spawnIntervalMs) {
      spawnZombie();
      gameState.lastSpawnAtMs = performance.now();
    }
  }

  // Пули
  for (let i = gameState.bullets.length - 1; i >= 0; i--) {
    const bullet = gameState.bullets[i];
    bullet.update(dt);
    if (bullet.isOffscreen()) {
      gameState.bullets.splice(i, 1);
    }
  }

  // Зомби движение и столкновения
  for (let zi = gameState.zombies.length - 1; zi >= 0; zi--) {
    const z = gameState.zombies[zi];
    z.update(dt);

    // Столкновение игрока и зомби
    const sumR = z.radius + gameState.player.radius;
    if (dist2(z.x, z.y, gameState.player.x, gameState.player.y) <= sumR * sumR) {
      gameState.player.health -= ZOMBIE_CONTACT_DPS * dt;
      if (gameState.player.health <= 0) {
        gameState.player.health = 0;
        gameState.isGameOver = true;
      }
    }

    // Погибшие зомби удаляем
    if (z.health <= 0) {
      // Эффект крови
      for (let p = 0; p < BLOOD_PARTICLES_ON_DEATH; p++) {
        const angle = randRange(0, Math.PI * 2);
        const speed = randRange(40, 180);
        gameState.particles.push(new Particle(
          z.x, z.y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          randRange(180, 420)
        ));
      }
      gameState.zombies.splice(zi, 1);
      gameState.score += 1;
    }
  }

  // Столкновения пуль и зомби (простая O(n*m))
  for (let bi = gameState.bullets.length - 1; bi >= 0; bi--) {
    const b = gameState.bullets[bi];
    let hit = false;
    for (let zi = gameState.zombies.length - 1; zi >= 0; zi--) {
      const z = gameState.zombies[zi];
      const sumR = z.radius + b.radius;
      if (dist2(z.x, z.y, b.x, b.y) <= sumR * sumR) {
        z.health -= BULLET_DAMAGE;
        hit = true;
        break;
      }
    }
    if (hit) {
      gameState.bullets.splice(bi, 1);
    }
  }

  // Частицы
  for (let i = gameState.particles.length - 1; i >= 0; i--) {
    const p = gameState.particles[i];
    p.update(dt);
    if (p.lifeMs <= 0) {
      gameState.particles.splice(i, 1);
    }
  }
}

function gameRender() {
  drawBackgroundGrid();

  // Элементы
  for (const p of gameState.particles) p.draw();
  for (const b of gameState.bullets) b.draw();
  for (const z of gameState.zombies) z.draw();
  gameState.player.draw();
  drawCrosshair();

  drawUI();

  // Экран проигрыша
  if (gameState.isGameOver) {
    const width = canvas.width / devicePixelRatioCached;
    const height = canvas.height / devicePixelRatioCached;
    ctx.fillStyle = COLOR.overlay;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = COLOR.uiText;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 42px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText("ИГРА ОКОНЧЕНА", width / 2, height / 2 - 30);
    ctx.font = "18px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillStyle = COLOR.uiFaint;
    ctx.fillText(`Счёт: ${gameState.score}`, width / 2, height / 2 + 10);
    ctx.fillText("Нажмите Enter, чтобы начать заново", width / 2, height / 2 + 38);
    ctx.textAlign = "left";
  }
}

// Старт
initGame();
requestAnimationFrame(gameLoop);
