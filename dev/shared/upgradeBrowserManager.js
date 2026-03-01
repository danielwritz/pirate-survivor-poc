import { clamp } from '../../src/core/math.js';
import {
  getHullShape,
  getHullSideMount,
  getShipWeaponCaps,
  getDeckCrewCapacity,
  getReactiveSailParams
} from '../../src/core/shipMath.js';
import {
  normalizeWeaponLayout,
  getWeaponCounts,
  syncArmamentDerivedStats,
  getSpareCrewCapacity,
  clampSupportCrew,
  clampArmamentToHull,
  autoInstallCannons,
  autoInstallGuns
} from '../../src/core/armament.js';
import { applyUpgradeRuleSet, createUpgradeCatalog } from '../../src/systems/upgradeRuleEngine.js';

function cloneJsonSafe(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function drawHullBody(ctx, entity, hullColor, trimColor) {
  const shape = getHullShape(entity);
  const { bowX, shoulderX, shoulderHalfBeam, sternShoulderX, sternHalfBeam, sternX } = shape;

  ctx.beginPath();
  ctx.moveTo(bowX, 0);
  ctx.lineTo(shoulderX, -shoulderHalfBeam);
  ctx.lineTo(sternShoulderX, -sternHalfBeam);
  ctx.lineTo(sternX, 0);
  ctx.lineTo(sternShoulderX, sternHalfBeam);
  ctx.lineTo(shoulderX, shoulderHalfBeam);
  ctx.closePath();
  ctx.fillStyle = hullColor;
  ctx.fill();

  ctx.strokeStyle = trimColor;
  ctx.lineWidth = 2.2;
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';
  ctx.miterLimit = 2;
  ctx.stroke();

  if (entity.ram) {
    ctx.fillStyle = '#bdb7b0';
    ctx.beginPath();
    ctx.moveTo(bowX, -4);
    ctx.lineTo(bowX + 12, 0);
    ctx.lineTo(bowX, 4);
    ctx.closePath();
    ctx.fill();
  }

  return shape;
}

function drawSail(ctx, entity, size, wind, time) {
  const mast = Math.max(8, size * 1.2 * (entity.mastScale || 1));
  const mastTopY = -mast;
  ctx.fillStyle = entity.trimColor || '#d9b78d';
  ctx.fillRect(-2, mastTopY, 4, mast);

  const sail = getReactiveSailParams(entity, size, wind, time, false);
  if (!sail.isOpen) {
    ctx.fillStyle = '#d6ddd2';
    const furlW = Math.max(7, size * 0.44);
    ctx.fillRect(1.2, mastTopY + size * 0.1, furlW, 4);
    ctx.fillRect(1.2, mastTopY + size * 0.2, furlW * 0.85, 3);
    return;
  }

  const topCtrlX = sail.leechX * 0.52 + sail.bend * size * 0.26;
  const topCtrlY = mastTopY + size * (0.05 + sail.intensity * 0.08 + sail.flutter * 0.03);
  const leechY = mastTopY + size * (0.2 + sail.bend * 0.1 + sail.flutter * 0.03);
  const lowCtrlX = sail.leechX * 0.92 + sail.bend * size * 0.46;
  const lowCtrlY = mastTopY + size * (0.58 - sail.bend * 0.09 - sail.flutter * 0.04);

  ctx.fillStyle = entity.sailColor || '#f0f7ff';
  ctx.beginPath();
  ctx.moveTo(2, mastTopY + 2);
  ctx.bezierCurveTo(topCtrlX * 0.56, topCtrlY, topCtrlX, mastTopY + size * 0.16, sail.leechX, leechY);
  ctx.bezierCurveTo(lowCtrlX, mastTopY + size * 0.42, lowCtrlX * 0.64, lowCtrlY, 2, sail.footY);
  ctx.closePath();
  ctx.fill();
}

function drawMount(ctx, mount, length, thickness, color) {
  ctx.save();
  ctx.translate(mount.x, mount.y);
  ctx.rotate(Math.atan2(mount.ny, mount.nx));
  ctx.fillStyle = color;
  ctx.fillRect(0, -thickness * 0.5, length, thickness);
  ctx.restore();
}

function drawShipSnapshot(ctx, root, x, y, label, previewWind, previewTime) {
  const entity = root.player;
  normalizeWeaponLayout(entity);
  syncArmamentDerivedStats(entity);

  ctx.save();
  ctx.translate(x, y);

  const hull = drawHullBody(ctx, entity, entity.hullColor || '#5f4630', entity.trimColor || '#d9b78d');
  drawSail(ctx, entity, entity.size, previewWind, previewTime);

  const slotCount = Math.max(1, entity.weaponLayout.port.length);
  for (let i = 0; i < slotCount; i++) {
    const portType = entity.weaponLayout.port[i] || 'empty';
    const starType = entity.weaponLayout.starboard[i] || 'empty';

    if (portType !== 'empty') {
      const cannon = portType === 'cannon';
      const mount = getHullSideMount(hull, i, slotCount, -1, 0.12, 0.88);
      drawMount(ctx, mount, cannon ? Math.max(8, entity.size * 0.48) : Math.max(4.5, entity.size * 0.3), cannon ? Math.max(2.8, entity.size * 0.14) : Math.max(1.8, entity.size * 0.1), cannon ? '#5f656c' : '#d5dbe2');
    }

    if (starType !== 'empty') {
      const cannon = starType === 'cannon';
      const mount = getHullSideMount(hull, i, slotCount, 1, 0.12, 0.88);
      drawMount(ctx, mount, cannon ? Math.max(8, entity.size * 0.48) : Math.max(4.5, entity.size * 0.3), cannon ? Math.max(2.8, entity.size * 0.14) : Math.max(1.8, entity.size * 0.1), cannon ? '#5f656c' : '#d5dbe2');
    }
  }

  ctx.restore();
  ctx.fillStyle = '#d6ecff';
  ctx.font = '14px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + 112);
}

export function createUpgradeBrowserManager(descriptor) {
  const catalog = createUpgradeCatalog(descriptor);
  const baselineRoot = cloneJsonSafe(descriptor.baseline || {});
  const standardIds = new Set(catalog.standard.map((u) => u.id));
  const majorIds = new Set(catalog.major.map((u) => u.id));

  const state = {
    selectedCounts: new Map(),
    selectedUpgradeId: null,
    baselineRoot,
    resultRoot: cloneJsonSafe(baselineRoot),
    trace: [],
    previewTime: 0,
    previewWind: { x: 0.42, y: -0.09 },
    zoom: 1,
    cameraX: 410,
    cameraY: 310,
    sceneWidth: 820,
    sceneHeight: 620
  };

  function screenToWorld(screenX, screenY, viewWidth, viewHeight) {
    return {
      x: (screenX - viewWidth * 0.5) / state.zoom + state.cameraX,
      y: (screenY - viewHeight * 0.5) / state.zoom + state.cameraY
    };
  }

  function worldToScreen(worldX, worldY, viewWidth, viewHeight) {
    return {
      x: (worldX - state.cameraX) * state.zoom + viewWidth * 0.5,
      y: (worldY - state.cameraY) * state.zoom + viewHeight * 0.5
    };
  }

  function panByPixels(deltaScreenX, deltaScreenY) {
    state.cameraX -= deltaScreenX / state.zoom;
    state.cameraY -= deltaScreenY / state.zoom;
  }

  function zoomAtScreen(nextZoom, screenX, screenY, viewWidth, viewHeight) {
    const targetZoom = Math.max(0.00001, Number(nextZoom) || state.zoom);
    const worldBefore = screenToWorld(screenX, screenY, viewWidth, viewHeight);
    state.zoom = targetZoom;
    state.cameraX = worldBefore.x - (screenX - viewWidth * 0.5) / state.zoom;
    state.cameraY = worldBefore.y - (screenY - viewHeight * 0.5) / state.zoom;
  }

  function ensureRepairCrew(player) {
    const deckCap = getDeckCrewCapacity(player);
    let spare = getSpareCrewCapacity(player);
    if (spare <= 0 && player.crew < deckCap) {
      player.crew += 1;
      spare = getSpareCrewCapacity(player);
    }
    if (spare > 0) {
      player.repairCrew = (player.repairCrew || 0) + 1;
      clampSupportCrew(player);
    }
  }

  function envHooks() {
    return {
      autoInstallCannons: (player, perSide) => autoInstallCannons(player, perSide),
      autoInstallGuns: (player, perSide) => autoInstallGuns(player, perSide),
      ensureRepairCrew,
      clampArmament: (root) => clampArmamentToHull(root.player),
      ensureCollectorSkiffs: () => {},
      clampHpToMax: (root) => {
        root.player.hp = Math.min(root.player.maxHp, root.player.hp);
      },
      postApply: (root) => {
        root.player.gunReload = Math.max(0.75, root.player.gunReload || 0.75);
        root.player.cannonReload = Math.max(0.9, root.player.cannonReload || 0.9);
        root.player.baseSpeed = Math.max(1.6, root.player.baseSpeed || 1.6);
        root.player.cannonPivot = clamp(root.player.cannonPivot || 0, 0, 20);
        root.player.hp = Math.min(root.player.maxHp, root.player.hp);
        normalizeWeaponLayout(root.player);
        clampArmamentToHull(root.player);
      }
    };
  }

  function recompute() {
    const current = cloneJsonSafe(baselineRoot);
    const trace = [];

    const ordered = [...catalog.standard, ...catalog.major];
    for (const upgrade of ordered) {
      const count = Math.max(0, Number(state.selectedCounts.get(upgrade.id) || 0));
      if (count <= 0) continue;

      for (let applicationIndex = 1; applicationIndex <= count; applicationIndex++) {
        const ruleTrace = applyUpgradeRuleSet(current, upgrade.rules || [], { env: envHooks() });
        for (const item of ruleTrace) {
          trace.push({
            upgradeId: upgrade.id,
            upgradeName: upgrade.name,
            applicationIndex,
            ...item
          });
        }
      }
    }

    state.resultRoot = current;
    state.trace = trace;
  }

  function getCount(id) {
    return Math.max(0, Number(state.selectedCounts.get(id) || 0));
  }

  function setCount(id, nextCount) {
    const upgrade = catalog.byId.get(id);
    if (!upgrade) return;
    const normalized = Math.max(0, Math.floor(Number(nextCount) || 0));
    const clamped = majorIds.has(id) ? Math.min(1, normalized) : normalized;

    if (clamped <= 0) state.selectedCounts.delete(id);
    else state.selectedCounts.set(id, clamped);

    state.selectedUpgradeId = id;
    recompute();
  }

  function increment(id) {
    const count = getCount(id);
    setCount(id, count + 1);
  }

  function decrement(id) {
    const count = getCount(id);
    setCount(id, Math.max(0, count - 1));
  }

  function toggle(id) {
    setCount(id, getCount(id) > 0 ? 0 : 1);
  }

  function selectUpgrade(id) {
    state.selectedUpgradeId = id;
  }

  function clear() {
    state.selectedCounts.clear();
    state.selectedUpgradeId = null;
    recompute();
  }

  function drawPreview(ctx, width, height, dt = 1 / 60) {
    state.previewTime += dt;
    state.sceneWidth = width;
    state.sceneHeight = height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0a2235';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width * 0.5, height * 0.5);
    ctx.scale(state.zoom, state.zoom);
    ctx.translate(-state.cameraX, -state.cameraY);

    ctx.strokeStyle = 'rgba(159,194,217,0.14)';
    const worldLeft = state.cameraX - (width * 0.5) / state.zoom;
    const worldRight = state.cameraX + (width * 0.5) / state.zoom;
    const worldTop = state.cameraY - (height * 0.5) / state.zoom;
    const worldBottom = state.cameraY + (height * 0.5) / state.zoom;
    const startX = Math.floor(worldLeft / 40) * 40;
    const endX = Math.ceil(worldRight / 40) * 40;
    const startY = Math.floor(worldTop / 40) * 40;
    const endY = Math.ceil(worldBottom / 40) * 40;

    for (let x = startX; x <= endX; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, state.sceneHeight);
      ctx.stroke();
    }
    for (let y = startY; y <= endY; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(state.sceneWidth, y + 0.5);
      ctx.stroke();
    }

    drawShipSnapshot(ctx, state.baselineRoot, state.sceneWidth * 0.3, state.sceneHeight * 0.45, 'Before', state.previewWind, state.previewTime);
    drawShipSnapshot(ctx, state.resultRoot, state.sceneWidth * 0.7, state.sceneHeight * 0.45, 'After', state.previewWind, state.previewTime);

    ctx.strokeStyle = 'rgba(232,245,255,0.3)';
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(state.sceneWidth * 0.5, 40);
    ctx.lineTo(state.sceneWidth * 0.5, state.sceneHeight - 40);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function getInspection() {
    const before = state.baselineRoot.player;
    const after = state.resultRoot.player;
    const capsBefore = getShipWeaponCaps(before, before.cannonCapacityBonus || 0);
    const capsAfter = getShipWeaponCaps(after, after.cannonCapacityBonus || 0);
    const countsBefore = getWeaponCounts(before);
    const countsAfter = getWeaponCounts(after);

    const selectedUpgrades = Array.from(state.selectedCounts.entries())
      .map(([id, count]) => {
        const upgrade = catalog.byId.get(id);
        if (!upgrade) return null;
        return { ...upgrade, count };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const ia = [...catalog.standard, ...catalog.major].findIndex((u) => u.id === a.id);
        const ib = [...catalog.standard, ...catalog.major].findIndex((u) => u.id === b.id);
        return ia - ib;
      });

    const selectedUpgrade = state.selectedUpgradeId ? catalog.byId.get(state.selectedUpgradeId) : null;
    const selectedTrace = selectedUpgrade
      ? state.trace.filter((t) => t.upgradeId === selectedUpgrade.id)
      : state.trace;

    return {
      selectedUpgrades,
      selectedUpgrade,
      selectedTrace,
      fullTrace: state.trace,
      evaluated: state.resultRoot,
      derived: {
        before: { caps: capsBefore, counts: countsBefore },
        after: { caps: capsAfter, counts: countsAfter }
      }
    };
  }

  recompute();

  return {
    state,
    descriptor,
    catalog,
    standardIds,
    majorIds,
    getCount,
    setCount,
    increment,
    decrement,
    toggle,
    selectUpgrade,
    clear,
    drawPreview,
    screenToWorld,
    worldToScreen,
    panByPixels,
    zoomAtScreen,
    getInspection
  };
}
