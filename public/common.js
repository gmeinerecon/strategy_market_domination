// Shared helpers for host & student
const palette = ['#2563eb','#16a34a','#dc2626','#f59e0b','#06b6d4','#a855f7','#f97316','#ec4899','#10b981','#3b82f6','#ef4444'];

function num(v){ const n = Number(v); return Number.isFinite(n)? n : 0; }

function drawLineChart(canvasId, series, labels, opts = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  // ---- HiDPI Render Fix ----
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  // Resize internal pixel buffer
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  // Normalize drawing space
  ctx.scale(dpr, dpr);

  // ---- Chart Dimensions ----
  const width = rect.width;
  const height = rect.height;
  const padding = 40;

  ctx.clearRect(0, 0, width, height);

  // ---- Axes ----
  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 1;

  // X-axis
  ctx.beginPath();
  ctx.moveTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();

  // Y-axis
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.stroke();

  // ---- Determine Y range ----
  let allValues = [];
  series.forEach(s => allValues.push(...s.data));
  allValues = allValues.filter(v => Number.isFinite(v));

  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);

  const yMin = minVal > 0 ? 0 : minVal;
  const yMax = maxVal;

  const yScale = (height - padding * 2) / (yMax - yMin);

  function yPixel(val) {
    return height - padding - (val - yMin) * yScale;
  }

  // ---- Draw Lines ----
  series.forEach(s => {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;

    ctx.beginPath();
    s.data.forEach((v, i) => {
      if (!Number.isFinite(v)) return;

      const x = padding + (i / (labels.length - 1)) * (width - padding * 2);
      const y = yPixel(v);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });

  // ---- Draw Legend ----
  if (opts.legendId) {
    const legend = document.getElementById(opts.legendId);
    if (legend) {
      legend.innerHTML = "";
      series.forEach(s => {
        const item = document.createElement("div");
        item.style.display = "flex";
        item.style.alignItems = "center";
        item.style.gap = "6px";
        item.innerHTML = `
          <div style="width:14px;height:14px;border-radius:3px;
               background:${s.color};border:1px solid #94a3b8"></div>
          <span>${s.label}</span>`;
        legend.appendChild(item);
      });
    }
  }
}

function download(filename, text) {
  const blob = new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
}
