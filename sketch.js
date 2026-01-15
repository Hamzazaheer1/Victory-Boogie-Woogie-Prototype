// ===== CONFIGURATION =====
const CRACK_DENSITY = 0.00008; // extremely low
const CRACK_ALPHA = 22;
const CRACK_WEIGHT = 0.6;
const STROKE_DENSITY = 3.2;
const COLOR_VARIANCE = 6;
const EDGE_WOBBLE = 1.4;

const STROKE_DENSITY_BY_COLOR = {
  "#F0CF00": 1.4, // yellow – very textured
  "#E8BF00": 1.3,
  "#C53018": 0.9, // red – heavier, fewer
  "#1A56A4": 1.0, // blue – balanced
  "#131533": 0.6, // near-black – smooth
  "#CBD5DD": 0.4, // white / off-white – very subtle
  "#EAECEC": 0.35,
  "#D2CDA3": 0.5,
};

// ===== MAIN SETUP =====
// Canvas setup - creates the drawing area
function setup() {
  createCanvas(MONDRIAN_DATA.canvas.width, MONDRIAN_DATA.canvas.height);
  noLoop(); // Draw once (this is static art)
  noStroke(); // Mondrian blocks have no borders
}

// ===== MAIN DRAW LOOP =====
// Draws the entire artwork with diamond clipping mask
function draw() {
  background("#fff");

  // Create diamond clipping mask (only shows art inside diamond shape)
  drawingContext.save();
  drawingContext.beginPath();
  const bounds = getArtBounds();
  const cx = bounds.cx;
  const cy = bounds.cy;
  const r = min(bounds.w, bounds.h) * 0.6;
  drawingContext.moveTo(cx, cy - r);
  drawingContext.lineTo(cx + r, cy);
  drawingContext.lineTo(cx, cy + r);
  drawingContext.lineTo(cx - r, cy);
  drawingContext.closePath();
  drawingContext.clip();

  // Paint all rectangles inside diamond
  for (const rct of MONDRIAN_DATA.protected) {
    paintRect(rct.x, rct.y, rct.w, rct.h, rct.color);
  }

  drawingContext.restore();
}

// ===== PAINT RECTANGLE =====
// Paints a single colored rectangle with various texture effects
// Comment out any line below to disable that effect and test the difference
function paintRect(x, y, w, h, baseColor) {
  baseColor = safeColor(baseColor);

  // EFFECT 1: Base fill - solid color background with slight variation
  applyBaseFill(x, y, w, h, baseColor);

  // EFFECT 2: Brush strokes - directional lines that simulate paint brush texture
  applyBrushStrokes(x, y, w, h, baseColor);

  // EFFECT 3: Paint pooling - subtle dark border that simulates paint edges
  applyPaintPooling(x, y, w, h);

  // EFFECT 4: Micro cracks - small crack lines on large paint areas (aged paint effect)
  drawMicroCracks(x, y, w, h, baseColor);
}

// EFFECT 1: Base fill - solid color background with slight random variation
function applyBaseFill(x, y, w, h, baseColor) {
  noStroke();
  fill(
    red(baseColor) + random(-2, 2),
    green(baseColor) + random(-2, 2),
    blue(baseColor) + random(-2, 2)
  );
  rect(x, y, w, h);
}

// EFFECT 2: Brush strokes - directional lines that simulate paint brush texture
function applyBrushStrokes(x, y, w, h, baseColor) {
  const horizontal = w > h;
  const density =
    STROKE_DENSITY_BY_COLOR[baseColor.toString().toUpperCase()] ?? 0.8;
  const strokeCount = ((horizontal ? h : w) / 3) * density;
  for (let i = 0; i < strokeCount; i++) {
    const offset = map(i, 0, strokeCount, 0, horizontal ? h : w);
    const jitter = random(-EDGE_WOBBLE, EDGE_WOBBLE);
    stroke(
      red(baseColor) + random(-COLOR_VARIANCE, COLOR_VARIANCE),
      green(baseColor) + random(-COLOR_VARIANCE, COLOR_VARIANCE),
      blue(baseColor) + random(-COLOR_VARIANCE, COLOR_VARIANCE),
      160
    );
    strokeWeight(random(1.2, 2.2));
    if (horizontal) {
      line(x, y + offset + jitter, x + w, y + offset + jitter);
    } else {
      line(x + offset + jitter, y, x + offset + jitter, y + h);
    }
  }
}

// EFFECT 3: Paint pooling - subtle dark border that simulates paint edges
function applyPaintPooling(x, y, w, h) {
  noFill();
  stroke(0, 18);
  strokeWeight(1.3);
  rect(
    x + random(0.4, 0.8),
    y + random(0.4, 0.8),
    w - random(0.8, 1.4),
    h - random(0.8, 1.4)
  );
}

// ===== HELPER FUNCTIONS =====

// Converts color string to p5 color object, defaults to white if invalid
function safeColor(c) {
  if (!c) return color("#ffffff");
  return color(c);
}

// Calculates the bounding box of all rectangles to find center and size
function getArtBounds() {
  let minX = Infinity,
    minY = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity;
  for (const r of MONDRIAN_DATA.protected) {
    minX = min(minX, r.x);
    minY = min(minY, r.y);
    maxX = max(maxX, r.x + r.w);
    maxY = max(maxY, r.y + r.h);
  }
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    w: maxX - minX,
    h: maxY - minY,
  };
}

// Draws small crack lines on large paint areas (simulates aged/cracked paint)
function drawMicroCracks(x, y, w, h, baseColor) {
  // Only large paint areas crack (skip small rectangles)
  if (w * h < 120 * 120) return;

  const count = floor(w * h * CRACK_DENSITY);
  stroke(
    red(baseColor) - 18,
    green(baseColor) - 18,
    blue(baseColor) - 18,
    CRACK_ALPHA
  );
  strokeWeight(CRACK_WEIGHT);

  for (let i = 0; i < count; i++) {
    let cx = x + random(w);
    let cy = y + random(h);
    let len = random(8, 22);
    let angle = random(-PI / 6, PI / 6); // mostly horizontal cracks
    // Broken crack (2–3 segments)
    let segments = floor(random(2, 4));
    let px = cx;
    let py = cy;
    for (let s = 0; s < segments; s++) {
      let nx = px + cos(angle) * (len / segments);
      let ny = py + sin(angle) * (len / segments);
      if (random() > 0.35) {
        line(px, py, nx, ny);
      }
      px = nx;
      py = ny;
    }
  }
}
