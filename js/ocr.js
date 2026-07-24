(function (global) {
  'use strict';

  const OPENCV_URL = 'https://cdn.jsdelivr.net/npm/@techstark/opencv-js@5.0.0-release.1/dist/opencv.js';
  const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  const WARPED_SIZE = 450; // 9 cells * 50px, kept small for OCR speed

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') {
          resolve();
        } else {
          existing.addEventListener('load', () => resolve());
          existing.addEventListener('error', () => reject(new Error('script load failed: ' + src)));
        }
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = () => reject(new Error('script load failed: ' + src));
      document.head.appendChild(script);
    });
  }

  let openCvReadyPromise = null;
  function ensureOpenCvLoaded() {
    if (global.cv && global.cv.Mat) return Promise.resolve();
    if (!openCvReadyPromise) {
      // The UMD build exposes `cv` as a Promise that resolves to the ready
      // module (rather than the classic onRuntimeInitialized callback), so
      // just await whatever the script attached to window.cv.
      openCvReadyPromise = loadScript(OPENCV_URL)
        .then(() => Promise.resolve(global.cv))
        .then((resolvedCv) => {
          global.cv = resolvedCv;
        });
    }
    return openCvReadyPromise;
  }

  let tesseractReadyPromise = null;
  function ensureTesseractLoaded() {
    if (global.Tesseract) return Promise.resolve();
    if (!tesseractReadyPromise) {
      tesseractReadyPromise = loadScript(TESSERACT_URL);
    }
    return tesseractReadyPromise;
  }

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image load failed'));
      img.src = URL.createObjectURL(file);
    });
  }

  function orderQuadPoints(approxMat) {
    const pts = [];
    for (let i = 0; i < 4; i++) {
      pts.push({ x: approxMat.data32S[i * 2], y: approxMat.data32S[i * 2 + 1] });
    }
    pts.sort((a, b) => a.y - b.y);
    const top = pts.slice(0, 2).sort((a, b) => a.x - b.x);
    const bottom = pts.slice(2, 4).sort((a, b) => a.x - b.x);
    const [tl, tr] = top;
    const [bl, br] = bottom;
    return [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y];
  }

  // Detects the largest quadrilateral in the photo (the sudoku grid outline)
  // and warps it to a square, front-on view. Falls back to a plain center
  // crop if no clear grid outline is found.
  function detectAndWarpBoard(imageEl) {
    const cv = global.cv;
    const maxDim = 1200;
    const scale = Math.min(1, maxDim / Math.max(imageEl.width, imageEl.height));

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = Math.round(imageEl.width * scale);
    srcCanvas.height = Math.round(imageEl.height * scale);
    srcCanvas.getContext('2d').drawImage(imageEl, 0, 0, srcCanvas.width, srcCanvas.height);

    const src = cv.imread(srcCanvas);
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    const blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    const thresh = new cv.Mat();
    cv.adaptiveThreshold(blurred, thresh, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let bestQuad = null;
    let bestArea = 0;
    const minArea = srcCanvas.width * srcCanvas.height * 0.15;
    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      if (area >= minArea) {
        const peri = cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
        if (approx.rows === 4 && area > bestArea) {
          bestArea = area;
          if (bestQuad) bestQuad.delete();
          bestQuad = approx;
        } else {
          approx.delete();
        }
      }
      cnt.delete();
    }

    let warped = new cv.Mat();
    if (bestQuad) {
      const points = orderQuadPoints(bestQuad);
      bestQuad.delete();
      const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, points);
      const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0, 0, WARPED_SIZE, 0, WARPED_SIZE, WARPED_SIZE, 0, WARPED_SIZE,
      ]);
      const M = cv.getPerspectiveTransform(srcTri, dstTri);
      cv.warpPerspective(gray, warped, M, new cv.Size(WARPED_SIZE, WARPED_SIZE));
      srcTri.delete();
      dstTri.delete();
      M.delete();
    } else {
      const size = Math.min(gray.rows, gray.cols);
      const x = Math.floor((gray.cols - size) / 2);
      const y = Math.floor((gray.rows - size) / 2);
      const cropped = gray.roi(new cv.Rect(x, y, size, size));
      cv.resize(cropped, warped, new cv.Size(WARPED_SIZE, WARPED_SIZE));
      cropped.delete();
    }

    const outCanvas = document.createElement('canvas');
    outCanvas.width = WARPED_SIZE;
    outCanvas.height = WARPED_SIZE;
    cv.imshow(outCanvas, warped);

    src.delete();
    gray.delete();
    blurred.delete();
    thresh.delete();
    contours.delete();
    hierarchy.delete();
    warped.delete();

    return outCanvas;
  }

  function cellHasDigit(ctx, w, h) {
    const { data } = ctx.getImageData(0, 0, w, h);
    let darkCount = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 128) darkCount++;
    }
    const ratio = darkCount / (w * h);
    // Too little dark area -> empty cell. Too much -> likely grid-line noise.
    return ratio > 0.03 && ratio < 0.6;
  }

  async function recognizeDigits(warpedCanvas, onProgress) {
    const Tesseract = global.Tesseract;
    const cellSize = WARPED_SIZE / 9;
    const margin = cellSize * 0.15;
    const inner = Math.round(cellSize - margin * 2);
    const grid = new Array(81).fill(0);

    const worker = await Tesseract.createWorker('eng');
    await worker.setParameters({
      tessedit_char_whitelist: '123456789',
      tessedit_pageseg_mode: Tesseract.PSM ? Tesseract.PSM.SINGLE_CHAR : '10',
    });

    try {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const cellCanvas = document.createElement('canvas');
          cellCanvas.width = inner;
          cellCanvas.height = inner;
          const ctx = cellCanvas.getContext('2d');
          ctx.drawImage(
            warpedCanvas,
            c * cellSize + margin,
            r * cellSize + margin,
            inner,
            inner,
            0,
            0,
            inner,
            inner
          );

          if (cellHasDigit(ctx, inner, inner)) {
            const { data } = await worker.recognize(cellCanvas);
            const text = (data.text || '').replace(/[^1-9]/g, '');
            if (text.length > 0) {
              grid[r * 9 + c] = Number(text[0]);
            }
          }

          if (onProgress) onProgress(r * 9 + c + 1, 81);
        }
      }
    } finally {
      await worker.terminate();
    }

    return grid;
  }

  function init(config) {
    const { fileInput, onRecognized, setLoading, setStatus } = config;

    fileInput.addEventListener('change', async (event) => {
      const file = event.target.files && event.target.files[0];
      fileInput.value = '';
      if (!file) return;

      try {
        setLoading(true, 'ライブラリを読み込んでいます…');
        await Promise.all([ensureOpenCvLoaded(), ensureTesseractLoaded()]);

        setLoading(true, '盤面を検出しています…');
        const imageEl = await loadImageFromFile(file);
        const warped = detectAndWarpBoard(imageEl);
        URL.revokeObjectURL(imageEl.src);

        setLoading(true, '数字を認識しています… (0/81)');
        const grid = await recognizeDigits(warped, (done, total) => {
          setLoading(true, `数字を認識しています… (${done}/${total})`);
        });

        setLoading(false);
        onRecognized(grid);
      } catch (err) {
        console.error(err);
        setLoading(false);
        setStatus('画像の読み取りに失敗しました。手動で入力してください。');
      }
    });
  }

  global.SudokuOCR = { init };
})(window);
