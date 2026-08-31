/* =========================================================
   On Your Mark! Staff Blog Edit — Firebase 設定の入れ物
   ---------------------------------------------------------
   公開サイト（public-site/js/firebase-config.js）と
   まったく同じ設定を使います。内容もそろえてあります。

   ※ このプロジェクトの方針どおり、HTMLには書かず独立した .js にしています。
   ※ 後続のスクリプト（js/login.js / js/editor.js）から
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
window.firebaseConfig = firebaseConfig;

/* ---------------------------------------------------------
   Firebase の初期化
   ---------------------------------------------------------
   各HTMLで先に読み込んだ compat版SDK（firebase-app / firebase-auth /
   firebase-firestore、編集画面ではさらに firebase-storage）が使える前提です。
   ここで一度だけ initializeApp を呼び、以降は firebase.auth() /
   firebase.firestore() / firebase.storage() を各スクリプトから使えるようにします。
   （二重初期化を避けるため、すでに初期化済みなら何もしません）
   --------------------------------------------------------- */
if (typeof firebase !== "undefined") {
  if (!firebase.apps || !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
} else {
  console.error(
    "Firebase SDK が読み込まれていません。HTMLの <script> 読み込み順を確認してください（Firebase本体 → firebase-config.js → login.js / editor.js）。"
  );
}
