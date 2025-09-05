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

// Константы уровней и боссов
const ZOMBIES_PER_LEVEL = 10; // количество зомби до появления босса
const BOSS_HEALTH_MULTIPLIER = 3; // здоровье босса в разы больше обычного зомби
const BOSS_SPEED_MULTIPLIER = 0.8; // босс медленнее, но сильнее
const BOSS_DAMAGE_MULTIPLIER = 2; // урон босса в разы больше

const COLOR = {
  background: "#0d1017",
  gridDark: "#0f1320",
  gridLight: "#12162a",
  playerFill: "#4cc9f0",
  playerStroke: "#3a86ff",
  zombieFill: "#4a5d23", // обновлен для лучшего соответствия новому дизайну
  zombieStroke: "#2d6a4f",
  bullet: "#ffd166",
  blood: "#b11a1a",
  uiText: "#e6edf3",
  uiFaint: "#9aa4b2",
  hpBarBack: "#2b2f3a",
  hpBarFill: "#20c997",
  overlay: "rgba(0,0,0,0.55)",
  bossFill: "#8b0000",
  bossStroke: "#4b0000",
};

// Система звуков
class SoundManager {
  constructor() {
    this.audioContext = null;
    this.sounds = {};
    this.musicGain = null;
    this.sfxGain = null;
    this.currentMusic = null;
    this.musicVolume = 0.3;
    this.sfxVolume = 0.5;
    this.isMusicEnabled = true;
    this.initAudio();
  }
  
  initAudio() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Создаем узлы для управления громкостью
      this.musicGain = this.audioContext.createGain();
      this.sfxGain = this.audioContext.createGain();
      
      this.musicGain.connect(this.audioContext.destination);
      this.sfxGain.connect(this.audioContext.destination);
      
      this.musicGain.gain.value = this.musicVolume;
      this.sfxGain.gain.value = this.sfxVolume;
      
      console.log("Аудио система инициализирована");
    } catch (e) {
      console.log("Web Audio API не поддерживается");
    }
  }
  
  // Активация аудио контекста (требуется для современных браузеров)
  async activateAudio() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
      console.log("Аудио контекст активирован");
    }
  }
  
  playSound(frequency, duration, type = 'sine', volume = 0.1, isMusic = false) {
    if (!this.audioContext) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(isMusic ? this.musicGain : this.sfxGain);
    
    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }
  
  playShoot() {
    this.playSound(800, 0.1, 'square', 0.05);
  }
  
  playZombieHit() {
    this.playSound(200, 0.2, 'sawtooth', 0.03);
  }
  
  playZombieDeath() {
    this.playSound(150, 0.5, 'sawtooth', 0.08);
  }
  
  playZombieGrowl() {
    const frequency = 80 + Math.random() * 40;
    this.playSound(frequency, 0.3, 'sawtooth', 0.02);
  }
  
  playBossSpawn() {
    this.playSound(60, 1.0, 'sawtooth', 0.1);
  }
  
  playLevelComplete() {
    this.playSound(440, 0.2, 'sine', 0.1);
    setTimeout(() => this.playSound(554, 0.2, 'sine', 0.1), 200);
    setTimeout(() => this.playSound(659, 0.3, 'sine', 0.1), 400);
  }
  
  playPlayerHit() {
    this.playSound(300, 0.3, 'square', 0.05);
  }
  
  // Музыкальные методы
  async playBackgroundMusic() {
    if (!this.isMusicEnabled || !this.audioContext) return;
    await this.activateAudio();
    this.stopMusic();
    this.currentMusic = 'background';
    
    console.log("Запуск фоновой музыки");
    
    // Создаем мелодию для фоновой музыки
    this.createMelody([
      {freq: 220, duration: 0.5}, // A3
      {freq: 247, duration: 0.5}, // B3
      {freq: 277, duration: 0.5}, // C#4
      {freq: 330, duration: 0.5}, // E4
      {freq: 277, duration: 0.5}, // C#4
      {freq: 247, duration: 0.5}, // B3
      {freq: 220, duration: 1.0}, // A3
    ], true);
  }
  
  async playBossMusic() {
    if (!this.isMusicEnabled || !this.audioContext) return;
    await this.activateAudio();
    this.stopMusic();
    this.currentMusic = 'boss';
    
    console.log("Запуск музыки босса");
    
    // Создаем более напряженную мелодию для босса
    this.createMelody([
      {freq: 110, duration: 0.3}, // A2
      {freq: 123, duration: 0.3}, // B2
      {freq: 139, duration: 0.3}, // C#3
      {freq: 165, duration: 0.3}, // E3
      {freq: 185, duration: 0.3}, // F#3
      {freq: 220, duration: 0.3}, // A3
      {freq: 185, duration: 0.3}, // F#3
      {freq: 165, duration: 0.3}, // E3
      {freq: 139, duration: 0.3}, // C#3
      {freq: 123, duration: 0.3}, // B2
      {freq: 110, duration: 0.6}, // A2
    ], true);
  }
  
  createMelody(notes, loop = false) {
    if (!this.audioContext) return;
    
    const totalDuration = notes.reduce((sum, note) => sum + note.duration, 0);
    let currentTime = this.audioContext.currentTime;
    
    notes.forEach(note => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.musicGain);
      
      oscillator.frequency.setValueAtTime(note.freq, currentTime);
      oscillator.type = 'triangle';
      
      gainNode.gain.setValueAtTime(0, currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0.05, currentTime + note.duration * 0.7);
      gainNode.gain.exponentialRampToValueAtTime(0.001, currentTime + note.duration);
      
      oscillator.start(currentTime);
      oscillator.stop(currentTime + note.duration);
      
      currentTime += note.duration;
    });
    
    if (loop) {
      // Очищаем предыдущий интервал если есть
      if (this.musicLoopInterval) {
        clearInterval(this.musicLoopInterval);
      }
      
      // Создаем новый интервал для зацикливания
      this.musicLoopInterval = setInterval(() => {
        if (this.currentMusic === 'background' || this.currentMusic === 'boss') {
          this.createMelody(notes, false); // Не зацикливаем рекурсивно
        } else {
          clearInterval(this.musicLoopInterval);
          this.musicLoopInterval = null;
        }
      }, totalDuration * 1000);
    }
  }
  
  stopMusic() {
    // Останавливаем текущую музыку
    if (this.musicGain) {
      this.musicGain.gain.cancelScheduledValues(this.audioContext.currentTime);
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, this.audioContext.currentTime);
      this.musicGain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.5);
    }
    
    // Очищаем интервал зацикливания
    if (this.musicLoopInterval) {
      clearInterval(this.musicLoopInterval);
      this.musicLoopInterval = null;
    }
    
    this.currentMusic = null;
  }
  
  setMusicEnabled(enabled) {
    this.isMusicEnabled = enabled;
    if (!enabled) {
      this.stopMusic();
    } else if (this.currentMusic) {
      if (this.currentMusic === 'background') {
        this.playBackgroundMusic();
      } else if (this.currentMusic === 'boss') {
        this.playBossMusic();
      }
    }
  }
  
  toggleMusic() {
    this.setMusicEnabled(!this.isMusicEnabled);
  }
}

const soundManager = new SoundManager();

// Система базы данных и управления игроками
class DatabaseManager {
  constructor() {
    this.db = null;
    this.initDatabase();
  }
  
  async initDatabase() {
    try {
      // Пробуем загрузить SQL.js
      if (typeof initSqlJs !== 'undefined') {
        const SQL = await initSqlJs({
          locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });
        
        // Создаем базу данных в памяти
        this.db = new SQL.Database();
        
        // Создаем таблицу для рейтинга
        this.db.run(`
          CREATE TABLE IF NOT EXISTS leaderboard (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            score INTEGER NOT NULL,
            level INTEGER NOT NULL,
            date TEXT NOT NULL
          )
        `);
        
        console.log("SQLite база данных инициализирована");
      } else {
        console.log("SQL.js не загружен, используем localStorage");
      }
    } catch (error) {
      console.error("Ошибка инициализации базы данных:", error);
      console.log("Используем localStorage как резервный вариант");
    }
  }
  
  saveScore(playerName, score, level) {
    const date = new Date().toISOString();
    const newScore = { name: playerName, score, level, date };
    
    try {
      // Пробуем сохранить в SQLite
      if (this.db) {
        this.db.run(
          "INSERT INTO leaderboard (name, score, level, date) VALUES (?, ?, ?, ?)",
          [playerName, score, level, date]
        );
      }
    } catch (error) {
      console.error("Ошибка сохранения в SQLite:", error);
    }
    
    // Всегда сохраняем в localStorage
    const scores = this.getTopScores(10); // Получаем больше записей для обновления
    scores.push(newScore);
    
    // Сортируем по очкам и уровню
    scores.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.level - a.level;
    });
    
    // Сохраняем только топ-10
    const topScores = scores.slice(0, 10);
    localStorage.setItem('zombieShooterLeaderboard', JSON.stringify(topScores));
    
    console.log("Очки сохранены:", newScore);
  }
  
  getTopScores(limit = 3) {
    try {
      // Пробуем получить из SQLite
      if (this.db) {
        const result = this.db.exec(`
          SELECT name, score, level, date 
          FROM leaderboard 
          ORDER BY score DESC, level DESC 
          LIMIT ${limit}
        `);
        
        if (result.length > 0) {
          return result[0].values.map(row => ({
            name: row[0],
            score: row[1],
            level: row[2],
            date: row[3]
          }));
        }
      }
    } catch (error) {
      console.error("Ошибка получения из SQLite:", error);
    }
    
    // Загружаем из localStorage как резервный вариант
    const stored = localStorage.getItem('zombieShooterLeaderboard');
    if (stored) {
      const scores = JSON.parse(stored);
      return scores.slice(0, limit);
    }
    
    return [];
  }
}

const dbManager = new DatabaseManager();

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
    // Сохраняем очки игрока
    if (gameState.playerName) {
      dbManager.saveScore(gameState.playerName, gameState.score, gameState.level);
    }
    showLeaderboardModal();
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
  level: 1,
  zombiesKilledThisLevel: 0,
  bossSpawned: false,
  boss: null,
  isLevelComplete: false,
  levelCompleteTime: 0,
  lastZombieGrowl: 0,
  playerName: "",
  isGameStarted: false,
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
    soundManager.playShoot();
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
    this.walkCycle = Math.random() * Math.PI * 2; // для анимации ходьбы
    this.type = Math.floor(Math.random() * 3); // разные типы зомби
  }
  update(dt) {
    const dir = normalize(gameState.player.x - this.x, gameState.player.y - this.y);
    this.x += dir.x * this.speed * dt;
    this.y += dir.y * this.speed * dt;
    this.walkCycle += dt * 8; // скорость анимации ходьбы
  }
  draw() {
    const walkOffset = Math.sin(this.walkCycle) * 3; // амплитуда покачивания при ходьбе
    const armSwing = Math.sin(this.walkCycle * 2) * 0.3; // покачивание рук
    
    // Сохраняем текущее состояние контекста
    ctx.save();
    
    // Перемещаем начало координат к центру зомби
    ctx.translate(this.x, this.y);
    
    // Определяем направление к игроку для поворота зомби
    const dir = normalize(gameState.player.x - this.x, gameState.player.y - this.y);
    const angle = Math.atan2(dir.y, dir.x);
    ctx.rotate(angle);
    
    // Тело зомби (основной круг)
    ctx.lineWidth = 2;
    ctx.fillStyle = this.type === 0 ? "#4a5d23" : this.type === 1 ? "#6b4423" : "#3d2f1f";
    ctx.strokeStyle = this.type === 0 ? "#2d3a15" : this.type === 1 ? "#4a2f15" : "#2a1f15";
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Голова зомби (меньший круг сверху)
    const headRadius = this.radius * 0.6;
    ctx.fillStyle = this.type === 0 ? "#5a6d33" : this.type === 1 ? "#7b5433" : "#4d3f2f";
    ctx.strokeStyle = this.type === 0 ? "#3d4a23" : this.type === 1 ? "#5b3423" : "#3a2f23";
    ctx.beginPath();
    ctx.arc(0, -this.radius * 0.3, headRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Волосы зомби (рваные пряди)
    ctx.strokeStyle = this.type === 0 ? "#2d3a15" : this.type === 1 ? "#4a2f15" : "#1a0f0f";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const angle = (i - 2) * 0.3;
      const startX = Math.cos(angle) * headRadius * 0.8;
      const startY = -this.radius * 0.3 - Math.sin(angle) * headRadius * 0.8;
      const endX = startX + (Math.random() - 0.5) * 10;
      const endY = startY - 8 - Math.random() * 5;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
    
    // Глаза зомби (красные точки)
    ctx.fillStyle = "#ff0000";
    ctx.beginPath();
    ctx.arc(-headRadius * 0.3, -this.radius * 0.3 - headRadius * 0.2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(headRadius * 0.3, -this.radius * 0.3 - headRadius * 0.2, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Рот зомби
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -this.radius * 0.3 + headRadius * 0.1, headRadius * 0.4, 0, Math.PI);
    ctx.stroke();
    
    // Зубы
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 3; i++) {
      const toothX = -headRadius * 0.2 + i * headRadius * 0.2;
      ctx.fillRect(toothX - 1, -this.radius * 0.3 + headRadius * 0.1, 2, 3);
    }
    
    // Морщины и шрамы на лице
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Вертикальные морщины
    ctx.moveTo(-headRadius * 0.1, -this.radius * 0.3 - headRadius * 0.1);
    ctx.lineTo(-headRadius * 0.1, -this.radius * 0.3 + headRadius * 0.1);
    ctx.moveTo(headRadius * 0.1, -this.radius * 0.3 - headRadius * 0.1);
    ctx.lineTo(headRadius * 0.1, -this.radius * 0.3 + headRadius * 0.1);
    // Горизонтальные морщины
    ctx.moveTo(-headRadius * 0.3, -this.radius * 0.3 - headRadius * 0.05);
    ctx.lineTo(headRadius * 0.3, -this.radius * 0.3 - headRadius * 0.05);
    ctx.moveTo(-headRadius * 0.2, -this.radius * 0.3 + headRadius * 0.05);
    ctx.lineTo(headRadius * 0.2, -this.radius * 0.3 + headRadius * 0.05);
    ctx.stroke();
    
    // Шрам на лице (для некоторых типов зомби)
    if (this.type === 2) {
      ctx.strokeStyle = "#8b0000";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-headRadius * 0.4, -this.radius * 0.3 - headRadius * 0.1);
      ctx.lineTo(headRadius * 0.4, -this.radius * 0.3 + headRadius * 0.1);
      ctx.stroke();
    }
    
    // Руки зомби
    ctx.strokeStyle = this.type === 0 ? "#4a5d23" : this.type === 1 ? "#6b4423" : "#3d2f1f";
    ctx.lineWidth = 3;
    ctx.beginPath();
    // Левая рука
    ctx.moveTo(-this.radius * 0.7, -this.radius * 0.1);
    ctx.lineTo(-this.radius * 1.2 + armSwing * 5, this.radius * 0.2 + walkOffset);
    // Правая рука
    ctx.moveTo(this.radius * 0.7, -this.radius * 0.1);
    ctx.lineTo(this.radius * 1.2 - armSwing * 5, this.radius * 0.2 + walkOffset);
    ctx.stroke();
    
    // Кисти рук
    ctx.fillStyle = this.type === 0 ? "#4a5d23" : this.type === 1 ? "#6b4423" : "#3d2f1f";
    ctx.beginPath();
    ctx.arc(-this.radius * 1.2 + armSwing * 5, this.radius * 0.2 + walkOffset, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.radius * 1.2 - armSwing * 5, this.radius * 0.2 + walkOffset, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Когти на руках
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    for (let hand = 0; hand < 2; hand++) {
      const handX = hand === 0 ? -this.radius * 1.2 + armSwing * 5 : this.radius * 1.2 - armSwing * 5;
      const handY = this.radius * 0.2 + walkOffset;
      for (let claw = 0; claw < 3; claw++) {
        const clawAngle = (claw - 1) * 0.5;
        const clawX = handX + Math.cos(clawAngle) * 6;
        const clawY = handY + Math.sin(clawAngle) * 6;
        ctx.beginPath();
        ctx.moveTo(handX, handY);
        ctx.lineTo(clawX, clawY);
        ctx.stroke();
      }
    }
    
    // Ноги зомби
    ctx.strokeStyle = this.type === 0 ? "#4a5d23" : this.type === 1 ? "#6b4423" : "#3d2f1f";
    ctx.lineWidth = 4;
    ctx.beginPath();
    // Левая нога
    ctx.moveTo(-this.radius * 0.3, this.radius * 0.8);
    ctx.lineTo(-this.radius * 0.3 + walkOffset * 2, this.radius * 1.3);
    // Правая нога
    ctx.moveTo(this.radius * 0.3, this.radius * 0.8);
    ctx.lineTo(this.radius * 0.3 - walkOffset * 2, this.radius * 1.3);
    ctx.stroke();
    
    // Ступни
    ctx.fillStyle = this.type === 0 ? "#4a5d23" : this.type === 1 ? "#6b4423" : "#3d2f1f";
    ctx.fillRect(-this.radius * 0.3 + walkOffset * 2 - 3, this.radius * 1.3, 6, 3);
    ctx.fillRect(this.radius * 0.3 - walkOffset * 2 - 3, this.radius * 1.3, 6, 3);
    
    // Кровь и раны (случайные пятна)
    if (this.type === 1) {
      ctx.fillStyle = "#8b0000";
      ctx.beginPath();
      ctx.arc(-this.radius * 0.4, this.radius * 0.2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(this.radius * 0.3, -this.radius * 0.1, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Восстанавливаем состояние контекста
    ctx.restore();
    
    // Полоска здоровья над зомби
    if (this.health < this.radius * ZOMBIE_HEALTH_PER_RADIUS) {
      const barWidth = this.radius * 1.5;
      const barHeight = 4;
      const barX = this.x - barWidth / 2;
      const barY = this.y - this.radius - 10;
      
      // Фон полоски здоровья
      ctx.fillStyle = "#2b2f3a";
      ctx.fillRect(barX, barY, barWidth, barHeight);
      
      // Заливка полоски здоровья
      const healthRatio = this.health / (this.radius * ZOMBIE_HEALTH_PER_RADIUS);
      const fillWidth = barWidth * healthRatio;
      ctx.fillStyle = healthRatio > 0.5 ? "#20c997" : healthRatio > 0.25 ? "#ffd166" : "#ff4757";
      ctx.fillRect(barX, barY, fillWidth, barHeight);
      
      // Рамка полоски здоровья
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barWidth, barHeight);
    }
  }
}

class BossZombie {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 40; // Больше обычного зомби
    this.speed = ZOMBIE_BASE_SPEED_PX_PER_S * BOSS_SPEED_MULTIPLIER;
    this.health = 200 * BOSS_HEALTH_MULTIPLIER;
    this.maxHealth = this.health;
    this.walkCycle = Math.random() * Math.PI * 2;
    this.attackCooldown = 0;
    this.isAttacking = false;
    this.attackDuration = 0;
  }
  
  update(dt) {
    const dir = normalize(gameState.player.x - this.x, gameState.player.y - this.y);
    this.x += dir.x * this.speed * dt;
    this.y += dir.y * this.speed * dt;
    this.walkCycle += dt * 6; // Медленнее обычного зомби
    
    // Атака босса
    this.attackCooldown -= dt;
    if (this.attackCooldown <= 0) {
      const distToPlayer = Math.hypot(gameState.player.x - this.x, gameState.player.y - this.y);
      if (distToPlayer < this.radius + gameState.player.radius + 20) {
        this.isAttacking = true;
        this.attackDuration = 0.5;
        this.attackCooldown = 2.0; // Атака каждые 2 секунды
        soundManager.playZombieGrowl();
      }
    }
    
    if (this.isAttacking) {
      this.attackDuration -= dt;
      if (this.attackDuration <= 0) {
        this.isAttacking = false;
      }
    }
  }
  
  draw() {
    const walkOffset = Math.sin(this.walkCycle) * 2;
    const armSwing = Math.sin(this.walkCycle * 2) * 0.2;
    
    ctx.save();
    ctx.translate(this.x, this.y);
    
    const dir = normalize(gameState.player.x - this.x, gameState.player.y - this.y);
    const angle = Math.atan2(dir.y, dir.x);
    ctx.rotate(angle);
    
    // Тело босса (большой круг)
    ctx.lineWidth = 3;
    ctx.fillStyle = COLOR.bossFill;
    ctx.strokeStyle = COLOR.bossStroke;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Голова босса
    const headRadius = this.radius * 0.7;
    ctx.fillStyle = "#a00000";
    ctx.strokeStyle = "#600000";
    ctx.beginPath();
    ctx.arc(0, -this.radius * 0.2, headRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Глаза босса (большие и злые)
    ctx.fillStyle = "#ff0000";
    ctx.beginPath();
    ctx.arc(-headRadius * 0.3, -this.radius * 0.2 - headRadius * 0.2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(headRadius * 0.3, -this.radius * 0.2 - headRadius * 0.2, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Рот босса (больше и страшнее)
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -this.radius * 0.2 + headRadius * 0.1, headRadius * 0.5, 0, Math.PI);
    ctx.stroke();
    
    // Большие зубы
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 5; i++) {
      const toothX = -headRadius * 0.3 + i * headRadius * 0.15;
      ctx.fillRect(toothX - 2, -this.radius * 0.2 + headRadius * 0.1, 4, 6);
    }
    
    // Руки босса (больше и сильнее)
    ctx.strokeStyle = COLOR.bossFill;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-this.radius * 0.6, -this.radius * 0.1);
    ctx.lineTo(-this.radius * 1.4 + armSwing * 8, this.radius * 0.3 + walkOffset);
    ctx.moveTo(this.radius * 0.6, -this.radius * 0.1);
    ctx.lineTo(this.radius * 1.4 - armSwing * 8, this.radius * 0.3 + walkOffset);
    ctx.stroke();
    
    // Кисти рук босса
    ctx.fillStyle = COLOR.bossFill;
    ctx.beginPath();
    ctx.arc(-this.radius * 1.4 + armSwing * 8, this.radius * 0.3 + walkOffset, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.radius * 1.4 - armSwing * 8, this.radius * 0.3 + walkOffset, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Большие когти
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    for (let hand = 0; hand < 2; hand++) {
      const handX = hand === 0 ? -this.radius * 1.4 + armSwing * 8 : this.radius * 1.4 - armSwing * 8;
      const handY = this.radius * 0.3 + walkOffset;
      for (let claw = 0; claw < 4; claw++) {
        const clawAngle = (claw - 1.5) * 0.4;
        const clawX = handX + Math.cos(clawAngle) * 10;
        const clawY = handY + Math.sin(clawAngle) * 10;
        ctx.beginPath();
        ctx.moveTo(handX, handY);
        ctx.lineTo(clawX, clawY);
        ctx.stroke();
      }
    }
    
    // Ноги босса
    ctx.strokeStyle = COLOR.bossFill;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-this.radius * 0.2, this.radius * 0.7);
    ctx.lineTo(-this.radius * 0.2 + walkOffset * 3, this.radius * 1.5);
    ctx.moveTo(this.radius * 0.2, this.radius * 0.7);
    ctx.lineTo(this.radius * 0.2 - walkOffset * 3, this.radius * 1.5);
    ctx.stroke();
    
    // Ступни босса
    ctx.fillStyle = COLOR.bossFill;
    ctx.fillRect(-this.radius * 0.2 + walkOffset * 3 - 5, this.radius * 1.5, 10, 5);
    ctx.fillRect(this.radius * 0.2 - walkOffset * 3 - 5, this.radius * 1.5, 10, 5);
    
    // Эффект атаки
    if (this.isAttacking) {
      ctx.strokeStyle = "#ff0000";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    ctx.restore();
    
    // Полоска здоровья босса (всегда видна)
    const barWidth = this.radius * 2;
    const barHeight = 8;
    const barX = this.x - barWidth / 2;
    const barY = this.y - this.radius - 15;
    
    // Фон полоски здоровья
    ctx.fillStyle = "#2b2f3a";
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    // Заливка полоски здоровья
    const healthRatio = this.health / this.maxHealth;
    const fillWidth = barWidth * healthRatio;
    ctx.fillStyle = healthRatio > 0.5 ? "#ff0000" : healthRatio > 0.25 ? "#ff8800" : "#ff0000";
    ctx.fillRect(barX, barY, fillWidth, barHeight);
    
    // Рамка полоски здоровья
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
    
    // Текст "БОСС"
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText("БОСС", this.x, barY - 5);
    ctx.textAlign = "left";
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
  // Сложность растёт со временем и уровнем
  const elapsedSec = gameState.elapsedMs / 1000;
  const levelMultiplier = 1 + (gameState.level - 1) * 0.3;
  const difficulty = (1 + Math.min(2.5, elapsedSec / 60)) * levelMultiplier;

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
  const health = radius * ZOMBIE_HEALTH_PER_RADIUS * (0.6 + 0.5 * Math.random()) * levelMultiplier;
  gameState.zombies.push(new Zombie(x, y, radius, speed, health));
}

function spawnBoss() {
  if (gameState.bossSpawned) return;
  
  // Убираем всех оставшихся зомби
  gameState.zombies = [];
  
  // Спавн босса в центре экрана
  const width = canvas.width / devicePixelRatioCached;
  const height = canvas.height / devicePixelRatioCached;
  const x = width / 2;
  const y = height / 2;
  
  gameState.boss = new BossZombie(x, y);
  gameState.bossSpawned = true;
  soundManager.playBossSpawn();
  
  // Переключаем на музыку босса
  soundManager.playBossMusic();
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
  ctx.fillText(`Уровень: ${gameState.level}`, 16, 34);

  // Полоса здоровья
  const barX = 16, barY = 60, barW = 200, barH = 14;
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

  // Прогресс до босса
  if (!gameState.bossSpawned && !gameState.isLevelComplete) {
    const progressX = 16, progressY = 100, progressW = 200, progressH = 12;
    const progress = gameState.zombiesKilledThisLevel / ZOMBIES_PER_LEVEL;
    
    ctx.fillStyle = COLOR.hpBarBack;
    ctx.fillRect(progressX, progressY, progressW, progressH);
    ctx.fillStyle = "#ff6b35";
    ctx.fillRect(progressX, progressY, Math.floor(progressW * progress), progressH);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.strokeRect(progressX - 0.5, progressY - 0.5, progressW + 1, progressH + 1);
    ctx.fillStyle = COLOR.uiFaint;
    ctx.fillText(`Зомби до босса: ${gameState.zombiesKilledThisLevel}/${ZOMBIES_PER_LEVEL}`, progressX, progressY + progressH + 6);
  }

  // Индикатор босса
  if (gameState.bossSpawned && gameState.boss) {
    ctx.fillStyle = "#ff0000";
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "center";
    ctx.fillText("⚠ БОСС НАПАДАЕТ! ⚠", canvas.width / devicePixelRatioCached / 2, 20);
    ctx.textAlign = "left";
    ctx.font = "16px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
  }

  // Сообщение о завершении уровня
  if (gameState.isLevelComplete) {
    ctx.fillStyle = "#00ff00";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`УРОВЕНЬ ${gameState.level} ПРОЙДЕН!`, canvas.width / devicePixelRatioCached / 2, canvas.height / devicePixelRatioCached / 2 - 20);
    ctx.font = "16px Arial";
    ctx.fillText("Переход к следующему уровню...", canvas.width / devicePixelRatioCached / 2, canvas.height / devicePixelRatioCached / 2 + 10);
    ctx.textAlign = "left";
  }

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

// Функции управления модальными окнами
function showNameModal() {
  document.getElementById('nameModal').style.display = 'flex';
  document.getElementById('playerNameInput').focus();
}

function hideNameModal() {
  document.getElementById('nameModal').style.display = 'none';
}

function showLeaderboardModal() {
  updateLeaderboardDisplay();
  document.getElementById('leaderboardModal').style.display = 'flex';
}

function hideLeaderboardModal() {
  document.getElementById('leaderboardModal').style.display = 'none';
}

function updateLeaderboardDisplay() {
  const leaderboardList = document.getElementById('leaderboardList');
  const scores = dbManager.getTopScores(3);
  
  leaderboardList.innerHTML = '';
  
  if (scores.length === 0) {
    leaderboardList.innerHTML = '<p style="text-align: center; color: #9aa4b2;">Пока нет рекордов</p>';
    return;
  }
  
  scores.forEach((score, index) => {
    const item = document.createElement('div');
    item.className = 'leaderboard-item';
    if (score.name === gameState.playerName) {
      item.classList.add('current-player');
    }
    
    item.innerHTML = `
      <div class="leaderboard-rank">${index + 1}</div>
      <div class="leaderboard-name">${score.name}</div>
      <div class="leaderboard-score">${score.score} (ур. ${score.level})</div>
    `;
    
    leaderboardList.appendChild(item);
  });
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
  gameState.level = 1;
  gameState.zombiesKilledThisLevel = 0;
  gameState.bossSpawned = false;
  gameState.boss = null;
  gameState.isLevelComplete = false;
  gameState.levelCompleteTime = 0;
  gameState.lastZombieGrowl = 0;
  gameState.isGameStarted = true;
  lastFrameTimeMs = performance.now();
  
  // Запускаем фоновую музыку
  soundManager.playBackgroundMusic();
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
  if (!gameState.isGameStarted) return;
  
  gameState.player.update(dt);

  // Спавн зомби с уменьшением интервала по мере прогресса
  if (!gameState.isGameOver && !gameState.bossSpawned && !gameState.isLevelComplete) {
    const elapsedSec = gameState.elapsedMs / 1000;
    const spawnIntervalMs = clamp(1100 - elapsedSec * 6, 350, 1100); // от ~1.1с до ~0.35с
    if (performance.now() - gameState.lastSpawnAtMs >= spawnIntervalMs) {
      spawnZombie();
      gameState.lastSpawnAtMs = performance.now();
    }
  }

  // Проверка на спавн босса
  if (!gameState.bossSpawned && !gameState.isLevelComplete && gameState.zombiesKilledThisLevel >= ZOMBIES_PER_LEVEL) {
    spawnBoss();
  }

  // Обновление босса
  if (gameState.boss) {
    gameState.boss.update(dt);
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

    // Случайное рычание зомби
    if (performance.now() - gameState.lastZombieGrowl > 3000 + Math.random() * 2000) {
      soundManager.playZombieGrowl();
      gameState.lastZombieGrowl = performance.now();
    }

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
      gameState.zombiesKilledThisLevel += 1;
      soundManager.playZombieDeath();
    }
  }

  // Столкновение игрока и босса
  if (gameState.boss) {
    const sumR = gameState.boss.radius + gameState.player.radius;
    if (dist2(gameState.boss.x, gameState.boss.y, gameState.player.x, gameState.player.y) <= sumR * sumR) {
      const damage = ZOMBIE_CONTACT_DPS * BOSS_DAMAGE_MULTIPLIER * dt;
      gameState.player.health -= damage;
      if (gameState.player.health <= 0) {
        gameState.player.health = 0;
        gameState.isGameOver = true;
      }
      soundManager.playPlayerHit();
    }
  }

  // Столкновения пуль и зомби (простая O(n*m))
  for (let bi = gameState.bullets.length - 1; bi >= 0; bi--) {
    const b = gameState.bullets[bi];
    let hit = false;
    
    // Столкновение с обычными зомби
    for (let zi = gameState.zombies.length - 1; zi >= 0; zi--) {
      const z = gameState.zombies[zi];
      const sumR = z.radius + b.radius;
      if (dist2(z.x, z.y, b.x, b.y) <= sumR * sumR) {
        z.health -= BULLET_DAMAGE;
        hit = true;
        soundManager.playZombieHit();
        break;
      }
    }
    
    // Столкновение с боссом
    if (!hit && gameState.boss) {
      const sumR = gameState.boss.radius + b.radius;
      if (dist2(gameState.boss.x, gameState.boss.y, b.x, b.y) <= sumR * sumR) {
        gameState.boss.health -= BULLET_DAMAGE;
        hit = true;
        soundManager.playZombieHit();
      }
    }
    
    if (hit) {
      gameState.bullets.splice(bi, 1);
    }
  }

  // Проверка смерти босса
  if (gameState.boss && gameState.boss.health <= 0) {
    // Эффект крови для босса
    for (let p = 0; p < BLOOD_PARTICLES_ON_DEATH * 3; p++) {
      const angle = randRange(0, Math.PI * 2);
      const speed = randRange(60, 200);
      gameState.particles.push(new Particle(
        gameState.boss.x, gameState.boss.y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        randRange(300, 600)
      ));
    }
    gameState.boss = null;
    gameState.bossSpawned = false;
    gameState.isLevelComplete = true;
    gameState.levelCompleteTime = performance.now();
    gameState.level += 1;
    gameState.zombiesKilledThisLevel = 0;
    soundManager.playLevelComplete();
  }

  // Переход к следующему уровню
  if (gameState.isLevelComplete && performance.now() - gameState.levelCompleteTime > 3000) {
    gameState.isLevelComplete = false;
    gameState.levelCompleteTime = 0;
    
    // Возвращаем фоновую музыку
    soundManager.playBackgroundMusic();
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

  if (gameState.isGameStarted) {
    // Элементы
    for (const p of gameState.particles) p.draw();
    for (const b of gameState.bullets) b.draw();
    for (const z of gameState.zombies) z.draw();
    if (gameState.boss) gameState.boss.draw();
    gameState.player.draw();
    drawCrosshair();

    drawUI();
  }

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
    ctx.fillText("ИГРА ОКОНЧЕНА", width / 2, height / 2 - 60);
    ctx.font = "18px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillStyle = COLOR.uiFaint;
    ctx.fillText(`Игрок: ${gameState.playerName}`, width / 2, height / 2 - 20);
    ctx.fillText(`Счёт: ${gameState.score}`, width / 2, height / 2 + 10);
    ctx.fillText(`Уровень: ${gameState.level}`, width / 2, height / 2 + 35);
    ctx.fillText("Нажмите Enter для рейтинга", width / 2, height / 2 + 65);
    ctx.textAlign = "left";
  }
}

// Обработчики событий для модальных окон
document.addEventListener('DOMContentLoaded', function() {
  const nameInput = document.getElementById('playerNameInput');
  const startBtn = document.getElementById('startGameBtn');
  const playAgainBtn = document.getElementById('playAgainBtn');
  const musicToggle = document.getElementById('musicToggle');
  
  // Обработчик кнопки "Начать игру"
  startBtn.addEventListener('click', async function() {
    const playerName = nameInput.value.trim();
    if (playerName) {
      gameState.playerName = playerName;
      hideNameModal();
      
      // Активируем аудио перед началом игры
      await soundManager.activateAudio();
      
      initGame();
    } else {
      alert('Пожалуйста, введите ваше имя!');
    }
  });
  
  // Обработчик Enter в поле ввода имени
  nameInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      startBtn.click();
    }
  });
  
  // Обработчик кнопки "Играть снова"
  playAgainBtn.addEventListener('click', function() {
    hideLeaderboardModal();
    showNameModal();
  });
  
  // Обработчик кнопки музыки
  musicToggle.addEventListener('click', async function() {
    await soundManager.activateAudio();
    soundManager.toggleMusic();
    updateMusicButton();
  });
  
  // Функция обновления кнопки музыки
  function updateMusicButton() {
    if (soundManager.isMusicEnabled) {
      musicToggle.textContent = '🎵';
      musicToggle.classList.remove('disabled');
    } else {
      musicToggle.textContent = '🔇';
      musicToggle.classList.add('disabled');
    }
  }
  
  // Инициализация кнопки музыки
  updateMusicButton();
  
  // Показываем модальное окно ввода имени при загрузке
  showNameModal();
});

// Старт
requestAnimationFrame(gameLoop);
