// ===== Option C Enhanced server.js — Part 1 of 5 =====
// Core imports, static server, WebSocket setup, base state, parameters

const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;

// ----------------------------------------------
// Static File Server
// ----------------------------------------------
const server = http.createServer((req, res) => {
  let filePath = req.url;
  if (filePath === '/' || filePath === '') filePath = '/host.html';
  if (filePath === '/host') filePath = '/host.html';
  if (filePath === '/student') filePath = '/student.html';

  const fullPath = path.join(__dirname, 'public', decodeURI(filePath));
  if (!fullPath.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(fullPath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8'
    };
    res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain; charset=utf-8' });
    res.end(content);
  });
});

// ----------------------------------------------
// WebSocket Server Setup
// ----------------------------------------------
const wss = new WebSocket.Server({ server });

// Color palette for firm identity
const palette = [
  '#2563eb','#16a34a','#dc2626','#f59e0b','#06b6d4',
  '#a855f7','#f97316','#ec4899','#10b981','#3b82f6','#ef4444'
];

// Random normal utility
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function safeNum(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

// ----------------------------------------------
// Option C PARAMETERS — extended dynamic oligopoly
// ----------------------------------------------
const defaultParams = {
  // Market-level parameters
  baseDemand: 120,
  brandLiftMarket: 5,
  priceDragMarket: 3,

  // Utility weights
  betaBrand: 0.8,
  betaPrice: 0.6,
  betaAd: 0.5,

  // Brand capital persistence
  brandPersistence: 0.8,

  // Costs
  fixedCost: 15,
  variableCost: 2.5,
  convexCost: 0.04,

  // Advertising costs
  adCostLinear: 1.2,
  adCostQuadratic: 0.15,

  // Brand investment cost
  brandCostLinear: 1.0,
  brandCostQuadratic: 0.2,

  // Capacity investment cost
  investmentCostLinear: 3.0,
  investmentCostQuadratic: 0.15,

  // Capital depreciation
  capacityDepreciation: 0.03,

  // Demand shocks
  shockMean: 0,
  shockStd: 15,

  // Scale economies (market domination)
  scaleEconomy: 0.15, // reduces variable cost proportional to market share

  // Experience curve
  experienceRate: 0.0008 // cost reduction per cumulative sales
};

// ----------------------------------------------
// GAME STATE
// ----------------------------------------------
const state = {
  round: 1,
  params: { ...defaultParams },
  firms: {}, // id → { id, name, color, brandStock, adStock, capacity, cumulativeSales, wsId, connected }
  choices: {}, // id → { price, quantity, brand, ad, invest, submitted }
  history: [],
  nextFirmId: 1,
  hostClients: new Set(),
  studentClients: new Map() // ws → firmId
};

// Utility function to broadcast to all
function broadcast(msg) {
  const data = JSON.stringify(msg);
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  });
}

function send(ws, msg) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// ----------------------------------------------
// PUBLIC STATE FOR CLIENTS
// ----------------------------------------------
function getPublicState() {
  const firmsArray = Object.values(state.firms).map(f => ({
    id: f.id,
    name: f.name,
    color: f.color,
    brandStock: + (f.brandStock || 0).toFixed(2),
    adStock: + (f.adStock || 0).toFixed(2),
    capacity: + (f.capacity || 0).toFixed(2),
    cumulativeSales: + (f.cumulativeSales || 0).toFixed(2),
    connected: !!f.connected
  }));

  return {
    round: state.round,
    params: state.params,
    firms: firmsArray,
    choices: state.choices,
    history: state.history
  };
}

// ----------------------------------------------
// RESET LOGIC
// ----------------------------------------------
function resetGame(hard = false) {
  state.round = 1;
  state.history = [];

  if (hard) {
    for (const [ws, fid] of state.studentClients.entries()) {
      try { send(ws, { type: 'kicked' }); } catch {}
      try { ws.close(); } catch {}
    }
    state.studentClients.clear();
    state.firms = {};
    state.choices = {};
    state.nextFirmId = 1;
  } else {
    Object.values(state.firms).forEach(f => {
      f.brandStock = 5;
      f.adStock = 5;
      f.capacity = 25;
    });

    state.choices = {};
    Object.values(state.firms).forEach(f => {
      state.choices[f.id] = {
        price: 10,
        quantity: 20,
        brand: 5,
        ad: 5,
        invest: 0,
        submitted: false
      };
    });
  }
}

// ===== END OF PART 1 =====
// ===== Option C Enhanced server.js — Part 2 of 5 =====
// Core computeResults() engine

function computeResults() {
  const P = state.params;
  const firmList = Object.values(state.firms);
  if (firmList.length === 0) return null;

  // --- Effective Brand & Advertising Capital ---
  const effectiveBrand = {};
  const effectiveAd = {};
  firmList.forEach(f => {
    const ch = state.choices[f.id] || {};
    const bInv = Math.max(0, safeNum(ch.brand));
    const adInv = Math.max(0, safeNum(ch.ad));

    // Stocks from previous rounds
    const prevB = safeNum(f.brandStock, 0);
    const prevA = safeNum(f.adStock, 0);

    effectiveBrand[f.id] = P.brandPersistence * prevB + bInv;
    effectiveAd[f.id] = P.brandPersistence * prevA + adInv;
  });

  // --- Averages ---
  let avgPrice = 0, avgBrandEff = 0;
  firmList.forEach(f => {
    avgPrice += safeNum(state.choices[f.id]?.price);
    avgBrandEff += effectiveBrand[f.id];
  });
  avgPrice /= firmList.length;
  avgBrandEff /= firmList.length;

  // --- Market demand with shock ---
  const demandBaseline = P.baseDemand +
    P.brandLiftMarket * avgBrandEff -
    P.priceDragMarket * avgPrice;

  const shock = P.shockStd > 0 ? (P.shockMean + P.shockStd * randn()) : P.shockMean;
  const marketDemand = Math.max(0, demandBaseline + shock);

  // --- Utility and shares ---
  const utils = firmList.map(f => {
    const ch = state.choices[f.id] || {};
    const p = safeNum(ch.price);
    const B = effectiveBrand[f.id];
    const A = effectiveAd[f.id];
    return P.betaBrand * B - P.betaPrice * p + P.betaAd * A;
  });
  const maxU = Math.max(...utils);
  const expU = utils.map(u => Math.exp(u - maxU));
  const denom = expU.reduce((a, b) => a + b, 0) || 1;

  // --- Compute outcomes per firm ---
  const firmOutcomes = firmList.map((f, idx) => {
    const ch = state.choices[f.id] || {};

    const p = Math.max(0, safeNum(ch.price));
    const qRaw = Math.max(0, Math.floor(safeNum(ch.quantity)));
    const bInv = Math.max(0, safeNum(ch.brand));
    const adInv = Math.max(0, safeNum(ch.ad));
    const invest = Math.max(0, safeNum(ch.invest));

    const B = effectiveBrand[f.id];
    const A = effectiveAd[f.id];
    const share = expU[idx] / denom;
    const demanded = share * marketDemand;

    // Capacity constraint
    const q = Math.min(qRaw, f.capacity || 0);
    const sales = Math.min(q, demanded);

    // Experience curve adjustment
    const expReduction = P.experienceRate * (f.cumulativeSales || 0);
    let varCost = Math.max(0.1, P.variableCost * (1 - expReduction));

    // Scale/dominance cost reduction
    const dominanceBoost = P.scaleEconomy * share;
    varCost = Math.max(0.1, varCost * (1 - dominanceBoost));

    // Cost components
    const fixed = P.fixedCost;
    const prodCost = varCost * q + P.convexCost * q * q;
    const brandCost = P.brandCostLinear * bInv + P.brandCostQuadratic * bInv * bInv;
    const adCost = P.adCostLinear * adInv + P.adCostQuadratic * adInv * adInv;
    const investCost = P.investmentCostLinear * invest + P.investmentCostQuadratic * invest * invest;

    const cost = fixed + prodCost + brandCost + adCost + investCost;
    const revenue = p * sales;
    const profit = revenue - cost;
    const leftover = Math.max(0, q - sales);

    return {
      id: f.id,
      name: f.name,
      p: +p.toFixed(2),
      q,
      bInvest: +bInv.toFixed(2),
      adInvest: +adInv.toFixed(2),
      invest: +invest.toFixed(2),
      bEff: +B.toFixed(2),
      aEff: +A.toFixed(2),
      share,
      demanded,
      sales,
      leftover,
      cost: +cost.toFixed(2),
      revenue: +revenue.toFixed(2),
      profit: +profit.toFixed(2)
    };
  });

  const totalSales = firmOutcomes.reduce((a, o) => a + o.sales, 0);
  const avgProfit = firmOutcomes.reduce((a, o) => a + o.profit, 0) / firmList.length;

  // --- Update stocks for next round ---
  firmOutcomes.forEach(o => {
    const f = state.firms[o.id];
    const ch = state.choices[o.id] || {};

    // Update brand & advertising capital
    f.brandStock = effectiveBrand[o.id];
    f.adStock = effectiveAd[o.id];

    // Update capacity
    const invest = Math.max(0, safeNum(ch.invest));
    f.capacity = (1 - P.capacityDepreciation) * f.capacity + invest;

    // Update cumulative sales
    f.cumulativeSales = (f.cumulativeSales || 0) + o.sales;
  });

  // --- Save history ---
  const results = {
    avgPrice: +avgPrice.toFixed(2),
    avgBrandEff: +avgBrandEff.toFixed(2),
    demandBaseline: +demandBaseline.toFixed(2),
    shock: +shock.toFixed(2),
    marketDemand: +marketDemand.toFixed(2),
    totalSales: +totalSales.toFixed(2),
    avgProfit: +avgProfit.toFixed(2),
    firmOutcomes
  };

  state.history.push({ round: state.round, summary: results, firmOutcomes });
  state.round += 1;

  return results;
}

// ===== END OF PART 2 =====
// ===== Option C Enhanced server.js — Part 3 of 5 =====
// WebSocket handlers: join, choice updates, host commands, round control

// Handle WebSocket connections
wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => ws.isAlive = true);

  ws.on('message', (data) => {
    let msg = {};
    try { msg = JSON.parse(data); } catch { return; }
    const t = msg.type;

    // -------------------------------
    // Host joins
    // -------------------------------
    if (t === 'join' && msg.role === 'host') {
      state.hostClients.add(ws);
      send(ws, { type: 'state', payload: getPublicState() });
      return;
    }

    // -------------------------------
    // Student joins
    // -------------------------------
    if (t === 'join' && msg.role === 'student') {
      const name = String(msg.name || ('Firm ' + state.nextFirmId)).slice(0,60);
      const id = state.nextFirmId++;
      const color = palette[(id - 1) % palette.length];

      state.firms[id] = {
        id,
        name,
        color,
        brandStock: 5,
        adStock: 5,
        capacity: 25,
        cumulativeSales: 0,
        wsId: Date.now() + ':' + Math.random().toString(36).slice(2),
        connected: true
      };

      state.choices[id] = {
        price: 10,
        quantity: 20,
        brand: 5,
        ad: 5,
        invest: 0,
        submitted: false
      };

      state.studentClients.set(ws, id);

      send(ws, { type: 'joined', payload: { firmId: id, color } });
      broadcast({ type: 'state', payload: getPublicState() });
      return;
    }

    // -------------------------------
    // Host modifies parameters
    // -------------------------------
    if (t === 'set_params') {
      if (!state.hostClients.has(ws)) return;
      state.params = { ...state.params, ...(msg.params || {}) };
      broadcast({ type: 'state', payload: getPublicState() });
      return;
    }

    // -------------------------------
    // Reset game
    // -------------------------------
    if (t === 'reset_game') {
      if (!state.hostClients.has(ws)) return;
      const hard = !!msg.hard;
      resetGame(hard);
      broadcast({ type: 'state', payload: getPublicState() });
      return;
    }

    // -------------------------------
    // Student updates choices
    // -------------------------------
    if (t === 'choice_update') {
      const fid = state.studentClients.get(ws);
      if (!fid) return;
      const ch = state.choices[fid] || {};
      ch.price = safeNum(msg.choice?.price, ch.price);
      ch.quantity = Math.max(0, Math.floor(safeNum(msg.choice?.quantity, ch.quantity)));
      ch.brand = Math.max(0, safeNum(msg.choice?.brand, ch.brand));
      ch.ad = Math.max(0, safeNum(msg.choice?.ad, ch.ad));
      ch.invest = Math.max(0, safeNum(msg.choice?.invest, ch.invest));
      ch.submitted = false;
      state.choices[fid] = ch;
      broadcast({ type: 'state', payload: getPublicState() });
      return;
    }

    // -------------------------------
    // Student submits choices
    // -------------------------------
    if (t === 'choice_submit') {
      const fid = state.studentClients.get(ws);
      if (!fid) return;
      const ch = state.choices[fid] || {};
      ch.submitted = true;
      state.choices[fid] = ch;
      broadcast({ type: 'state', payload: getPublicState() });
      return;
    }

    // -------------------------------
    // Host kicks a firm
    // -------------------------------
    if (t === 'kick_firm') {
      if (!state.hostClients.has(ws)) return;
      const id = Number(msg.id);
      if (!Number.isFinite(id) || !state.firms[id]) {
        send(ws, { type: 'error', message: 'Unknown firm id' });
        return;
      }

      for (const [client, fid] of Array.from(state.studentClients.entries())) {
        if (fid === id) {
          try { send(client, { type: 'kicked' }); } catch {}
          try { client.close(); } catch {}
          state.studentClients.delete(client);
        }
      }

      delete state.firms[id];
      delete state.choices[id];
      broadcast({ type: 'state', payload: getPublicState() });
      return;
    }

    // -------------------------------
    // Host computes round
    // -------------------------------
    if (t === 'compute_round') {
      if (!state.hostClients.has(ws)) return;
      const results = computeResults();
      if (results) {
        broadcast({ type: 'results', payload: { results, state: getPublicState() } });
      } else {
        send(ws, { type: 'error', message: 'No firms connected.' });
      }
      return;
    }

    // -------------------------------
    // Host exports CSV
    // -------------------------------
    if (t === 'export_csv') {
      if (!state.hostClients.has(ws)) return;
      const csv = csvFromHistory();
      send(ws, { type: 'csv_data', payload: { csv } });
      return;
    }
  });

  ws.on('close', () => {
    if (state.hostClients.has(ws)) state.hostClients.delete(ws);

    const fid = state.studentClients.get(ws);
    if (fid) {
      state.studentClients.delete(ws);
      if (state.firms[fid]) state.firms[fid].connected = false;
      broadcast({ type: 'state', payload: getPublicState() });
    }
  });
});

// Heartbeat
setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// ===== END OF PART 3 =====
// ===== Option C Enhanced server.js — Part 4 of 5 =====
// CSV export, history utilities, and auxiliary functions

// ----------------------------------------------
// CSV Export Utility
// ----------------------------------------------
function csvFromHistory() {
  const headers = [
    'round','firmId','firmName','price','quantity','brand_invest','ad_invest','capacity_invest',
    'brand_effective','ad_effective','share','demanded','sales','leftover','revenue','cost','profit',
    'avg_price','avg_brand_eff','demand_baseline','shock','market_demand','total_sales','avg_profit'
  ];

  const rows = [headers.join(',')];

  state.history.forEach(h => {
    const s = h.summary;
    h.firmOutcomes.forEach(o => {
      const r = [
        h.round,
        o.id,
        JSON.stringify(o.name || ''),
        o.p,
        o.q,
        o.bInvest,
        o.adInvest,
        o.invest,
        o.bEff,
        o.aEff,
        o.share.toFixed(4),
        o.demanded.toFixed(2),
        o.sales.toFixed(2),
        o.leftover.toFixed(2),
        o.revenue.toFixed(2),
        o.cost.toFixed(2),
        o.profit.toFixed(2),
        s.avgPrice,
        s.avgBrandEff,
        s.demandBaseline,
        s.shock,
        s.marketDemand,
        s.totalSales,
        s.avgProfit
      ];
      rows.push(r.join(','));
    });
  });

  return rows.join('\n');
}

// Additional helper utilities could be added here.

// ===== END OF PART 4 =====
// ===== Option C Enhanced server.js — Part 5 of 5 =====
// Final server startup block and module exports (if needed)

// ----------------------------------------------
// Server Start
// ----------------------------------------------
server.listen(PORT, () => {
  console.log(`Option C Enhanced Local Multiplayer server running on http://localhost:${PORT}`);
  console.log('Host dashboard: /host  |  Student console: /student');
});

// If additional exports are required for testing, they could be added here.
// module.exports = { state, computeResults, csvFromHistory };

// ===== END OF PART 5 =====