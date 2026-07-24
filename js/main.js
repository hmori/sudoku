(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const statusEl = document.getElementById('status-message');
    function setStatus(message) {
      statusEl.textContent = message;
    }

    const state = { activeBoard: null };

    const mainBoard = window.createBoard(document.getElementById('board'), {
      lockGivens: true,
      onSelect: () => {
        state.activeBoard = mainBoard;
      },
      onChange: () => setStatus(''),
    });
    state.activeBoard = mainBoard;

    // --- Numpad / keyboard input, routed to whichever board is active.
    // There are two numpads in the DOM (main page + OCR review modal) since
    // the modal overlay blocks clicks on the one underneath it.
    document.querySelectorAll('[data-numpad]').forEach((numpad) => {
      numpad.addEventListener('click', (event) => {
        const key = event.target.closest('.numpad-key');
        if (!key || !state.activeBoard) return;
        state.activeBoard.setValueAtSelected(Number(key.dataset.value));
      });
    });

    document.addEventListener('keydown', (event) => {
      if (!state.activeBoard) return;
      if (event.key >= '1' && event.key <= '9') {
        state.activeBoard.setValueAtSelected(Number(event.key));
      } else if (event.key === '0' || event.key === 'Backspace' || event.key === 'Delete') {
        state.activeBoard.setValueAtSelected(0);
      }
    });

    // --- Solve / Clear ---
    document.getElementById('solve-btn').addEventListener('click', () => {
      const grid = mainBoard.getGrid();
      if (window.SudokuSolver.findConflicts(grid).size > 0) {
        setStatus('入力に矛盾があります。赤いセルを確認してください。');
        return;
      }
      const solved = window.SudokuSolver.solve(grid);
      if (!solved) {
        setStatus('解が見つかりませんでした。入力を確認してください。');
        return;
      }
      const givens = grid.map((v) => v !== 0);
      mainBoard.setGrid(solved, givens);
      setStatus('解けました。');
    });

    document.getElementById('clear-btn').addEventListener('click', () => {
      mainBoard.setGrid(new Array(81).fill(0), new Array(81).fill(false));
      setStatus('');
    });

    // --- Difficulty segmented control ---
    const difficultyTabs = document.getElementById('difficulty-tabs');
    let currentDifficulty = 'medium';
    difficultyTabs.addEventListener('click', (event) => {
      const tab = event.target.closest('.segmented-btn');
      if (!tab) return;
      currentDifficulty = tab.dataset.difficulty;
      difficultyTabs.querySelectorAll('.segmented-btn').forEach((btn) => {
        const active = btn === tab;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', String(active));
      });
    });

    // --- Puzzle generation ---
    document.getElementById('new-puzzle-btn').addEventListener('click', () => {
      setStatus('生成しています…');
      // Defer so the status message paints before the (synchronous) search runs.
      setTimeout(() => {
        const { puzzle } = window.SudokuGenerator.generatePuzzle(currentDifficulty);
        const givens = puzzle.map((v) => v !== 0);
        mainBoard.setGrid(puzzle, givens);
        state.activeBoard = mainBoard;
        setStatus('新しい問題を生成しました。');
      }, 20);
    });

    // --- OCR: photo/camera input and review flow ---
    const ocrModal = document.getElementById('ocr-review-modal');
    const ocrReviewBoardEl = document.getElementById('ocr-review-board');
    let ocrReviewBoard = null;

    function openOcrReview(grid) {
      if (!ocrReviewBoard) {
        ocrReviewBoard = window.createBoard(ocrReviewBoardEl, {
          lockGivens: false,
          onSelect: () => {
            state.activeBoard = ocrReviewBoard;
          },
        });
      }
      ocrModal.hidden = false;
      const givens = grid.map((v) => v !== 0);
      ocrReviewBoard.setGrid(grid, givens);
      state.activeBoard = ocrReviewBoard;
    }

    window.SudokuOCR.init({
      fileInput: document.getElementById('photo-input'),
      onRecognized: openOcrReview,
      setLoading: (isLoading, text) => {
        const overlay = document.getElementById('ocr-loading');
        overlay.hidden = !isLoading;
        if (text) document.getElementById('ocr-loading-text').textContent = text;
      },
      setStatus,
    });

    document.getElementById('ocr-confirm-btn').addEventListener('click', () => {
      const grid = ocrReviewBoard.getGrid();
      const givens = grid.map((v) => v !== 0);
      mainBoard.setGrid(grid, givens);
      state.activeBoard = mainBoard;
      ocrModal.hidden = true;
      setStatus('写真から読み取った内容を反映しました。内容を確認してから解いてください。');
    });

    document.getElementById('ocr-cancel-btn').addEventListener('click', () => {
      ocrModal.hidden = true;
      state.activeBoard = mainBoard;
    });
  });
})();
