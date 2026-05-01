

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
    frontier = [Math.floor(width / 2) + Math.floor(height / 2) * width];

var mazeWorker = new Worker("js/colourflood/maze.js");

mazeWorker.postMessage({width: width, height: height});

var isRunning = false;

function startTimer() {
  if (isRunning) return;
  isRunning = true;
  d3.timer(function() {
    for (var i = 0; i < 200; ++i) {
      if (exploreFrontier()) {
        isRunning = false;
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
  distance[i] = 0;
  frontier.push(i);
  startTimer();
});

function exploreFrontier() {
  if ((i0 = popRandom(frontier)) == null) return true;

  var i0,
      i1,
      d0 = distance[i0],
      d1 = d0 + .25,
      color = d3.hsl((d0)/5.5 % 360, 
                     Math.pow(Math.E, -d0 * 0.0003),
                     1 - 0.5 * Math.pow(Math.E, -d0 * 0.0003)).rgb();

  image.data[0] = color.r;
  image.data[1] = color.g;
  image.data[2] = color.b;
  image.data[3] = 200;
  context.putImageData(image, i0 % width, i0 / width | 0);

  if (cells[i0] & E && !distance[i1 = i0 + 1]) distance[i1] = d1, frontier.push(i1);
  if (cells[i0] & W && !distance[i1 = i0 - 1]) distance[i1] = d1, frontier.push(i1);
  if (cells[i0] & S && !distance[i1 = i0 + width]) distance[i1] = d1, frontier.push(i1);
  if (cells[i0] & N && !distance[i1 = i0 - width]) distance[i1] = d1, frontier.push(i1);

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