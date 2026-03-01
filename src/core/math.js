export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function cross2(o, a, b) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

export function convexHull(points) {
  if (!points || points.length < 3) return points || [];
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross2(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross2(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

export function polygonPath(ctx, cx, cy, radius, sides, rot) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    const px = cx + Math.cos(a) * radius;
    const py = cy + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function polygonFromPoints(ctx, points) {
  if (!points || points.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
}

export function angleDiff(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

export function seeded01(seed, i = 0) {
  const s = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return s - Math.floor(s);
}
