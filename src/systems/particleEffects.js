(function () {
  function normalizeOr(x, y, fallbackX = 1, fallbackY = 0) {
    const len = Math.hypot(x, y);
    if (!Number.isFinite(len) || len <= 0.00001) return { x: fallbackX, y: fallbackY };
    return { x: x / len, y: y / len };
  }

  function createMuzzleBlastParticles(x, y, dirX, dirY, cannon = false) {
    const particles = [];
    const dir = normalizeOr(dirX, dirY, 1, 0);
    const smokeCount = cannon ? 14 : 7;
    const emberCount = cannon ? 5 : 2;
    const smokeColors = ['#4b4f55', '#707780', '#8c939d', '#555b63'];
    const emberColors = ['#f3c46a', '#f08b42', '#de543c'];

    for (let i = 0; i < smokeCount; i++) {
      const ang = Math.atan2(dir.y, dir.x) + (Math.random() - 0.5) * (cannon ? 0.75 : 0.95);
      const speed = (cannon ? 1.15 : 0.75) + Math.random() * (cannon ? 1.15 : 0.85);
      const life = (cannon ? 0.28 : 0.18) + Math.random() * (cannon ? 0.26 : 0.16);
      const color = smokeColors[Math.floor(Math.random() * smokeColors.length)];
      particles.push({
        x: x + dir.x * (cannon ? 4 : 2) + (Math.random() - 0.5) * 2,
        y: y + dir.y * (cannon ? 4 : 2) + (Math.random() - 0.5) * 2,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        size: (cannon ? 2.8 : 1.7) + Math.random() * (cannon ? 2.6 : 1.6),
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * (cannon ? 0.35 : 0.25),
        life,
        maxLife: life,
        color,
        sides: Math.random() < 0.5 ? 4 : 5,
        drift: (cannon ? 0.08 : 0.06) + Math.random() * 0.12
      });
    }

    for (let i = 0; i < emberCount; i++) {
      const ang = Math.atan2(dir.y, dir.x) + (Math.random() - 0.5) * (cannon ? 0.42 : 0.56);
      const speed = (cannon ? 1.8 : 1.1) + Math.random() * (cannon ? 1.6 : 1.0);
      const life = (cannon ? 0.12 : 0.08) + Math.random() * 0.1;
      const color = emberColors[Math.floor(Math.random() * emberColors.length)];
      particles.push({
        x: x + dir.x * (cannon ? 4.6 : 2.4),
        y: y + dir.y * (cannon ? 4.6 : 2.4),
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        size: (cannon ? 1.7 : 1.0) + Math.random() * (cannon ? 1.4 : 0.9),
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.6,
        life,
        maxLife: life,
        color,
        sides: Math.random() < 0.5 ? 3 : 4,
        drift: 0.04 + Math.random() * 0.08
      });
    }

    return particles;
  }

  function getDamageDebrisPalette(target, fallbackHeavy = false) {
    if (!target) {
      return fallbackHeavy
        ? ['#7a5b45', '#8e6b4f', '#5b4535', '#bf7b54']
        : ['#8b745d', '#6f5c4c', '#5a493b', '#a37e61'];
    }

    const hull = target.hullColor || '#6a5748';
    const trim = target.trimColor || '#b8997a';
    const deckBrown1 = '#8a6a4f';
    const deckBrown2 = '#6e5340';
    const darkChip = '#43372e';
    return [hull, trim, deckBrown1, deckBrown2, darkChip];
  }

  function createImpactDebrisParticles(x, y, dirX, dirY, heavy = false, target = null) {
    const particles = [];
    const dir = normalizeOr(dirX, dirY, 1, 0);
    const normal = { x: -dir.x, y: -dir.y };
    const count = heavy ? 22 : 12;
    const palette = getDamageDebrisPalette(target, heavy);

    for (let i = 0; i < count; i++) {
      const ang = Math.atan2(normal.y, normal.x) + (Math.random() - 0.5) * (heavy ? 0.56 : 0.82);
      const speed = (heavy ? 2.0 : 1.2) + Math.random() * (heavy ? 2.6 : 1.6);
      const life = (heavy ? 0.22 : 0.15) + Math.random() * (heavy ? 0.25 : 0.18);
      const color = palette[Math.floor(Math.random() * palette.length)];
      particles.push({
        x: x + normal.x * (heavy ? 2.8 : 1.8),
        y: y + normal.y * (heavy ? 2.8 : 1.8),
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        size: (heavy ? 2.1 : 1.2) + Math.random() * (heavy ? 2.8 : 1.7),
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * (heavy ? 0.58 : 0.42),
        life,
        maxLife: life,
        color,
        sides: Math.random() < 0.45 ? 3 : (Math.random() < 0.6 ? 4 : 5),
        drift: 0.02 + Math.random() * 0.08
      });
    }

    return particles;
  }

  function createDeckBurstParticles(x, y, dirX, dirY, heavy = false) {
    const particles = [];
    const dir = normalizeOr(dirX, dirY, 1, 0);
    const normal = { x: -dir.x, y: -dir.y };
    const count = heavy ? 7 : 4;
    const colors = heavy
      ? ['#ffcf7a', '#f5944b', '#d6523e', '#9a3b2f']
      : ['#ffcd77', '#ee8e46', '#c84c38'];

    for (let i = 0; i < count; i++) {
      const ang = Math.atan2(normal.y, normal.x) + (Math.random() - 0.5) * (heavy ? 0.7 : 0.9);
      const speed = (heavy ? 1.15 : 0.8) + Math.random() * (heavy ? 1.0 : 0.7);
      const life = (heavy ? 0.1 : 0.08) + Math.random() * 0.08;
      particles.push({
        x: x + normal.x * (heavy ? 2.2 : 1.4),
        y: y + normal.y * (heavy ? 2.2 : 1.4),
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        size: (heavy ? 1.5 : 1.0) + Math.random() * (heavy ? 1.2 : 0.8),
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.8,
        life,
        maxLife: life,
        color: colors[Math.floor(Math.random() * colors.length)],
        sides: Math.random() < 0.5 ? 3 : 4,
        drift: 0.03 + Math.random() * 0.06
      });
    }

    return particles;
  }

  window.GameParticleEffects = {
    normalizeOr,
    createMuzzleBlastParticles,
    createImpactDebrisParticles,
    createDeckBurstParticles
  };
})();
