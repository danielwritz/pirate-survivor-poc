import {
  BOSS_WARNING_EDGE_MARGIN,
  BOSS_WARNING_PULSE_HZ,
  BOSS_WARNING_PULSE_MAX,
  BOSS_WARNING_PULSE_MIN,
  BOSS_WARNING_SIZE
} from '../shared/constants.js';

function projectToScreen(pos, viewportState) {
  const { camera, zoom, width, height } = viewportState;
  const x = (pos.x - camera.x) * zoom;
  const y = (pos.y - camera.y) * zoom;
  const onScreen = x >= 0 && x <= width && y >= 0 && y <= height;
  return { x, y, onScreen };
}

export function drawBossWarning(ctx, bossWorldPos, viewportState) {
  if (!ctx || !bossWorldPos || !viewportState) return;
  const { width, height } = viewportState;
  const projected = projectToScreen(bossWorldPos, viewportState);
  if (projected.onScreen) return;

  const cx = width * 0.5;
  const cy = height * 0.5;
  const dx = projected.x - cx;
  const dy = projected.y - cy;
  if (dx === 0 && dy === 0) return;

  const margin = Math.max(0, Math.min(BOSS_WARNING_EDGE_MARGIN, Math.min(width, height) * 0.45));
  const bounds = {
    left: margin,
    right: width - margin,
    top: margin,
    bottom: height - margin
  };

  const tCandidates = [];
  if (dx !== 0) {
    const tLeft = (bounds.left - cx) / dx;
    const tRight = (bounds.right - cx) / dx;
    if (tLeft > 0) tCandidates.push(tLeft);
    if (tRight > 0) tCandidates.push(tRight);
  }
  if (dy !== 0) {
    const tTop = (bounds.top - cy) / dy;
    const tBottom = (bounds.bottom - cy) / dy;
    if (tTop > 0) tCandidates.push(tTop);
    if (tBottom > 0) tCandidates.push(tBottom);
  }

  const tEdge = Math.min(...tCandidates.filter((t) => Number.isFinite(t)));
  if (!Number.isFinite(tEdge) || tEdge <= 0) return;

  const px = cx + dx * tEdge;
  const py = cy + dy * tEdge;

  const phase = performance.now() / 1000 * (Math.PI * 2 * BOSS_WARNING_PULSE_HZ);
  const pulse = (Math.sin(phase) + 1) * 0.5;
  const scale = BOSS_WARNING_PULSE_MIN + (BOSS_WARNING_PULSE_MAX - BOSS_WARNING_PULSE_MIN) * pulse;
  const size = BOSS_WARNING_SIZE * scale;

  ctx.save();
  ctx.translate(px, py);
  ctx.font = `700 ${size}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f34d4d';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = size * 0.45;
  ctx.fillText('!', 0, 0);
  ctx.restore();
}

export function createHudManager() {
  return {
    draw(ctx, { bosses = [], viewportState } = {}) {
      if (!ctx || !viewportState || !Array.isArray(bosses)) return;
      for (const boss of bosses) {
        if (!boss) continue;
        drawBossWarning(ctx, boss, viewportState);
      }
    }
  };
}
