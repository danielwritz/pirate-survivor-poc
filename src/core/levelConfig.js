export const LEVEL_CONFIGS = [
  { name: 'Coastal Skirmish', duration: 45, spawnRate: 1.0, bossEvery: 45, windShift: 16 },
  { name: 'Open Waters', duration: 55, spawnRate: 1.2, bossEvery: 50, windShift: 14 },
  { name: 'Storm Belt', duration: 65, spawnRate: 1.45, bossEvery: 55, windShift: 11 },
  { name: 'Kraken Frontier', duration: 75, spawnRate: 1.75, bossEvery: 60, windShift: 9 }
];

export function getLevelConfig(stageIndex) {
  if (stageIndex < LEVEL_CONFIGS.length) {
    return LEVEL_CONFIGS[stageIndex];
  }

  const tail = LEVEL_CONFIGS[LEVEL_CONFIGS.length - 1];
  const extra = stageIndex - LEVEL_CONFIGS.length + 1;

  return {
    name: `Endless ${extra}`,
    duration: Math.max(45, tail.duration - extra * 2),
    spawnRate: tail.spawnRate + extra * 0.22,
    bossEvery: Math.max(38, tail.bossEvery - extra),
    windShift: Math.max(6, tail.windShift - Math.floor(extra * 0.4))
  };
}
