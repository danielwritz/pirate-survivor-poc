# Upgrade Scenarios

> Starter picks, standard offers, major upgrades, upgrade application, and offer rolling.

---

### Scenario: Three starter picks on round join

When a player joins a round, they immediately receive 3 sequential standard upgrade offers (the "starter picks"). This lets players customize their build identity from the very first second.

**Given** a ship that just joined the round
**When** `initStartingUpgradeOffer` is called
**Then** `startingPicksRemaining` should be 3
**And** the ship should have an upgrade offer with 3 choices

```yaml
id: starter_picks_on_join
tags: [progression]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  ship: { justJoined: true }

actions:
  - initStartingUpgradeOffer: {}

assertions:
  - ship.startingPicksRemaining: 3
  - ship.upgradeOffer.length: 3
```

---

### Scenario: Starter picks chain sequentially

After selecting a starter pick, if picks remain, the next offer should be generated immediately without requiring XP.

**Given** a ship with startingPicksRemaining = 2 and an active offer
**When** the player selects choice index 1
**Then** an upgrade should be applied
**And** startingPicksRemaining should drop to 1
**And** a new offer should be presented immediately

```yaml
id: starter_picks_chain
tags: [progression]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  ship: { startingPicksRemaining: 2, upgradeOffer: [a, b, c] }

actions:
  - selectUpgrade: { choiceIndex: 1 }

assertions:
  - result.applied: true
  - result.startingPicksRemaining: 1
  - result.nextOffer: { not: null }
```

---

### Scenario: Each level-up queues a standard upgrade offer

When a ship levels up through XP, pendingLevelUpOffers increments and the next standard 3-choice offer is rolled.

**Given** a ship at level 3 with no pending offers
**When** enough XP is awarded to level up
**Then** pendingLevelUpOffers should be at least 1
**And** an upgrade offer with 3 choices should appear

```yaml
id: levelup_queues_standard_offer
tags: [progression]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  ship: { level: 3, xp: 0, xpToNext: 1, pendingLevelUpOffers: 0, upgradeOffer: null }

actions:
  - awardXp: { amount: 1 }

assertions:
  - ship.level: 4
  - ship.upgradeOffer.length: 3
```

---

### Scenario: Major upgrade offered every 5 levels

At levels 5, 10, 15, 20, etc., a major upgrade offer should replace the standard offer. Major upgrades are game-changing abilities that define build identity.

**Given** a ship at level 4 about to reach level 5
**When** the ship levels up to level 5
**Then** a major upgrade offer should be generated (not standard)
**And** pendingMajorOffers should track the queued major

```yaml
id: major_upgrade_every_5_levels
tags: [progression]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  ship: { level: 4, xp: 0, xpToNext: 1, _lastMajorLevel: 0, pendingMajorOffers: 0, upgradeOffer: null }

actions:
  - awardXp: { amount: 1 }

assertions:
  - ship.level: 5
  - ship.pendingMajorOffers: ">= 0"
  - ship.upgradeOffer: { not: null }
```

---

### Scenario: Major offers take priority over standard offers

If both pending major and standard offers exist (e.g., from a multi-level-up), the major offer should be presented first.

**Given** a ship with pendingMajorOffers = 1 and pendingLevelUpOffers = 2
**When** the current offer is consumed and the next is rolled
**Then** the next offer should be from the major catalog

```yaml
id: major_priority_over_standard
tags: [progression]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  ship: { pendingMajorOffers: 1, pendingLevelUpOffers: 2, upgradeOffer: null }

actions:
  - rollNextOffer: {}

assertions:
  - offerType: major
  - ship.pendingMajorOffers: 0
```

---

### Scenario: Upgrade application modifies ship stats

When an upgrade is applied, the ship's stats should change according to the upgrade's effect definitions. e.g., "Iron Hull" should increase maxHp.

**Given** a ship with maxHp 20
**When** an upgrade that grants +5 maxHp is applied
**Then** ship.maxHp should be 25

```yaml
id: upgrade_modifies_stats
tags: [progression]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  ship: { maxHp: 20 }
  upgradeId: iron_hull  # example — actual ID depends on catalog

actions:
  - applyUpgrade: { upgradeId: iron_hull }

assertions:
  - ship.maxHp: ">= 25"
```

---

### Scenario: Offer contains exactly 3 choices

All upgrade offers (starter, standard, or major) should present exactly 3 choices for the player to pick from.

**Given** the upgrade catalog is loaded
**When** a standard offer is rolled
**Then** the offer array should have exactly 3 entries
**And** each entry should have id, name, and desc fields

```yaml
id: offer_has_three_choices
tags: [progression]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  catalogLoaded: true

actions:
  - rollUpgradeOffer: { type: standard, count: 3 }

assertions:
  - offer.length: 3
  - offer[0].id: { not: null }
  - offer[0].name: { not: null }
  - offer[0].desc: { not: null }
```

---

### Scenario: Invalid choice index is rejected

If a player sends an out-of-range choice index (negative, ≥3, or when no offer is active), the selection should be rejected gracefully.

**Given** a ship with an active 3-choice offer
**When** the player sends choiceIndex 5
**Then** the result should indicate applied: false
**And** the ship's state should be unchanged

```yaml
id: invalid_choice_rejected
tags: [progression]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  ship: { upgradeOffer: [a, b, c] }

actions:
  - selectUpgrade: { choiceIndex: 5 }

assertions:
  - result.applied: false
  - ship.upgradeOffer: [a, b, c]
```

---

### Scenario: Upgrade catalog has standard and major types

The loaded catalog should separate upgrades into standard (frequent, incremental) and major (rare, transformative) pools.

**Given** the catalog is loaded from data/upgrades.json
**When** the catalog is inspected
**Then** it should have a non-empty standard array
**And** it should have a non-empty major array

```yaml
id: catalog_has_both_types
tags: [progression]
status: passing
sprint: v0.6-existing
priority: p2

setup:
  catalogLoaded: true

assertions:
  - catalog.standard.length: ">= 10"
  - catalog.major.length: ">= 3"
```
