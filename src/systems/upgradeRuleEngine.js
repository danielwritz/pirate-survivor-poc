import { clamp } from '../core/math.js';

function cloneJsonSafe(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function getByPath(root, path) {
  if (!path) return root;
  const parts = path.split('.');
  let current = root;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function setByPath(root, path, value) {
  const parts = path.split('.');
  let current = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (typeof current[key] !== 'object' || current[key] === null) current[key] = {};
    current = current[key];
  }
  current[parts[parts.length - 1]] = value;
}

function pushTrace(trace, rule, previousValue, nextValue, note) {
  trace.push({
    op: rule.op,
    path: rule.path || null,
    previousValue,
    nextValue,
    note: note || null
  });
}

function applyNumericOp(root, rule, trace, mode) {
  const prev = Number(getByPath(root, rule.path) || 0);
  const raw = Number(rule.value || 0);
  let next = prev;

  if (mode === 'add') next = prev + raw;
  if (mode === 'mul') next = prev * raw;
  if (mode === 'min') next = Math.min(prev, raw);
  if (mode === 'max') next = Math.max(prev, raw);

  setByPath(root, rule.path, next);
  pushTrace(trace, rule, prev, next);
}

export function applyUpgradeRuleSet(rootState, rules, options = {}) {
  const trace = [];
  const env = options.env || {};

  for (const rule of rules || []) {
    if (!rule || !rule.op) continue;

    if (rule.op === 'set') {
      const prev = getByPath(rootState, rule.path);
      setByPath(rootState, rule.path, cloneJsonSafe(rule.value));
      pushTrace(trace, rule, prev, getByPath(rootState, rule.path));
      continue;
    }

    if (rule.op === 'add' || rule.op === 'mul' || rule.op === 'min' || rule.op === 'max') {
      applyNumericOp(rootState, rule, trace, rule.op);
      continue;
    }

    if (rule.op === 'clamp') {
      const prev = Number(getByPath(rootState, rule.path) || 0);
      const next = clamp(prev, Number(rule.min ?? -Infinity), Number(rule.max ?? Infinity));
      setByPath(rootState, rule.path, next);
      pushTrace(trace, rule, prev, next);
      continue;
    }

    if (rule.op === 'addAbility') {
      const player = rootState.player;
      if (!Array.isArray(player?.slots)) {
        pushTrace(trace, rule, null, null, 'Missing player.slots for addAbility');
        continue;
      }
      const label = String(rule.value || '');
      const prev = [...player.slots];
      if (label && !player.slots.includes(label) && player.slots.length < 4) {
        player.slots.push(label);
      }
      pushTrace(trace, rule, prev, [...player.slots]);
      continue;
    }

    if (rule.op === 'autoInstallCannons') {
      if (typeof env.autoInstallCannons === 'function') {
        env.autoInstallCannons(rootState.player, Number(rule.perSide || 1));
        pushTrace(trace, rule, null, null, `Installed up to ${Number(rule.perSide || 1)} cannons per side`);
      } else {
        pushTrace(trace, rule, null, null, 'Skipped: autoInstallCannons hook unavailable');
      }
      continue;
    }

    if (rule.op === 'autoInstallGuns') {
      if (typeof env.autoInstallGuns === 'function') {
        env.autoInstallGuns(rootState.player, Number(rule.perSide || 1));
        pushTrace(trace, rule, null, null, `Installed up to ${Number(rule.perSide || 1)} guns per side`);
      } else {
        pushTrace(trace, rule, null, null, 'Skipped: autoInstallGuns hook unavailable');
      }
      continue;
    }

    if (rule.op === 'ensureRepairCrew') {
      if (typeof env.ensureRepairCrew === 'function') {
        const snapshotBefore = {
          crew: rootState.player?.crew,
          repairCrew: rootState.player?.repairCrew
        };
        env.ensureRepairCrew(rootState.player);
        pushTrace(trace, rule, snapshotBefore, {
          crew: rootState.player?.crew,
          repairCrew: rootState.player?.repairCrew
        });
      } else {
        pushTrace(trace, rule, null, null, 'Skipped: ensureRepairCrew hook unavailable');
      }
      continue;
    }

    if (rule.op === 'call') {
      const fnName = String(rule.fn || '');
      const fn = env[fnName];
      if (typeof fn === 'function') {
        fn(rootState, rule);
        pushTrace(trace, rule, null, null, `Called env.${fnName}`);
      } else {
        pushTrace(trace, rule, null, null, `Skipped: env.${fnName} not found`);
      }
      continue;
    }

    pushTrace(trace, rule, null, null, 'Unsupported rule op');
  }

  if (typeof env.postApply === 'function') {
    env.postApply(rootState);
  }

  return trace;
}

export function createUpgradeCatalog(descriptor) {
  const standard = Array.isArray(descriptor?.standard) ? descriptor.standard : [];
  const major = Array.isArray(descriptor?.major) ? descriptor.major : [];
  const byId = new Map([...standard, ...major].map((u) => [u.id, u]));
  return { standard, major, byId };
}
