# 数独ソルバー

ブラウザだけで動く数独ソルバーです。ビルド不要（素の HTML / CSS / JavaScript）で、GitHub Pages にそのまま公開できます。

## 機能

- 盤面への手入力（セルをタップ→下部の数字パッドで入力。物理キーボードの数字キーにも対応）
- 入力中の矛盾（行・列・3x3ブロックの重複）をリアルタイムでハイライト
- ワンタップで解答（バックトラッキング法）
- 難易度（易しい／普通／難しい）を選んで新しい問題を自動生成（一意解を保証）
- 写真・カメラからの盤面読み取り（OpenCV.js で盤面を検出・正面化し、Tesseract.js で数字をOCR。認識結果は確認・修正してから反映）

## 対応環境

- 端末: iPhone, Android, デスクトップ
- ブラウザ: Chrome, Safari

## ローカルでの動作確認

ビルド不要なので、任意の静的サーバーで `index.html` を配信するだけで動作します。

```bash
python3 -m http.server 8000
# http://localhost:8000/ をブラウザで開く
```

## 構成

```
index.html
css/style.css
js/
  solver.js     … 数独ソルバー（バックトラッキング＋ビットマスク）
  generator.js  … パズル自動生成（完成盤生成＋穴あけ）
  board.js      … 9x9盤面のUI（描画・選択・入力）
  ocr.js        … 写真/カメラからの盤面読み取り（OpenCV.js + Tesseract.js、CDNから遅延ロード）
  main.js       … 画面の初期化とイベント配線
```

## GitHub Pages への公開

1. このリポジトリを GitHub にプッシュします。
2. GitHub の Settings → Pages で、Source を「Deploy from a branch」、Branch を「main」/ ルート(`/`) に設定します。
3. しばらくすると `https://<ユーザー名>.github.io/<リポジトリ名>/` で公開されます。

## 注意事項

- 写真/カメラからの読み取り機能は初回利用時に OpenCV.js・Tesseract.js を CDN から読み込むため、インターネット接続が必要です。
- OCR は完全ではないため、読み取り結果は必ず確認・修正してから解答してください。
- 「写真/カメラから入力」は `<input type="file" accept="image/*">` を OS 標準のアクションシート（写真を撮る／フォトライブラリから選択）経由で使う実装です。以前は `capture="environment"` を付けて直接カメラを起動していましたが、iOS の Chrome など WKWebView 系ブラウザでは直接起動フローでカメラ映像が真っ暗になり操作不能になる不具合が確認されたため、`capture` 属性を外して標準アクションシート経由に変更しています。
