import { clamp } from './core/math.js';
import {
  BOSS_HEALTH_BAR_HEIGHT,
  BOSS_HEALTH_BAR_WIDTH_FACTOR
} from '../shared/constants.js';

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function drawBossHealthBar(ctx, boss, screenX, screenY, options = {}) {
  if (!ctx || !boss) return;

  const { renderedWidth = null, zoom = 1 } = options;
  const maxHealth = Math.max(0, Number(boss?.maxHealth ?? boss?.maxHp ?? 0));
  const health = Math.max(0, Number(boss?.health ?? boss?.hp ?? 0));
  const ratio = maxHealth > 0 ? clamp(health / maxHealth, 0, 1) : 0;

  const baseWidth = renderedWidth ?? (boss?.size ? boss.size * zoom * 2 : 0);
  const width = Math.max(12, baseWidth * BOSS_HEALTH_BAR_WIDTH_FACTOR);
  const height = Math.max(2, BOSS_HEALTH_BAR_HEIGHT);
  const verticalOffset = (boss?.size || 0) * zoom + height * 1.6;
  const originX = screenX - width * 0.5;
  const originY = screenY - verticalOffset;

  ctx.save();
  ctx.fillStyle = 'rgba(8,12,16,0.7)';
  ctx.fillRect(originX, originY, width, height);

  const red = { r: 220, g: 62, b: 62 };
  const green = { r: 64, g: 199, b: 96 };
  const r = Math.round(lerp(red.r, green.r, ratio));
  const g = Math.round(lerp(red.g, green.g, ratio));
  const b = Math.round(lerp(red.b, green.b, ratio));
  const fillWidth = width * ratio;
  if (fillWidth > 0) {
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(originX, originY, fillWidth, height);
  }

  ctx.strokeStyle = 'rgba(240,248,255,0.82)';
  ctx.lineWidth = Math.max(1, height * 0.18);
  ctx.strokeRect(originX, originY, width, height);
  ctx.restore();
}
