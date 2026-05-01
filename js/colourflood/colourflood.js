

var canvasEl = document.getElementById("bg");
var rect = canvasEl.getBoundingClientRect();
var width = Math.floor(rect.width),
    height = Math.floor(rect.height);

canvasEl.width = width;
canvasEl.height = height;

var N = 1 << 0,
    S = 1 << 1,
    W = 1 << 2,
    E = 1 << 3;

var canvas = d3.select("#bg");

var cells,
    context = canvas.node().getContext("2d"),
    image = context.createImageData(1, 1),
    imageData = image.data,
    distance = d3.range(width * height).map(function() { return 0; }),
    visited = new Uint8Array(width * height),
    hueShift = new Float32Array(width * height),
    center = Math.floor(width / 2) + Math.floor(height / 2) * width,
    frontier = [center];

imageData[3] = 200;

visited[center] = 1;

var mazeWorker = new Worker("js/colourflood/maze.js");

mazeWorker.postMessage({width: width, height: height});

var isRunning = false;
var mode = "colour";

function pickStart() {
  return Math.floor(Math.random() * (width * height));
}

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
  d3.timer(function() {
    for (var i = 0; i < 200; ++i) {
      if (exploreFrontier()) {
        isRunning = false;
        mode = (mode === "colour") ? "erase" : "colour";
        if (mode === "colour") resetDistance();
        resetVisited(pickStart());
        startTimer();
        return true;
      }
    }
  });
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

function exploreFrontier() {
  if ((i0 = popRandom(frontier)) == null) return true;

  var i0,
      i1,
      d0 = distance[i0],
      d1 = d0 + .25,
      px = i0 % width,
      py = i0 / width | 0;

  if (mode === "colour") {
    var fade = Math.exp(-d0 * 0.0003);
    paintHSL(((d0)/5.5 + hueShift[i0]) % 360, fade, 1 - 0.5 * fade);
    context.putImageData(image, px, py);
  } else {
    context.clearRect(px, py, 1, 1);
  }

  if (cells[i0] & E && !visited[i1 = i0 + 1])     distance[i1] = distance[i1] || d1, hueShift[i1] = hueShift[i0], visited[i1] = 1, frontier.push(i1);
  if (cells[i0] & W && !visited[i1 = i0 - 1])     distance[i1] = distance[i1] || d1, hueShift[i1] = hueShift[i0], visited[i1] = 1, frontier.push(i1);
  if (cells[i0] & S && !visited[i1 = i0 + width]) distance[i1] = distance[i1] || d1, hueShift[i1] = hueShift[i0], visited[i1] = 1, frontier.push(i1);
  if (cells[i0] & N && !visited[i1 = i0 - width]) distance[i1] = distance[i1] || d1, hueShift[i1] = hueShift[i0], visited[i1] = 1, frontier.push(i1);

}

function paintHSL(h, s, l) {
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
  imageData[0] = (r1 + m) * 255;
  imageData[1] = (g1 + m) * 255;
  imageData[2] = (b1 + m) * 255;
}

function popRandom(array) {

  if (!(n = array.length)) return;


  var n;
  var i = Math.random() * n | 0;
  var t;

  t = array[i];
  array[i] = array[n - 1];
  array[n - 1] = t;

  return array.pop();
}