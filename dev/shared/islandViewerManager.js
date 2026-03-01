import { convexHull } from '../../src/core/math.js';

function seededRng(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function buildIslandPolygons(island) {
  const points = [];
  for (const patch of island.patches) {
    const sides = patch.sides === 3 ? 3 : 6;
    for (let i = 0; i < sides; i++) {
      const a = patch.rot + (i / sides) * Math.PI * 2;
      points.push({
        x: patch.x - island.x + Math.cos(a) * patch.size * 0.92,
        y: patch.y - island.y + Math.sin(a) * patch.size * 0.92
      });
    }
  }

  let outer = convexHull(points);
  if (!outer.length) {
    outer = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      outer.push({ x: Math.cos(a) * island.r, y: Math.sin(a) * island.r });
    }
  }

  const inner = outer.map((pt) => {
    const ang = Math.atan2(pt.y, pt.x);
    const inset = 0.68 + Math.sin(ang * 2.4 + island.x * 0.007 + island.y * 0.003) * 0.06;
    return { x: pt.x * inset, y: pt.y * inset };
  });

  island.outerPoly = outer;
  island.innerPoly = inner;
}

function makeIsland(rand, worldWidth, worldHeight) {
  const x = 200 + rand() * (worldWidth - 400);
  const y = 200 + rand() * (worldHeight - 400);
  const roll = rand();
  const isSmall = roll < 0.22;
  const isLong = roll >= 0.22 && roll < 0.5;
  const isLarge = roll > 0.84;
  const r = isSmall ? (28 + rand() * 36) : isLarge ? (96 + rand() * 82) : (50 + rand() * 76);
  const island = { x, y, r, patches: [], buildings: [], docks: [], foliage: [], defenseLevel: 0 };

  const patchCount = isSmall ? (5 + Math.floor(rand() * 4)) : isLarge ? (18 + Math.floor(rand() * 12)) : (9 + Math.floor(rand() * 10));
  const spineDir = rand() * Math.PI * 2;
  const spineLength = isLong ? (r * (1.6 + rand() * 1.4)) : (r * (0.4 + rand() * 0.5));
  const thickness = isLong ? (0.22 + rand() * 0.18) : (0.45 + rand() * 0.28);
  let maxExtent = r;

  for (let p = 0; p < patchCount; p++) {
    const t = patchCount <= 1 ? 0.5 : (p / (patchCount - 1));
    const along = (t - 0.5) * spineLength;
    const lateral = (rand() - 0.5) * r * thickness;
    const px = x + Math.cos(spineDir) * along - Math.sin(spineDir) * lateral + (rand() - 0.5) * r * 0.22;
    const py = y + Math.sin(spineDir) * along + Math.cos(spineDir) * lateral + (rand() - 0.5) * r * 0.22;
    const size = (isSmall ? 8 : isLarge ? 14 : 10) + rand() * (isLarge ? 22 : 16);
    const sides = rand() < 0.58 ? 6 : 3;
    const rot = rand() * Math.PI * 2;
    island.patches.push({ x: px, y: py, size, sides, rot });
    maxExtent = Math.max(maxExtent, Math.hypot(px - x, py - y) + size * 1.2);

    if (rand() < 0.35) {
      const offAng = rand() * Math.PI * 2;
      const offDist = size * (0.4 + rand() * 0.7);
      const sx = px + Math.cos(offAng) * offDist;
      const sy = py + Math.sin(offAng) * offDist;
      const ssize = size * (0.45 + rand() * 0.4);
      const ssides = rand() < 0.5 ? 6 : 3;
      island.patches.push({ x: sx, y: sy, size: ssize, sides: ssides, rot: rot + rand() * 0.6 });
      maxExtent = Math.max(maxExtent, Math.hypot(sx - x, sy - y) + ssize * 1.2);
    }
  }

  island.r = maxExtent;

  const bCount = Math.max(2, Math.floor(island.r / 24));
  for (let b = 0; b < bCount; b++) {
    const patch = island.patches[Math.floor(rand() * island.patches.length)];
    const bx = patch.x + (rand() - 0.5) * patch.size * 0.6;
    const by = patch.y + (rand() - 0.5) * patch.size * 0.6;
    const size = 8 + rand() * 18;
    island.buildings.push({ x: bx, y: by, size, tower: false });
  }

  if (island.buildings.length) {
    const dockCount = 1 + Math.floor(rand() * (isLarge ? 3 : 2));
    for (let d = 0; d < dockCount; d++) {
      const ang = rand() * Math.PI * 2;
      const baseDist = island.r * (0.78 + rand() * 0.15);
      const length = 18 + rand() * 34;
      const width = 6 + rand() * 5;
      island.docks.push({
        x: island.x + Math.cos(ang) * baseDist,
        y: island.y + Math.sin(ang) * baseDist,
        rot: ang,
        length,
        width
      });
    }
  }

  const foliageCount = Math.max(5, Math.floor(island.r / 10));
  for (let f = 0; f < foliageCount; f++) {
    const patch = island.patches[Math.floor(rand() * island.patches.length)];
    const ang = rand() * Math.PI * 2;
    const off = patch.size * (0.1 + rand() * 0.7);
    const fx = patch.x + Math.cos(ang) * off;
    const fy = patch.y + Math.sin(ang) * off;
    if (rand() < 0.55) {
      const crown = 5 + rand() * 6;
      island.foliage.push({ kind: 'tree', x: fx, y: fy, crown });
    } else {
      island.foliage.push({ kind: 'shrub', x: fx, y: fy, width: 6 + rand() * 10, height: 4 + rand() * 6 });
    }
  }

  buildIslandPolygons(island);
  return island;
}

export function createIslandViewerManager(config) {
  const state = {
    islands: [],
    seed: config.defaults.seed,
    profileId: config.defaults.profile,
    worldWidth: config.defaults.worldWidth,
    worldHeight: config.defaults.worldHeight,
    zoom: Number(config.defaults.zoom) || 0.22,
    cameraX: (config.defaults.worldWidth || 3600) * 0.5,
    cameraY: (config.defaults.worldHeight || 2600) * 0.5,
    layers: {
      terrain: !!config.defaults.showTerrain,
      buildings: !!config.defaults.showBuildings,
      foliage: !!config.defaults.showFoliage,
      docks: !!config.defaults.showDocks,
      polygons: !!config.defaults.showPolygons
    }
  };

  function regenerate(seed = state.seed, profileId = state.profileId) {
    state.seed = Number(seed) || 1;
    state.profileId = profileId;
    const profile = (config.profiles || []).find((p) => p.id === profileId) || config.profiles[0];

    const rand = seededRng(state.seed);
    state.islands = [];
    const count = profile?.islandCount || 24;
    for (let i = 0; i < count; i++) {
      state.islands.push(makeIsland(rand, state.worldWidth, state.worldHeight));
    }
  }

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

  function draw(ctx, width, height) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0a2235';
    ctx.fillRect(0, 0, width, height);

    const scale = state.zoom;

    for (const island of state.islands) {
      if (state.layers.terrain) {
        for (const patch of island.patches) {
          const cp = worldToScreen(patch.x, patch.y, width, height);
          const sides = patch.sides === 3 ? 3 : 6;
          const radius = patch.size * scale;
          ctx.beginPath();
          for (let i = 0; i < sides; i++) {
            const a = patch.rot + (i / sides) * Math.PI * 2;
            const x = cp.x + Math.cos(a) * radius;
            const y = cp.y + Math.sin(a) * radius;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fillStyle = '#50764f';
          ctx.fill();
          ctx.strokeStyle = '#3b5f3a';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      if (state.layers.buildings) {
        for (const b of island.buildings) {
          const bp = worldToScreen(b.x, b.y, width, height);
          const s = Math.max(2, b.size * 0.22 * scale);
          ctx.fillStyle = '#9c7a5a';
          ctx.fillRect(bp.x - s, bp.y - s, s * 2, s * 2);
          ctx.fillStyle = '#6a4f39';
          ctx.fillRect(bp.x - s * 0.6, bp.y - s * 0.2, s * 1.2, s * 0.8);
        }
      }

      if (state.layers.foliage) {
        for (const f of island.foliage) {
          const fp = worldToScreen(f.x, f.y, width, height);
          if (f.kind === 'tree') {
            ctx.fillStyle = '#2a5b35';
            ctx.beginPath();
            ctx.arc(fp.x, fp.y, Math.max(1.6, f.crown * 0.28 * scale), 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = '#3f6a3c';
            ctx.fillRect(fp.x - 1.5, fp.y - 1, 3, 2);
          }
        }
      }

      if (state.layers.docks) {
        for (const d of island.docks) {
          const dp = worldToScreen(d.x, d.y, width, height);
          const length = d.length * scale;
          const widthPx = Math.max(1, d.width * 0.4 * scale);
          ctx.save();
          ctx.translate(dp.x, dp.y);
          ctx.rotate(d.rot);
          ctx.fillStyle = '#7a5a3c';
          ctx.fillRect(0, -widthPx * 0.5, length, widthPx);
          ctx.restore();
        }
      }

      if (state.layers.polygons && island.outerPoly?.length) {
        const center = worldToScreen(island.x, island.y, width, height);
        ctx.beginPath();
        island.outerPoly.forEach((pt, i) => {
          const x = center.x + pt.x * scale;
          const y = center.y + pt.y * scale;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.strokeStyle = '#aee0ff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  regenerate(state.seed, state.profileId);

  return {
    state,
    regenerate,
    screenToWorld,
    worldToScreen,
    panByPixels,
    zoomAtScreen,
    draw
  };
}
