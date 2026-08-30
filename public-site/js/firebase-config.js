/* =========================================================
   On Your Mark! Staff Blog — Firebase 設定の入れ物
   ---------------------------------------------------------
   このファイルは Firebase のウェブ用SDK設定（firebaseConfig）を
   置いておくための「入れ物」です。
   まだ実際の値は入っていません。プレースホルダーのままです。

   ▼ 使い方（あとで自分で作業するところ）
   1. Firebase コンソール → プロジェクトの設定 → 「マイアプリ」→
      ウェブアプリの「SDK の設定と構成」を開く
   2. そこに表示される firebaseConfig の値をコピーする
   3. 下の "ここに〜を貼る" の部分を、コピーした値に書き換える
      （ダブルクォート " " はそのまま残して、中身だけ差し替える）

   ※ このプロジェクトの方針どおり、HTMLには書かず独立した .js にしています。
   ※ 後続のスクリプト（例: js/app.js や編集者サイト側）から
     firebaseConfig という名前で参照できます。
   ========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyD8bOYMC6rSW8h9r85GG4J6lBH-zyB7_pE",
  authDomain: "onyourmarkfukuoka-blog.firebaseapp.com",
  projectId: "onyourmarkfukuoka-blog",
  storageBucket: "onyourmarkfukuoka-blog.firebasestorage.app",
  messagingSenderId: "268417636152",
  appId: "1:268417636152:web:108ed576ccf51a94bb53cd"
};
// モジュール形式で読み込む場合にも参照できるよう、window にも載せておきます。
// （通常の <script> 読み込みなら firebaseConfig をそのまま使えます）
window.firebaseConfig = firebaseConfig;
