

var canvasEl = document.getElementById("bg");
var rect = canvasEl.getBoundingClientRect();
var dpr = window.devicePixelRatio || 1;
var width = Math.floor(rect.width * dpr),
    height = Math.floor(rect.height * dpr);

canvasEl.width = width;
canvasEl.height = height;

var cells,
    context = canvasEl.getContext("2d"),
    canvasImage = context.createImageData(width, height),
    canvasData = canvasImage.data,
    distance = new Float32Array(width * height),
    visited = new Uint8Array(width * height),
    hueShift = new Float32Array(width * height),
    center = latLonToCell(CAMBRIDGE[0], CAMBRIDGE[1], width, height),
    frontier = [center];

visited[center] = 1;

var mazeWorker = new Worker("js/colourflood/maze.js");

mazeWorker.postMessage({width: width, height: height});

var isRunning = false;
var mode = "colour";

function pickStart() {
  return center;
}

// `distance` drives the colour fade and is only meaningful during a colour
// pass: it is zeroed when each colour pass begins and left stale during erase,
// which never paints from it.
function resetDistance() {
  for (var k = 0; k < distance.length; k++) {
    distance[k] = 0;
    hueShift[k] = 0;
  }
}

function resetVisited(startPoint) {
  for (var k = 0; k < visited.length; k++) visited[k] = 0;
  frontier.length = 0;
  frontier.push(startPoint);
  visited[startPoint] = 1;
}

function startTimer() {
  if (isRunning) return;
  isRunning = true;
  function frame() {
    var minX = width, minY = height, maxX = -1, maxY = -1;
    var painted = false;
    for (var i = 0; i < 400; ++i) {
      var i0 = exploreFrontier();
      if (i0 < 0) break;
      var x = i0 % width,
          y = (i0 / width) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      painted = true;
    }
    if (painted) {
      context.putImageData(canvasImage, 0, 0, minX, minY, maxX - minX + 1, maxY - minY + 1);
    }
    if (frontier.length === 0) {
      isRunning = false;
      mode = (mode === "colour") ? "erase" : "colour";
      if (mode === "colour") resetDistance();
      resetVisited(pickStart());
      startTimer();
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

mazeWorker.addEventListener("message", function(event) {
  mazeWorker.terminate();
  cells = event.data;
  startTimer();
});

document.addEventListener("click", function(event) {
  if (!cells) return;
  var r = canvasEl.getBoundingClientRect();
  var x = Math.floor((event.clientX - r.left) * (width / r.width));
  var y = Math.floor((event.clientY - r.top) * (height / r.height));
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  var i = y * width + x;
  if (visited[i]) return;
  hueShift[i] = Math.random() * 360;
  visited[i] = 1;
  frontier.push(i);
  startTimer();
});

var dirs = [
  [E, W, 1],
  [W, E, -1],
  [S, N, width],
  [N, S, -width]
];

function exploreFrontier() {
  var i0 = popRandom(frontier);
  if (i0 == null) return -1;

  var d0 = distance[i0],
      d1 = d0 + 0.25,
      idx = i0 * 4;

  if (mode === "colour") {
    var fade = Math.exp(-d0 * 0.0003);
    paintHSL((d0 / 5.5 + hueShift[i0]) % 360, fade, 1 - 0.5 * fade, idx);
  } else {
    canvasData[idx] = 0;
    canvasData[idx + 1] = 0;
    canvasData[idx + 2] = 0;
    canvasData[idx + 3] = 0;
  }

  for (var k = 0; k < dirs.length; k++) {
    var out = dirs[k][0],
        incoming = dirs[k][1],
        i1 = i0 + dirs[k][2];
    if ((cells[i0] & out) && (cells[i1] & incoming) && !visited[i1]) {
      distance[i1] = d1;
      hueShift[i1] = hueShift[i0];
      visited[i1] = 1;
      frontier.push(i1);
    }
  }

  return i0;
}

function paintHSL(h, s, l, idx) {
  var c = (1 - Math.abs(2 * l - 1)) * s,
      hp = h / 60,
      x = c * (1 - Math.abs(hp % 2 - 1)),
      r1, g1, b1;
  if (hp < 1)      r1 = c, g1 = x, b1 = 0;
  else if (hp < 2) r1 = x, g1 = c, b1 = 0;
  else if (hp < 3) r1 = 0, g1 = c, b1 = x;
  else if (hp < 4) r1 = 0, g1 = x, b1 = c;
  else if (hp < 5) r1 = x, g1 = 0, b1 = c;
  else             r1 = c, g1 = 0, b1 = x;
  var m = l - c / 2;
  canvasData[idx]     = (r1 + m) * 255;
  canvasData[idx + 1] = (g1 + m) * 255;
  canvasData[idx + 2] = (b1 + m) * 255;
  canvasData[idx + 3] = 200;
}

function popRandom(array) {
  var n = array.length;
  if (!n) return;
  var i = Math.random() * n | 0;
  var t = array[i];
  array[i] = array[n - 1];
  array[n - 1] = t;
  return array.pop();
}