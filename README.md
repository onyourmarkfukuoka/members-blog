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
