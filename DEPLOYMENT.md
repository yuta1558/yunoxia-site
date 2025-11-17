# Deployment Guide - yunoxia.one

このドキュメントは、yunoxia.oneのデプロイメント手順とCDN最適化戦略を説明します。

---

## 📋 目次

1. [デプロイメント要件](#デプロイメント要件)
2. [デプロイメント手順](#デプロイメント手順)
3. [CDN & キャッシュ戦略](#cdn--キャッシュ戦略)
4. [パフォーマンス最適化](#パフォーマンス最適化)
5. [セキュリティヘッダー](#セキュリティヘッダー)
6. [環境別設定](#環境別設定)
7. [デプロイメント後チェックリスト](#デプロイメント後チェックリスト)

---

## デプロイメント要件

### 最小要件

- ✅ **静的ファイルホスティング**: HTML/CSS/JSをホストできる環境
- ✅ **HTTPSサポート**: 必須（Service Worker要件）
- ✅ **カスタムヘッダー設定**: キャッシュ制御のため推奨

### 推奨環境

以下のいずれかのホスティングサービス:

| サービス | 特徴 | 設定難易度 |
|---------|------|-----------|
| **Cloudflare Pages** | 無料CDN、自動HTTPS、高速 | ⭐⭐ |
| **Vercel** | ゼロ設定、自動デプロイ | ⭐ |
| **Netlify** | 使いやすい、豊富な機能 | ⭐ |
| **GitHub Pages** | 無料、Gitベース | ⭐⭐ |
| **AWS S3 + CloudFront** | 高度な制御可能 | ⭐⭐⭐⭐ |

---

## デプロイメント手順

### 1. Cloudflare Pagesへのデプロイ

```bash
# 1. Cloudflareアカウントでログイン

# 2. ダッシュボードから「Pages」→「Create a project」

# 3. GitHubリポジトリを接続

# 4. ビルド設定
Build command: (空欄 - ビルド不要)
Build output directory: /
Root directory: /

# 5. 環境変数（不要）

# 6. デプロイ
```

#### Cloudflare Pages ヘッダー設定

`public/_headers` ファイルを作成:

```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()

/*.html
  Cache-Control: public, max-age=0, must-revalidate

/assets/css/*
  Cache-Control: public, max-age=31536000, immutable

/assets/js/*
  Cache-Control: public, max-age=31536000, immutable

/assets/svg/*
  Cache-Control: public, max-age=31536000, immutable

/assets/*.png
  Cache-Control: public, max-age=31536000, immutable

/assets/*.jpg
  Cache-Control: public, max-age=31536000, immutable

/sw.js
  Cache-Control: public, max-age=0, must-revalidate

/robots.txt
  Cache-Control: public, max-age=3600

/sitemap.xml
  Cache-Control: public, max-age=3600
```

### 2. Vercelへのデプロイ

```bash
# 1. Vercel CLIをインストール（オプション）
npm i -g vercel

# 2. デプロイ
vercel

# または GitHub連携でGitプッシュ時に自動デプロイ
```

#### Vercel設定ファイル (`vercel.json`)

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    },
    {
      "source": "/assets/css/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/assets/js/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/*.html",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, must-revalidate"
        }
      ]
    }
  ]
}
```

### 3. Netlifyへのデプロイ

```bash
# 1. Netlify CLIをインストール（オプション）
npm i -g netlify-cli

# 2. デプロイ
netlify deploy

# または GitHub連携で自動デプロイ
```

#### Netlify設定ファイル (`netlify.toml`)

```toml
[build]
  publish = "."
  command = ""

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"

[[headers]]
  for = "/assets/css/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/assets/js/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.html"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"
```

### 4. GitHub Pagesへのデプロイ

```bash
# 1. リポジトリ設定 → Pages → Source: main branch

# 2. カスタムドメイン設定（オプション）

# 3. HTTPS強制を有効化
```

**注意**: GitHub Pagesはカスタムヘッダー設定ができないため、Service Workerでキャッシュを制御します。

---

## CDN & キャッシュ戦略

### キャッシュ戦略の概要

yunoxia.oneは3層のキャッシュ戦略を採用:

```
1. Browser Cache (Cache-Control headers)
2. CDN Cache (Edge caching)
3. Service Worker Cache (sw.js)
```

### リソース別キャッシュ設定

| リソース | ブラウザキャッシュ | CDN | Service Worker |
|---------|-----------------|-----|----------------|
| **HTML** | `max-age=0, must-revalidate` | なし | Network-first |
| **CSS/JS** | `max-age=31536000, immutable` | 1年 | Cache-first |
| **画像** | `max-age=31536000, immutable` | 1年 | Cache-first |
| **sw.js** | `max-age=0, must-revalidate` | なし | なし |
| **robots.txt** | `max-age=3600` | 1時間 | なし |
| **sitemap.xml** | `max-age=3600` | 1時間 | なし |

### Cache-Control ヘッダーの説明

```
public              - CDNでキャッシュ可能
max-age=31536000    - 1年間キャッシュ（秒単位）
immutable           - リバリデーション不要（変更なし）
must-revalidate     - 期限切れ時に必ず再検証
```

### バージョニング戦略

**問題**: 静的アセットを長期キャッシュすると、更新が反映されない

**解決策**:

1. **Service Workerバージョン管理**
   ```javascript
   // sw.js
   const CACHE_VERSION = 'v1.0.0';  // 変更時に更新
   ```

2. **ファイル名ハッシュ（将来的な拡張）**
   ```
   app.js → app.abc123.js
   style.css → style.def456.css
   ```

3. **クエリパラメータ（簡易版）**
   ```html
   <link rel="stylesheet" href="assets/css/style.css?v=1.0.0">
   ```

### CDN設定のベストプラクティス

#### Cloudflare

- ✅ **Auto Minify**: HTML/CSS/JSを有効化
- ✅ **Brotli圧縮**: 自動有効
- ✅ **HTTP/2**: デフォルトで有効
- ✅ **Always Use HTTPS**: 有効化

#### Vercel

- ✅ **自動圧縮**: Gzip/Brotli
- ✅ **HTTP/3**: デフォルトで有効
- ✅ **Edge Network**: 自動最適化

#### Netlify

- ✅ **Asset Optimization**: 有効化
- ✅ **Post Processing**: Minification有効
- ✅ **Prerendering**: 不要（静的サイト）

---

## パフォーマンス最適化

### 実装済みの最適化

- ✅ **Service Worker**: オフライン対応とキャッシュ
- ✅ **遅延読み込み**: `defer`属性でJS読み込み
- ✅ **フォント最適化**: `display=swap`でFOIT防止
- ✅ **CSS変数**: 実行時計算の削減
- ✅ **IntersectionObserver**: 効率的なスクロール監視
- ✅ **requestAnimationFrame**: スムーズなアニメーション

### 追加推奨最適化

#### 1. 画像最適化

```bash
# WebP形式への変換
cwebp -q 80 ogp.png -o ogp.webp

# レスポンシブ画像
<picture>
  <source srcset="image.webp" type="image/webp">
  <img src="image.png" alt="...">
</picture>
```

#### 2. 重要CSS のインライン化

```html
<head>
  <style>
    /* Critical CSS here */
  </style>
  <link rel="stylesheet" href="style.css" media="print" onload="this.media='all'">
</head>
```

#### 3. プリロード/プリコネクト

```html
<!-- Google Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<!-- GSAP CDN -->
<link rel="preconnect" href="https://cdn.jsdelivr.net">
```

#### 4. リソースヒント

```html
<!-- 次ページのプリフェッチ -->
<link rel="prefetch" href="/about.html">
```

---

## セキュリティヘッダー

### 必須ヘッダー

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### Content Security Policy（推奨）

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline';
  style-src 'self' https://fonts.googleapis.com 'unsafe-inline';
  font-src https://fonts.gstatic.com;
  img-src 'self' data:;
  connect-src 'self';
```

**注意**: `'unsafe-inline'`は、インラインスクリプト（FOUC防止）のために必要

---

## 環境別設定

### 開発環境

```bash
# ローカルサーバー起動
python3 -m http.server 8000

# パフォーマンス監視有効化
# index.htmlに追加:
<script src="assets/js/performance-monitor.js" defer></script>
```

### ステージング環境

- Service Workerを無効化（デバッグのため）
- パフォーマンス監視有効
- エラートラッキング有効

### 本番環境

- Service Worker有効
- パフォーマンス監視無効（オプション）
- 圧縮・Minify有効
- セキュリティヘッダー設定

---

## デプロイメント後チェックリスト

### 基本確認

- [ ] すべてのページが正常に表示される
- [ ] HTTPSが有効（緑の鍵マーク）
- [ ] robots.txt/sitemap.xmlにアクセスできる
- [ ] Service Workerが登録される
- [ ] コンソールにエラーがない

### パフォーマンス確認

- [ ] Lighthouse スコア 90+ (全カテゴリ)
- [ ] First Contentful Paint < 1.8秒
- [ ] Largest Contentful Paint < 2.5秒
- [ ] Time to Interactive < 3.5秒

### セキュリティ確認

- [ ] [Security Headers](https://securityheaders.com/) でA+評価
- [ ] [SSL Labs](https://www.ssllabs.com/ssltest/) でA評価
- [ ] CSP設定が正しく動作

### SEO確認

- [ ] Google Search Consoleにサイトマップ送信
- [ ] [PageSpeed Insights](https://pagespeed.web.dev/) で90+
- [ ] Open Graphが正しく動作（FacebookデバッガーでチェK）
- [ ] Twitter Cardが正しく動作（Validatorでチェック）

### キャッシュ確認

```bash
# HTTPヘッダー確認
curl -I https://yunoxia.one/assets/css/style.css

# 期待される出力:
# Cache-Control: public, max-age=31536000, immutable
```

---

## トラブルシューティング

### Service Workerが更新されない

```javascript
// DevTools → Application → Service Workers
// "Update on reload" にチェック
// または強制アンインストール:
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(r => r.unregister());
});
```

### キャッシュが効かない

1. ブラウザのハードリロード（Cmd+Shift+R / Ctrl+F5）
2. DevTools → Network → "Disable cache" のチェックを外す
3. CDNのキャッシュをパージ

### CORSエラー

```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

**解決**: CDN設定で以下のヘッダーを追加

```
Access-Control-Allow-Origin: *
```

---

## CI/CD 統合（オプション）

### GitHub Actions 例

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Publish to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: yunoxia-site
          directory: .
```

---

## パフォーマンスベンチマーク

### 目標値

| メトリクス | 目標 | 現在値 |
|-----------|------|--------|
| FCP | < 1.8s | |
| LCP | < 2.5s | |
| TBT | < 200ms | |
| CLS | < 0.1 | |
| Speed Index | < 3.0s | |

### 測定ツール

- **Lighthouse**: Chrome DevTools
- **WebPageTest**: https://www.webpagetest.org/
- **PageSpeed Insights**: https://pagespeed.web.dev/
- **GTmetrix**: https://gtmetrix.com/

---

## まとめ

yunoxia.oneのデプロイメントは以下の手順で完了します:

1. ホスティングサービスを選択（推奨: Cloudflare Pages）
2. リポジトリを接続
3. キャッシュヘッダーを設定
4. セキュリティヘッダーを設定
5. デプロイ後チェックリストを確認

**重要**: ビルドステップは不要です。すべて静的ファイルです。

---

**最終更新**: 2025-11-17
**推奨デプロイ先**: Cloudflare Pages
**平均デプロイ時間**: < 5分
