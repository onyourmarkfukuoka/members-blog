# On Your Mark! Staff Blog

夏に高校生と大学生でつくるキャンプ「On Your Mark!」のスタッフブログ。

## いまできているもの
- `public-site/` … 一般公開サイト（閲覧者向け）。今はサンプルデータで動きます。
- `admin-site/` … 編集者サイト（Googleログイン → 記事の一時保存/公開）。Firestore / Storage に接続。

公開サイトの記事データは、いまは空（`data/sample-posts.json` の `posts: []`）です。
記事0件でもエラーにならず「まだ記事がありません」と表示されます。次のステップで Firestore 読み込みに切り替えます。

## フォルダ構成
```
public-site/
├─ index.html                … 画面の骨組み（JSは書かない）
├─ css/style.css              … 見た目（水色基調）
├─ js/app.js                  … 動き（読み込み・一覧・記事・年別/カテゴリメニュー・ページ送り）
├─ js/firebase-config.js      … Firebase設定＋初期化
└─ data/sample-posts.json     … サンプル記事（=Firestoreの posts と同じ形）

admin-site/
├─ login.html                … Googleログイン画面
├─ index.html                … 編集画面（骨組みのみ／JSは書かない）
├─ css/style.css              … 見た目（public-siteと統一）
├─ js/firebase-config.js      … Firebase設定＋初期化（public-siteと同じ内容）
├─ js/login.js                … Googleログイン（popup→失敗時redirect）
└─ js/editor.js               … 認証監視・記事の作成/編集・写真アップロード・一時保存/公開・一覧
```
> ルール：**HTMLの中にJavaScriptは書かない**。動きは必ず `js/` の中に。

## カテゴリ
記事は3カテゴリのどれかに必ず属します（編集フォームで必須選択・初期値は「その他」）。

| Firestoreの値 | 表示名 |
| --- | --- |
| `camp` | キャンプ当日 |
| `meeting` | ミーティング |
| `other` | その他 |

`category` が無い記事は `other`（その他）として扱います。
公開サイトのメニューでは「年 → カテゴリ」の順にしぼり込めます（トップの「最新の記事」は全カテゴリ混在のまま）。一覧は1ページ5件で、下に番号式のページ送りが出ます。

## プレビューのしかた
`file://` で直接開くと JSON を読み込めないので、簡易サーバーを立てて見ます。
**リポジトリのルート**で立てると、公開サイトと編集サイトのリンクが行き来できます。

```bash
python3 -m http.server 8000
# 公開サイト : http://localhost:8000/public-site/
# 編集サイト : http://localhost:8000/admin-site/login.html
```

## これから
- Firestore / Storage のセキュリティルール設定（下記）
- 公開サイト `js/app.js` の `loadPosts()` を Firestore（`posts` の `status=="published"`）読み込みに差し替え

## デプロイ（Firebase Hosting・マルチサイト）
公開サイトと編集サイトは**別々の Hosting サイト**として配信します（`firebase.json` の `hosting` を配列で2つ定義）。

| ターゲット | ディレクトリ | HostingサイトID | 公開URL |
| --- | --- | --- | --- |
| `public` | `public-site/` | `onyourmarkfukuoka-blog`（既定サイト） | https://onyourmarkfukuoka-blog.web.app |
| `admin`  | `admin-site/`  | `onyourmarkfukuoka-blog-admin` | https://onyourmarkfukuoka-blog-admin.web.app |

### 初回だけ必要な準備
1. Firebase コンソール → Hosting → 「別のサイトを追加」で **`onyourmarkfukuoka-blog-admin`** という名前のサイトを作る
   （別名にする場合は `.firebaserc` の `targets.…​.hosting.admin` と、`firebase.json` の `redirects[].destination` の2か所を合わせて書き換える）
2. ターゲットとサイトの対応づけ（`.firebaserc` に既に書いてあるので通常は不要。ズレたとき用）:
   ```bash
   firebase target:apply hosting public onyourmarkfukuoka-blog
   firebase target:apply hosting admin  onyourmarkfukuoka-blog-admin
   ```

### デプロイ
```bash
firebase deploy --only hosting            # 両サイト
firebase deploy --only hosting:public     # 公開サイトだけ
firebase deploy --only hosting:admin      # 編集サイトだけ
```

デプロイ後：
- 公開サイト … https://onyourmarkfukuoka-blog.web.app
- 編集サイト … https://onyourmarkfukuoka-blog-admin.web.app （`/login.html` がログイン画面）
- サイトをまたぐリンク（公開サイトの「スタッフ用ログイン」／編集サイトの「公開サイトへもどる」）は
  `firebase.json` の `redirects` でお互いの本番URLへ転送します。ローカル（`python3 -m http.server`）では相対パスのまま動きます。

## Firebase接続時のセキュリティ設定（忘れずに）
`js/firebase-config.js` のウェブ用設定（`apiKey` など）は、クライアントに公開される前提の値。
公開リポジトリに入っていても設計上は問題なく、`apiKey` は秘密鍵ではない（認証を通すための識別子）。
実際の防御は次で行う:

- **Firestore / Storage のセキュリティルール**
  - 読み取り: `status == "published"` のみ全公開
  - 書き込み: ログイン済みのスタッフ（許可リストのアカウント）のみ
- **APIキーの制限**（Google Cloud コンソール）
  - HTTPリファラーを自サイトのドメインに限定する
- 必要に応じて **App Check** を導入する

## 記事データの形（1件）
Firestoreコレクション `posts` の1ドキュメント。`sample-posts.json` も同じフィールド名です。
```json
{
  "id": "p-20260830",
  "pinned": false,
  "status": "published",
  "category": "camp",
  "date": "2026-08-30",
  "editorName": "ゆい",
  "title": "記事タイトル",
  "photos": ["写真のダウンロードURL（最大2枚）"],
  "body": "本文。空行で段落が分かれます。"
}
```
- `category` … `"camp" | "meeting" | "other"`。無い場合は `"other"` 扱い。
- `status` … `"draft"`（一時保存）| `"published"`（公開）。公開サイトは `"published"` のみ表示。
- `photos` … 最大2件。編集サイトで選んだ画像を保存・公開時に Firebase Storage の
  `posts/{postId}/` へアップロードし、そのダウンロードURLを入れる。
- Firestoreにはこのほか `authorUid` / `createdAt` / `updatedAt` / `publishedAt` を保存。

## 困ったときは
編集や表示でうまくいかないことがあれば、団体の共有アドレスまで。
（返信に数日いただくことがあります）
