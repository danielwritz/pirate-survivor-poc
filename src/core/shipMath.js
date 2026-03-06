import { clamp } from './math.js';

export function getHullShape(entity) {
  if (entity.hullDesign) {
    const size = entity.size;
    const design = entity.hullDesign;
    const bodyHalfLen = size * clamp(design.bodyHalfLenMul, 0.36, 0.95);
    const bodyHalfBeam = size * clamp(design.bodyHalfBeamMul, 0.38, 1.12);
    const sternBeamMul = clamp(design.sternBeamMul ?? 1, 0.34, 1.08);
    const sternHalfBeam = bodyHalfBeam * sternBeamMul;
    const bowTip = size * clamp(design.bowTipMul, 0.2, 1.25);
    const sternTip = size * clamp(design.sternTipMul, 0.12, 1.15);
    const beam = Math.max(2.2, bodyHalfBeam / 0.62);
    const shoulderX = bodyHalfLen;
    const sternShoulderX = -bodyHalfLen;
    const bowX = shoulderX + bowTip;
    const sternX = sternShoulderX - sternTip;
    return {
      len: (bowX - sternX) * 0.5,
      beam,
      bow: 1,
      stern: 1,
      bowX,
      shoulderX,
      shoulderHalfBeam: bodyHalfBeam,
      sternShoulderX,
      sternHalfBeam,
      sternX
    };
  }

  const size = entity.size;
  const len = size * clamp(entity.hullLength ?? 1, 0.78, 1.55);
  const beam = size * clamp(entity.hullBeam ?? 1, 0.7, 1.45);
  const bow = clamp(entity.bowSharpness ?? 1, 0.72, 1.7);
  const stern = clamp(entity.sternTaper ?? 1, 0.6, 1.5);

  return {
    len,
    beam,
    bow,
    stern,
    bowX: len * (1.05 + bow * 0.14),
    shoulderX: len * 0.34,
    shoulderHalfBeam: beam * 0.62,
    sternShoulderX: -len * (0.7 + stern * 0.2),
    sternHalfBeam: beam * 0.46,
    sternX: -len * (0.95 + stern * 0.24)
  };
}

export function getDeckCrewCapacity(entity) {
  const shape = getHullShape(entity);
  const deckLength = shape.shoulderX - shape.sternShoulderX;
  const deckBeam = shape.shoulderHalfBeam + shape.sternHalfBeam;
  const area = deckLength * deckBeam;
  return clamp(Math.floor(area / 56) + 2, 2, 48);
}

export function getShipTier(entity) {
  const shape = getHullShape(entity);
  const deckLength = shape.shoulderX - shape.sternShoulderX;
  if (deckLength < 24) return 1;
  if (deckLength < 36) return 2;
  if (deckLength < 50) return 3;
  return 4;
}

export function getShipWeaponCaps(entity, cannonCapacityBonus = 0) {
  const shape = getHullShape(entity);
  const tier = getShipTier(entity);
  const deckLength = shape.shoulderX - shape.sternShoulderX;
  const deckBeam = shape.beam * 1.16;
  const deckArea = deckLength * deckBeam;

  // Keep cannon growth tied to real hull deck footprint so extra racks matter.
  const baseCannonsPerSide = 1 + tier;
  const areaCannons = Math.max(0, Math.floor((deckArea - 140) / 180));
  const maxCannonsPerSide = clamp(baseCannonsPerSide + areaCannons + cannonCapacityBonus, 2, 12);

  const baseGuns = 3 + tier * 2;
  const areaGuns = Math.max(0, Math.floor((deckArea - 28) / 44));
  const maxGunners = clamp(baseGuns + areaGuns, 3, 24);

  return { tier, maxCannonsPerSide, maxGunners };
}

export function getHullUpperEdge(shape) {
  return [
    { x: shape.sternX, y: 0 },
    { x: shape.sternShoulderX, y: -shape.sternHalfBeam },
    { x: shape.shoulderX, y: -shape.shoulderHalfBeam },
    { x: shape.bowX, y: 0 }
  ];
}

export function hullHalfWidthAt(shape, x) {
  const topA = { x: shape.bowX, y: 0 };
  const topB = { x: shape.shoulderX, y: -shape.shoulderHalfBeam };
  const topC = { x: shape.sternShoulderX, y: -shape.sternHalfBeam };
  const topD = { x: shape.sternX, y: 0 };

  const px = clamp(x, shape.sternX, shape.bowX);
  if (px >= topB.x) {
    const t = (px - topB.x) / Math.max(0.001, topA.x - topB.x);
    return Math.abs(topB.y + (topA.y - topB.y) * t);
  }
  if (px >= topC.x) {
    const t = (px - topC.x) / Math.max(0.001, topB.x - topC.x);
    return Math.abs(topC.y + (topB.y - topC.y) * t);
  }
  const t = (px - topD.x) / Math.max(0.001, topC.x - topD.x);
  return Math.abs(topD.y + (topC.y - topD.y) * t);
}

function samplePolyline(points, tNorm) {
  const lengths = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const seg = Math.hypot(dx, dy);
    lengths.push(seg);
    total += seg;
  }

  const clampedT = clamp(tNorm, 0, 1);
  let target = clampedT * total;
  for (let i = 0; i < lengths.length; i++) {
    const seg = lengths[i];
    if (target <= seg || i === lengths.length - 1) {
      const localT = seg <= 0.0001 ? 0 : target / seg;
      const a = points[i];
      const b = points[i + 1];
      const x = a.x + (b.x - a.x) * localT;
      const y = a.y + (b.y - a.y) * localT;
      const txRaw = b.x - a.x;
      const tyRaw = b.y - a.y;
      const tLen = Math.hypot(txRaw, tyRaw) || 1;
      return {
        x,
        y,
        tx: txRaw / tLen,
        ty: tyRaw / tLen
      };
    }
    target -= seg;
  }

  const last = points[points.length - 1];
  return { x: last.x, y: last.y, tx: 1, ty: 0 };
}

export function getHullSideMount(shape, index, total, sideSign, trimStart = 0.1, trimEnd = 0.9) {
  const upperEdge = getHullUpperEdge(shape);
  const baseT = total <= 1 ? 0.5 : index / (total - 1);
  const pathT = trimStart + (trimEnd - trimStart) * baseT;
  const upper = samplePolyline(upperEdge, pathT);

  let px = upper.x;
  let py = upper.y;
  let tx = upper.tx;
  let ty = upper.ty;

  if (sideSign >= 0) {
    py = -py;
    ty = -ty;
  }

  let nx = -ty;
  let ny = tx;
  const nLen = Math.hypot(nx, ny) || 1;
  nx /= nLen;
  ny /= nLen;

  const desiredY = sideSign >= 0 ? 1 : -1;
  if (ny * desiredY < 0) {
    nx = -nx;
    ny = -ny;
  }

  return { x: px, y: py, nx, ny };
}

export function getReactiveSailParams(entity, size, wind, time, enemySail = false) {
  const fwd = { x: Math.cos(entity.heading), y: Math.sin(entity.heading) };
  const right = { x: -fwd.y, y: fwd.x };
  const windMag = Math.hypot(wind.x, wind.y);
  const windForward = fwd.x * wind.x + fwd.y * wind.y;
  const windSide = right.x * wind.x + right.y * wind.y;
  const seed = (entity.id || 0) * 0.61 + (enemySail ? 1.3 : 0.2);
  const flutter = Math.sin(time * 8.4 + seed) * 0.35 + Math.sin(time * 13.2 + seed * 1.7) * 0.2;
  const intensity = clamp(windMag / 0.55, 0, 1.5);
  const openFactor = entity.sailOpen ? 1 : 0;
  const billow = (0.28 + intensity * 0.98 + Math.max(0, windForward) * 0.68 + flutter * 0.08) * openFactor;
  const bend = clamp(windSide * (1.24 + intensity * 0.96) + flutter * 0.22, -1.65, 1.65);
  const chord = size * (enemySail ? 0.9 : 1.08);
  const leechX = chord * (0.72 + billow * 0.54);
  const footY = -(Math.max(8, size * 1.2 * (entity.mastScale ?? 1))) + size * (enemySail ? 0.68 : 0.74);

  return {
    intensity,
    flutter,
    bend,
    leechX,
    footY,
    isOpen: !!entity.sailOpen
  };
}
