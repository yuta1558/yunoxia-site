# デプロイと移行（site/）

> 2026-10-18 現在: yunoxia.one は新しいプロジェクト（yunoxia-next）に付け替え済み。旧プロジェクト（yunoxia-site）は自動デプロイを止めてあり、リポジトリのルートにあった旧サイトのファイルは削除した。手順 1〜3 は記録として残す。旧プロジェクトを消すときは、デプロイが 100 件を超えているのでダッシュボードからは消せない。Cloudflare の Known issues にある「Delete a project with a high amount of deployments」のスクリプトで本番以外のデプロイを消してから削除する。

新しいサイトは、今の yunoxia.one とは別の Cloudflare Pages プロジェクトでデプロイする。ドメインを付け替えるまで、今のサイトは止まらない。

ドメインの付け替え（手順 3）と、D1・シークレットの作成（手順 4）はオーナーが行う。コードの側は準備済み。

## 1. 新しい Pages プロジェクトを作る

Cloudflare ダッシュボード → Workers & Pages → Create → Pages → Connect to Git。

| 項目 | 値 |
| --- | --- |
| リポジトリ | yuta1558/yunoxia-site |
| プロジェクト名 | 例：yunoxia-next（`*.pages.dev` のサブドメインになる） |
| Production branch | main |
| Framework preset | Astro（または None） |
| Root directory | `site` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| 環境変数 | 不要。Node のバージョンは `site/.node-version`（22）で決まる |

今の Pages プロジェクト（yunoxia-site）の設定は変えない。

## 2. プレビューで確かめる

`https://<プロジェクト名>.pages.dev` に対して確認する。

```sh
B=https://<プロジェクト名>.pages.dev
curl -sI $B/ | grep -i cache-control                       # max-age=0, must-revalidate
curl -sI $B/nope | head -1                                  # 404
curl -sI $B/about.html | grep -iE '^(HTTP|location)'        # 301 -> /about/
curl -sI $B/links.html | grep -iE '^(HTTP|location)'        # 301 -> /about/
curl -sI "$B$(curl -s $B/ | grep -o '/_astro/[^"]*\.css' | head -1)" | grep -i cache-control   # immutable
curl -sI $B/assets/ogp-v2.png | grep -i cache-control       # immutable
curl -s  $B/robots.txt                                      # Sitemap 行あり、Disallow なし
curl -sI $B/admin/ | grep -iE 'x-robots|content-security'   # noindex と CSP
```

CMS のバインディングがまだなら、`/api/posts` は 503 を返す。`/log/` と `/rss.xml` は静的な内容のまま表示される（正常）。

## 3. ドメインの付け替え（オーナーのみ）

1. 今のプロジェクト（yunoxia-site）→ Custom domains から `yunoxia.one` を外す。
2. 新しいプロジェクト → Custom domains → `yunoxia.one` を追加する。www は Redirect Rules で apex に転送済みなので、追加は不要。
3. 数分待ってから、手順 2 の確認を `B=https://yunoxia.one` で繰り返す。
4. 追加で次を確認する。
   - X や Discord で OGP カードが出る（og:image は `/assets/ogp-v2.png` のまま）
   - 以前のサイトを開いたことがあるブラウザで、トップを 2 回読み込むと新しいサイトになる（`sw.js` の停止スイッチが古い Service Worker を解除する）
   - Browser Cache TTL は「既存のヘッダーを優先」のまま
5. 切り戻し：問題があれば、Custom domains を新しいプロジェクトから外し、今のプロジェクトに戻す。DNS は Cloudflare 内で完結するので、数分で戻る。

HSTS は付け替えとは別に段階的に入れる（1 日 → 1 か月 → 1 年）。入れるときは `public/_headers` の `/*` に `Strict-Transport-Security` を追加する。

## 4. CMS（ブログ）

### 構成

| 部品 | 場所 |
| --- | --- |
| API | `functions/api/`（posts、auth/login、auth/verify、preview、upload） |
| 公開ページ | `functions/log/p/[slug].js` → `/log/p/<slug>/` |
| Log 一覧への差し込み | `functions/log/index.js`（`/log/` の静的 HTML に公開記事を先頭へ追加） |
| トップの Log への差し込み | `functions/index.js`、`functions/en/index.js`（新しい記事を先頭に、合計 3 件） |
| 更新マーク | `functions/updates.json.js`（公開記事の更新日時を `/updates.json` に足す） |
| RSS への差し込み | `functions/rss.xml.js` |
| 管理画面 | `public/admin/`（`/admin/`、noindex、外部スクリプトなし） |
| 本文エディタ | `src/admin/editor.ts`（CodeMirror 6、ライブプレビュー）。`scripts/build-admin.mjs` がビルドと dev の前に `public/admin/editor.js` へまとめる（生成物なのでコミットしない） |
| CLI からの投稿 | `scripts/cms.mjs`（4-6） |
| スキーマ | `migrations/0001_create_posts.sql` |
| Functions を動かす範囲 | `public/_routes.json`（上の差し込み先と API だけ。他は静的配信） |

公開ページは、ビルド済みの `/log/` を殻として読み込み、HTMLRewriter で `<main>` を差し替えて返す。ヘッダー、フッター、フォント、CSS はビルドと同じものになる。Markdown の変換は `functions/_lib/markdown.js` が行う。生の HTML は通さず、リンクと画像の URL は http(s)、mailto、サイト内パスに限る。

Log の Markdown（`src/content/log/`）は、CMS 以前の記録として残す。CMS の記事は、一覧と RSS で Markdown の記事より上に並ぶ。CMS の記事は sitemap には入らない（必要になったら sitemap を Function で拡張する）。

### 4-1. D1 を作る

```sh
cd site
npx wrangler login
npx wrangler d1 create yunoxia-blog            # 出力された database_id を控える
cp wrangler.toml.example wrangler.toml          # database_id を書き換える
npx wrangler d1 migrations apply yunoxia-blog --remote
```

### 4-2. バインディング（どちらか一方）

- A. ダッシュボードで設定する（コード変更なし）：新しいプロジェクト → Settings → Bindings → D1 database を追加し、変数名 `DB`、データベース `yunoxia-blog` を選ぶ。この場合 `wrangler.toml` はコミットしない（4-1 のコピーはマイグレーション用に手元だけで使う）。
- B. `wrangler.toml` をコミットする：database_id を入れた `site/wrangler.toml` をコミットする。以後はこのファイルがバインディングの正になり、ダッシュボードではバインディングを編集できなくなる。

おすすめは A。D1 の ID は秘密ではないが、A ならコードを変えずに済み、ダッシュボード側で完結する。

画像アップロードを使う場合だけ、R2 バケット（例：yunoxia-images）を作り、同じ手順で変数名 `IMAGES` としてバインドする。バインドしなければ、アップロードだけが 503 を返し、他は動く。

### 4-3. シークレット

新しいプロジェクト → Settings → Variables and Secrets に、種類「Secret」で登録する（Production と Preview の両方）。

| 名前 | 値 |
| --- | --- |
| `JWT_SECRET` | 32 バイト以上のランダム文字列。`openssl rand -base64 48` |
| `ADMIN_PASSWORD_HASH` | 下のコマンドで作る |
| `ADMIN_USERNAME` | 任意（省略時は admin）。種類は通常の変数でよい |
| `CMS_API_TOKEN` | 任意。`scripts/cms.mjs`（Claude からの投稿）用の API トークン。32 文字以上、`openssl rand -base64 48`。未設定なら CLI からは書けない |

パスワードのハッシュ（PBKDF2-SHA256、10 万回、ソルト付き）は手元で作る。パスワードはシェルの履歴に残さない。

```sh
node -e "const c=require('crypto');const rl=require('readline').createInterface({input:process.stdin,output:process.stderr});rl.question('password: ',p=>{const s=c.randomBytes(16);console.log('pbkdf2\$100000\$'+s.toString('base64')+'\$'+c.pbkdf2Sync(p,s,100000,32,'sha256').toString('base64'));rl.close()})"
```

### 4-4. ログイン試行の制限

主な対策はアプリ側の制限（`functions/_lib/attempts.js`、テーブルは `migrations/0002_login_attempts.sql`）。同じ IP からの失敗が 15 分に 5 回、全体で 30 回を超えると 429 を返す。成功するとその IP の記録は消える。0002 を適用していないとログインは 503 になる（制限なしで動かさないため）。

ゾーンの WAF ルールは `*.pages.dev`（プロジェクトの別名とブランチのプレビュー）には効かないので、補助と考える。Free プランでは期間が 10 秒しか選べない（現在は 10 回／10 秒で設定済み）。パスワードは 20 文字以上のランダムな文字列にする。

### 4-5. ローカルで動かす

```sh
cd site
cp wrangler.toml.example wrangler.toml
printf 'JWT_SECRET="dev-secret-change-me"\nADMIN_PASSWORD_HASH="<4-3 で作った値>"\n' > .dev.vars
npm run build
npx wrangler d1 migrations apply yunoxia-blog --local
npx wrangler pages dev                         # http://localhost:8788/admin/
```

`wrangler.toml`、`.dev.vars`、`.wrangler/` はコミットしない。

### 4-6. Claude（CLI）から書く

`scripts/cms.mjs` は API トークンで API を呼び、記事の作成・更新・公開をする。管理画面のパスワードは使わない。

```sh
cd site
export CMS_TOKEN=<CMS_API_TOKEN と同じ値>      # CMS_URL は省略時 https://yunoxia.one
node scripts/cms.mjs list                      # 記事の一覧（下書きを含む）
node scripts/cms.mjs get <slug> > post.md      # 既存の記事をファイルに書き出す
node scripts/cms.mjs push post.md              # 作成。同じ slug があれば更新
node scripts/cms.mjs push post.md --publish    # 公開して URL を表示
```

ファイルはフロントマター（`title`、`slug`、`excerpt`、`tags`、`status`、`featured_image`）付きの Markdown。本文や `featured_image` にローカルの画像パスがあれば、先にアップロードして URL に置き換える（R2 の `IMAGES` が必要）。

設定：

1. Pages の Secret に `CMS_API_TOKEN` を登録する（4-3）。
2. Claude の環境（クラウド環境の設定）に、同じ値を環境変数 `CMS_TOKEN` として登録する。チャットには貼らない。
3. 漏れたと思ったら `CMS_API_TOKEN` を作り直す。古い値はその時点で使えなくなる。

トークンは管理者と同じ権限（作成、更新、削除、アップロード）を持つ。CLI は削除を持たない。

## PR #41 からの変更点

| 項目 | PR #41 | 今回 |
| --- | --- | --- |
| `/api/auth/login` の配置 | `functions/api/auth.js`（`/api/auth` にしか当たらず、login に届かない） | `functions/api/auth/login.js` |
| パスワード | ソルトなし SHA-256、通常の比較 | ソルト付き PBKDF2、定数時間比較 |
| CORS | 任意のオリジンを許可 | 送らない（管理画面は同一オリジン） |
| 画像 | SVG を許可（同一オリジンで実行されうる） | SVG を拒否。配信時に nosniff と sandbox の CSP |
| エラー応答 | 例外メッセージを返す | 返さない |
| 入力検証 | タイトルと本文の有無のみ | 長さ、slug の形式、タグ数、状態、画像 URL |
| Markdown | marked + DOMPurify（CDN） | サーバー側の安全な変換（生 HTML なし） |
| 管理画面 | EasyMDE ほか CDN 4 本、トークンは localStorage | 外部スクリプトなし、厳しい CSP、トークンは sessionStorage |
