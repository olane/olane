

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
    distance = d3.range(width * height).map(function() { return 0; }),
    visited = new Uint8Array(width * height),
    center = Math.floor(width / 2) + Math.floor(height / 2) * width,
    frontier = [center];

visited[center] = 1;

var mazeWorker = new Worker("js/colourflood/maze.js");

mazeWorker.postMessage({width: width, height: height});

var isRunning = false;
var mode = "colour";

function pickStart() {
  return Math.floor(Math.random() * (width * height));
}

function resetDistance() {
  for (var k = 0; k < distance.length; k++) distance[k] = 0;
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
    var color = d3.hsl((d0)/5.5 % 360,
                       Math.pow(Math.E, -d0 * 0.0003),
                       1 - 0.5 * Math.pow(Math.E, -d0 * 0.0003)).rgb();
    image.data[0] = color.r;
    image.data[1] = color.g;
    image.data[2] = color.b;
    image.data[3] = 200;
    context.putImageData(image, px, py);
  } else {
    context.clearRect(px, py, 1, 1);
  }

  if (cells[i0] & E && !visited[i1 = i0 + 1])     distance[i1] = distance[i1] || d1, visited[i1] = 1, frontier.push(i1);
  if (cells[i0] & W && !visited[i1 = i0 - 1])     distance[i1] = distance[i1] || d1, visited[i1] = 1, frontier.push(i1);
  if (cells[i0] & S && !visited[i1 = i0 + width]) distance[i1] = distance[i1] || d1, visited[i1] = 1, frontier.push(i1);
  if (cells[i0] & N && !visited[i1 = i0 - width]) distance[i1] = distance[i1] || d1, visited[i1] = 1, frontier.push(i1);

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