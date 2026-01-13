// data.js (updated dummy Mondrian-ish dataset)
const MONDRIAN_DATA = {
  canvas: { width: 400, height: 400 },

  protected: [
    // soft "tape" bars (no black)
    { id: "b1", x: 0, y: 40, w: 400, h: 20, color: "#f2f2f2" },
    { id: "b2", x: 60, y: 0, w: 20, h: 400, color: "#f2f2f2" },
    { id: "b3", x: 220, y: 0, w: 20, h: 400, color: "#f2f2f2" },
    { id: "b4", x: 0, y: 240, w: 400, h: 20, color: "#f2f2f2" },

    // a few larger “anchors”
    { id: "a1", x: 80, y: 80, w: 80, h: 60, color: "#d62828" }, // red block
    { id: "a2", x: 260, y: 80, w: 60, h: 60, color: "#1f3c88" }, // blue block
    { id: "a3", x: 280, y: 280, w: 80, h: 60, color: "#f2c500" }, // yellow block

    // small square clusters (boogie rhythm)
    // cluster 1 (top-left-ish)
    { id: "s1", x: 100, y: 60, w: 20, h: 20, color: "#f2c500" },
    { id: "s2", x: 120, y: 60, w: 20, h: 20, color: "#f5f5f5" },
    { id: "s3", x: 140, y: 60, w: 20, h: 20, color: "#d62828" },

    // cluster 2 (near center)
    { id: "s4", x: 180, y: 180, w: 20, h: 20, color: "#1f3c88" },
    { id: "s5", x: 200, y: 180, w: 20, h: 20, color: "#f2c500" },
    { id: "s6", x: 180, y: 200, w: 20, h: 20, color: "#f5f5f5" },
    { id: "s7", x: 200, y: 200, w: 20, h: 20, color: "#d62828" },

    // cluster 3 (bottom-left)
    { id: "s8", x: 40, y: 300, w: 20, h: 20, color: "#d62828" },
    { id: "s9", x: 60, y: 300, w: 20, h: 20, color: "#f2c500" },
    { id: "s10", x: 80, y: 300, w: 20, h: 20, color: "#1f3c88" },

    // cluster 4 (right edge vibe)
    { id: "s11", x: 360, y: 140, w: 20, h: 20, color: "#f2c500" },
    { id: "s12", x: 360, y: 160, w: 20, h: 20, color: "#d62828" },
    { id: "s13", x: 360, y: 180, w: 20, h: 20, color: "#f5f5f5" },

    { id: "s14", x: 360, y: 180, w: 20, h: 20, color: "#d62828" },
  ],
};
