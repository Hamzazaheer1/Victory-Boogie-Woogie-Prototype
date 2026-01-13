// prng.js
// Small deterministic PRNG (sfc32) + string->seed

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function sfc32(a, b, c, d) {
  return function () {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    // 0..1
    return (t >>> 0) / 4294967296;
  };
}

function makeRngFromString(seedStr) {
  const seed = xmur3(seedStr);
  const a = seed(),
    b = seed(),
    c = seed(),
    d = seed();
  const rand = sfc32(a, b, c, d);
  return {
    float: () => rand(),
    int: (min, maxInclusive) => {
      const r = rand();
      return min + Math.floor(r * (maxInclusive - min + 1));
    },
    pick: (arr) => arr[Math.floor(rand() * arr.length)],
  };
}
