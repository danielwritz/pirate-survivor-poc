import { clamp } from './math.js';
import { getShipWeaponCaps, getDeckCrewCapacity } from './shipMath.js';

export function getWeaponSlotCount(entity) {
  const caps = getShipWeaponCaps(entity, entity.cannonCapacityBonus || 0);
  return clamp(Math.max(3, Math.ceil(caps.maxGunners * 0.6) + 2), 3, 12);
}

export function normalizeWeaponLayout(entity) {
  const slots = getWeaponSlotCount(entity);
  if (!entity.weaponLayout) {
    entity.weaponLayout = { port: [], starboard: [] };
  }

  const normalize = (arr) => {
    const out = Array.isArray(arr) ? [...arr] : [];
    while (out.length < slots) out.push('empty');
    if (out.length > slots) out.length = slots;
    for (let i = 0; i < out.length; i++) {
      if (out[i] !== 'gun' && out[i] !== 'cannon') out[i] = 'empty';
    }
    return out;
  };

  entity.weaponLayout.port = normalize(entity.weaponLayout.port);
  entity.weaponLayout.starboard = normalize(entity.weaponLayout.starboard);
  return entity.weaponLayout;
}

export function getWeaponCounts(entity) {
  const layout = normalizeWeaponLayout(entity);
  const port = layout.port;
  const star = layout.starboard;

  let gunTotal = 0;
  let cannonTotal = 0;
  let portCannons = 0;
  let starCannons = 0;

  for (let i = 0; i < port.length; i++) {
    if (port[i] === 'gun') gunTotal += 1;
    if (port[i] === 'cannon') {
      cannonTotal += 1;
      portCannons += 1;
    }

    if (star[i] === 'gun') gunTotal += 1;
    if (star[i] === 'cannon') {
      cannonTotal += 1;
      starCannons += 1;
    }
  }

  return {
    gunTotal,
    cannonTotal,
    cannonPerSide: Math.max(portCannons, starCannons)
  };
}

export function syncArmamentDerivedStats(entity) {
  const weapon = getWeaponCounts(entity);
  entity.cannons = weapon.cannonPerSide;
  return weapon;
}

export function getSpareCrewCapacity(entity) {
  const totalCrew = clamp(entity.crew || 0, 0, getDeckCrewCapacity(entity));
  const committed = Math.max(0, (entity.rowers || 0) + (entity.gunners || 0) + (entity.repairCrew || 0));
  return Math.max(0, totalCrew - committed);
}

export function clampSupportCrew(entity) {
  const maxByDeck = getDeckCrewCapacity(entity);
  entity.repairCrew = clamp(entity.repairCrew || 0, 0, maxByDeck);
  const maxSupport = Math.max(0, (entity.crew || 0) - ((entity.rowers || 0) + (entity.gunners || 0)));
  entity.repairCrew = Math.min(entity.repairCrew, maxSupport);
}

export function clampArmamentToHull(entity) {
  normalizeWeaponLayout(entity);
  const caps = getShipWeaponCaps(entity, entity.cannonCapacityBonus || 0);
  entity.gunners = clamp(entity.gunners || 0, 0, caps.maxGunners);

  const trimCannons = (lane) => {
    let cannons = 0;
    for (let i = 0; i < lane.length; i++) {
      if (lane[i] !== 'cannon') continue;
      cannons += 1;
      if (cannons > caps.maxCannonsPerSide) lane[i] = 'gun';
    }
  };

  trimCannons(entity.weaponLayout.port);
  trimCannons(entity.weaponLayout.starboard);
  syncArmamentDerivedStats(entity);
  return caps;
}

export function autoInstallCannons(entity, perSideCount = 1) {
  normalizeWeaponLayout(entity);
  const caps = getShipWeaponCaps(entity, entity.cannonCapacityBonus || 0);

  const centerOutIndices = (length) => {
    const out = [];
    if (length <= 0) return out;
    const center = (length - 1) / 2;
    for (let i = 0; i < length; i++) out.push(i);
    out.sort((a, b) => {
      const da = Math.abs(a - center);
      const db = Math.abs(b - center);
      if (da !== db) return da - db;
      return a - b;
    });
    return out;
  };

  const installOnSide = (lane) => {
    let installed = 0;
    const indices = centerOutIndices(lane.length);
    while (installed < perSideCount) {
      const sideCannons = lane.filter((t) => t === 'cannon').length;
      if (sideCannons >= caps.maxCannonsPerSide) break;
      const emptyIdx = indices.find((idx) => lane[idx] === 'empty');
      if (emptyIdx == null) break;
      lane[emptyIdx] = 'cannon';
      installed += 1;
    }
  };

  installOnSide(entity.weaponLayout.port);
  installOnSide(entity.weaponLayout.starboard);
  syncArmamentDerivedStats(entity);
}

export function autoInstallGuns(entity, perSideCount = 1) {
  normalizeWeaponLayout(entity);

  const centerOutIndices = (length) => {
    const out = [];
    if (length <= 0) return out;
    const center = (length - 1) / 2;
    for (let i = 0; i < length; i++) out.push(i);
    out.sort((a, b) => {
      const da = Math.abs(a - center);
      const db = Math.abs(b - center);
      if (da !== db) return da - db;
      return a - b;
    });
    return out;
  };

  const installOnSide = (lane) => {
    let installed = 0;
    const indices = centerOutIndices(lane.length);
    while (installed < perSideCount) {
      const emptyIdx = indices.find((idx) => lane[idx] === 'empty');
      if (emptyIdx == null) break;
      lane[emptyIdx] = 'gun';
      installed += 1;
    }
  };

  installOnSide(entity.weaponLayout.port);
  installOnSide(entity.weaponLayout.starboard);
  syncArmamentDerivedStats(entity);
}

export function getWeaponCrewDemand(entity) {
  const weapon = getWeaponCounts(entity);
  return weapon.gunTotal * 0.55 + weapon.cannonTotal * 1.15;
}

export function getWeaponCrewRatio(entity) {
  const demand = Math.max(1, getWeaponCrewDemand(entity));
  return clamp((entity.gunners || 0) / demand, 0.25, 1.55);
}

export function getEffectiveReloadTimes(entity) {
  const ratio = getWeaponCrewRatio(entity);
  const factor = clamp(1.52 - ratio * 0.58, 0.72, 1.88);
  return {
    gun: (entity.gunReload || 1) * factor,
    cannon: (entity.cannonReload || 1) * (factor * 1.04)
  };
}
