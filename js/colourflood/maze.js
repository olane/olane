var N = 1 << 0,
    S = 1 << 1,
    W = 1 << 2,
    E = 1 << 3;

self.addEventListener("message", function(event) {
  postMessage(generateMaze(event.data.width, event.data.height));
});

function generateMaze(width, height) {
  var n = width * height;
  var cells = new Uint8Array(n);
  var inMaze = new Uint8Array(n);
  var remaining = new Array(n);
  for (var k = 0; k < n; k++) remaining[k] = k;
  var previous = new Int32Array(n);
  for (var k = 0; k < n; k++) previous[k] = -1;

  // Add a random cell.
  var start = remaining.pop();
  inMaze[start] = 1;

  // While there are remaining cells,
  // add a loop-erased random walk to the maze.
  while (!loopErasedRandomWalk());

  return cells;

  function loopErasedRandomWalk() {
    var direction, index0, index1, i, j;

    // Pick a location that's not yet in the maze (if any).
    do if ((index0 = remaining.pop()) == null) return true;
    while (inMaze[index0]);

    // Perform a random walk starting at this location,
    previous[index0] = index0;
    walk: while (true) {
      i = index0 % width;
      j = index0 / width | 0;

      // picking a legal random direction at each step.
      direction = Math.random() * 4 | 0;
      if      (direction === 0) { if (j <= 0)          continue walk; --j; }
      else if (direction === 1) { if (j >= height - 1) continue walk; ++j; }
      else if (direction === 2) { if (i <= 0)          continue walk; --i; }
      else                      { if (i >= width - 1)  continue walk; ++i; }

      // If this new cell was visited previously during this walk,
      // erase the loop, rewinding the path to its earlier state.
      // Otherwise, just add it to the walk.
      index1 = j * width + i;
      if (previous[index1] !== -1) eraseWalk(index0, index1);
      else previous[index1] = index0;
      index0 = index1;

      // If this cell is part of the maze, we're done walking.
      if (inMaze[index1]) {

        // Add the random walk to the maze by backtracking to the starting cell.
        // Also erase this walk's history to not interfere with subsequent walks.
        while ((index0 = previous[index1]) !== index1) {
          direction = index1 - index0;
          if      (direction ===  1) cells[index0] |= E, cells[index1] |= W;
          else if (direction === -1) cells[index0] |= W, cells[index1] |= E;
          else if (direction <   0)  cells[index0] |= N, cells[index1] |= S;
          else                       cells[index0] |= S, cells[index1] |= N;
          previous[index1] = -1;
          inMaze[index1] = 1;
          index1 = index0;
        }
        previous[index1] = -1;
        inMaze[index1] = 1;
        return;
      }
    }
  }

  function eraseWalk(index0, index1) {
    var index;
    while ((index = previous[index0]) !== index1) {
      previous[index0] = -1;
      index0 = index;
    }
    previous[index0] = -1;
  }
}
