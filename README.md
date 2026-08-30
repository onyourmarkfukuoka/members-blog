# On Your Mark! Staff Blog

夏に高校生と大学生でつくるキャンプ「On Your Mark!」のスタッフブログ。

## いまできているもの
- `public-site/` … 一般公開サイト（閲覧者向け）の見た目。今はサンプルデータで動きます。

## フォルダ構成（公開サイト）
```
public-site/
├─ index.html                … 画面の骨組み（JSは書かない）
├─ css/style.css              … 見た目（水色基調）
├─ js/app.js                  … 動き（読み込み・一覧・記事・年別メニュー）
├─ js/firebase-config.js      … Firebase設定の入れ物（後でコンソールの値に差し替え）
└─ data/sample-posts.json     … サンプル記事（=後でFirestoreに置き換える形）
```
> ルール：**HTMLの中にJavaScriptは書かない**。動きは必ず `js/` の中に。

## プレビューのしかた
`file://` で直接開くと JSON を読み込めないので、簡易サーバーを立てて見ます。

```bash
cd public-site
python3 -m http.server 8000
# ブラウザで http://localhost:8000 を開く
```

## これから
- 編集者サイト（Googleログイン → 記事の作成・写真アップ・一時保存/公開）
- Firebase（Firestore / Storage / Hosting）への接続
- `sample-posts.json` を Firestore の `published` に置き換え

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
```json
{
  "id": "p-20260830",
  "pinned": false,
  "status": "published",
  "date": "2026-08-30",
  "editorName": "ゆい",
  "title": "記事タイトル",
  "photos": ["写真URL（最大3枚）"],
  "body": "本文。空行で段落が分かれます。"
}
```

## 困ったときは
編集や表示でうまくいかないことがあれば、団体の共有アドレスまで。
（返信に数日いただくことがあります）
