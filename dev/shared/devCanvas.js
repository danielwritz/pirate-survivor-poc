export function createDevCanvas(host, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = options.width ?? 1200;
  canvas.height = options.height ?? 720;
  canvas.style.width = '100%';
  canvas.style.maxWidth = `${canvas.width}px`;
  canvas.style.height = 'auto';
  canvas.style.display = 'block';
  canvas.style.border = '1px solid #30516b';
  canvas.style.borderRadius = '8px';
  canvas.style.background = options.background ?? '#0a2235';
  host.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  return { canvas, ctx };
}

export function drawGrid(ctx, width, height, spacing = 32) {
  ctx.save();
  ctx.strokeStyle = 'rgba(159,194,217,0.15)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
    ctx.stroke();
  }
  ctx.restore();
}
