importScripts("geo.js");

var N = 1 << 0,
    S = 1 << 1,
    W = 1 << 2,
    E = 1 << 3;

self.addEventListener("message", function(event) {
  postMessage(generateMaze(event.data.width, event.data.height));
});

// The maze is shaped like the UK map: every landmass (Great Britain, Ireland
// and the bit of Europe in view) is a maze, the sea is fully open so colour
// that leaks out through holes in the coastline can flow across the water.
function generateMaze(width, height) {
  var n = width * height;
  var land = buildLandMask(width, height);
  var unprocessed = new Uint8Array(n);
  var pos = new Int32Array(n);
  var cells = new Uint8Array(n);

  // Sea is fully open (in-bounds directions only).
  for (var i = 0; i < n; i++) {
    if (land[i]) continue;
    var x = i % width;
    var bits = 0;
    if (i >= width) bits |= N;
    if (i < n - width) bits |= S;
    if (x > 0) bits |= W;
    if (x < width - 1) bits |= E;
    cells[i] = bits;
  }

  // Build a maze spanning tree over every connected landmass, keeping the
  // coastal cells aside so holes can be punched through them afterwards.
  var coasts = [];
  for (i = 0; i < n; i++) {
    if (!land[i] || unprocessed[i]) continue;
    var comp = [],
        coast = [];
    collectComponent(i, width, height, land, unprocessed, comp, coast);
    for (var k = 0; k < comp.length; k++) pos[comp[k]] = k;
    generateComponentMaze(comp, width, height, land, pos, cells);
    coasts.push(coast);
  }

  var mainSea = findMainSea(width, height, land);

  punchHoles(width, height, mainSea, cells, coasts);
  connectEnclosedSeas(width, height, land, mainSea, cells);

  return cells;
}

// Rasterise the coastline rings into a land/sea mask for the given canvas.
function buildLandMask(width, height) {
  var n = width * height;
  var land = new Uint8Array(n);
  var rows = new Array(height);
  for (var y = 0; y < height; y++) rows[y] = [];

  for (var c = 0; c < COASTLINES.length; c++) {
    var ring = COASTLINES[c];
    var pts = new Array(ring.length);
    for (var k = 0; k < ring.length; k++) {
      pts[k] = projectPoint(ring[k][0], ring[k][1], width, height);
    }
    for (k = 0; k < pts.length - 1; k++) {
      var ax = pts[k][0], ay = pts[k][1], bx = pts[k + 1][0], by = pts[k + 1][1];
      var y0 = Math.max(0, Math.ceil(Math.min(ay, by) - 0.5));
      var y1 = Math.min(height - 1, Math.floor(Math.max(ay, by) - 0.5));
      for (y = y0; y <= y1; y++) {
        var yc = y + 0.5;
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) {
          var t = (yc - ay) / (by - ay);
          rows[y].push(ax + t * (bx - ax));
        }
      }
    }
  }

  for (y = 0; y < height; y++) {
    var xs = rows[y].sort(function(a, b) { return a - b; });
    for (var k = 0; k + 1 < xs.length; k += 2) {
      var x0 = Math.max(0, Math.ceil(xs[k]));
      var x1 = Math.min(width - 1, Math.floor(xs[k + 1]));
      var base = y * width;
      for (var x = x0; x <= x1; x++) land[base + x] = 1;
    }
  }
  return land;
}

function hasSeaNeighbour(i, land, width, height) {
  var n = land.length;
  var x = i % width;
  if (i >= width && !land[i - width]) return true;
  if (i < n - width && !land[i + width]) return true;
  if (x > 0 && !land[i - 1]) return true;
  if (x < width - 1 && !land[i + 1]) return true;
  return false;
}

// Collect the connected landmass starting at `start`, plus the coastal cells
// (land cells that border the sea) used later for punching holes.
function collectComponent(start, width, height, land, unprocessed, comp, coast) {
  var n = land.length;
  var stack = [start];
  unprocessed[start] = 1;
  while (stack.length) {
    var i = stack.pop();
    comp.push(i);
    if (hasSeaNeighbour(i, land, width, height)) coast.push(i);
    var x = i % width;
    var j;
    if (i >= width) { j = i - width; addNeighbour(j); }
    if (i < n - width) { j = i + width; addNeighbour(j); }
    if (x > 0) { j = i - 1; addNeighbour(j); }
    if (x < width - 1) { j = i + 1; addNeighbour(j); }
  }
  function addNeighbour(j) {
    if (land[j] && !unprocessed[j]) { unprocessed[j] = 1; stack.push(j); }
  }
}

// Wilson's algorithm (loop-erased random walk) restricted to one connected
// landmass.
function generateComponentMaze(comp, width, height, land, pos, cells) {
  var m = comp.length;
  var inMaze = new Uint8Array(m);
  var previous = new Int32Array(m);
  var order = new Array(m);
  for (var k = 0; k < m; k++) {
    previous[k] = -1;
    order[k] = k;
  }
  for (k = m - 1; k > 0; k--) {
    var r = (Math.random() * (k + 1)) | 0;
    var t = order[k]; order[k] = order[r]; order[r] = t;
  }

  inMaze[order.pop()] = 1;

  while (order.length) {
    var p;
    do {
      if (!order.length) return;
      p = order.pop();
    } while (inMaze[p]);

    var index0 = comp[p];
    previous[p] = p;
    walk: while (true) {
      var i = index0 % width;
      var j = (index0 / width) | 0;
      var dir = (Math.random() * 4) | 0;
      var ni = i, nj = j;
      if (dir === 0) --nj;
      else if (dir === 1) ++nj;
      else if (dir === 2) --ni;
      else ++ni;
      if (ni < 0 || nj < 0 || ni >= width || nj >= height) continue walk;
      var index1 = nj * width + ni;
      if (!land[index1]) continue walk;
      var p1 = pos[index1];
      if (previous[p1] !== -1) eraseWalk(p, p1, previous);
      else previous[p1] = p;
      index0 = index1;
      p = p1;
      if (inMaze[p1]) {
        var cur = p1, prev;
        while ((prev = previous[cur]) !== cur) {
          var a = comp[cur], b = comp[prev];
          var d = a - b;
          if (d === 1) { cells[b] |= E; cells[a] |= W; }
          else if (d === -1) { cells[b] |= W; cells[a] |= E; }
          else if (d < 0) { cells[b] |= N; cells[a] |= S; }
          else { cells[b] |= S; cells[a] |= N; }
          previous[cur] = -1;
          inMaze[cur] = 1;
          cur = prev;
        }
        previous[cur] = -1;
        inMaze[cur] = 1;
        break walk;
      }
    }
  }
}

function eraseWalk(index0, index1, previous) {
  var index;
  while ((index = previous[index0]) !== index1) {
    previous[index0] = -1;
    index0 = index;
  }
  previous[index0] = -1;
}

// The main sea component, used so that holes always open into the sea that the
// colour can actually reach (not into small enclosed lakes/bays).
function findMainSea(width, height, land) {
  var n = land.length;
  var seen = new Uint8Array(n);
  var main = null;
  for (var i = 0; i < n; i++) {
    if (land[i] || seen[i]) continue;
    var comp = [];
    var stack = [i];
    seen[i] = 1;
    while (stack.length) {
      var c = stack.pop();
      comp.push(c);
      var x = c % width;
      var j;
      if (c >= width) { j = c - width; if (!land[j] && !seen[j]) { seen[j] = 1; stack.push(j); } }
      if (c < n - width) { j = c + width; if (!land[j] && !seen[j]) { seen[j] = 1; stack.push(j); } }
      if (x > 0) { j = c - 1; if (!land[j] && !seen[j]) { seen[j] = 1; stack.push(j); } }
      if (x < width - 1) { j = c + 1; if (!land[j] && !seen[j]) { seen[j] = 1; stack.push(j); } }
    }
    if (!main || comp.length > main.length) main = comp;
  }
  var mainSea = new Uint8Array(n);
  for (var k = 0; k < main.length; k++) mainSea[main[k]] = 1;
  return mainSea;
}

// Punch random holes through the coastline so colour can get out, making sure
// every landmass has at least one opening.
function punchHoles(width, height, mainSea, cells, coasts) {
  var n = cells.length;
  for (var c = 0; c < coasts.length; c++) {
    var coast = coasts[c];
    var m = coast.length;
    var target = Math.max(1, Math.min(20, Math.round(m * 0.002)));
    for (var k = m - 1; k > 0; k--) {
      var r = (Math.random() * (k + 1)) | 0;
      var t = coast[k]; coast[k] = coast[r]; coast[r] = t;
    }
    var made = 0;
    for (k = 0; k < m && made < target; k++) {
      if (tryOpenHole(coast[k], width, height, mainSea, cells)) made++;
    }
    if (made === 0) {
      for (k = 0; k < m; k++) {
        if (tryOpenHole(coast[k], width, height, mainSea, cells)) { made++; break; }
      }
    }
  }
}

// Open a coastal cell to an adjacent main-sea cell (it is already reachable
// through the land maze).
function tryOpenHole(cell, width, height, mainSea, cells) {
  var n = cells.length;
  var x = cell % width;
  var nb = [];
  if (cell >= width) nb.push(cell - width);
  if (cell < n - width) nb.push(cell + width);
  if (x > 0) nb.push(cell - 1);
  if (x < width - 1) nb.push(cell + 1);
  for (var k = 0; k < nb.length; k++) {
    var j = nb[k];
    if (mainSea[j]) {
      openEdge(cell, j, cells, width);
      return true;
    }
  }
  return false;
}

// Any body of water left sealed off from the main sea (enclosed bays, or the
// Baltic where the map is clipped) is joined to it with a passage through the
// land, so colour can flow across the whole sea.
function connectEnclosedSeas(width, height, land, mainSea, cells) {
  var n = cells.length;
  var seen = new Uint8Array(n);
  for (var i = 0; i < n; i++) {
    if (land[i] || seen[i] || mainSea[i]) continue;
    var pocket = [];
    var stack = [i];
    seen[i] = 1;
    while (stack.length) {
      var c = stack.pop();
      pocket.push(c);
      var x = c % width;
      var j;
      if (c >= width) { j = c - width; if (!land[j] && !seen[j] && !mainSea[j]) { seen[j] = 1; stack.push(j); } }
      if (c < n - width) { j = c + width; if (!land[j] && !seen[j] && !mainSea[j]) { seen[j] = 1; stack.push(j); } }
      if (x > 0) { j = c - 1; if (!land[j] && !seen[j] && !mainSea[j]) { seen[j] = 1; stack.push(j); } }
      if (x < width - 1) { j = c + 1; if (!land[j] && !seen[j] && !mainSea[j]) { seen[j] = 1; stack.push(j); } }
    }
    // Find a land cell separating this pocket from the main sea.
    outer:
    for (var k = 0; k < pocket.length; k++) {
      var p = pocket[k];
      var px = p % width;
      var nb = [];
      if (p >= width) nb.push(p - width);
      if (p < n - width) nb.push(p + width);
      if (px > 0) nb.push(p - 1);
      if (px < width - 1) nb.push(p + 1);
      for (var m = 0; m < nb.length; m++) {
        var b = nb[m];
        if (!land[b]) continue;
        var bx = b % width;
        var bn = [];
        if (b >= width) bn.push(b - width);
        if (b < n - width) bn.push(b + width);
        if (bx > 0) bn.push(b - 1);
        if (bx < width - 1) bn.push(b + 1);
        for (var mm = 0; mm < bn.length; mm++) {
          if (mainSea[bn[mm]]) {
            openEdge(b, p, cells, width);
            openEdge(b, bn[mm], cells, width);
            break outer;
          }
        }
      }
    }
  }
}

function openEdge(a, b, cells, width) {
  var d = b - a;
  if (d === 1) { cells[a] |= E; cells[b] |= W; }
  else if (d === -1) { cells[a] |= W; cells[b] |= E; }
  else if (d === -width) { cells[a] |= N; cells[b] |= S; }
  else { cells[a] |= S; cells[b] |= N; }
}
