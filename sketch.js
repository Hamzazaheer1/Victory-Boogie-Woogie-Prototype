// ===== CONFIGURATION =====
const CRACK_DENSITY = 0.00008; // extremely low
const CRACK_ALPHA = 22;
const CRACK_WEIGHT = 0.6;
const STROKE_DENSITY = 3.2;
const COLOR_VARIANCE = 6;
const EDGE_WOBBLE = 1.4;

// Painted effect configuration
const DISTORTION_AMOUNT = 2; // Maximum pixel offset for shape distortion (increased for visibility)
const TEXTURE_INTENSITY_MIN = 1;
const TEXTURE_INTENSITY_MAX = 2;
const NOISE_SCALE = 0.01; // Scale for Perlin noise
const BRUSH_STROKE_NOISE_FACTOR = 8; // Maximum noise factor for brush strokes
const BRUSH_EXTEND_AMOUNT = 1; // How far brush strokes can extend beyond rectangle
const BRUSH_LAYER_CHANCE = 0.2; // 60% chance for second layer of brush strokes
const EDGE_IRREGULARITY = 2.5; // How irregular/wobbly the rectangle edges are (in pixels)
const EDGE_SEGMENTS = 3; // Number of segments per edge for irregularity (more = smoother but more irregular)

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
  
  // Apply random distortion to shape position and size
  const distorted = applyShapeDistortion(x, y, w, h);
  const distX = distorted.x;
  const distY = distorted.y;
  const distW = distorted.w;
  const distH = distorted.h;

  // EFFECT 1: Base fill with noise-based texture
  applyBaseFillWithTexture(distX, distY, distW, distH, baseColor);

  // EFFECT 2: Brush strokes with edge distortions
  applyBrushStrokesWithDistortion(distX, distY, distW, distH, baseColor);

  // EFFECT 3: Paint pooling - subtle dark border that simulates paint edges
  applyPaintPooling(distX, distY, distW, distH);

  // EFFECT 4: Micro cracks - small crack lines on large paint areas (aged paint effect)
  drawMicroCracks(distX, distY, distW, distH, baseColor);
}

// EFFECT 1: Base fill with noise-based texture and irregular shape
function applyBaseFillWithTexture(x, y, w, h, baseColor) {
  noStroke();
  
  // Apply base color with slight random variation
  const baseR = red(baseColor) + random(-3, 3);
  const baseG = green(baseColor) + random(-3, 3);
  const baseB = blue(baseColor) + random(-3, 3);
  
  // Apply noise-based texture variation - more visible
  const textureIntensity = random(TEXTURE_INTENSITY_MIN, TEXTURE_INTENSITY_MAX);
  
  // Sample noise at multiple points and blend
  const noiseValue1 = noise(x * NOISE_SCALE, y * NOISE_SCALE) * textureIntensity;
  const noiseValue2 = noise((x + w) * NOISE_SCALE, (y + h) * NOISE_SCALE) * textureIntensity;
  const noiseValue3 = noise((x + w/2) * NOISE_SCALE, (y + h/2) * NOISE_SCALE) * textureIntensity;
  const avgNoise = (noiseValue1 + noiseValue2 + noiseValue3) / 3;
  
  fill(
    constrain(baseR + avgNoise * 15, 0, 255),
    constrain(baseG + avgNoise * 15, 0, 255),
    constrain(baseB + avgNoise * 15, 0, 255)
  );
  
  // Draw irregular rectangle instead of perfect rect
  drawIrregularRect(x, y, w, h);
}

// EFFECT 2: Brush strokes with edge distortions using noise - MULTI-LAYERED with extended strokes
function applyBrushStrokesWithDistortion(x, y, w, h, baseColor) {
  const horizontal = w > h;
  const density =
    STROKE_DENSITY_BY_COLOR[baseColor.toString().toUpperCase()] ?? 0.8;
  const baseStrokeCount = ((horizontal ? h : w) / 3) * density;
  
  // Randomize stroke density per shape
  const strokeVariation = random(0.6, 1.4);
  const actualStrokeCount = floor(baseStrokeCount * strokeVariation);
  
  // FIRST LAYER: Always draw first layer
  drawBrushLayer(x, y, w, h, baseColor, actualStrokeCount, horizontal, 1);
  
  // SECOND LAYER: Random chance for second layer (60% chance)
  if (random() < BRUSH_LAYER_CHANCE) {
    const secondLayerCount = floor(actualStrokeCount * random(0.5, 0.8));
    drawBrushLayer(x, y, w, h, baseColor, secondLayerCount, horizontal, 2);
  }
}

// Draw a single layer of brush strokes
function drawBrushLayer(x, y, w, h, baseColor, strokeCount, horizontal, layerNum) {
  for (let i = 0; i < strokeCount; i++) {
    const offset = map(i, 0, strokeCount, 0, horizontal ? h : w);
    
    // Use noise for more natural jitter - more pronounced
    const noiseFactor = random(2, BRUSH_STROKE_NOISE_FACTOR);
    const jitterX = (noise(x * NOISE_SCALE, (y + offset) * NOISE_SCALE) - 0.5) * noiseFactor * 2;
    const jitterY = (noise((x + offset) * NOISE_SCALE, y * NOISE_SCALE) - 0.5) * noiseFactor * 2;
    const jitter = random(-EDGE_WOBBLE * 2, EDGE_WOBBLE * 2);
    
    // Randomize color variation per stroke - more variation for second layer
    const colorVarMultiplier = layerNum === 2 ? 1.5 : 1;
    const colorVar = random(-COLOR_VARIANCE * colorVarMultiplier, COLOR_VARIANCE * colorVarMultiplier);
    
    // Second layer can be slightly darker or lighter
    const layerColorShift = layerNum === 2 ? random(-8, 8) : 0;
    
    stroke(
      constrain(red(baseColor) + colorVar + layerColorShift, 0, 255),
      constrain(green(baseColor) + colorVar + layerColorShift, 0, 255),
      constrain(blue(baseColor) + colorVar + layerColorShift, 0, 255),
      layerNum === 2 ? 200 : 180 // Second layer slightly more opaque
    );
    
    // Vary stroke weight - second layer can be thicker
    const baseWeight = layerNum === 2 ? random(1.8, 3.5) : random(1.5, 2.8);
    strokeWeight(baseWeight);
    
    if (horizontal) {
      // Calculate extended start and end points (can go outside rectangle)
      const extendStart = random(-BRUSH_EXTEND_AMOUNT, BRUSH_EXTEND_AMOUNT * 0.3);
      const extendEnd = random(-BRUSH_EXTEND_AMOUNT * 0.3, BRUSH_EXTEND_AMOUNT);
      
      // Apply edge distortions using noise
      const noiseStart = (noise(x * NOISE_SCALE, (y + offset) * NOISE_SCALE) - 0.5) * noiseFactor * 2;
      const noiseEnd = (noise((x + w) * NOISE_SCALE, (y + offset) * NOISE_SCALE) - 0.5) * noiseFactor * 2;
      
      const startX = x + noiseStart + extendStart;
      const endX = x + w + noiseEnd + extendEnd;
      const yPos = y + offset + jitter + jitterY;
      
      // Draw the stroke (can extend beyond rectangle)
      line(startX, yPos, endX, yPos);
      
      // Sometimes add a slight angle variation for more organic feel
      if (random() < 0.3) {
        const angleVariation = random(-0.1, 0.1);
        const startX2 = startX + cos(angleVariation) * 5;
        const endX2 = endX + cos(angleVariation) * 5;
        const yPos2 = yPos + sin(angleVariation) * 5;
        strokeWeight(baseWeight * 0.6);
        line(startX2, yPos2, endX2, yPos2);
      }
    } else {
      // Vertical strokes
      const extendStart = random(-BRUSH_EXTEND_AMOUNT, BRUSH_EXTEND_AMOUNT * 0.3);
      const extendEnd = random(-BRUSH_EXTEND_AMOUNT * 0.3, BRUSH_EXTEND_AMOUNT);
      
      const noiseStart = (noise((x + offset) * NOISE_SCALE, y * NOISE_SCALE) - 0.5) * noiseFactor * 2;
      const noiseEnd = (noise((x + offset) * NOISE_SCALE, (y + h) * NOISE_SCALE) - 0.5) * noiseFactor * 2;
      
      const xPos = x + offset + jitter + jitterX;
      const startY = y + noiseStart + extendStart;
      const endY = y + h + noiseEnd + extendEnd;
      
      line(xPos, startY, xPos, endY);
      
      // Sometimes add a slight angle variation
      if (random() < 0.3) {
        const angleVariation = random(-0.1, 0.1);
        const xPos2 = xPos + sin(angleVariation) * 5;
        const startY2 = startY + cos(angleVariation) * 5;
        const endY2 = endY + cos(angleVariation) * 5;
        strokeWeight(baseWeight * 0.6);
        line(xPos2, startY2, xPos2, endY2);
      }
    }
  }
}

// EFFECT 3: Paint pooling - subtle dark border that simulates paint edges
function applyPaintPooling(x, y, w, h) {
  noFill();
  stroke(0, 25);
  strokeWeight(1.5);
  
  // Use noise for more natural edge variations - more visible
  const offsetX = random(0.5, 1.2) + (noise(x * NOISE_SCALE) - 0.5) * 0.8;
  const offsetY = random(0.5, 1.2) + (noise(y * NOISE_SCALE) - 0.5) * 0.8;
  const offsetW = random(1.0, 2.0) + (noise((x + w) * NOISE_SCALE) - 0.5) * 0.8;
  const offsetH = random(1.0, 2.0) + (noise((y + h) * NOISE_SCALE) - 0.5) * 0.8;
  
  // Draw irregular inner rectangle for paint pooling effect
  drawIrregularRect(
    x + offsetX,
    y + offsetY,
    w - offsetW,
    h - offsetH
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

// ===== HELPER FUNCTIONS FOR PAINTED EFFECT =====

// Apply random distortion to shape position and size
function applyShapeDistortion(x, y, w, h) {
  // Apply random offsets to position and size
  const offsetX = random(-DISTORTION_AMOUNT, DISTORTION_AMOUNT);
  const offsetY = random(-DISTORTION_AMOUNT, DISTORTION_AMOUNT);
  const offsetW = random(-DISTORTION_AMOUNT, DISTORTION_AMOUNT);
  const offsetH = random(-DISTORTION_AMOUNT, DISTORTION_AMOUNT);
  
  // Use noise for smoother, more natural distortions
  const noiseX = (noise(x * NOISE_SCALE, y * NOISE_SCALE) - 0.5) * DISTORTION_AMOUNT * 2;
  const noiseY = (noise(y * NOISE_SCALE, x * NOISE_SCALE) - 0.5) * DISTORTION_AMOUNT * 2;
  const noiseW = (noise((x + w) * NOISE_SCALE, y * NOISE_SCALE) - 0.5) * DISTORTION_AMOUNT * 2;
  const noiseH = (noise(x * NOISE_SCALE, (y + h) * NOISE_SCALE) - 0.5) * DISTORTION_AMOUNT * 2;
  
  // Blend random and noise-based distortions
  return {
    x: x + (offsetX + noiseX) / 2,
    y: y + (offsetY + noiseY) / 2,
    w: w + (offsetW + noiseW) / 2,
    h: h + (offsetH + noiseH) / 2
  };
}

// Draw an irregular rectangle with wobbly edges
function drawIrregularRect(x, y, w, h) {
  beginShape();
  
  // Top edge - left to right
  for (let i = 0; i <= EDGE_SEGMENTS; i++) {
    const t = i / EDGE_SEGMENTS;
    const baseX = x + w * t;
    const baseY = y;
    // Add irregularity using noise and random
    const noiseX = (noise(baseX * NOISE_SCALE * 2, baseY * NOISE_SCALE * 2) - 0.5) * EDGE_IRREGULARITY * 2;
    const noiseY = (noise(baseY * NOISE_SCALE * 2, baseX * NOISE_SCALE * 2) - 0.5) * EDGE_IRREGULARITY * 2;
    const randomX = random(-EDGE_IRREGULARITY, EDGE_IRREGULARITY);
    const randomY = random(-EDGE_IRREGULARITY, EDGE_IRREGULARITY);
    vertex(baseX + noiseX + randomX, baseY + noiseY + randomY);
  }
  
  // Right edge - top to bottom
  for (let i = 1; i <= EDGE_SEGMENTS; i++) {
    const t = i / EDGE_SEGMENTS;
    const baseX = x + w;
    const baseY = y + h * t;
    const noiseX = (noise(baseX * NOISE_SCALE * 2, baseY * NOISE_SCALE * 2) - 0.5) * EDGE_IRREGULARITY * 2;
    const noiseY = (noise(baseY * NOISE_SCALE * 2, baseX * NOISE_SCALE * 2) - 0.5) * EDGE_IRREGULARITY * 2;
    const randomX = random(-EDGE_IRREGULARITY, EDGE_IRREGULARITY);
    const randomY = random(-EDGE_IRREGULARITY, EDGE_IRREGULARITY);
    vertex(baseX + noiseX + randomX, baseY + noiseY + randomY);
  }
  
  // Bottom edge - right to left
  for (let i = 1; i <= EDGE_SEGMENTS; i++) {
    const t = 1 - (i / EDGE_SEGMENTS);
    const baseX = x + w * t;
    const baseY = y + h;
    const noiseX = (noise(baseX * NOISE_SCALE * 2, baseY * NOISE_SCALE * 2) - 0.5) * EDGE_IRREGULARITY * 2;
    const noiseY = (noise(baseY * NOISE_SCALE * 2, baseX * NOISE_SCALE * 2) - 0.5) * EDGE_IRREGULARITY * 2;
    const randomX = random(-EDGE_IRREGULARITY, EDGE_IRREGULARITY);
    const randomY = random(-EDGE_IRREGULARITY, EDGE_IRREGULARITY);
    vertex(baseX + noiseX + randomX, baseY + noiseY + randomY);
  }
  
  // Left edge - bottom to top
  for (let i = 1; i < EDGE_SEGMENTS; i++) {
    const t = 1 - (i / EDGE_SEGMENTS);
    const baseX = x;
    const baseY = y + h * t;
    const noiseX = (noise(baseX * NOISE_SCALE * 2, baseY * NOISE_SCALE * 2) - 0.5) * EDGE_IRREGULARITY * 2;
    const noiseY = (noise(baseY * NOISE_SCALE * 2, baseX * NOISE_SCALE * 2) - 0.5) * EDGE_IRREGULARITY * 2;
    const randomX = random(-EDGE_IRREGULARITY, EDGE_IRREGULARITY);
    const randomY = random(-EDGE_IRREGULARITY, EDGE_IRREGULARITY);
    vertex(baseX + noiseX + randomX, baseY + noiseY + randomY);
  }
  
  endShape(CLOSE);
}
