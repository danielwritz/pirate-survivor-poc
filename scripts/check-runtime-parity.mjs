import { readFileSync } from 'fs';
import { resolve } from 'path';

function fail(message) {
  console.error(`\n[runtime-check] ${message}`);
  process.exit(1);
}

function getMajor(versionLike) {
  const clean = String(versionLike || '').trim().replace(/^v/, '');
  const major = Number.parseInt(clean.split('.')[0], 10);
  return Number.isFinite(major) ? major : null;
}

const root = process.cwd();
const pkgPath = resolve(root, 'package.json');
const nvmrcPath = resolve(root, '.nvmrc');

let pkg;
try {
  pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
} catch (err) {
  fail(`Could not parse package.json: ${err?.message || err}`);
}

let nvmrc;
try {
  nvmrc = readFileSync(nvmrcPath, 'utf8').trim();
} catch (err) {
  fail(`Missing or unreadable .nvmrc: ${err?.message || err}`);
}

const nvmMajor = getMajor(nvmrc);
if (!nvmMajor) {
  fail(`Invalid .nvmrc value: "${nvmrc}"`);
}

const currentMajor = getMajor(process.versions.node);
if (!currentMajor) {
  fail(`Could not read current Node version: ${process.versions.node}`);
}

const engineRange = pkg?.engines?.node;
if (typeof engineRange !== 'string' || !engineRange.trim()) {
  fail('package.json must define engines.node to enforce runtime parity.');
}

const expectedMin = engineRange.match(/>=\s*(\d+)/);
const expectedMaxExclusive = engineRange.match(/<\s*(\d+)/);
if (!expectedMin || !expectedMaxExclusive) {
  fail(`engines.node must use a bounded major range like ">=22 <23". Found: "${engineRange}"`);
}

const minMajor = Number.parseInt(expectedMin[1], 10);
const maxExclusiveMajor = Number.parseInt(expectedMaxExclusive[1], 10);
if (!(currentMajor >= minMajor && currentMajor < maxExclusiveMajor)) {
  fail(`Current Node ${process.versions.node} violates engines.node "${engineRange}". Expected major ${minMajor}.`);
}

if (currentMajor !== nvmMajor) {
  fail(`Node major mismatch: running ${currentMajor}, but .nvmrc requires ${nvmMajor}.`);
}

const ciNodeVersion = process.env.CI_NODE_VERSION;
if (ciNodeVersion) {
  const ciMajor = getMajor(ciNodeVersion);
  if (!ciMajor) {
    fail(`Invalid CI_NODE_VERSION value: "${ciNodeVersion}"`);
  }
  if (ciMajor !== nvmMajor) {
    fail(`Workflow NODE_VERSION (${ciNodeVersion}) does not match .nvmrc (${nvmrc}).`);
  }
}

console.log(`[runtime-check] OK: Node ${process.versions.node}, engines.node "${engineRange}", .nvmrc "${nvmrc}"`);
