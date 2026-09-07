/* =========================================================
   On Your Mark! Staff Blog Edit — ログイン処理
   ---------------------------------------------------------
   HTMLには一切JSを書かず、ここだけで動きを管理します。
   画面の文言は js/i18n.js（JP / EN 切り替え）を通して出します。

   やること：
   - すでにログイン済みなら index.html（編集画面）へ進める
   - 「Googleでログイン」ボタン：まず popup、ダメなら redirect
   - redirect から戻ってきた場合の結果も受け取る
   ========================================================= */

const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

const t = (key, params) => (window.I18N ? window.I18N.t(key, params) : key);

/* Google のログイン画面の言語を、選ばれた言語に合わせる */
function syncAuthLanguage() {
  if (window.I18N) {
    auth.languageCode = window.I18N.getLang() === "en" ? "en" : "ja";
  } else {
    auth.useDeviceLanguage();
  }
}
syncAuthLanguage();

const el = (id) => document.getElementById(id);
const loginBtn = el("googleLoginBtn");
const msg = el("authMsg");

/* 言語が変わっても出し直せるよう、キーで保持 */
let msgState = null; // { key, isError } | null

function setMsg(key, opts) {
  opts = opts || {};
  msgState = key ? { key, isError: !!opts.isError } : null;
  renderMsg();
}
function renderMsg() {
  if (!msgState) {
    msg.textContent = "";
    msg.classList.remove("is-error");
    return;
  }
  msg.textContent = t(msgState.key);
  msg.classList.toggle("is-error", msgState.isError);
}

window.addEventListener("i18n:change", () => {
  renderMsg();
  syncAuthLanguage();
});

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
    setMsg("login.msg.cantReturn", { isError: true });
  });

/* -----------------------------------------------------------
   ログインボタン
   popup を優先し、popup がブロック／未対応なら redirect に切り替える
----------------------------------------------------------- */
async function signIn() {
  loginBtn.disabled = true;
  setMsg("login.msg.opening");

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
      setMsg("login.msg.switching");
      try {
        await auth.signInWithRedirect(googleProvider);
        return; // ページ遷移するのでここで終わり
      } catch (err2) {
        console.error("signInWithRedirect error:", err2);
        setMsg("login.msg.cantStart", { isError: true });
      }
    } else {
      setMsg("login.msg.failed", { isError: true });
    }
    loginBtn.disabled = false;
  }
}

loginBtn.addEventListener("click", signIn);
