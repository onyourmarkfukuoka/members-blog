/* =========================================================
   On Your Mark! Staff Blog Edit — ログイン処理
   ---------------------------------------------------------
   HTMLには一切JSを書かず、ここだけで動きを管理します。

   やること：
   - すでにログイン済みなら index.html（編集画面）へ進める
   - 「Googleでログイン」ボタン：まず popup、ダメなら redirect
   - redirect から戻ってきた場合の結果も受け取る
   ========================================================= */

const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// 表示言語をブラウザに合わせる（日本語UIになりやすい）
auth.useDeviceLanguage();

const el = (id) => document.getElementById(id);
const loginBtn = el("googleLoginBtn");
const msg = el("authMsg");

function setMsg(text, isError = false) {
  msg.textContent = text || "";
  msg.classList.toggle("is-error", !!isError);
}

/* ログイン成功後の移動先 */
function goToEditor() {
  window.location.replace("index.html");
}

/* -----------------------------------------------------------
   ログイン状態の監視
   すでにログイン済みでこのページ（login.html）を開いたら
   編集画面へ送る。
----------------------------------------------------------- */
auth.onAuthStateChanged((user) => {
  if (user) goToEditor();
});

/* -----------------------------------------------------------
   redirect 方式で戻ってきたときの結果を拾う
   （popup が使えず redirect にフォールバックした場合）
----------------------------------------------------------- */
auth
  .getRedirectResult()
  .then((result) => {
    if (result && result.user) goToEditor();
  })
  .catch((err) => {
    console.error("getRedirectResult error:", err);
    setMsg("ログインに戻れませんでした。もう一度お試しください。", true);
  });

/* -----------------------------------------------------------
   ログインボタン
   popup を優先し、popup がブロック／未対応なら redirect に切り替える
----------------------------------------------------------- */
async function signIn() {
  loginBtn.disabled = true;
  setMsg("ログイン画面をひらいています…");

  try {
    await auth.signInWithPopup(googleProvider);
    // 成功すれば onAuthStateChanged が編集画面へ送る
  } catch (err) {
    console.error("signInWithPopup error:", err);

    const fallbackCodes = [
      "auth/popup-blocked",
      "auth/popup-closed-by-user",
      "auth/cancelled-popup-request",
      "auth/operation-not-supported-in-this-environment"
    ];

    if (fallbackCodes.includes(err.code)) {
      setMsg("別画面でのログインに切り替えます…");
      try {
        await auth.signInWithRedirect(googleProvider);
        return; // ページ遷移するのでここで終わり
      } catch (err2) {
        console.error("signInWithRedirect error:", err2);
        setMsg("ログインを開始できませんでした。時間をおいて再度お試しください。", true);
      }
    } else {
      setMsg("ログインに失敗しました。もう一度お試しください。", true);
    }
    loginBtn.disabled = false;
  }
}

loginBtn.addEventListener("click", signIn);
