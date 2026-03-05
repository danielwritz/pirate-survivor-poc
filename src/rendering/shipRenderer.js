import { clamp } from '../core/math.js';
import { getHullShape, getHullSideMount } from '../core/shipMath.js';

const DEFAULT_GUN_PIVOT_RAD = (30 * Math.PI) / 180;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function drawHullPath(ctx, shape, z) {
  ctx.beginPath();
  ctx.moveTo(shape.bowX * z, 0);
  ctx.lineTo(shape.shoulderX * z, -shape.shoulderHalfBeam * z);
  ctx.lineTo(shape.sternShoulderX * z, -shape.sternHalfBeam * z);
  ctx.lineTo(shape.sternX * z, 0);
  ctx.lineTo(shape.sternShoulderX * z, shape.sternHalfBeam * z);
  ctx.lineTo(shape.shoulderX * z, shape.shoulderHalfBeam * z);
  ctx.closePath();
}

function drawRam(ctx, shape, z, ship) {
  if (!ship.ram) return;

  const baseRamDamage = 46;
  const ramDamage = Math.max(baseRamDamage, Number(ship.ramDamage || baseRamDamage));
  const ramTier = clamp((ramDamage - baseRamDamage) / 18, 0, 4.5);
  const plateThickness = (1.8 + ramTier * 0.9) * z;

  const edgeInset = clamp(0.16 + ramTier * 0.03, 0.16, 0.28);
  const portEdgeX = shape.shoulderX + (shape.bowX - shape.shoulderX) * edgeInset;
  const portEdgeY = -shape.shoulderHalfBeam * (1 - edgeInset);
  const starEdgeX = shape.shoulderX + (shape.bowX - shape.shoulderX) * edgeInset;
  const starEdgeY = shape.shoulderHalfBeam * (1 - edgeInset);

  ctx.fillStyle = '#99a0a8';
  ctx.beginPath();
  ctx.moveTo(shape.bowX * z, 0);
  ctx.lineTo(shape.shoulderX * z, -shape.shoulderHalfBeam * z);
  ctx.lineTo(shape.shoulderX * z, shape.shoulderHalfBeam * z);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#6f7781';
  ctx.beginPath();
  ctx.moveTo(shape.bowX * z + plateThickness, 0);
  ctx.lineTo(portEdgeX * z, portEdgeY * z);
  ctx.lineTo(starEdgeX * z, starEdgeY * z);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#d1d7dd';
  ctx.lineWidth = Math.max(1.2, 1.4 + ramTier * 0.45) * z;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(shape.bowX * z + plateThickness, 0);
  ctx.lineTo(portEdgeX * z, portEdgeY * z);
  ctx.lineTo(shape.shoulderX * z, -shape.shoulderHalfBeam * z);
  ctx.moveTo(shape.bowX * z + plateThickness, 0);
  ctx.lineTo(starEdgeX * z, starEdgeY * z);
  ctx.lineTo(shape.shoulderX * z, shape.shoulderHalfBeam * z);
  ctx.stroke();

  ctx.strokeStyle = '#4b535d';
  ctx.lineWidth = Math.max(1, 1 + ramTier * 0.25) * z;
  ctx.beginPath();
  ctx.moveTo(portEdgeX * z, portEdgeY * z);
  ctx.lineTo(starEdgeX * z, starEdgeY * z);
  ctx.stroke();
}

function drawPerimeterMountWithAim(ctx, mount, length, thickness, color, z, aimOffset = 0) {
  ctx.save();
  ctx.translate(mount.x * z, mount.y * z);
  ctx.rotate(Math.atan2(mount.ny, mount.nx) + aimOffset);
  ctx.fillStyle = color;
  ctx.fillRect(0, -thickness * 0.5 * z, length * z, thickness * z);
  ctx.restore();
}

function drawCannonReloadOverlay(ctx, mount, length, thickness, z, aimOffset = 0, remainingRatio = 0) {
  if (remainingRatio <= 0.001) return;
  const fillLen = Math.max(0, length * clamp(remainingRatio, 0, 1));
  ctx.save();
  ctx.translate(mount.x * z, mount.y * z);
  ctx.rotate(Math.atan2(mount.ny, mount.nx) + aimOffset);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, -thickness * 0.5 * z, fillLen * z, thickness * z);
  ctx.restore();
}

function getDefaultLayout(ship) {
  const rawPort = Array.isArray(ship.weaponLayout?.port) ? ship.weaponLayout.port : [];
  const rawStar = Array.isArray(ship.weaponLayout?.starboard) ? ship.weaponLayout.starboard : [];
  const size = Math.max(1, rawPort.length, rawStar.length);

  const port = new Array(size).fill('empty');
  const starboard = new Array(size).fill('empty');

  for (let i = 0; i < size; i++) {
    port[i] = rawPort[i] || 'empty';
    starboard[i] = rawStar[i] || 'empty';
  }

  return { port, starboard };
}

function getMountAimOffset(ship, mount, type, sideSign, targetWorldAngle) {
  if (!Number.isFinite(targetWorldAngle)) return 0;

  const localTarget = angleDiff(targetWorldAngle, ship.heading || 0);
  const base = Math.atan2(mount.ny, mount.nx);

  const pivot = type === 'cannon'
    ? Math.max(0, Number(ship.cannonPivot || 0)) * (Math.PI / 180)
    : DEFAULT_GUN_PIVOT_RAD;

  return clamp(angleDiff(localTarget, base), -pivot, pivot);
}

function defaultReloadRatio(ship, side, index) {
  const mountLane = ship?.cannonMountTimers?.[side];
  if (Array.isArray(mountLane) && Number.isFinite(mountLane[index])) {
    const mountReload = Math.max(0.001, Number(ship.cannonReload || 0));
    const mountTimer = Math.max(0, Number(mountLane[index] || 0));
    return 1 - clamp(mountTimer / mountReload, 0, 1);
  }

  const reload = Math.max(0.001, Number(ship.cannonReload || 0));
  const timer = Math.max(0, Number(ship.cannonTimer || 0));
  return 1 - clamp(timer / reload, 0, 1);
}

function drawReactiveSail(ctx, ship, size, z, wind, time) {
  const mastScale = Number.isFinite(ship.mastScale) ? ship.mastScale : 1;
  const mastTopY = -Math.max(8, size * 1.2 * mastScale) * z;

  if (!ship.sailOpen) {
    const furlW = Math.max(8, size * 0.5) * z;
    const furlH = Math.max(2.5, size * 0.09) * z;
    ctx.fillStyle = '#d6ddd2';
    ctx.fillRect(-furlW * 0.4, mastTopY + size * 0.16 * z, furlW, furlH);
    ctx.fillRect(-furlW * 0.33, mastTopY + size * 0.28 * z, furlW * 0.86, furlH * 0.9);
    return;
  }

  const fwd = { x: Math.cos(ship.heading || 0), y: Math.sin(ship.heading || 0) };
  const right = { x: -fwd.y, y: fwd.x };
  const windX = Number.isFinite(wind?.x) ? wind.x : 0;
  const windY = Number.isFinite(wind?.y) ? wind.y : 0;
  const windMag = Math.hypot(windX, windY);
  const windForward = fwd.x * windX + fwd.y * windY;
  const windSide = right.x * windX + right.y * windY;
  const intensity = clamp(windMag / 0.55, 0, 1.5);

  const windAngleLocal = windMag > 0.0001 ? Math.atan2(windSide, windForward) : 0;
  const seed = (ship.id || 0) * 0.73 + size * 0.09;
  const flutter = Math.sin(time * 8.6 + seed) * (0.03 + intensity * 0.02);
  const billowPulse = Math.sin(time * 3.2 + (ship.id || 0) * 0.41 + size * 0.05);
  const sailAngle = windAngleLocal + Math.PI * 0.5 + flutter;

  const pivotY = mastTopY + size * 0.22 * z;
  const mainW = size * 2.3 * (1 + (billowPulse * 0.02 + intensity * 0.03)) * z;
  const mainH = Math.max(3.4, size * 0.27) * z;

  ctx.save();
  ctx.translate(0, pivotY);
  ctx.rotate(sailAngle);

  ctx.fillStyle = 'rgba(195, 215, 230, 0.22)';
  ctx.fillRect(-mainW * 0.62, -mainH * 1.12, mainW * 1.24, mainH * 2.24);

  ctx.fillStyle = ship.sailColor || '#f0f7ff';
  ctx.globalAlpha = 0.9;
  ctx.fillRect(-mainW * 0.5, -mainH * 0.5, mainW, mainH);
  ctx.strokeStyle = 'rgba(130,150,170,0.5)';
  ctx.lineWidth = Math.max(0.7, z * 0.52);
  ctx.strokeRect(-mainW * 0.5, -mainH * 0.5, mainW, mainH);
  ctx.globalAlpha = 1;

  ctx.restore();
}

/**
 * Draw SP-style ship body, mounts, and sail using a shared renderer.
 *
 * A mount layout strategy can be injected to customize how mounts are generated
 * from ship state without rewriting the renderer.
 */
export function drawShipRenderer(ctx, sx, sy, ship, options = {}) {
  const {
    zoom = 1,
    wind = { x: 0, y: 0 },
    time = 0,
    mountLayoutStrategy = getDefaultLayout,
    targetWorldAngle = null,
    targetSideSign = 0,
    showInWorldCannonReload = true,
    getCannonReloadRatio = null,
    getMountTargetWorldAngle = null,
    drawInterior = null,
    drawOverlays = null
  } = options;

  const z = zoom;
  const size = ship.size || 16;
  const heading = ship.heading || 0;
  const shape = getHullShape(ship);

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(heading);

  if (ship.invuln) {
    ctx.globalAlpha = 0.3 + Math.sin(time * 8) * 0.15;
    ctx.fillStyle = '#88ccff';
    ctx.beginPath();
    ctx.arc(0, 0, shape.len * z * 1.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  drawHullPath(ctx, shape, z);
  ctx.fillStyle = ship.hullColor || '#5f4630';
  ctx.fill();

  ctx.strokeStyle = ship.trimColor || '#d9b78d';
  ctx.lineWidth = Math.max(2, z * 1.8);
  drawHullPath(ctx, shape, z);
  ctx.stroke();

  if ((ship.hullArmorTier || 0) > 0) {
    const plateCount = 3 + ship.hullArmorTier;
    const deckLen = shape.shoulderX - shape.sternShoulderX;
    ctx.strokeStyle = 'rgba(160,150,130,0.35)';
    ctx.lineWidth = Math.max(0.5, z * 0.4);
    for (let i = 0; i < plateCount; i++) {
      const t = (i + 0.5) / plateCount;
      const lx = shape.sternShoulderX + deckLen * t;
      const hw = Math.abs((shape.shoulderHalfBeam * (1 - t)) + (shape.sternHalfBeam * t));
      ctx.beginPath();
      ctx.moveTo(lx * z, -hw * z);
      ctx.lineTo(lx * z, hw * z);
      ctx.stroke();
    }
  }

  drawRam(ctx, shape, z, ship);

  if (typeof drawInterior === 'function') {
    drawInterior({ shape, z });
  }

  const layout = mountLayoutStrategy(ship, shape) || getDefaultLayout(ship);
  const sides = [
    ['port', -1, Array.isArray(layout.port) ? layout.port : []],
    ['starboard', 1, Array.isArray(layout.starboard) ? layout.starboard : []]
  ];

  for (const [sideName, sideSign, slots] of sides) {
    if (!slots.length) continue;
    for (let i = 0; i < slots.length; i++) {
      const type = slots[i] || 'empty';
      if (type === 'empty') continue;

      const mount = getHullSideMount(shape, i, slots.length, sideSign, 0.12, 0.88);
      const cannonPort = type === 'cannon';
      const length = cannonPort ? Math.max(8, size * 0.48) : Math.max(4.5, size * 0.3);
      const thickness = cannonPort ? Math.max(2.8, size * 0.14) : Math.max(1.8, size * 0.1);
      const color = cannonPort ? '#5f656c' : '#d5dbe2';
      const mountTargetWorldAngle = typeof getMountTargetWorldAngle === 'function'
        ? getMountTargetWorldAngle({
          ship,
          side: sideName,
          sideSign,
          index: i,
          type,
          mount,
          targetWorldAngle,
          targetSideSign
        })
        : targetWorldAngle;
      const aimOffset = getMountAimOffset(ship, mount, type, sideSign, mountTargetWorldAngle);

      drawPerimeterMountWithAim(ctx, mount, length, thickness, color, z, aimOffset);

      if (cannonPort && showInWorldCannonReload) {
        const ratio = typeof getCannonReloadRatio === 'function'
          ? getCannonReloadRatio({ ship, side: sideName, index: i, type })
          : defaultReloadRatio(ship, sideName, i);
        drawCannonReloadOverlay(ctx, mount, length, thickness, z, aimOffset, ratio);
      }
    }
  }

  const mast = Math.max(8, size * 1.2 * (ship.mastScale || 1));
  ctx.fillStyle = ship.trimColor || '#d9b78d';
  ctx.fillRect(-2 * z, -mast * z, 4 * z, mast * z);
  drawReactiveSail(ctx, ship, size, z, wind, time);

  if (typeof drawOverlays === 'function') {
    drawOverlays({ shape, z });
  }

  ctx.restore();
  return { shape };
}
