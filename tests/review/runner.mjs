#!/usr/bin/env node
/**
 * tests/review/runner.mjs
 *
 * Reads a story rubric YAML, runs matching scenario scripts from
 * tests/review/story-N/, aggregates weighted scores, and writes
 * a JSON report to stdout.
 *
 * Usage:  node tests/review/runner.mjs <story-number>
 * Output: JSON with { score, passed, total, details[] }
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '../..');

const storyNum = process.argv[2];
if (!storyNum) {
  console.error('Usage: node tests/review/runner.mjs <story-number>');
  process.exit(1);
}

// ── Parse rubric (lightweight, no YAML lib needed) ──
const rubricPath = join(root, `docs/reviews/story-${storyNum}-rubric.yaml`);
if (!existsSync(rubricPath)) {
  console.error(`Rubric not found: ${rubricPath}`);
  process.exit(1);
}

const rubricText = readFileSync(rubricPath, 'utf8');
const scenarios = [];
const scenarioBlocks = rubricText.split(/\n  - id: /).slice(1);
for (const block of scenarioBlocks) {
  const idMatch = block.match(/^"?([^"\n]+)"?/);
  const weightMatch = block.match(/weight:\s*(\d+)/);
  if (idMatch && weightMatch) {
    scenarios.push({ id: idMatch[1], weight: Number(weightMatch[1]) });
  }
}

// ── Run scenario scripts ──
const scenarioDir = join(__dirname, `story-${storyNum}`);
if (!existsSync(scenarioDir)) {
  console.error(`Scenario test directory not found: ${scenarioDir}`);
  process.exit(1);
}

const scripts = readdirSync(scenarioDir)
  .filter(f => f.endsWith('.mjs'))
  .sort();

const details = [];
let weightedSum = 0;
let totalWeight = 0;

for (const scenario of scenarios) {
  const scriptFile = scripts.find(s => s.replace('.mjs', '') === scenario.id);
  if (!scriptFile) {
    details.push({
      id: scenario.id,
      weight: scenario.weight,
      score: 0,
      verdict: 'FAIL',
      reason: 'No matching test script found'
    });
    totalWeight += scenario.weight;
    continue;
  }

  const scriptPath = join(scenarioDir, scriptFile);
  let result;
  try {
    const stdout = execFileSync('node', [scriptPath], {
      cwd: root,
      timeout: 30000,
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: '' }
    });
    result = JSON.parse(stdout.trim().split('\n').pop());
  } catch (err) {
    const stderr = err.stderr?.toString() || err.message;
    result = { verdict: 'FAIL', reason: `Script error: ${stderr.slice(0, 500)}` };
  }

  const score = result.verdict === 'PASS' ? 1.0
    : result.verdict === 'PARTIAL' ? 0.5
    : 0.0;

  details.push({
    id: scenario.id,
    weight: scenario.weight,
    score,
    verdict: result.verdict,
    reason: result.reason || ''
  });

  weightedSum += score * scenario.weight;
  totalWeight += scenario.weight;
}

const finalScore = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;
const passed = finalScore >= 85;

const report = { score: finalScore, passed, totalWeight, details };
console.log(JSON.stringify(report, null, 2));
process.exit(passed ? 0 : 1);
