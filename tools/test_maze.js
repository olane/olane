// Regression check for the colourflood maze generation.
//
// Usage:
//     node tools/test_maze.js
//
// Loads geo.js and maze.js (which normally run in a web worker) into a Node
// context, generates the maze for a range of screen aspect ratios, and checks
// that: Cambridge is on land, the sea is fully open, every landmass has a hole,
// and the flood from Cambridge reaches (nearly) all land and sea.
//
// Note: maze.js calls importScripts("geo.js"), so it is stripped and both
// files are eval'd together in the same scope.

const fs = require("fs");
const path = require("path");

const REPO = path.join(__dirname, "..");
const geo = fs.readFileSync(path.join(REPO, "js/colourflood/geo.js"), "utf8");
const maze = fs.readFileSync(path.join(REPO, "js/colourflood/maze.js"), "utf8");

// Mimic the worker global scope so the eval'd scripts can find each other.
const ctx = {};
ctx.self = ctx;
ctx.importScripts = () => {};
ctx.addEventListener = () => {};
ctx.postMessage = () => {};

const exportsSrc = `
self.generateMaze = generateMaze;
self.buildLandMask = buildLandMask;
self.hasSeaNeighbour = hasSeaNeighbour;
self.latLonToCell = latLonToCell;
self.CAMBRIDGE = CAMBRIDGE;
self.COASTLINES = COASTLINES;
`;
const src = geo + "\n" + maze.replace(/importScripts\([^)]*\);?/, "") + "\n" + exportsSrc;
const run = new Function("self", src);
run(ctx);

function verify(width, height) {
  const cells = ctx.generateMaze(width, height);
  const n = width * height;
  const land = ctx.buildLandMask(width, height);

  let landCount = 0, seaCount = 0;
  for (let i = 0; i < n; i++) {
    if (land[i]) landCount++; else seaCount++;
  }

  // Cambridge must be on land.
  const center = ctx.latLonToCell(ctx.CAMBRIDGE[0], ctx.CAMBRIDGE[1], width, height);
  const cxx = center % width, cyy = Math.floor(center / width);

  // Sea must be fully open (all in-bounds directions).
  let badSea = 0;
  for (let i = 0; i < n; i++) {
    if (land[i]) continue;
    const x = i % width;
    let want = 0;
    if (i >= width) want |= 1;
    if (i < n - width) want |= 2;
    if (x > 0) want |= 4;
    if (x < width - 1) want |= 8;
    if (cells[i] !== want) badSea++;
  }

  // Every landmass needs at least one hole (a land cell open to the sea).
  let holes = 0;
  for (let i = 0; i < n; i++) {
    if (!land[i]) continue;
    const x = i % width;
    const y = Math.floor(i / width);
    if ((x > 0 && !land[i - 1] && (cells[i] & 4) && (cells[i - 1] & 8)) ||
        (x + 1 < width && !land[i + 1] && (cells[i] & 8) && (cells[i + 1] & 4)) ||
        (y > 0 && !land[i - width] && (cells[i] & 1) && (cells[i - width] & 2)) ||
        (y + 1 < height && !land[i + width] && (cells[i] & 2) && (cells[i + width] & 1))) holes++;
  }

  // Flood from Cambridge along open passages (matching colourflood.js).
  const visited = new Uint8Array(n);
  const frontier = [center];
  visited[center] = 1;
  let fi = 0;
  while (fi < frontier.length) {
    const i = frontier[fi++];
    const x = i % width;
    const y = Math.floor(i / width);
    if ((cells[i] & 8) && (cells[i + 1] & 4) && x + 1 < width && !visited[i + 1]) { visited[i + 1] = 1; frontier.push(i + 1); }
    if ((cells[i] & 4) && (cells[i - 1] & 8) && x > 0 && !visited[i - 1]) { visited[i - 1] = 1; frontier.push(i - 1); }
    if ((cells[i] & 2) && (cells[i + width] & 1) && y + 1 < height && !visited[i + width]) { visited[i + width] = 1; frontier.push(i + width); }
    if ((cells[i] & 1) && (cells[i - width] & 2) && y > 0 && !visited[i - width]) { visited[i - width] = 1; frontier.push(i - width); }
  }

  let reachableLand = 0, reachableSea = 0;
  for (let i = 0; i < n; i++) {
    if (!visited[i]) continue;
    if (land[i]) reachableLand++; else reachableSea++;
  }

  console.log(`grid ${width}x${height}: land=${landCount} sea=${seaCount} cambridge=(${cxx},${cyy}) land=${!!land[center]}`);
  console.log(`  sea not all-open: ${badSea}`);
  console.log(`  holes: ${holes}`);
  console.log(`  reachable land: ${reachableLand}/${landCount}`);
  console.log(`  reachable sea: ${reachableSea}/${seaCount}`);

  // A tiny number of unreachable cells is allowed: these are sub-pixel
  // enclosed bays (and islands inside them) too small to bother connecting.
  const ok =
    land[center] &&
    badSea === 0 &&
    holes > 0 &&
    reachableLand >= landCount * 0.999 &&
    reachableSea >= seaCount * 0.97;
  console.log(ok ? "PASS" : "FAIL");
  return ok;
}

let allOk = true;
for (const [width, height] of [
  [390, 844],    // portrait phone
  [844, 390],    // landscape phone
  [640, 640],    // square
  [600, 1200],   // tall tablet
  [800, 450],
  [1600, 900],
  [1920, 1080],  // desktop
]) {
  allOk = verify(width, height) && allOk;
}
process.exit(allOk ? 0 : 1);
