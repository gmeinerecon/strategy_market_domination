// Shared helpers for host & student
const palette = ['#2563eb','#16a34a','#dc2626','#f59e0b','#06b6d4','#a855f7','#f97316','#ec4899','#10b981','#3b82f6','#ef4444'];

function num(v){ const n = Number(v); return Number.isFinite(n)? n : 0; }

function drawLineChart(canvasId, series, labels, opts={}){
  const canvas = document.getElementById(canvasId);
  if(!canvas) return; const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);
  const pad = {l: 64, r: 12, t: 24, b: 36};
  const w = W - pad.l - pad.r, h = H - pad.t - pad.b;

  const all = series.flatMap(s => s.data.filter(Number.isFinite));
  let minY = Math.min(...all), maxY = Math.max(...all);
  if(!Number.isFinite(minY) || !Number.isFinite(maxY)) { minY = 0; maxY = 1; }
  if(minY === maxY) { maxY = minY + 1; }
  const span = maxY - minY; minY -= span*0.05; maxY += span*0.05;

  // axes + axis titles
  ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t+h); ctx.lineTo(pad.l+w, pad.t+h); ctx.stroke();
  ctx.fillStyle = '#475569'; ctx.font = '12px system-ui';
  if(opts.yTitle){ ctx.save(); ctx.translate(16, pad.t+h/2); ctx.rotate(-Math.PI/2); ctx.textAlign='center'; ctx.fillText(opts.yTitle, 0,0); ctx.restore(); }
  if(opts.xTitle){ ctx.textAlign='center'; ctx.fillText(opts.xTitle, pad.l+w/2, pad.t+h+28); }

  // grid lines
  ctx.strokeStyle = '#e5e7eb'; ctx.setLineDash([4,4]);
  for(let i=1;i<=4;i++){
    const y = pad.t + (h*i/5); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l+w, y); ctx.stroke();
  }
  ctx.setLineDash([]);

  // y labels
  ctx.fillStyle = '#475569'; ctx.textAlign='right';
  const yVals = [maxY, (maxY+minY)/2, minY];
  yVals.forEach((v, idx)=>{ const y = pad.t + (idx===0?0: idx===1?h/2: h); ctx.fillText(v.toFixed(1), pad.l-6, y+4); });

  // x labels
  ctx.textAlign='center';
  const n = labels.length; const xMap = (i,n)=> pad.l + (n<=1? 0 : (w * i / (n-1)));
  for(let i=0;i<n;i++){ const x = xMap(i,n); const lab = labels[i]; if(i%Math.ceil(n/10)===0 || i===n-1){ ctx.fillText(lab, x, pad.t+h+18); } }

  const yMap = (y)=> pad.t + h - ( (y - minY) / (maxY - minY) ) * h;

  series.forEach((s)=>{
    const color = s.color || '#2563eb';
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
    let started = false;
    s.data.forEach((v,i)=>{
      if(!Number.isFinite(v)) { started = false; return; }
      const x = xMap(i, n); const y = yMap(v);
      if(!started){ ctx.moveTo(x,y); started = true; } else { ctx.lineTo(x,y); }
    });
    ctx.stroke();
  });

  // legend
  const legendEl = document.getElementById(opts.legendId||'');
  if(legendEl){
    legendEl.innerHTML='';
    series.forEach(s=>{
      const item = document.createElement('div'); item.className='legend-item';
      const sw = document.createElement('div'); sw.className='legend-swatch'; sw.style.background = s.color||'#2563eb';
      const label = document.createElement('div'); label.textContent = s.label || 'Series';
      item.appendChild(sw); item.appendChild(label); legendEl.appendChild(item);
    });
  }
}

function download(filename, text) {
  const blob = new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
}
