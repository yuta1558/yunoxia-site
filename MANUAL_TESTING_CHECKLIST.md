# 包括的手動テストチェックリスト - yunoxia.one

このドキュメントは、yunoxia.oneサイトの機能、パフォーマンス、アクセシビリティ、SEO、PWAの包括的な手動テストチェックリストです。

## 目次
- [機能テスト](#機能テスト)
- [パフォーマンステスト](#パフォーマンステスト)
- [アクセシビリティテスト](#アクセシビリティテスト)
- [SEOテスト](#seoテスト)
- [PWAテスト](#pwaテスト)
- [クロスブラウザテスト](#クロスブラウザテスト)
- [セキュリティテスト](#セキュリティテスト)
- [デプロイメントテスト](#デプロイメントテスト)

---

## 機能テスト

### ページ読み込み
- [ ] すべてのページ（index, about, works, log, links）が直接URLでアクセス可能
- [ ] ページ読み込み時にFOUC（Flash of Unstyled Content）が発生しない
- [ ] パーシャル（header, footer）が正しく読み込まれる
- [ ] すべての画像とアイコンが正しく表示される
- [ ] ファビコンが正しく表示される
- [ ] Google Fontsが正しく読み込まれる

### PJAX ナビゲーション
- [ ] ナビゲーションリンクをクリックして各ページに遷移できる
- [ ] PJAX遷移時にページがリロードされない（ネットワークタブで確認）
- [ ] PJAX遷移時にルートプログレスバーが表示される
- [ ] PJAX遷移後もテーマ設定が保持される
- [ ] PJAX遷移後もアクティブナビゲーション状態が更新される
- [ ] ブラウザの戻る/進むボタンが正しく動作する
- [ ] ブラウザの履歴が正しく更新される
- [ ] PJAX遷移後にfade-inアニメーションが再実行される
- [ ] PJAX遷移後にカードチルト効果が動作する
- [ ] PJAX失敗時にフルページリロードにフォールバックする
- [ ] 外部リンクがPJAXでインターセプトされない
- [ ] ハッシュリンクがPJAXでインターセプトされない

### テーマ切り替え
- [ ] テーマトグルスイッチが表示される
- [ ] ライトモードとダークモードが切り替えられる
- [ ] テーマ変更がlocalStorageに保存される
- [ ] ページリロード後もテーマ設定が保持される
- [ ] システムのカラースキーム設定が初回訪問時に反映される
- [ ] システムのカラースキーム変更時に自動更新される（ユーザー設定がない場合）
- [ ] PJAX遷移後もテーマトグルが動作する
- [ ] テーマ切り替え時にスムーズなトランジションが発生する
- [ ] localStorageが無効でもテーマが動作する（デフォルトlightまたはシステム設定）

### アニメーション
- [ ] 初回ページ読み込み時にナビゲーションがアニメーションする（GSAP）
- [ ] 初回ページ読み込み時にメインコンテンツがフェードインする（GSAP）
- [ ] スクロール時に`.fade-in`要素がビューポートに入ると表示される
- [ ] ナビゲーション下線がアクティブリンクに配置される
- [ ] マウスオーバー時にナビゲーション下線が移動する
- [ ] マウスアウト時にナビゲーション下線がアクティブリンクに戻る
- [ ] カード要素にマウスを乗せると3Dチルト効果が発生する
- [ ] カードからマウスを離すと元の位置に戻る
- [ ] `prefers-reduced-motion`設定時にアニメーションが無効化される
- [ ] GSAPが読み込めない場合でもサイトが機能する

### レスポンシブデザイン
- [ ] デスクトップ（1920px）で正しく表示される
- [ ] ラップトップ（1366px）で正しく表示される
- [ ] タブレット（768px）で正しく表示される
- [ ] モバイル（375px）で正しく表示される
- [ ] 極小画面（320px）で正しく表示される
- [ ] ウィンドウサイズ変更時にレイアウトが崩れない
- [ ] ウィンドウリサイズ時にナビゲーション下線が再配置される
- [ ] タッチデバイスでカードチルトが無効化される
- [ ] 横向き（landscape）でも正しく表示される

---

## パフォーマンステスト

### 読み込みパフォーマンス
- [ ] 初回読み込みが3秒以内に完了する
- [ ] PJAX遷移が1秒以内に完了する
- [ ] パーシャルの読み込みが500ms以内に完了する
- [ ] フォントがFOIT（Flash of Invisible Text）を引き起こさない
- [ ] スクリプトの読み込みがレンダリングをブロックしない

### Web Vitals メトリクス
開発者コンソールで確認：
- [ ] LCP (Largest Contentful Paint) < 2.5秒 - "good"
- [ ] FID (First Input Delay) < 100ms - "good"
- [ ] CLS (Cumulative Layout Shift) < 0.1 - "good"
- [ ] FCP (First Contentful Paint) < 1.8秒 - "good"
- [ ] TTFB (Time to First Byte) < 800ms - "good"
- [ ] INP (Interaction to Next Paint) < 200ms - "good"
- [ ] コンソールにメトリクスがカラーコード付きで表示される
- [ ] `WebVitalsMonitor.displayTable()`でテーブル表示できる
- [ ] `WebVitalsMonitor.exportJSON()`でJSON出力できる

### Lighthouse スコア
Chrome DevToolsのLighthouseで確認：
- [ ] Performance: 90以上
- [ ] Accessibility: 90以上
- [ ] Best Practices: 90以上
- [ ] SEO: 90以上
- [ ] PWA: インストール可能（manifest.jsonとService Worker検出）

### ネットワーク効率
- [ ] HTTPリクエスト数が最小限（15以下が理想）
- [ ] 総転送サイズが小さい（150KB以下が理想、初回読み込み）
- [ ] CDNリソース（GSAP、Fonts、Web Vitals）が正しく読み込まれる
- [ ] キャッシュヘッダーが適切に設定されている
- [ ] 静的アセット（CSS、JS、画像）が長期キャッシュされる
- [ ] gzip/brotli圧縮が有効（本番環境）

---

## アクセシビリティテスト

### キーボードナビゲーション
- [ ] Tabキーですべてのインタラクティブ要素に到達できる
- [ ] フォーカス状態が視覚的に明確
- [ ] Enterキーでリンクをアクティブ化できる
- [ ] Spaceキーでテーマトグルを切り替えられる
- [ ] キーボードトラップが存在しない
- [ ] フォーカス順序が論理的
- [ ] Skipリンクでメインコンテンツにジャンプできる（該当する場合）

### スクリーンリーダー
NVDA / JAWS / VoiceOverで確認：
- [ ] ページタイトルが読み上げられる
- [ ] ランドマーク（header, nav, main, footer）が認識される
- [ ] 見出し構造（h1, h2, h3）が論理的
- [ ] リンクテキストが説明的
- [ ] テーマトグルの状態が読み上げられる
- [ ] `.sr-only`クラスの内容が読み上げられる
- [ ] 装飾的要素が`aria-hidden="true"`で非表示
- [ ] ナビゲーションのアクティブ状態が伝わる

### カラーコントラスト
- [ ] ライトモードのテキストコントラストがWCAG AA基準を満たす（4.5:1以上）
- [ ] ダークモードのテキストコントラストがWCAG AA基準を満たす（4.5:1以上）
- [ ] リンクが周囲のテキストと区別可能
- [ ] ボタンとインタラクティブ要素が視認可能
- [ ] フォーカスインジケーターが十分なコントラストを持つ

### セマンティックHTML
- [ ] `<header>`, `<nav>`, `<main>`, `<footer>`が使用されている
- [ ] 見出しレベルがスキップされていない（h1→h2→h3）
- [ ] リストが適切にマークアップされている
- [ ] `lang="ja"`属性が設定されている
- [ ] `role`属性が適切に使用されている（role="main"）

---

## SEOテスト

### メタタグ
各ページ（index, about, works, log, links）で確認：
- [ ] `<title>`タグが一意で説明的
- [ ] `meta description`が設定されている（150-160文字推奨）
- [ ] `meta keywords`が適切
- [ ] `meta author`が設定されている
- [ ] Canonical URLが正しく設定されている
- [ ] Open Graphタグが完全（og:title, og:description, og:image, og:url, og:type, og:locale）
- [ ] Twitter Cardタグが完全（twitter:card, twitter:title, twitter:description, twitter:image）
- [ ] テーマカラーが設定されている（light/dark両方）

### サイトマップとロボット
- [ ] `/sitemap.xml`がアクセス可能
- [ ] サイトマップのXMLが有効
- [ ] サイトマップにすべてのページが含まれている（5ページ）
- [ ] サイトマップのURLが正しい（https://yunoxia.one/...）
- [ ] サイトマップの`lastmod`日付が設定されている
- [ ] サイトマップの`priority`が適切
- [ ] `/robots.txt`がアクセス可能
- [ ] robots.txtにサイトマップURLが記載されている
- [ ] robots.txtの`Allow: /`ディレクティブが正しい
- [ ] robots.txtの`Disallow`ルールが適切

### マニフェストとPWA
- [ ] `/manifest.json`がHTMLにリンクされている
- [ ] manifest.jsonが有効なJSON
- [ ] マニフェストがすべてのページでリンクされている

### クローラビリティ
- [ ] すべてのページが相互リンクされている
- [ ] リンクが`<a>`タグで実装されている（JavaScriptのみではない）
- [ ] URLがクリーンで読みやすい
- [ ] 重複コンテンツがない

---

## PWAテスト

### マニフェスト
- [ ] `/manifest.json`がアクセス可能
- [ ] マニフェストが有効なJSON
- [ ] `name`: "yunoxia.one - ゆーのくしあの個人サイト"が設定されている
- [ ] `short_name`: "yunoxia.one"が設定されている
- [ ] `description`が設定されている
- [ ] `icons`配列が定義されている
- [ ] `start_url`: "/"が設定されている
- [ ] `display`: "standalone"が設定されている
- [ ] `theme_color`と`background_color`が設定されている
- [ ] `lang`: "ja"が設定されている

### Service Worker
DevTools > Application > Service Workersで確認：
- [ ] Service Workerが正しく登録される
- [ ] Service Workerのスコープが`/`
- [ ] Service WorkerがActivate状態になる
- [ ] コンソールに"[PWA] Service Worker registered successfully"が表示される
- [ ] エラーが発生していない

### キャッシュ
DevTools > Application > Cache Storageで確認：
- [ ] キャッシュ"yunoxia-v1"が作成される
- [ ] プリキャッシュアセットがすべて含まれている：
  - [ ] `/`, `/index.html`
  - [ ] `/about.html`, `/works.html`, `/log.html`, `/links.html`
  - [ ] `/assets/css/style.css`
  - [ ] `/assets/js/app.js`, `/assets/js/web-vitals.js`
  - [ ] `/assets/favicon.svg`, `/assets/logo.svg`
  - [ ] `/partials/header.html`, `/partials/footer.html`
  - [ ] `/manifest.json`

### オフライン機能
1. サイトをオンラインで開く
2. DevToolsでオフラインモードに切り替える（Network > Offline）
3. テスト：
- [ ] ページがオフラインでも表示される
- [ ] PJAX遷移がオフラインでも動作する（キャッシュ済みページ）
- [ ] テーマ切り替えがオフラインでも動作する
- [ ] アニメーションがオフラインでも動作する
- [ ] コンソールに"[Service Worker] Serving from cache"が表示される
- [ ] オフライン時に未キャッシュページは適切にフォールバックする

### インストール可能性
- [ ] Chrome/Edgeでインストールプロンプトが表示される（アドレスバーのアイコン）
- [ ] "Add to Home Screen"がモバイルで機能する
- [ ] インストール後にスタンドアロンモードで起動する
- [ ] インストール後もすべての機能が動作する
- [ ] アプリアイコンが正しく表示される
- [ ] アンインストールが正常に動作する

### Service Worker更新
1. Service Workerファイル（sw.js）を変更
2. ページをリロード
3. テスト：
- [ ] 新しいService Workerが検出される
- [ ] コンソールに"[PWA] New content available"が表示される
- [ ] ハードリフレッシュで新しいバージョンがアクティブになる

---

## クロスブラウザテスト

### デスクトップブラウザ
- [ ] Chrome (最新版) - すべての機能が動作
- [ ] Firefox (最新版) - すべての機能が動作
- [ ] Safari (最新版) - すべての機能が動作
- [ ] Edge (最新版) - すべての機能が動作
- [ ] Opera (最新版、オプション) - すべての機能が動作

### モバイルブラウザ
- [ ] iOS Safari (最新版) - すべての機能が動作
- [ ] Chrome for Android (最新版) - すべての機能が動作
- [ ] Samsung Internet (オプション) - すべての機能が動作
- [ ] Firefox for Android (オプション) - すべての機能が動作

### 各ブラウザで確認
- [ ] すべての機能が動作する
- [ ] レイアウトが崩れない
- [ ] アニメーションが正しく表示される
- [ ] テーマ切り替えが動作する
- [ ] PJAX遷移が動作する
- [ ] Service Workerが動作する（対応ブラウザ）
- [ ] Web Vitalsが計測される
- [ ] フォントが正しく表示される

### 互換性チェック
- [ ] ES6+機能がサポートされていないブラウザでエラーが発生しない
- [ ] Service Worker非対応ブラウザでも基本機能が動作する
- [ ] IntersectionObserver非対応ブラウザでもコンテンツが表示される
- [ ] GSAP読み込み失敗時もサイトが機能する
- [ ] Web Vitals読み込み失敗時もサイトが機能する

---

## セキュリティテスト

### HTTPSとセキュリティヘッダー
本番環境で確認（DevTools > Network > Response Headers）：
- [ ] HTTPSで配信されている
- [ ] SSL証明書が有効
- [ ] `X-Frame-Options: DENY`ヘッダーが設定されている
- [ ] `X-Content-Type-Options: nosniff`ヘッダーが設定されている
- [ ] `X-XSS-Protection: 1; mode=block`ヘッダーが設定されている
- [ ] `Referrer-Policy`が適切に設定されている
- [ ] `Permissions-Policy`が設定されている

### Content Security Policy (CSP)
- [ ] CSPヘッダーが設定されている（Netlify/Vercel）
- [ ] インラインスクリプトが許可されている（FOUC防止スクリプト用）
- [ ] 外部CDNが許可されている：
  - [ ] cdn.jsdelivr.net (GSAP, Web Vitals)
  - [ ] fonts.googleapis.com
  - [ ] fonts.gstatic.com
- [ ] CSP違反がコンソールに表示されない
- [ ] 画像、スタイル、スクリプトが正常に読み込まれる

### Mixed Content
- [ ] HTTPSページからHTTPリソースが読み込まれていない
- [ ] すべてのCDNリソースがHTTPS経由
- [ ] 外部リンクがHTTPS（該当する場合）

---

## デプロイメントテスト

### ローカル環境
```bash
python3 -m http.server
```
- [ ] http://localhost:8000 でサイトが表示される
- [ ] すべての機能がローカルで動作する
- [ ] Service Workerがlocalhostで登録される

### Netlify
設定ファイル: `netlify.toml`
- [ ] netlify.tomlが存在する
- [ ] ビルドコマンドが正しい
- [ ] publishディレクトリが"."
- [ ] デプロイが成功する
- [ ] 本番URLでサイトが表示される
- [ ] リダイレクトルールが動作する（/index.html → /）
- [ ] ヘッダールールが適用されている
- [ ] HTTPSが有効
- [ ] カスタムドメインが設定されている（該当する場合）

### Vercel
設定ファイル: `vercel.json`
- [ ] vercel.jsonが存在する
- [ ] プロジェクト設定が正しい
- [ ] デプロイが成功する
- [ ] 本番URLでサイトが表示される
- [ ] ヘッダーが適用されている
- [ ] リダイレクトが動作する
- [ ] HTTPSが有効
- [ ] カスタムドメインが設定されている（該当する場合）

### GitHub Pages
設定ファイル: `.nojekyll`, `.github/workflows/deploy.yml`
- [ ] .nojekyllファイルが存在する
- [ ] GitHub Actionsワークフローが存在する
- [ ] ワークフローが正常に実行される
- [ ] Pages設定が有効化されている（Settings > Pages）
- [ ] GitHub Pages URLでサイトが表示される
- [ ] カスタムドメインが設定されている（該当する場合）
- [ ] HTTPSが有効（Enforce HTTPS）

### Cloudflare Pages
設定ファイル: `_headers`, `_redirects`
- [ ] _headersファイルが存在する
- [ ] _redirectsファイルが存在する
- [ ] ビルド設定が正しい（ビルドコマンド不要）
- [ ] デプロイが成功する
- [ ] 本番URLでサイトが表示される
- [ ] ヘッダーが適用されている
- [ ] リダイレクトが動作する
- [ ] HTTPSが有効
- [ ] カスタムドメインが設定されている（該当する場合）

### 本番環境共通チェック
- [ ] すべてのページが正しく表示される
- [ ] PJAX遷移が動作する
- [ ] テーマ切り替えが動作する
- [ ] Service Workerが登録される
- [ ] Web Vitalsが計測される
- [ ] SEOメタタグが正しい
- [ ] sitemap.xmlとrobots.txtがアクセス可能
- [ ] OGP画像が正しく表示される（SNSシェアテスト）
- [ ] ファビコンが表示される
- [ ] パフォーマンスが良好（Lighthouse 90+）

---

## パフォーマンス監視

### Web Vitals ダッシュボード
開発者コンソールで実行：
```javascript
// メトリクスサマリーを表示
WebVitalsMonitor.displayTable();

// JSONエクスポート
console.log(WebVitalsMonitor.exportJSON());

// 特定のメトリクスを確認
WebVitalsMonitor.metrics.LCP
WebVitalsMonitor.metrics.FID
WebVitalsMonitor.metrics.CLS
WebVitalsMonitor.metrics.FCP
WebVitalsMonitor.metrics.TTFB
WebVitalsMonitor.metrics.INP
```

### 継続的監視
- [ ] 定期的にLighthouseスコアを確認（月1回推奨）
- [ ] Web Vitalsメトリクスが劣化していないか確認
- [ ] ページサイズの増加をモニタリング
- [ ] 新しい機能追加時にパフォーマンステストを実施
- [ ] Service Workerバージョン更新時にキャッシュを確認

---

## リグレッションテスト

新しい機能を追加した際に確認：
- [ ] 既存のPJAX機能が壊れていない
- [ ] テーマ切り替えが動作する
- [ ] すべてのアニメーションが正しく動作する
- [ ] Service Workerが正常に動作する
- [ ] Web Vitalsメトリクスが劣化していない（±10%以内）
- [ ] すべてのページが正しく表示される
- [ ] アクセシビリティが損なわれていない
- [ ] Lighthouseスコアが維持されている（90+）
- [ ] クロスブラウザ互換性が維持されている

---

## エッジケーステスト

### ネットワーク条件
- [ ] Slow 3G接続でもサイトが使用可能
- [ ] オフライン→オンライン復帰時にキャッシュが更新される
- [ ] 断続的な接続でもPJAXが適切にフォールバックする

### ブラウザ機能
- [ ] JavaScriptが無効でも基本コンテンツが表示される
- [ ] localStorageが無効でもテーマが動作する
- [ ] Cookieが無効でも機能する
- [ ] プライベートブラウジングモードで動作する

### エッジ入力
- [ ] ウィンドウサイズを極端に変更しても崩れない（320px - 3840px）
- [ ] ブラウザズーム（50% - 200%）でもレイアウトが維持される
- [ ] 高DPIディスプレイで正しく表示される
- [ ] ダークモード/ライトモード頻繁切り替えでエラーが発生しない

---

## ツールと推奨環境

### 推奨テストツール
- **Chrome DevTools**: パフォーマンス、ネットワーク、アクセシビリティ監査
- **Lighthouse**: 包括的スコアリング（Performance, Accessibility, SEO, PWA）
- **WebPageTest**: 詳細なパフォーマンス分析
- **WAVE**: アクセシビリティ検証
- **axe DevTools**: アクセシビリティ検証
- **BrowserStack**: クロスブラウザ/デバイステスト

### テスト環境
```bash
# ローカルサーバー起動
python3 -m http.server
# または
python -m SimpleHTTPServer 8000

# ブラウザで開く
open http://localhost:8000
```

---

## 報告と追跡

バグや問題を発見した場合：
1. **詳細を記録**: ブラウザ、OS、バージョン、デバイス
2. **再現手順**: ステップバイステップで記述
3. **スクリーンショット/動画**: 問題を視覚的に記録
4. **コンソールエラー**: エラーメッセージをコピー
5. **GitHubイシュー作成**: 上記情報を含めて報告
6. **優先度設定**: Critical / High / Medium / Low

### イシューテンプレート
```markdown
## 問題の概要
[簡潔な説明]

## 環境
- ブラウザ: Chrome 120.0
- OS: Windows 11
- デバイス: Desktop
- URL: https://yunoxia.one/about.html

## 再現手順
1. ...
2. ...
3. ...

## 期待される動作
[期待される結果]

## 実際の動作
[実際に起こったこと]

## スクリーンショット
[画像を添付]

## コンソールエラー
```
[エラーメッセージ]
```

## 追加情報
[その他関連情報]
```

---

## テストスケジュール

### リリース前（必須）
- [ ] すべての機能テスト
- [ ] パフォーマンステスト（Lighthouse 90+）
- [ ] アクセシビリティテスト
- [ ] クロスブラウザテスト（Chrome, Firefox, Safari）
- [ ] モバイルテスト（iOS, Android）
- [ ] SEOテスト（全ページ）
- [ ] PWAテスト

### 月次メンテナンス（推奨）
- [ ] Lighthouseスコア確認
- [ ] Web Vitals確認
- [ ] リンク切れチェック
- [ ] セキュリティヘッダー確認
- [ ] Service Workerキャッシュ確認

### 四半期レビュー（推奨）
- [ ] 全機能テスト
- [ ] 新ブラウザバージョンでの互換性確認
- [ ] アクセシビリティ監査
- [ ] パフォーマンス最適化レビュー

---

**作成日**: 2025-11-17
**メンテナー**: yuta1558 / yunoxia.one
**バージョン**: 1.0.0

---

## チェックリスト使用方法

1. **テスト実施前**: このファイルをコピーして日付付きファイルを作成
2. **テスト中**: 各項目を確認してチェックを入れる
3. **問題発見時**: 該当項目にメモを追加、GitHubイシューを作成
4. **テスト完了後**: 結果をドキュメント化、未解決項目を追跡
5. **次回テスト**: 前回の結果を参考に優先順位を調整
