/**
 * Scenario: review_major_upgrade_is_triggered (weight: 4)
 * The major upgrade offer should hook into the existing upgrade system.
 */
import { distributeBossKillRewards } from '../../../server/bossDirector.js';
import { createShip } from '../../../shared/shipState.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const failures = [];

const boss = { x: 1000, y: 1000, isBoss: true, hp: 0 };
const killer = createShip(1000, 1050, { id: 1, name: 'Killer' });
killer.doubloons = 0;

distributeBossKillRewards(boss, killer, [killer], 4);

// The killer should have some indication of pending upgrade
const hasMajorFlag = killer.majorOfferTriggered === true;
const hasPendingMajor = (killer.pendingMajorOffers || 0) > 0;
const hasUpgradeOffer = killer.upgradeOffer !== undefined && killer.upgradeOffer !== null;

if (!hasMajorFlag && !hasPendingMajor && !hasUpgradeOffer) {
  failures.push('No indication of major upgrade offer on killer state');
}

// Check that bossDirector.js references upgradeDirector (integration check)
const root = join(import.meta.dirname, '..', '..', '..');
const bdSrc = readFileSync(join(root, 'server/bossDirector.js'), 'utf8');

if (!bdSrc.includes('upgradeDirector') && !bdSrc.includes('triggerMajorOffer')) {
  failures.push('bossDirector.js does not reference upgradeDirector or triggerMajorOffer');
}

// Edge: if player already has a pending upgrade, boss reward should not clobber it
const killer2 = createShip(1000, 1050, { id: 2, name: 'HasOffer' });
killer2.doubloons = 0;
killer2.pendingMajorOffers = 1;
killer2.upgradeOffer = [{ id: 'test', name: 'Test', desc: 'Existing offer' }];

const boss2 = { x: 1000, y: 1000, isBoss: true, hp: 0 };
distributeBossKillRewards(boss2, killer2, [killer2], 4);

// Should still have the offer (not nulled out)
if (killer2.upgradeOffer === null || killer2.upgradeOffer === undefined) {
  failures.push('Existing upgrade offer was clobbered by boss reward');
}

// pendingMajorOffers should have increased (or at least not decreased)
if ((killer2.pendingMajorOffers || 0) < 1) {
  failures.push('pendingMajorOffers decreased after boss reward');
}

if (failures.length === 0) {
  console.log(JSON.stringify({ verdict: 'PASS', reason: 'Major upgrade offer triggered via upgradeDirector integration' }));
} else if (failures.length <= 1) {
  console.log(JSON.stringify({ verdict: 'PARTIAL', reason: failures.join('; ') }));
} else {
  console.log(JSON.stringify({ verdict: 'FAIL', reason: failures.join('; ') }));
}
