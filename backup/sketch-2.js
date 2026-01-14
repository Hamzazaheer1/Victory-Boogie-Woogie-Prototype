// Victory Boogie Woogie – Prototype v5
// Based on Feijs algorithm: hierarchical cell-based nesting approach
// Journal of Mathematics and the Arts, 2019

// =====================
// CONFIG
// =====================

const CELL = 100;
const BASE_BG = 0;

const PALETTE = ["#f2c500", "#d62828", "#1f3c88", "#f5f5f5", "#d0d5db"];
const WEIGHTS = [30, 25, 15, 25, 5]; // Added gray with lower weight

// Splitting parameters (Feijs algorithm)
const MIN_SPLIT_SIZE = CELL * 2; // Minimum size before splitting stops
const MAX_DEPTH = 8; // Maximum nesting depth
const SPLIT_PROBABILITY = 0.8; // Probability of splitting a rectangle (increased for more splits)
const MIN_ASPECT_RATIO = 0.2; // Minimum aspect ratio to allow split (more permissive)
const MAX_ASPECT_RATIO = 5.0; // Maximum aspect ratio to allow split (more permissive)

// Mondrian balance constraints
const MIN_WHITE = 0.3;
const MAX_WHITE = 0.55;
const MAX_COLOR_DOMINANCE = 0.35;
const MAX_FILL_JUMP = 0.15;

// Deterministic seed
const SEED = "demo-seed-001";

// Diamond shape bounds (Victory Boogie Woogie is diamond-shaped, not square)
// Scaled from SVG: M207.5 2012.5L2051.5 144.5L3895.5 2012.5L2051.5 3845L207.5 2012.5Z
// Original: (207.5, 2012.5) -> (2051.5, 144.5) -> (3895.5, 2012.5) -> (2051.5, 3845)
// Scaled to 400x400:
const DIAMOND_BOUNDS = {
  centerX: 200, // 2051.5 * 400/4096 ≈ 200
  centerY: 196, // 2012.5 * 400/4096 ≈ 196
  leftX: 20,    // 207.5 * 400/4096 ≈ 20
  rightX: 380,  // 3895.5 * 400/4096 ≈ 380
  topY: 14,     // 144.5 * 400/4096 ≈ 14
  bottomY: 375  // 3845 * 400/4096 ≈ 375
};

// =====================
// STATE
// =====================

let rng;
let grid;
let baseP5;
let generatedP5;
let rectangleTree; // Root of hierarchical structure

// =====================
// HIERARCHICAL RECTANGLE CLASS (Object-Oriented)
// =====================

class RectangleNode {
  constructor(x, y, w, h, parent = null, depth = 0) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.parent = parent;
    this.depth = depth;
    this.children = [];
    this.color = null;
    this.isLeaf = true;
    this.isProtected = false;
  }

  getArea() {
    return this.w * this.h;
  }

  getAspectRatio() {
    return Math.max(this.w / this.h, this.h / this.w);
  }

  canSplit() {
    // Check if rectangle is large enough and aspect ratio is acceptable
    if (this.depth >= MAX_DEPTH) return false;
    if (this.w < MIN_SPLIT_SIZE || this.h < MIN_SPLIT_SIZE) return false;
    if (this.getAspectRatio() > MAX_ASPECT_RATIO) return false;
    if (this.getAspectRatio() < MIN_ASPECT_RATIO) return false;
    return true;
  }

  split() {
    if (!this.canSplit()) return false;
    if (rng.float() > SPLIT_PROBABILITY) return false;

    this.isLeaf = false;
    const splitHorizontal = this.w > this.h ? false : this.w < this.h ? true : rng.float() < 0.5;

    if (splitHorizontal) {
      // Split horizontally (create top and bottom)
      const splitPoint = this.h * (0.3 + rng.float() * 0.4); // Split between 30% and 70%
      const splitPointAligned = Math.floor(splitPoint / CELL) * CELL;

      if (splitPointAligned >= MIN_SPLIT_SIZE && this.h - splitPointAligned >= MIN_SPLIT_SIZE) {
        this.children.push(
          new RectangleNode(this.x, this.y, this.w, splitPointAligned, this, this.depth + 1)
        );
        this.children.push(
          new RectangleNode(
            this.x,
            this.y + splitPointAligned,
            this.w,
            this.h - splitPointAligned,
            this,
            this.depth + 1
          )
        );
        return true;
      }
    } else {
      // Split vertically (create left and right)
      const splitPoint = this.w * (0.3 + rng.float() * 0.4);
      const splitPointAligned = Math.floor(splitPoint / CELL) * CELL;

      if (splitPointAligned >= MIN_SPLIT_SIZE && this.w - splitPointAligned >= MIN_SPLIT_SIZE) {
        this.children.push(
          new RectangleNode(this.x, this.y, splitPointAligned, this.h, this, this.depth + 1)
        );
        this.children.push(
          new RectangleNode(
            this.x + splitPointAligned,
            this.y,
            this.w - splitPointAligned,
            this.h,
            this,
            this.depth + 1
          )
        );
        return true;
      }
    }

    this.isLeaf = true;
    return false;
  }

  getAllLeaves() {
    if (this.isLeaf) {
      return [this];
    }
    const leaves = [];
    for (const child of this.children) {
      leaves.push(...child.getAllLeaves());
    }
    return leaves;
  }

  intersectsProtected(protectedShapes) {
    for (const prot of protectedShapes) {
      if (
        this.x < prot.x + prot.w &&
        this.x + this.w > prot.x &&
        this.y < prot.y + prot.h &&
        this.y + this.h > prot.y
      ) {
        return true;
      }
    }
    return false;
  }

  isCompletelyInsideProtected(protectedShapes) {
    for (const prot of protectedShapes) {
      if (
        this.x >= prot.x &&
        this.y >= prot.y &&
        this.x + this.w <= prot.x + prot.w &&
        this.y + this.h <= prot.y + prot.h
      ) {
        return true;
      }
    }
    return false;
  }

  // Check if rectangle is inside the diamond shape
  isInsideDiamond() {
    const { centerX, centerY, leftX, rightX, topY, bottomY } = DIAMOND_BOUNDS;
    
    // Check all four corners of the rectangle
    const corners = [
      { x: this.x, y: this.y },
      { x: this.x + this.w, y: this.y },
      { x: this.x, y: this.y + this.h },
      { x: this.x + this.w, y: this.y + this.h }
    ];
    
    for (const corner of corners) {
      // Calculate distance from center to corner
      const dx = Math.abs(corner.x - centerX);
      const dy = Math.abs(corner.y - centerY);
      
      // Diamond shape: |x - centerX| / (rightX - centerX) + |y - centerY| / (bottomY - centerY) <= 1
      const widthRatio = (rightX - centerX);
      const heightRatio = (bottomY - centerY);
      
      if (dx / widthRatio + dy / heightRatio > 1) {
        return false;
      }
    }
    
    return true;
  }

  // Check if rectangle intersects the diamond shape
  intersectsDiamond() {
    const { centerX, centerY, leftX, rightX, topY, bottomY } = DIAMOND_BOUNDS;
    
    // Check if any corner is inside
    const corners = [
      { x: this.x, y: this.y },
      { x: this.x + this.w, y: this.y },
      { x: this.x, y: this.y + this.h },
      { x: this.x + this.w, y: this.y + this.h }
    ];
    
    for (const corner of corners) {
      const dx = Math.abs(corner.x - centerX);
      const dy = Math.abs(corner.y - centerY);
      const widthRatio = (rightX - centerX);
      const heightRatio = (bottomY - centerY);
      
      if (dx / widthRatio + dy / heightRatio <= 1) {
        return true;
      }
    }
    
    // Also check if rectangle contains the diamond center
    if (this.x <= centerX && this.x + this.w >= centerX &&
        this.y <= centerY && this.y + this.h >= centerY) {
      return true;
    }
    
    return false;
  }
}

// =====================
// SPACE PARTITIONING (for neighbor finding)
// =====================

class SpacePartition {
  constructor(rects, width, height, cellSize) {
    this.cellSize = cellSize;
    this.cols = Math.floor(width / cellSize);
    this.rows = Math.floor(height / cellSize);
    this.grid = Array.from({ length: this.cols }, () =>
      Array.from({ length: this.rows }, () => [])
    );

    for (const rect of rects) {
      this.insert(rect);
    }
  }

  insert(rect) {
    const x0 = clamp(Math.floor(rect.x / this.cellSize), 0, this.cols);
    const y0 = clamp(Math.floor(rect.y / this.cellSize), 0, this.rows);
    const x1 = clamp(Math.ceil((rect.x + rect.w) / this.cellSize), 0, this.cols);
    const y1 = clamp(Math.ceil((rect.y + rect.h) / this.cellSize), 0, this.rows);

    for (let x = x0; x < x1; x++) {
      for (let y = y0; y < y1; y++) {
        this.grid[x][y].push(rect);
      }
    }
  }

  findNeighbors(rect) {
    const x0 = clamp(Math.floor(rect.x / this.cellSize), 0, this.cols);
    const y0 = clamp(Math.floor(rect.y / this.cellSize), 0, this.rows);
    const x1 = clamp(Math.ceil((rect.x + rect.w) / this.cellSize), 0, this.cols);
    const y1 = clamp(Math.ceil((rect.y + rect.h) / this.cellSize), 0, this.rows);

    const neighbors = new Set();
    for (let x = x0; x < x1; x++) {
      for (let y = y0; y < y1; y++) {
        for (const r of this.grid[x][y]) {
          if (r !== rect) neighbors.add(r);
        }
      }
    }
    return Array.from(neighbors);
  }
}

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
  // Draw diamond background
  drawDiamondBackground(p);
  // Filter protected shapes to only those inside diamond
  const protectedInsideDiamond = filterToDiamond(MONDRIAN_DATA.protected);
  // Set up diamond clipping
  setupDiamondClipping(p);
  drawProtected(p, protectedInsideDiamond);
  endDiamondClipping(p);
}

function drawDiamondBackground(p) {
  const { centerX, centerY, leftX, rightX, topY, bottomY } = DIAMOND_BOUNDS;
  p.fill(BASE_BG);
  p.noStroke();
  // Draw diamond shape
  p.beginShape();
  p.vertex(centerX, topY);      // Top
  p.vertex(rightX, centerY);   // Right
  p.vertex(centerX, bottomY);  // Bottom
  p.vertex(leftX, centerY);    // Left
  p.endShape(p.CLOSE);
}

// Set up diamond clipping mask for drawing
function setupDiamondClipping(p) {
  const { centerX, centerY, leftX, rightX, topY, bottomY } = DIAMOND_BOUNDS;
  
  // Create a graphics buffer for the mask
  if (!p.diamondMask) {
    p.diamondMask = p.createGraphics(p.width, p.height);
    p.diamondMask.clear();
    p.diamondMask.fill(255);
    p.diamondMask.noStroke();
    p.diamondMask.beginShape();
    p.diamondMask.vertex(centerX, topY);
    p.diamondMask.vertex(rightX, centerY);
    p.diamondMask.vertex(centerX, bottomY);
    p.diamondMask.vertex(leftX, centerY);
    p.diamondMask.endShape(p.CLOSE);
  }
  
  // Use the mask
  p.drawingContext.globalCompositeOperation = 'source-over';
  p.drawingContext.save();
  p.drawingContext.beginPath();
  p.drawingContext.moveTo(centerX, topY);
  p.drawingContext.lineTo(rightX, centerY);
  p.drawingContext.lineTo(centerX, bottomY);
  p.drawingContext.lineTo(leftX, centerY);
  p.drawingContext.closePath();
  p.drawingContext.clip();
}

function endDiamondClipping(p) {
  p.drawingContext.restore();
}

// Filter protected shapes to only those that intersect the diamond
function filterToDiamond(protectedShapes) {
  return protectedShapes.filter(shape => {
    // Create a temporary rectangle node to check intersection
    const tempRect = new RectangleNode(shape.x, shape.y, shape.w, shape.h);
    return tempRect.intersectsDiamond();
  });
}

function runPipeline(p) {
  const { width: W, height: H } = MONDRIAN_DATA.canvas;

  // 🔑 reset RNG every run (determinism guaranteed)
  rng = makeRngFromString(SEED);

  p.background(BASE_BG);
  
  // 0) Draw diamond background
  drawDiamondBackground(p);

  // 0.5) Filter protected shapes to only those inside diamond
  const protectedInsideDiamond = filterToDiamond(MONDRIAN_DATA.protected);

  // 0.6) Set up diamond clipping
  setupDiamondClipping(p);

  // 1) Protected layer
  drawProtected(p, protectedInsideDiamond);

  // 2) Build hierarchical rectangle tree (Feijs algorithm)
  rectangleTree = buildHierarchicalTree(W, H, protectedInsideDiamond);

  // 3) Recursively split rectangles
  recursivelySplit(rectangleTree, protectedInsideDiamond);

  // 4) Get all leaf rectangles (voids to fill)
  const allLeaves = rectangleTree.getAllLeaves();
  const voidLeaves = allLeaves.filter((leaf) => !leaf.isProtected);
  
  console.log(`Tree built. Total leaves: ${allLeaves.length}, Non-protected leaves: ${voidLeaves.length}`);

  // 5) Assign colors using pattern-aware approach
  const filledRects = assignColorsWithBalance(p, voidLeaves, W, H, protectedInsideDiamond);
  
  console.log(`Filled ${filledRects.length} rectangles`);

  // 6) Protected redraw (authority)
  drawProtected(p, protectedInsideDiamond);

  // 7) End diamond clipping
  endDiamondClipping(p);

  // 8) Subtle grain (only inside diamond)
  setupDiamondClipping(p);
  applyLightGrain(p, 1400);
  endDiamondClipping(p);

  // 9) Report
  printFinalReport(filledRects, W, H);
}

// =====================
// HIERARCHICAL TREE BUILDING (Feijs Algorithm)
// =====================

function buildHierarchicalTree(width, height, protectedShapes) {
  // Start with root rectangle covering the diamond shape bounds
  const { leftX, topY, rightX, bottomY } = DIAMOND_BOUNDS;
  const diamondWidth = rightX - leftX;
  const diamondHeight = bottomY - topY;
  const root = new RectangleNode(leftX, topY, diamondWidth, diamondHeight);

  // Mark protected areas in the tree
  markProtectedAreas(root, protectedShapes);

  return root;
}

function markProtectedAreas(node, protectedShapes) {
  if (node.isCompletelyInsideProtected(protectedShapes)) {
    node.isProtected = true;
    return;
  }

  if (node.intersectsProtected(protectedShapes)) {
    // If node intersects protected shapes, mark it but allow children
    node.isProtected = false; // Will be handled by children
  }
}

function recursivelySplit(node, protectedShapes) {
  // Don't split protected areas
  if (node.isProtected) return;
  
  // Don't split if node is completely outside diamond
  if (!node.intersectsDiamond()) {
    node.isProtected = true; // Mark as protected so we don't fill it
    return;
  }

  // Try to split this node
  const didSplit = node.split();

  if (didSplit) {
    // Recursively split children
    for (const child of node.children) {
      // Check if child is protected
      if (child.isCompletelyInsideProtected(protectedShapes)) {
        child.isProtected = true;
      } else if (!child.intersectsDiamond()) {
        // Mark as protected if outside diamond
        child.isProtected = true;
      } else {
        // Even if child intersects protected, we can still split it
        // The parts that don't overlap can be filled
        child.isProtected = false;
        // Continue splitting if it's large enough
        recursivelySplit(child, protectedShapes);
      }
    }
  }
}

// =====================
// COLOR ASSIGNMENT (Pattern-Aware)
// =====================

function assignColorsWithBalance(p, leaves, W, H, protectedShapes) {
  // Filter out protected leaves
  const fillableLeaves = leaves.filter((leaf) => !leaf.isProtected);

  // Sort by position (top-to-bottom, left-to-right)
  fillableLeaves.sort((a, b) => a.y - b.y || a.x - b.x);

  console.log(`Total leaves: ${leaves.length}, Fillable leaves: ${fillableLeaves.length}`);

  const filled = [];
  let prevMetrics = null;
  // Initialize space partition with empty array, will be updated as we add rectangles
  const spacePartition = new SpacePartition([], W, H, CELL);

  for (const leaf of fillableLeaves) {
    // Skip if leaf is completely outside diamond
    if (!leaf.intersectsDiamond()) {
      continue;
    }
    
    // Check if this leaf overlaps with protected areas
    // If it does, we need to clip it to only the non-protected parts
    let rectToFill = { x: leaf.x, y: leaf.y, w: leaf.w, h: leaf.h };
    
    // Clip to diamond bounds first
    rectToFill = clipToDiamond(rectToFill);
    if (!rectToFill || rectToFill.w < MIN_SPLIT_SIZE || rectToFill.h < MIN_SPLIT_SIZE) {
      continue;
    }
    
    if (rectToFill && leaf.intersectsProtected(protectedShapes)) {
      // Try to find a non-overlapping sub-rectangle
      const clipped = clipToNonProtected(rectToFill, protectedShapes);
      if (!clipped || clipped.w < MIN_SPLIT_SIZE || clipped.h < MIN_SPLIT_SIZE) {
        continue; // Skip if we can't get a valid clipped rectangle
      }
      rectToFill = clipped;
    }

    // Find neighbors for pattern rules (from already filled rectangles)
    const neighbors = spacePartition.findNeighbors(rectToFill);

    // Assign color based on size, neighbors, and hierarchy
    const color = chooseColor(rectToFill, neighbors, filled, W, H);

    if (!color) continue;

    const candidate = { x: rectToFill.x, y: rectToFill.y, w: rectToFill.w, h: rectToFill.h, color };

    // Check pattern rules
    const proposal = [...filled, candidate];
    if (!isPatternAllowed(proposal)) continue;

    // Check balance constraints
    const metrics = evaluateMetrics(proposal, W, H);
    if (!isImprovement(metrics, prevMetrics)) break;

    filled.push(candidate);
    prevMetrics = metrics;

    // Update space partition with new rectangle
    spacePartition.insert(candidate);

    // Draw rectangle - canvas clipping will handle diamond bounds
    if (rectToFill && rectToFill.w >= 1 && rectToFill.h >= 1) {
      p.fill(color);
      p.noStroke();
      p.rect(rectToFill.x, rectToFill.y, rectToFill.w, rectToFill.h);
    }
  }

  return filled;
}

// Clip a rectangle to fit inside the diamond shape
// Uses diamond equation: |x - centerX| / widthRatio + |y - centerY| / heightRatio <= 1
function clipToDiamond(rect) {
  const { centerX, centerY, leftX, rightX, topY, bottomY } = DIAMOND_BOUNDS;
  const widthRatio = (rightX - centerX);  // ~180
  const heightRatio = (bottomY - centerY); // ~179
  
  // Helper function to check if a point is inside diamond
  function isPointInsideDiamond(x, y) {
    const dx = Math.abs(x - centerX);
    const dy = Math.abs(y - centerY);
    return (dx / widthRatio + dy / heightRatio) <= 1.001; // Small tolerance for rounding
  }
  
  // Check all four corners
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x, y: rect.y + rect.h },
    { x: rect.x + rect.w, y: rect.y + rect.h }
  ];
  
  const cornerStatus = corners.map(c => isPointInsideDiamond(c.x, c.y));
  const allInside = cornerStatus.every(s => s);
  const allOutside = cornerStatus.every(s => !s);
  
  if (allInside) {
    return { ...rect }; // Already inside, return as-is
  }
  
  if (allOutside) {
    // Check center point
    const centerX_rect = rect.x + rect.w / 2;
    const centerY_rect = rect.y + rect.h / 2;
    if (!isPointInsideDiamond(centerX_rect, centerY_rect)) {
      return null; // Completely outside
    }
  }
  
  // Rectangle partially intersects - clip to diamond edges
  // Find the intersection of the rectangle with the diamond
  // We'll use a simpler approach: clip each edge to the diamond boundary
  
  let clipped = { ...rect };
  
  // Clip each edge by checking points along the edge
  // Left edge: check points from top to bottom
  let leftClip = 0;
  for (let y = clipped.y; y < clipped.y + clipped.h; y += 1) {
    if (isPointInsideDiamond(clipped.x, y)) {
      leftClip = 0;
      break;
    } else {
      leftClip++;
    }
  }
  if (leftClip > 0) {
    clipped.x += leftClip;
    clipped.w -= leftClip;
  }
  
  // Right edge: check points from top to bottom
  let rightClip = 0;
  for (let y = clipped.y; y < clipped.y + clipped.h; y += 1) {
    if (!isPointInsideDiamond(clipped.x + clipped.w, y)) {
      rightClip++;
    }
  }
  if (rightClip > 0) {
    clipped.w -= rightClip;
  }
  
  // Top edge: check points from left to right
  let topClip = 0;
  for (let x = clipped.x; x < clipped.x + clipped.w; x += 1) {
    if (isPointInsideDiamond(x, clipped.y)) {
      topClip = 0;
      break;
    } else {
      topClip++;
    }
  }
  if (topClip > 0) {
    clipped.y += topClip;
    clipped.h -= topClip;
  }
  
  // Bottom edge: check points from left to right
  let bottomClip = 0;
  for (let x = clipped.x; x < clipped.x + clipped.w; x += 1) {
    if (!isPointInsideDiamond(x, clipped.y + clipped.h)) {
      bottomClip++;
    }
  }
  if (bottomClip > 0) {
    clipped.h -= bottomClip;
  }
  
  // Final validation: check if the clipped rectangle is valid
  if (clipped.w < 1 || clipped.h < 1) {
    // Try alternative: use bounding box of valid corners
    const validCorners = corners.filter((c, i) => cornerStatus[i]);
    if (validCorners.length > 0) {
      const minX = Math.max(leftX, Math.min(...validCorners.map(c => c.x)));
      const maxX = Math.min(rightX, Math.max(...validCorners.map(c => c.x)));
      const minY = Math.max(topY, Math.min(...validCorners.map(c => c.y)));
      const maxY = Math.min(bottomY, Math.max(...validCorners.map(c => c.y)));
      
      const w = maxX - minX;
      const h = maxY - minY;
      if (w >= 1 && h >= 1) {
        return { x: minX, y: minY, w, h };
      }
    }
    return null;
  }
  
  return clipped;
}

// Clip a rectangle to avoid protected areas
// Returns a sub-rectangle that doesn't overlap protected shapes, or null if impossible
function clipToNonProtected(rect, protectedShapes) {
  // For rectangles that intersect protected areas, try to find a valid sub-rectangle
  // This is a simplified approach - we try to clip from one side at a time
  
  let bestRect = null;
  let bestArea = 0;
  
  // Try clipping from each side
  const candidates = [];
  
  // Check each protected shape that intersects
  for (const prot of protectedShapes) {
    if (
      rect.x < prot.x + prot.w &&
      rect.x + rect.w > prot.x &&
      rect.y < prot.y + prot.h &&
      rect.y + rect.h > prot.y
    ) {
      // Try left side (rect to the left of protected)
      if (rect.x < prot.x) {
        const candidate = {
          x: rect.x,
          y: rect.y,
          w: prot.x - rect.x,
          h: rect.h
        };
        if (candidate.w >= MIN_SPLIT_SIZE && candidate.h >= MIN_SPLIT_SIZE) {
          candidates.push(candidate);
        }
      }
      
      // Try right side (rect to the right of protected)
      if (rect.x + rect.w > prot.x + prot.w) {
        const candidate = {
          x: prot.x + prot.w,
          y: rect.y,
          w: rect.x + rect.w - (prot.x + prot.w),
          h: rect.h
        };
        if (candidate.w >= MIN_SPLIT_SIZE && candidate.h >= MIN_SPLIT_SIZE) {
          candidates.push(candidate);
        }
      }
      
      // Try top side
      if (rect.y < prot.y) {
        const candidate = {
          x: rect.x,
          y: rect.y,
          w: rect.w,
          h: prot.y - rect.y
        };
        if (candidate.w >= MIN_SPLIT_SIZE && candidate.h >= MIN_SPLIT_SIZE) {
          candidates.push(candidate);
        }
      }
      
      // Try bottom side
      if (rect.y + rect.h > prot.y + prot.h) {
        const candidate = {
          x: rect.x,
          y: prot.y + prot.h,
          w: rect.w,
          h: rect.y + rect.h - (prot.y + prot.h)
        };
        if (candidate.w >= MIN_SPLIT_SIZE && candidate.h >= MIN_SPLIT_SIZE) {
          candidates.push(candidate);
        }
      }
    }
  }
  
  // Find the largest candidate that doesn't intersect any protected shape
  for (const candidate of candidates) {
    let isValid = true;
    for (const prot of protectedShapes) {
      if (
        candidate.x < prot.x + prot.w &&
        candidate.x + candidate.w > prot.x &&
        candidate.y < prot.y + prot.h &&
        candidate.y + candidate.h > prot.y
      ) {
        isValid = false;
        break;
      }
    }
    if (isValid) {
      const area = candidate.w * candidate.h;
      if (area > bestArea) {
        bestArea = area;
        bestRect = candidate;
      }
    }
  }
  
  return bestRect;
}

function chooseColor(leaf, neighbors, filled, W, H) {
  // Handle both RectangleNode and plain objects
  const area = leaf.getArea ? leaf.getArea() : leaf.w * leaf.h;
  const largeAreaThreshold = 140 * 140;

  // Large areas tend to be white
  if (area > largeAreaThreshold) {
    return "#f5f5f5";
  }

  // Check neighbor colors to avoid same-color adjacency
  // Neighbors are from the space partition (filled rectangles)
  const neighborColors = neighbors
    .map((n) => n.color)
    .filter((c) => c && c !== "#f5f5f5" && c !== null);
  const colorCounts = {};
  for (const c of neighborColors) {
    colorCounts[c] = (colorCounts[c] || 0) + 1;
  }

  // Weighted random pick, but avoid colors that are too common in neighbors
  const availableColors = PALETTE.filter((c) => {
    if (c === "#f5f5f5") return false; // Don't use white for small areas
    const count = colorCounts[c] || 0;
    return count < 2; // Avoid if 2+ neighbors have this color
  });

  if (availableColors.length === 0) {
    // Fallback: use all colors except white
    const nonWhitePalette = PALETTE.filter((c) => c !== "#f5f5f5");
    const nonWhiteWeights = PALETTE.map((c, i) => (c !== "#f5f5f5" ? WEIGHTS[i] : 0)).filter(
      (w) => w > 0
    );
    return weightedPick(nonWhitePalette, nonWhiteWeights);
  }

  // Pick from available colors with weights
  const availableWeights = availableColors.map((c) => {
    const idx = PALETTE.indexOf(c);
    return WEIGHTS[idx];
  });
  return weightedPick(availableColors, availableWeights);
}

// =====================
// RENDERING
// =====================

function drawProtected(p, shapes) {
  p.noStroke();
  for (const r of shapes) {
    // Canvas clipping will handle diamond bounds, but we still check for basic validity
    if (r.w > 0 && r.h > 0) {
      p.fill(r.color);
      p.rect(r.x, r.y, r.w, r.h);
    }
  }
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

function areAdjacent(a, b) {
  const touchX = a.x + a.w === b.x || b.x + b.w === a.x;
  const overlapY = a.y < b.y + b.h && a.y + a.h > b.y;
  const touchY = a.y + a.h === b.y || b.y + b.h === a.y;
  const overlapX = a.x < b.x + b.w && a.x + a.w > b.x;
  return (touchX && overlapY) || (touchY && overlapX);
}

function isPatternAllowed(rects) {
  if (rects.length === 0) return true;
  const last = rects[rects.length - 1];
  const type = classifyRect(last);

  // Rule 1: small rectangles should cluster (but allow some flexibility)
  if (type === "small" && rects.length >= 3) {
    const recent = rects.slice(-5); // Check last 5 instead of 3
    const smallCount = recent.filter((r) => classifyRect(r) === "small").length;
    // Allow if at least 1 small in recent, or if this is one of the first few
    if (smallCount < 1 && rects.length > 5) {
      return false;
    }
  }

  // Rule 2: large blocks should be somewhat isolated (but not strictly)
  if (type === "large") {
    let adjacentLargeCount = 0;
    for (let i = 0; i < rects.length - 1; i++) {
      if (classifyRect(rects[i]) === "large" && areAdjacent(rects[i], last)) {
        adjacentLargeCount++;
        // Allow up to 1 adjacent large block
        if (adjacentLargeCount > 1) {
          return false;
        }
      }
    }
  }

  return true;
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
