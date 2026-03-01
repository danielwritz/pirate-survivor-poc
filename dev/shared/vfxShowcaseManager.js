import {
  createMuzzleBlastParticles,
  createImpactDebrisParticles,
  createDeckBurstParticles,
  normalizeOr
} from '../../src/systems/particleEffects.js';
import { clamp } from '../../src/core/math.js';

function createWaterSplashParticles(x, y, heavy = false) {
  const out = [];
  const count = heavy ? 12 : 7;
  const colors = heavy
    ? ['#c7ebff', '#9fd5f4', '#72b6df', '#ffffff']
    : ['#d6f0ff', '#9ed0ee', '#7fb9df', '#f4fcff'];

  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const speed = (0.35 + Math.random() * (heavy ? 1.45 : 1.05)) * 0.8;
    const life = 0.18 + Math.random() * (heavy ? 0.32 : 0.24);
    out.push({
      x,
      y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      size: 1.2 + Math.random() * (heavy ? 3.2 : 2.3),
      rot: 0,
      spin: 0,
      life,
      maxLife: life,
      color: colors[Math.floor(Math.random() * colors.length)],
      sides: 8,
      drift: -0.05 - Math.random() * 0.1,
      circle: true
    });
  }

  return out;
}

function createProjectile(x, y, dirX, dirY, cannon = false) {
  const dir = normalizeOr(dirX, dirY, 1, 0);
  return {
    x,
    y,
    vx: dir.x * (cannon ? 5.2 : 6.4),
    vy: dir.y * (cannon ? 5.2 : 6.4),
    life: cannon ? 1.2 : 0.95,
    maxLife: cannon ? 1.2 : 0.95,
    color: cannon ? '#f1b05f' : '#ffd887',
    radius: cannon ? 3.4 : 2.6
  };
}

export function createVfxShowcaseManager() {
  const state = {
    particles: [],
    projectiles: [],
    timeScale: 1,
    worldScale: 1,
    origin: { x: 450, y: 320 }
  };

  function setOrigin(x, y) {
    state.origin.x = x;
    state.origin.y = y;
  }

  function setTimeScale(next) {
    state.timeScale = clamp(next, 0.1, 2);
  }

  function clear() {
    state.particles = [];
    state.projectiles = [];
  }

  function spawn(effect, params = {}) {
    const x = params.x ?? state.origin.x;
    const y = params.y ?? state.origin.y;
    const dirX = params.dirX ?? 1;
    const dirY = params.dirY ?? -0.18;

    if (effect === 'muzzle') {
      state.particles.push(...createMuzzleBlastParticles(x, y, dirX, dirY, !!params.cannon));
      state.projectiles.push(createProjectile(x, y, dirX, dirY, !!params.cannon));
      return;
    }

    if (effect === 'impact') {
      state.particles.push(...createImpactDebrisParticles(x, y, dirX, dirY, !!params.heavy, null));
      return;
    }

    if (effect === 'deckBurst') {
      state.particles.push(...createDeckBurstParticles(x, y, dirX, dirY, !!params.heavy));
      return;
    }

    if (effect === 'waterSplash') {
      state.particles.push(...createWaterSplashParticles(x, y, !!params.heavy));
      return;
    }

    if (effect === 'volley') {
      const count = clamp(Number(params.count) || 1, 1, 8);
      const cannon = !!params.cannon;
      for (let i = 0; i < count; i++) {
        const spread = (i - (count - 1) * 0.5) * (cannon ? 12 : 9);
        const spawnX = x + spread;
        const spawnY = y + Math.abs(spread) * 0.08;
        const pDir = normalizeOr(dirX, dirY + (Math.random() - 0.5) * 0.18, 1, 0);
        state.particles.push(...createMuzzleBlastParticles(spawnX, spawnY, pDir.x, pDir.y, cannon));
        state.projectiles.push(createProjectile(spawnX, spawnY, pDir.x, pDir.y, cannon));
      }
    }
  }

  function update(dt) {
    const step = dt * state.timeScale;

    for (const p of state.particles) {
      p.x += p.vx * step * 60;
      p.y += p.vy * step * 60;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.y -= (p.drift || 0) * step * 60;
      p.rot += p.spin || 0;
      p.life -= step;
    }
    state.particles = state.particles.filter((p) => p.life > 0);

    for (const b of state.projectiles) {
      b.x += b.vx * step * 60;
      b.y += b.vy * step * 60;
      b.life -= step;
    }
    state.projectiles = state.projectiles.filter((b) => b.life > 0);
  }

  function draw(ctx, width, height) {
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#0a2235';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(159,194,217,0.12)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
      ctx.stroke();
    }

    for (const b of state.projectiles) {
      const life = clamp(b.life / b.maxLife, 0, 1);
      ctx.globalAlpha = life;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    for (const p of state.particles) {
      const life = clamp(p.life / p.maxLife, 0, 1);
      const pr = p.size * (0.45 + life * 0.75) * state.worldScale;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot || 0);
      ctx.globalAlpha = life;
      ctx.fillStyle = p.color || '#ffffff';
      if (p.circle) {
        ctx.beginPath();
        ctx.arc(0, 0, pr, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const sides = Math.max(3, p.sides || 4);
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
          const a = (i / sides) * Math.PI * 2;
          const px = Math.cos(a) * pr;
          const py = Math.sin(a) * pr;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.strokeStyle = 'rgba(232,245,255,0.45)';
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(state.origin.x - 28, state.origin.y);
    ctx.lineTo(state.origin.x + 28, state.origin.y);
    ctx.moveTo(state.origin.x, state.origin.y - 28);
    ctx.lineTo(state.origin.x, state.origin.y + 28);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  return {
    state,
    setOrigin,
    setTimeScale,
    clear,
    spawn,
    update,
    draw
  };
}
