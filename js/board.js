(function (global) {
  'use strict';

  // Renders a 9x9 board into `container` and returns a controller object.
  // opts:
  //   lockGivens  - given cells cannot be selected/edited (true for the main board)
  //   onSelect    - called with the selected cell index
  //   onChange    - called with the current grid whenever a value changes
  function createBoard(container, opts) {
    opts = opts || {};
    container.innerHTML = '';

    const cells = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cell';
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);
        cell.setAttribute('role', 'gridcell');
        container.appendChild(cell);
        cells.push(cell);
      }
    }

    let grid = new Array(81).fill(0);
    let givens = new Array(81).fill(false);
    let selectedIndex = -1;

    function render() {
      const conflicts = global.SudokuSolver.findConflicts(grid);
      for (let i = 0; i < 81; i++) {
        const cell = cells[i];
        const value = grid[i];
        cell.textContent = value ? String(value) : '';
        cell.classList.toggle('given', !!givens[i]);
        cell.classList.toggle('selected', i === selectedIndex);
        cell.classList.toggle('conflict', conflicts.has(i));
      }
    }

    function selectCell(index) {
      if (givens[index] && opts.lockGivens) return;
      selectedIndex = index;
      render();
      if (opts.onSelect) opts.onSelect(index);
    }

    cells.forEach((cell, index) => {
      cell.addEventListener('click', () => selectCell(index));
    });

    function setValueAtSelected(value) {
      if (selectedIndex === -1) return;
      if (givens[selectedIndex] && opts.lockGivens) return;
      grid[selectedIndex] = value;
      render();
      if (opts.onChange) opts.onChange(grid.slice());
    }

    function setGrid(newGrid, newGivens) {
      grid = newGrid.slice();
      givens = newGivens ? newGivens.slice() : grid.map((v) => v !== 0);
      selectedIndex = -1;
      render();
    }

    function getGrid() {
      return grid.slice();
    }

    render();

    return {
      setGrid,
      getGrid,
      setValueAtSelected,
      selectCell,
      get selectedIndex() {
        return selectedIndex;
      },
    };
  }

  global.createBoard = createBoard;
})(window);
