(function (global) {
  'use strict';

  const DIFFICULTY_CLUES = { easy: 40, medium: 32, hard: 26 };

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function popcount(x) {
    let count = 0;
    while (x) {
      x &= x - 1;
      count++;
    }
    return count;
  }

  function bitToValue(bit) {
    return Math.round(Math.log2(bit)) + 1;
  }

  // Same most-constrained-cell backtracking as solver.js, but candidate
  // order is shuffled so repeated calls yield different completed grids.
  function fillRandom(grid, rowMask, colMask, boxMask) {
    let bestIndex = -1;
    let bestCount = 10;
    let bestCandidates = 0;
    for (let i = 0; i < 81; i++) {
      if (grid[i]) continue;
      const r = Math.floor(i / 9);
      const c = i % 9;
      const b = global.SudokuSolver.boxIndex(r, c);
      const used = rowMask[r] | colMask[c] | boxMask[b];
      const candidates = ~used & 0x1ff;
      const count = popcount(candidates);
      if (count === 0) return false;
      if (count < bestCount) {
        bestCount = count;
        bestIndex = i;
        bestCandidates = candidates;
        if (count === 1) break;
      }
    }
    if (bestIndex === -1) return true;

    const bits = [];
    let remaining = bestCandidates;
    while (remaining) {
      const bit = remaining & -remaining;
      remaining ^= bit;
      bits.push(bit);
    }
    shuffle(bits);

    const r = Math.floor(bestIndex / 9);
    const c = bestIndex % 9;
    const b = global.SudokuSolver.boxIndex(r, c);
    for (const bit of bits) {
      grid[bestIndex] = bitToValue(bit);
      rowMask[r] |= bit;
      colMask[c] |= bit;
      boxMask[b] |= bit;

      if (fillRandom(grid, rowMask, colMask, boxMask)) return true;

      grid[bestIndex] = 0;
      rowMask[r] &= ~bit;
      colMask[c] &= ~bit;
      boxMask[b] &= ~bit;
    }
    return false;
  }

  function generateSolvedGrid() {
    const grid = new Array(81).fill(0);
    const rowMask = new Array(9).fill(0);
    const colMask = new Array(9).fill(0);
    const boxMask = new Array(9).fill(0);
    fillRandom(grid, rowMask, colMask, boxMask);
    return grid;
  }

  // Starts from a full solved grid and removes cells one at a time (in
  // random order), keeping a removal only while the puzzle still has a
  // unique solution.
  function generatePuzzle(difficulty) {
    const target = DIFFICULTY_CLUES[difficulty] || DIFFICULTY_CLUES.medium;
    const solution = generateSolvedGrid();
    const puzzle = solution.slice();
    const order = shuffle(Array.from({ length: 81 }, (_, i) => i));

    let clues = 81;
    for (const index of order) {
      if (clues <= target) break;
      const backup = puzzle[index];
      puzzle[index] = 0;
      const solutionCount = global.SudokuSolver.countSolutions(puzzle, 2);
      if (solutionCount === 1) {
        clues--;
      } else {
        puzzle[index] = backup;
      }
    }

    return { puzzle, solution };
  }

  global.SudokuGenerator = { generatePuzzle, generateSolvedGrid, DIFFICULTY_CLUES };
})(window);
