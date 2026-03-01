export function createInitialShipyardState() {
  return {
    active: true,
    freeEdit: true,
    starterPresetChosen: false,
    starterPresetId: null,
    starterPresetRects: [],
    editMode: 'shape',
    pendingCost: 0,
    dragHandle: null,
    dragStart: null,
    baseDesign: null,
    editDesign: null,
    previewScale: 3.2,
    launchRect: null,
    resetRect: null,
    modeRects: {},
    weaponBrush: 'gun',
    slotRects: [],
    brushRects: {},
    crewRects: {},
    message: 'Choose a starter ship preset, then tune it and launch.'
  };
}

export function createGameState() {
  return {
    time: 0,
    gold: 100,
    level: 1,
    xp: 0,
    xpToNext: 10,
    stageIndex: 0,
    stageTimer: 0,
    difficultyTier: 0,
    bossTimer: 0,
    bossesDefeated: 0,
    enemies: [],
    bullets: [],
    drops: [],
    particles: [],
    gameOver: false,
    upgradesOffered: null,
    wind: { x: 0.35, y: -0.12, timer: 0 },
    world: { width: 3600, height: 2600 },
    camera: { x: 0, y: 0 },
    zoom: 1.28,
    rowEffort: 0,
    difficultyFromSize: 0,
    defenseTier: 0,
    shipValueTier: 0,
    goldMagnetBonus: 0,
    anchorNoticeTimer: 0,
    anchorNoticeText: '',
    playerAim: null,
    zoomUserOffset: 0,
    islands: [],
    clouds: [],
    mode: 'shipyard',
    bossSpawnedThisStage: false,
    shipyard: createInitialShipyardState(),
    devtools: {
      visible: false,
      selectedKind: 'pirate',
      spawnOnClick: true,
      cursorWorld: { x: 0, y: 0 }
    }
  };
}
