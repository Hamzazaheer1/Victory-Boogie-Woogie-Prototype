// Victory Boogie Woogie – Prototype v4
// Mondrian-style STOP-ON-BALANCE + PATTERN AWARE COMPLETION

// =====================
// CONFIG
// =====================

const CELL = 20;
const BASE_BG = 240;

const PALETTE = ["#f2c500", "#d62828", "#1f3c88", "#f5f5f5"];
const WEIGHTS = [30, 25, 15, 30];

const LARGE_AREA_WHITE_THRESHOLD = 140 * 140;

// Mondrian balance constraints
const MIN_WHITE = 0.3;
const MAX_WHITE = 0.55;
const MAX_COLOR_DOMINANCE = 0.35;
const MAX_FILL_JUMP = 0.15;

// Deterministic seed
const SEED = "demo-seed-001";

// =====================
// STATE
// =====================

let rng;
let grid;
let baseP5;
let generatedP5;

// =====================
// P5 SETUP
// =====================

function setup() {
  const { width, height } = MONDRIAN_DATA.canvas;

  // ---------- BASE (Protected) ----------
  const baseContainer = document.getElementById("base-canvas");
  baseP5 = new p5((p) => {
    p.setup = () => {
      p.createCanvas(width, height).parent(baseContainer);
      p.noLoop();
      drawBaseCanvas(p);
    };
  });

  // ---------- GENERATED (Completion) ----------
  const generatedContainer = document.getElementById("generated-canvas");
  generatedP5 = new p5((p) => {
    p.setup = () => {
      p.createCanvas(width, height).parent(generatedContainer);
      p.noLoop();
      runPipeline(p);
    };
  });
}

function keyPressed() {
  if (key === "r" || key === "R") {
    if (baseP5) drawBaseCanvas(baseP5);
    if (generatedP5) runPipeline(generatedP5);
  }
}

// =====================
// PIPELINE
// =====================

function drawBaseCanvas(p) {
  p.background(BASE_BG);
  drawProtected(p, MONDRIAN_DATA.protected);
}

function runPipeline(p) {
  const { width: W, height: H } = MONDRIAN_DATA.canvas;

  // 🔑 reset RNG every run (determinism guaranteed)
  rng = makeRngFromString(SEED);

  p.background(BASE_BG);

  // 1) Protected layer
  drawProtected(p, MONDRIAN_DATA.protected);

  // 2) Grid occupancy
  initGrid(W, H, CELL);
  stampProtectedToGrid(MONDRIAN_DATA.protected, CELL);

  // 3) Void detection
  const voidRects = findMergedVoids(W, H, CELL);

  // 4) Pattern-aware Mondrian completion
  const filledRects = fillVoidsWithStop(p, voidRects, W, H);

  // 5) Protected redraw (authority)
  drawProtected(p, MONDRIAN_DATA.protected);

  // 6) Subtle grain
  applyLightGrain(p, 1400);

  // 7) Report
  printFinalReport(filledRects, W, H);
}

// =====================
// RENDERING
// =====================

function drawProtected(p, shapes) {
  p.noStroke();
  for (const r of shapes) {
    p.fill(r.color);
    p.rect(r.x, r.y, r.w, r.h);
  }
}

// =====================
// GRID LOGIC
// =====================

function initGrid(width, height, cell) {
  const cols = Math.floor(width / cell);
  const rows = Math.floor(height / cell);
  grid = Array.from({ length: cols }, () =>
    Array.from({ length: rows }, () => false)
  );
}

function stampProtectedToGrid(shapes, cell) {
  const cols = grid.length;
  const rows = grid[0].length;

  for (const r of shapes) {
    const x0 = clamp(Math.floor(r.x / cell), 0, cols);
    const y0 = clamp(Math.floor(r.y / cell), 0, rows);
    const x1 = clamp(Math.ceil((r.x + r.w) / cell), 0, cols);
    const y1 = clamp(Math.ceil((r.y + r.h) / cell), 0, rows);

    for (let x = x0; x < x1; x++) {
      for (let y = y0; y < y1; y++) {
        grid[x][y] = true;
      }
    }
  }
}

// =====================
// VOID MERGING
// =====================

function findMergedVoids(width, height, cell) {
  const cols = grid.length;
  const rows = grid[0].length;
  const used = Array.from({ length: cols }, () =>
    Array.from({ length: rows }, () => false)
  );

  const rects = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[x][y] || used[x][y]) continue;

      let maxW = 1;
      while (x + maxW < cols && !grid[x + maxW][y]) maxW++;

      let maxH = 1;
      outer: while (y + maxH < rows) {
        for (let k = 0; k < maxW; k++) {
          if (grid[x + k][y + maxH]) break outer;
        }
        maxH++;
      }

      for (let dx = 0; dx < maxW; dx++) {
        for (let dy = 0; dy < maxH; dy++) {
          used[x + dx][y + dy] = true;
        }
      }

      rects.push({
        x: x * cell,
        y: y * cell,
        w: maxW * cell,
        h: maxH * cell,
      });
    }
  }

  return rects;
}

// =====================
// PATTERN RULE HELPERS
// =====================

function classifyRect(r) {
  const area = r.w * r.h;
  if (area <= CELL * CELL * 2) return "small";
  if (area >= CELL * CELL * 10) return "large";
  return "medium";
}

function isLongThin(r) {
  return r.w >= r.h * 4 || r.h >= r.w * 4;
}

function areAdjacent(a, b) {
  const touchX = a.x + a.w === b.x || b.x + b.w === a.x;
  const overlapY = a.y < b.y + b.h && a.y + a.h > b.y;
  const touchY = a.y + a.h === b.y || b.y + b.h === a.y;
  const overlapX = a.x < b.x + b.w && a.x + a.w > b.x;
  return (touchX && overlapY) || (touchY && overlapX);
}

function isPatternAllowed(rects) {
  const last = rects[rects.length - 1];
  const type = classifyRect(last);

  // Rule 1: small rectangles must cluster
  if (type === "small") {
    const recent = rects.slice(-3);
    const smallCount = recent.filter((r) => classifyRect(r) === "small").length;
    if (smallCount < 2) return false;
  }

  // Rule 2: large blocks isolated
  if (type === "large") {
    for (let i = 0; i < rects.length - 1; i++) {
      if (classifyRect(rects[i]) === "large" && areAdjacent(rects[i], last)) {
        return false;
      }
    }
  }

  return true;
}

// =====================
// MONDRIAN STOP-ON-BALANCE
// =====================

function fillVoidsWithStop(p, rects, W, H) {
  const ordered = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);
  const filled = [];
  let prevMetrics = null;

  for (const r of ordered) {
    const area = r.w * r.h;
    const color =
      area > LARGE_AREA_WHITE_THRESHOLD
        ? "#f5f5f5"
        : weightedPick(PALETTE, WEIGHTS);

    const candidate = { ...r, color };
    const proposal = [...filled, candidate];

    if (!isPatternAllowed(proposal)) continue;

    const metrics = evaluateMetrics(proposal, W, H);
    if (!isImprovement(metrics, prevMetrics)) break;

    filled.push(candidate);
    prevMetrics = metrics;

    p.fill(color);
    p.noStroke();
    p.rect(r.x, r.y, r.w, r.h);
  }

  return filled;
}

// =====================
// METRICS
// =====================

function evaluateMetrics(rects, W, H) {
  const total = W * H;
  let filledArea = 0;
  let whiteArea = 0;
  const colorAreas = {};

  for (const r of rects) {
    const a = r.w * r.h;
    filledArea += a;
    colorAreas[r.color] = (colorAreas[r.color] || 0) + a;
    if (r.color === "#f5f5f5") whiteArea += a;
  }

  const maxColorRatio = Object.values(colorAreas).length
    ? Math.max(...Object.values(colorAreas)) / total
    : 0;

  return {
    filledRatio: filledArea / total,
    whiteRatio: whiteArea / total,
    maxColorRatio,
  };
}

function isImprovement(next, prev) {
  if (!prev) return true;
  if (next.whiteRatio < MIN_WHITE) return false;
  if (next.whiteRatio > MAX_WHITE) return false;
  if (next.maxColorRatio > MAX_COLOR_DOMINANCE) return false;
  if (next.filledRatio - prev.filledRatio > MAX_FILL_JUMP) return false;
  return true;
}

// =====================
// TEXTURE
// =====================

function applyLightGrain(p, n) {
  p.noStroke();
  for (let i = 0; i < n; i++) {
    const x = Math.floor(rng.float() * p.width);
    const y = Math.floor(rng.float() * p.height);
    p.fill(0, 0, 0, rng.int(2, 7));
    p.rect(x, y, 1, 1);
  }
}

// =====================
// UTILS
// =====================

function weightedPick(items, weights) {
  let total = weights.reduce((a, b) => a + b, 0);
  let r = rng.float() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function printFinalReport(rects, W, H) {
  const m = evaluateMetrics(rects, W, H);
  console.log("=== FINAL REPORT ===");
  console.table({
    filled_ratio: round3(m.filledRatio),
    white_ratio: round3(m.whiteRatio),
    max_color_ratio: round3(m.maxColorRatio),
    filled_rects: rects.length,
  });
}

function round3(v) {
  return Math.round(v * 1000) / 1000;
}
