/**
 * Scenario: review_existing_tests_still_pass (weight: 5)
 * Constants-only story: all pre-existing tests must still pass.
 */
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', '..', '..');
const failures = [];

try {
  const output = execSync('npm test', {
    cwd: root,
    timeout: 60000,
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: '' }
  });

  // Check for pass indicators
  if (output.includes('FAIL') || output.includes('failed')) {
    // Look for specific test failures
    const failLines = output.split('\n').filter(l =>
      l.includes('FAIL') || l.includes('✗') || l.includes('×')
    );
    failures.push(`Some tests failed: ${failLines.slice(0, 3).join('; ')}`);
  }
} catch (err) {
  const output = (err.stdout || '') + (err.stderr || '');
  if (output.includes('FAIL') || err.status !== 0) {
    const lines = output.split('\n').filter(l =>
      l.includes('FAIL') || l.includes('AssertionError') || l.includes('Error:')
    ).slice(0, 5);
    failures.push(`npm test failed: ${lines.join('; ') || 'exit code ' + err.status}`);
  }
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: 'All existing tests pass with new constants' }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
