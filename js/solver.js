(function (global) {
  'use strict';

  function boxIndex(row, col) {
    return Math.floor(row / 3) * 3 + Math.floor(col / 3);
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

  function buildMasks(grid) {
    const rowMask = new Array(9).fill(0);
    const colMask = new Array(9).fill(0);
    const boxMask = new Array(9).fill(0);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const v = grid[r * 9 + c];
        if (v) {
          const bit = 1 << (v - 1);
          rowMask[r] |= bit;
          colMask[c] |= bit;
          boxMask[boxIndex(r, c)] |= bit;
        }
      }
    }
    return { rowMask, colMask, boxMask };
  }

  function hasInitialConflicts(grid) {
    const rowMask = new Array(9).fill(0);
    const colMask = new Array(9).fill(0);
    const boxMask = new Array(9).fill(0);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const v = grid[r * 9 + c];
        if (!v) continue;
        const bit = 1 << (v - 1);
        const b = boxIndex(r, c);
        if ((rowMask[r] & bit) || (colMask[c] & bit) || (boxMask[b] & bit)) {
          return true;
        }
        rowMask[r] |= bit;
        colMask[c] |= bit;
        boxMask[b] |= bit;
      }
    }
    return false;
  }

  // Finds the empty cell with the fewest candidates (most-constrained-cell
  // heuristic), which keeps backtracking fast for both solving and puzzle
  // generation.
  function findBestEmptyCell(grid, rowMask, colMask, boxMask) {
    let bestIndex = -1;
    let bestCount = 10;
    let bestCandidates = 0;
    for (let i = 0; i < 81; i++) {
      if (grid[i]) continue;
      const r = Math.floor(i / 9);
      const c = i % 9;
      const b = boxIndex(r, c);
      const used = rowMask[r] | colMask[c] | boxMask[b];
      const candidates = ~used & 0x1ff;
      const count = popcount(candidates);
      if (count === 0) {
        return { index: i, candidates: 0 };
      }
      if (count < bestCount) {
        bestCount = count;
        bestIndex = i;
        bestCandidates = candidates;
        if (count === 1) break;
      }
    }
    return bestIndex === -1 ? null : { index: bestIndex, candidates: bestCandidates };
  }

  function backtrackSolve(grid, rowMask, colMask, boxMask) {
    const found = findBestEmptyCell(grid, rowMask, colMask, boxMask);
    if (!found) return true;
    if (found.candidates === 0) return false;

    const { index, candidates } = found;
    const r = Math.floor(index / 9);
    const c = index % 9;
    const b = boxIndex(r, c);

    let remaining = candidates;
    while (remaining) {
      const bit = remaining & -remaining;
      remaining ^= bit;
      grid[index] = bitToValue(bit);
      rowMask[r] |= bit;
      colMask[c] |= bit;
      boxMask[b] |= bit;

      if (backtrackSolve(grid, rowMask, colMask, boxMask)) return true;

      grid[index] = 0;
      rowMask[r] &= ~bit;
      colMask[c] &= ~bit;
      boxMask[b] &= ~bit;
    }
    return false;
  }

  function backtrackCount(grid, rowMask, colMask, boxMask, state) {
    const found = findBestEmptyCell(grid, rowMask, colMask, boxMask);
    if (!found) {
      state.count++;
      return state.count >= state.limit;
    }
    if (found.candidates === 0) return false;

    const { index, candidates } = found;
    const r = Math.floor(index / 9);
    const c = index % 9;
    const b = boxIndex(r, c);

    let remaining = candidates;
    while (remaining) {
      const bit = remaining & -remaining;
      remaining ^= bit;
      grid[index] = bitToValue(bit);
      rowMask[r] |= bit;
      colMask[c] |= bit;
      boxMask[b] |= bit;

      const shouldStop = backtrackCount(grid, rowMask, colMask, boxMask, state);

      grid[index] = 0;
      rowMask[r] &= ~bit;
      colMask[c] &= ~bit;
      boxMask[b] &= ~bit;

      if (shouldStop) return true;
    }
    return false;
  }

  // Returns a solved 81-length grid, or null if no solution exists.
  function solve(grid) {
    if (hasInitialConflicts(grid)) return null;
    const working = grid.slice();
    const { rowMask, colMask, boxMask } = buildMasks(working);
    return backtrackSolve(working, rowMask, colMask, boxMask) ? working : null;
  }

  // Counts solutions up to `limit` (default 2), stopping early once reached.
  function countSolutions(grid, limit) {
    if (hasInitialConflicts(grid)) return 0;
    const working = grid.slice();
    const { rowMask, colMask, boxMask } = buildMasks(working);
    const state = { count: 0, limit: limit || 2 };
    backtrackCount(working, rowMask, colMask, boxMask, state);
    return state.count;
  }

  // Returns a Set of cell indices that duplicate another value in the same
  // row, column, or 3x3 box.
  function findConflicts(grid) {
    const conflicts = new Set();
    for (let i = 0; i < 81; i++) {
      const v = grid[i];
      if (!v) continue;
      const r = Math.floor(i / 9);
      const c = i % 9;
      const b = boxIndex(r, c);
      for (let j = i + 1; j < 81; j++) {
        const v2 = grid[j];
        if (!v2 || v2 !== v) continue;
        const r2 = Math.floor(j / 9);
        const c2 = j % 9;
        if (r2 === r || c2 === c || boxIndex(r2, c2) === b) {
          conflicts.add(i);
          conflicts.add(j);
        }
      }
    }
    return conflicts;
  }

  global.SudokuSolver = { solve, countSolutions, findConflicts, boxIndex };
})(window);
