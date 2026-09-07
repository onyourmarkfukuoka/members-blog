/* =========================================================
   On Your Mark! Staff Blog Edit — 編集画面のロジック
   ---------------------------------------------------------
   HTMLには一切JSを書かず、ここだけで動きを管理します。
   画面の文言は js/i18n.js（JP / EN 切り替え）を通して出します。

   やること：
   - ログイン状態を監視。未ログインなら login.html へ送る
   - 上部に「◯◯さん ようこそ!」（users/{uid}.displayName ＞ Googleの名前）
   - フォーム：タイトル / 日付 / 編集者名 / カテゴリ / 写真（最大2枚） / 本文
     ・「編集者名」の初期値は、ヘッダーの表示名（profileName）
   - 写真は保存・公開時に Firebase Storage へアップロードし、URLを photos に保存
   - 「一時保存」= status:"draft"、「公開」= status:"published"
   - posts コレクションの一覧を読み込み、選んで再編集
   ---------------------------------------------------------
   Firestore ドキュメント（コレクション posts / 1記事1ドキュメント）
     title, editorName, date, body,
     category     … "camp" | "meeting" | "other"（必須／初期値 "other"）
     photos       … 最大2件。Storage の posts/{postId}/ にあげた画像のダウンロードURL配列
     status       … "draft" | "published"
     authorUid    … 最初に作成したユーザーの uid
     createdAt, updatedAt, publishedAt … サーバータイムスタンプ

   users/{uid}      … { displayName, updatedAt }（本人だけ読み書き可）
   ========================================================= */

/* 想定外のエラーを必ずコンソールに残す（スマホでの不具合調査用）。
   これがあると「押しても反応しない」の原因（例外で処理が止まっている等）が特定しやすい。 */
window.addEventListener("error", function (e) {
  console.error("[admin] uncaught error:", e && e.message, "@", (e && e.filename) + ":" + (e && e.lineno));
});
window.addEventListener("unhandledrejection", function (e) {
  console.error("[admin] unhandled promise rejection:", e && e.reason);
});

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp;

const MAX_PHOTOS = 2; // 写真は最大2枚まで

/* 文言取得のショートカット（js/i18n.js） */
const t = (key, params) => (window.I18N ? window.I18N.t(key, params) : key);

/* カテゴリ：Firestore の保存値。表示名は i18n の "cat.*" キーで出す。
   （保存値 camp/meeting/other は変更しない。表示だけ言語で切り替える） */
const CATEGORY_KEYS = ["camp", "meeting", "other"];
const DEFAULT_CATEGORY = "other";
const categoryLabel = (key) =>
  t("cat." + (CATEGORY_KEYS.includes(key) ? key : DEFAULT_CATEGORY));

const el = (id) => document.getElementById(id);

/* ----------------------- 要素 ----------------------- */
const authGate   = el("authGate");
const adminApp   = el("adminApp");
const welcome    = el("welcome");
const welcomeHint = el("welcomeHint");
const logoutBtn  = el("logoutBtn");

/* ヘッダーの「表示名を変更」まわり */
const editNameBtn   = el("editNameBtn");
const namePanel     = el("namePanel");
const nameInput     = el("nameInput");
const nameSaveBtn   = el("nameSaveBtn");
const nameCancelBtn = el("nameCancelBtn");
const nameStatus    = el("nameStatus");

const adminMain       = el("adminMain");
const homeChoice      = el("homeChoice");
const homeChoiceTitle = el("homeChoiceTitle");
const chooseNewBtn    = el("chooseNew");
const chooseEditBtn   = el("chooseEdit");
const menuBtn         = el("menuBtn");
const editorPanel     = el("editorPanel");
const listPanel       = el("listPanel");

const form         = el("postForm");
const formTitle    = el("formTitle");
const fTitle       = el("fTitle");
const fDate        = el("fDate");
const fEditor      = el("fEditor");
const fCategory    = el("fCategory");
const fBody        = el("fBody");
const formStatus   = el("formStatus");
const editingHint  = el("editingHint");
const newPostBtn   = el("newPostBtn");
const saveDraftBtn = el("saveDraftBtn");
const publishBtn   = el("publishBtn");

const photoUploader = el("photoUploader");
const photoList     = el("photoList");
const photoInput    = el("photoInput");
const photoAddLabel = el("photoAddLabel");
const photoHint     = el("photoHint");

const postList  = el("postList");
const listEmpty = el("listEmpty");

/* 投稿前プレビュー（公開サイトの記事詳細と同じ見た目・保存はしない） */
const previewBtn     = el("previewBtn");
const previewOverlay = el("previewOverlay");
const previewClose   = el("previewClose");
const previewSurface = el("previewSurface");
const pvDate   = el("pvDate");
const pvEditor = el("pvEditor");
const pvTitle  = el("pvTitle");
const pvPhotos = el("pvPhotos");
const pvBody   = el("pvBody");

/* ----------------------- 状態 ----------------------- */
let currentUser = null;
let editingId = null;      // 編集中ドキュメントID（新規なら null）
let editingSnapshot = null; // 編集中ドキュメントの現在の中身

/* ヘッダーのあいさつ＆新規記事の編集者名の初期値に使う表示名。
   users/{uid}.displayName に保存された各自の呼び名。未設定なら null。 */
let profileName = null;

/* 写真スロット（順番＝表示順・最大2）
   { kind: "existing", url }            … すでにStorageにある写真
   { kind: "new", file, previewUrl }    … これからアップロードする写真 */
let photoSlots = [];
let removedPhotoUrls = []; // 保存時に Storage から消したい既存写真のURL

/* 一覧のキャッシュ（言語を切り替えたときに読み直さず出し直すため） */
let cachedMyPosts = [];

/* 言語が変わっても出し直せるよう、動的テキストは「キー＋パラメータ」で保持 */
let formStatusState = null; // { key, params, isError } | null
let nameStatusState = null; // 同上
let gateErrShown = false;

/* ----------------------- 便利関数 ----------------------- */
function todayIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${y}.${m}.${d}`;
}

function setFormStatus(key, opts) {
  opts = opts || {};
  formStatusState = key ? { key, params: opts.params || null, isError: !!opts.isError } : null;
  renderFormStatus();
}
function renderFormStatus() {
  if (!formStatusState) {
    formStatus.textContent = "";
    formStatus.classList.remove("is-error");
    return;
  }
  formStatus.textContent = t(formStatusState.key, formStatusState.params);
  formStatus.classList.toggle("is-error", formStatusState.isError);
}

function setBusy(busy) {
  saveDraftBtn.disabled = busy;
  publishBtn.disabled = busy;
  previewBtn.disabled = busy;
  newPostBtn.disabled = busy;
  photoInput.disabled = busy;
  photoUploader.classList.toggle("is-busy", busy);
  postList.classList.toggle("is-busy", busy); // 保存・削除中は一覧の操作を止める
}

/* 見出し・ヒントは data-i18n 属性を差し替えておく。
   言語切り替え時は i18n.js の applyStatic が拾って自動で訳し直してくれる。 */
function setFormTitle(key) {
  formTitle.setAttribute("data-i18n", key);
  formTitle.textContent = t(key);
}
function setEditingHint(key) {
  if (!key) {
    editingHint.hidden = true;
    editingHint.removeAttribute("data-i18n");
    editingHint.textContent = "";
    return;
  }
  editingHint.hidden = false;
  editingHint.setAttribute("data-i18n", key);
  editingHint.textContent = t(key);
}
function setListEmpty(key) {
  listEmpty.setAttribute("data-i18n", key);
  listEmpty.textContent = t(key);
}

/* ----------------------- ヘッダーの表示名（あいさつ用） ----------------------- */
/* あいさつ／編集者名の初期値に使う名前。優先順位：
   1) 各自が設定した表示名（users/{uid}.displayName）
   2) Google アカウントの名前 / メール（未設定時の暫定）
   3) i18n の "name.fallback" */
function greetingName() {
  return profileName
    || (currentUser && (currentUser.displayName || currentUser.email))
    || t("name.fallback");
}

/* ヘッダーの「◯◯さん ようこそ！」と選択画面の見出しをまとめて更新 */
function updateGreetings() {
  const name = greetingName();
  welcome.textContent = t("welcome", { name });
  homeChoiceTitle.textContent = t("choice.greeting", { name });
  // 表示名が未設定なら、設定をうながす一文を出す（文言は data-i18n で管理）
  welcomeHint.hidden = !!profileName;
}

/* ログイン中ユーザーの表示名を Firestore から読み込む */
async function loadProfile() {
  if (!currentUser) return;
  try {
    const snap = await db.collection("users").doc(currentUser.uid).get();
    const d = (snap.exists && snap.data()) || {};
    profileName =
      typeof d.displayName === "string" && d.displayName.trim()
        ? d.displayName.trim()
        : null;
  } catch (err) {
    // 読めなくても挨拶自体は出す（暫定名にフォールバック）
    console.error("loadProfile error:", err);
    profileName = null;
  }
  updateGreetings();

  // 新規フォームの編集者名が「未入力」または「Googleの名前のまま（＝手入力なし）」なら、
  // 表示名に追従させる。手で書き換えたものは触らない。
  if (!editingId && profileName) {
    const cur = fEditor.value.trim();
    const wasGoogleName = currentUser && currentUser.displayName && cur === currentUser.displayName;
    if (!cur || wasGoogleName) fEditor.value = profileName;
  }
}

function setNameStatus(key, opts) {
  opts = opts || {};
  nameStatusState = key ? { key, params: opts.params || null, isError: !!opts.isError } : null;
  renderNameStatus();
}
function renderNameStatus() {
  if (!nameStatusState) {
    nameStatus.textContent = "";
    nameStatus.classList.remove("is-error");
    return;
  }
  nameStatus.textContent = t(nameStatusState.key, nameStatusState.params);
  nameStatus.classList.toggle("is-error", nameStatusState.isError);
}

function openNameEditor() {
  // 既存の表示名（無ければ Google の名前）を初期値に
  nameInput.value = profileName || (currentUser && currentUser.displayName) || "";
  setNameStatus("");
  namePanel.hidden = false;
  editNameBtn.setAttribute("aria-expanded", "true");
  nameInput.focus();
  nameInput.select();
}

function closeNameEditor() {
  namePanel.hidden = true;
  editNameBtn.setAttribute("aria-expanded", "false");
  setNameStatus("");
}

function toggleNameEditor() {
  namePanel.hidden ? openNameEditor() : closeNameEditor();
}

/* 表示名を保存（users/{uid} に merge）。保存できたら即反映。 */
async function saveName() {
  if (!currentUser) return;
  const value = nameInput.value.trim();
  if (!value) {
    setNameStatus("name.err.empty", { isError: true });
    return;
  }
  if (value.length > 40) {
    setNameStatus("name.err.long", { isError: true });
    return;
  }

  nameSaveBtn.disabled = true;
  nameCancelBtn.disabled = true;
  setNameStatus("name.saving");

  try {
    await db.collection("users").doc(currentUser.uid).set(
      { displayName: value, updatedAt: serverTimestamp() },
      { merge: true }
    );
    profileName = value;
    updateGreetings();

    // これ以降の新規記事の編集者名の初期値に反映。
    // いま開いている新規フォームが未入力／旧デフォルトのままなら、その場でも更新。
    if (!editingId) {
      const cur = fEditor.value.trim();
      const wasGoogleName = currentUser && currentUser.displayName && cur === currentUser.displayName;
      if (!cur || wasGoogleName) fEditor.value = value;
    }

    setNameStatus("name.saved");
    setTimeout(closeNameEditor, 900);
  } catch (err) {
    console.error("saveName error:", err);
    setNameStatus("name.err.save", { isError: true });
  } finally {
    nameSaveBtn.disabled = false;
    nameCancelBtn.disabled = false;
  }
}

/* ----------------------- 写真スロット ----------------------- */
function clearPhotoPreviews() {
  photoSlots.forEach((s) => { if (s.kind === "new") URL.revokeObjectURL(s.previewUrl); });
}

function renderPhotos() {
  photoList.innerHTML = "";
  photoSlots.forEach((slot, i) => {
    const li = document.createElement("li");
    li.className = "photo-item";

    const img = document.createElement("img");
    img.src = slot.kind === "existing" ? slot.url : slot.previewUrl;
    img.alt = t("photo.alt", { n: i + 1 });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "photo-item__del";
    del.setAttribute("aria-label", t("photo.remove", { n: i + 1 }));
    del.textContent = "×";
    del.addEventListener("click", () => removePhoto(i));

    li.append(img, del);
    photoList.appendChild(li);
  });

  photoAddLabel.hidden = photoSlots.length >= MAX_PHOTOS;

  const hintKey = photoSlots.length >= MAX_PHOTOS ? "photo.hintFull" : "photo.hint";
  photoHint.setAttribute("data-i18n", hintKey);
  photoHint.textContent = t(hintKey);
}

function addFiles(fileList) {
  const files = Array.from(fileList || []);
  let added = 0;
  for (const file of files) {
    if (photoSlots.length >= MAX_PHOTOS) {
      setFormStatus("photo.err.max", { isError: true });
      break;
    }
    if (!file.type || !file.type.startsWith("image/")) {
      setFormStatus("photo.err.type", { isError: true });
      continue;
    }
    photoSlots.push({ kind: "new", file, previewUrl: URL.createObjectURL(file) });
    added += 1;
  }
  if (added) setFormStatus("");
  renderPhotos();
}

function removePhoto(i) {
  const slot = photoSlots[i];
  if (!slot) return;
  if (slot.kind === "new") URL.revokeObjectURL(slot.previewUrl);
  if (slot.kind === "existing") removedPhotoUrls.push(slot.url);
  photoSlots.splice(i, 1);
  renderPhotos();
}

/* 1枚を Storage にアップロードして、ダウンロードURLを返す */
async function uploadPhoto(postId, file) {
  const safeName = (file.name || "photo").replace(/[^\w.\-]+/g, "_").slice(-60);
  const path = `posts/${postId}/${Date.now()}_${safeName}`;
  const snap = await storage.ref().child(path).put(file);
  return await snap.ref.getDownloadURL();
}

/* ----------------------- 画面の切り替え ----------------------- */
/* view: "home"（選択画面） | "new"（新規作成） | "edit"（既存の記事を編集） */
function setView(view) {
  adminMain.dataset.view = view;

  homeChoice.hidden  = view !== "home";
  menuBtn.hidden     = view === "home";
  listPanel.hidden   = view !== "edit";
  // 新規作成では最初からフォームを表示。編集では記事を選ぶまで隠す。
  editorPanel.hidden = view === "home" || (view === "edit" && !editingId);

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showHome() {
  updateGreetings();
  setView("home");
}

function startNew() {
  resetForm();
  setView("new");
}

function startEdit() {
  resetForm();
  setView("edit");
  loadPosts(); // 最新の一覧に更新（自分の記事だけ）
}

/* ----------------------- フォーム操作 ----------------------- */
function resetForm() {
  editingId = null;
  editingSnapshot = null;
  form.reset();
  fDate.value = todayIso();
  fCategory.value = DEFAULT_CATEGORY; // 初期選択は「その他」

  // 編集者名の初期値：ヘッダーの表示名 ＞ Google の名前
  const defaultEditor = profileName || (currentUser && currentUser.displayName) || "";
  if (defaultEditor) fEditor.value = defaultEditor;

  clearPhotoPreviews();
  photoSlots = [];
  removedPhotoUrls = [];
  renderPhotos();

  setFormTitle("form.newTitle");
  setEditingHint(null);
  setFormStatus("");
  highlightSelected();
}

function fillForm(id, data) {
  editingId = id;
  editingSnapshot = data;
  editorPanel.hidden = false; // 編集ビューで記事を選んだらフォームを表示
  fTitle.value  = data.title || "";
  fDate.value   = data.date || todayIso();
  fEditor.value = data.editorName || "";
  // category が無い既存記事は「その他」として扱う
  fCategory.value = CATEGORY_KEYS.includes(data.category) ? data.category : DEFAULT_CATEGORY;
  fBody.value   = data.body || "";

  clearPhotoPreviews();
  photoSlots = (data.photos || [])
    .slice(0, MAX_PHOTOS)
    .map((url) => ({ kind: "existing", url }));
  removedPhotoUrls = [];
  renderPhotos();

  setFormTitle("form.editTitle");
  setEditingHint(data.status === "published" ? "hint.published" : "hint.draft");
  setFormStatus("");
  highlightSelected();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function readForm() {
  return {
    title: fTitle.value.trim(),
    date: fDate.value,
    editorName: fEditor.value.trim(),
    category: fCategory.value,
    body: fBody.value.trim()
  };
}

/* 問題があれば i18n のキーを返す。無ければ null。 */
function validate(v) {
  if (!v.title) return "err.title";
  if (!v.date) return "err.date";
  if (!v.editorName) return "err.editor";
  if (!CATEGORY_KEYS.includes(v.category)) return "err.category";
  if (!v.body) return "err.body";
  return null;
}

/* ----------------------- 投稿前プレビュー ----------------------- */
/* いまフォームに入っている内容で、公開サイトの「記事詳細」と同じ見た目を組み立てる。
   ・公開サイトの app.js openArticle() と同じ手順（日付・編集者名・タイトル・写真・本文）
   ・写真はまだアップしていない選択中のものも、既存の previewUrl でそのまま表示
   ・保存・公開は一切しない（見た目確認だけ） */
function buildPreview() {
  const v = readForm();

  pvDate.textContent = formatDate(v.date);
  pvDate.hidden = !v.date;

  pvEditor.textContent = v.editorName;
  pvEditor.hidden = !v.editorName;
  // 編集者名の接頭辞（"編集 " / "Editor "）を言語に合わせる（CSS の content 用に引用符付き）
  previewSurface.style.setProperty(
    "--article-editor-prefix",
    JSON.stringify(t("preview.editorPrefix"))
  );

  pvTitle.textContent = v.title;
  pvTitle.hidden = !v.title;

  // 写真：公開サイトと同じく最大2枚。1枚→count-1／2枚→count-2
  const pics = photoSlots
    .slice(0, MAX_PHOTOS)
    .map((slot) => (slot.kind === "existing" ? slot.url : slot.previewUrl));
  pvPhotos.innerHTML = "";
  pvPhotos.className =
    "article__photos" + (pics.length === 2 ? " count-2" : pics.length === 1 ? " count-1" : "");
  pics.forEach((src) => {
    const img = document.createElement("img");
    img.src = src;
    img.alt = v.title || "";
    pvPhotos.appendChild(img);
  });

  // 本文：空行で段落分け（公開サイトと同じ）
  pvBody.innerHTML = "";
  (v.body || "").split(/\n{2,}/).forEach((para) => {
    const pEl = document.createElement("p");
    pEl.textContent = para.replace(/\n/g, " ");
    pvBody.appendChild(pEl);
  });
}

function openPreview() {
  // 先にモーダルを開く（組み立てで例外が出ても「押しても反応しない」を避ける）
  previewOverlay.hidden = false;
  document.body.style.overflow = "hidden"; // 背後をスクロールさせない
  try {
    buildPreview();
  } catch (err) {
    console.error("[admin] buildPreview error:", err);
  }
  try { previewClose.focus({ preventScroll: true }); } catch (e) { /* 一部ブラウザは preventScroll 未対応 */ }
}

function closePreview() {
  previewOverlay.hidden = true;
  document.body.style.overflow = "";
  try { previewBtn.focus({ preventScroll: true }); } catch (e) { /* noop */ }
}

/* ----------------------- 保存（下書き / 公開 共通） ----------------------- */
async function save(status) {
  const v = readForm();
  const errKey = validate(v);
  if (errKey) { setFormStatus(errKey, { isError: true }); return; }

  setBusy(true);

  // 新規でも先にIDを確保しておく（写真を posts/{postId}/ に置くため）
  const isNew = !editingId;
  const docRef = isNew ? db.collection("posts").doc() : db.collection("posts").doc(editingId);
  const postId = docRef.id;

  try {
    // 1) 写真：既存はURLをそのまま、新規は Storage にアップロードしてURL化（最大2枚）
    const photos = [];
    for (const slot of photoSlots.slice(0, MAX_PHOTOS)) {
      if (slot.kind === "existing") {
        photos.push(slot.url);
      } else {
        setFormStatus("save.uploading", { params: { n: photos.length + 1 } });
        photos.push(await uploadPhoto(postId, slot.file));
      }
    }

    // 2) 削除された既存写真を Storage から消す（できる範囲で。失敗しても続行）
    for (const url of removedPhotoUrls) {
      if (photos.includes(url)) continue; // まだ使われているなら消さない
      try {
        await storage.refFromURL(url).delete();
      } catch (e) {
        console.warn("写真の削除に失敗（無視して続行）:", e);
      }
    }

    setFormStatus(status === "published" ? "save.publishing" : "save.saving");

    // 3) ドキュメント本体を保存
    const payload = {
      title: v.title,
      editorName: v.editorName,
      date: v.date,
      category: v.category, // "camp" | "meeting" | "other"（必ず含める）
      body: v.body,
      photos: photos,       // 最大2件のダウンロードURL
      status: status,
      updatedAt: serverTimestamp()
    };

    if (isNew) {
      payload.authorUid = currentUser.uid;
      payload.createdAt = serverTimestamp();
      payload.publishedAt = status === "published" ? serverTimestamp() : null;
      await docRef.set(payload);
    } else {
      if (status === "published" && !(editingSnapshot && editingSnapshot.publishedAt)) {
        payload.publishedAt = serverTimestamp(); // 初回公開時だけ打つ
      }
      await docRef.update(payload);
    }

    // 4) 保存後の状態を整える（写真はすべて existing 扱いに戻す）
    editingId = postId;
    editingSnapshot = Object.assign({}, editingSnapshot, payload, { photos: photos });
    clearPhotoPreviews();
    photoSlots = photos.map((url) => ({ kind: "existing", url }));
    removedPhotoUrls = [];
    renderPhotos();

    setFormStatus(status === "published" ? "save.published" : "save.savedDraft");
    setFormTitle("form.editTitle");
    setEditingHint(status === "published" ? "hint.published" : "hint.draft");
    // 一覧を読み直す（onSnapshot にしていないので手動で）
    await loadPosts();
  } catch (err) {
    console.error("save error:", err);
    setFormStatus("save.err", { isError: true });
  } finally {
    setBusy(false);
  }
}

/* ----------------------- 削除（下書き・公開済みどちらも） ----------------------- */
async function deletePost(id, data) {
  const label = data && data.title ? t("del.label", { title: data.title }) : t("del.thisPost");
  const pubNote = data && data.status === "published" ? t("del.pubNote") : "";
  if (!window.confirm(t("del.confirm", { label, pubNote }))) return;

  setBusy(true);
  setFormStatus("del.deleting");
  try {
    // 1) 添付写真を Storage から消す（失敗しても続行）
    for (const url of (data && data.photos) || []) {
      try {
        await storage.refFromURL(url).delete();
      } catch (e) {
        console.warn("写真の削除に失敗（無視して続行）:", e);
      }
    }

    // 2) Firestore ドキュメントを削除
    await db.collection("posts").doc(id).delete();

    // 3) いま編集中の記事を消したらフォームを新規状態に戻す
    if (editingId === id) {
      resetForm();
      if (adminMain.dataset.view === "edit") editorPanel.hidden = true;
    }

    setFormStatus("del.done");
    await loadPosts();
  } catch (err) {
    console.error("deletePost error:", err);
    setFormStatus("del.err", { isError: true });
  } finally {
    setBusy(false);
  }
}

/* ----------------------- 一覧の読み込み・描画 ----------------------- */
async function loadPosts() {
  try {
    const snap = await db.collection("posts").orderBy("date", "desc").get();

    cachedMyPosts = [];
    snap.forEach((doc) => {
      const p = doc.data();
      // 自分（ログイン中のユーザー）が書いた記事だけを表示する
      if (!currentUser || p.authorUid !== currentUser.uid) return;
      cachedMyPosts.push({ id: doc.id, data: p });
    });

    renderPostList();
  } catch (err) {
    console.error("loadPosts error:", err);
    cachedMyPosts = [];
    postList.innerHTML = "";
    setListEmpty("list.loadErr");
    listEmpty.hidden = false;
  }
}

/* キャッシュから一覧を組み立てる（言語切り替え時もこれを呼ぶだけ） */
function renderPostList() {
  postList.innerHTML = "";

  cachedMyPosts.forEach(({ id, data: p }) => {
    const li = document.createElement("li");
    li.className = "post-list__item";
    li.dataset.id = id;

    const badgeClass = p.status === "published" ? "badge--pub" : "badge--draft";

    li.innerHTML = `
      <button class="post-list__pick" type="button">
        <span class="post-list__row">
          <span class="badge ${badgeClass}"></span>
          <span class="post-list__cat"></span>
          <time class="post-list__date"></time>
        </span>
        <span class="post-list__title"></span>
        <span class="post-list__editor"></span>
      </button>
      <div class="post-list__actions">
        <button class="post-list__act post-list__act--edit" type="button"></button>
        <button class="post-list__act post-list__act--del" type="button"></button>
      </div>`;

    li.querySelector(".badge").textContent = t(p.status === "published" ? "badge.live" : "badge.draft");
    li.querySelector(".post-list__act--edit").textContent = t("list.editBtn");
    li.querySelector(".post-list__act--del").textContent = t("list.delBtn");

    // category が無い既存記事は「その他」表示
    li.querySelector(".post-list__cat").textContent =
      categoryLabel(CATEGORY_KEYS.includes(p.category) ? p.category : DEFAULT_CATEGORY);
    li.querySelector(".post-list__date").textContent = formatDate(p.date);
    li.querySelector(".post-list__title").textContent = p.title || t("list.untitled");
    li.querySelector(".post-list__editor").textContent =
      p.editorName ? t("list.editorPrefix", { name: p.editorName }) : "";

    // カード本体クリック／「編集」ボタン＝フォームに読み込んで編集
    li.querySelector(".post-list__pick").addEventListener("click", () => fillForm(id, p));
    li.querySelector(".post-list__act--edit").addEventListener("click", () => fillForm(id, p));
    // 「削除」ボタン＝公開済みでも記事を削除
    li.querySelector(".post-list__act--del").addEventListener("click", () => deletePost(id, p));

    postList.appendChild(li);
  });

  if (cachedMyPosts.length === 0) setListEmpty("list.empty");
  listEmpty.hidden = cachedMyPosts.length > 0;
  highlightSelected();
}

function highlightSelected() {
  postList.querySelectorAll(".post-list__item").forEach((li) => {
    li.classList.toggle("is-selected", li.dataset.id === editingId);
  });
}

/* ----------------------- 言語切り替え時：動的テキストを出し直す ----------------------- */
window.addEventListener("i18n:change", () => {
  try {
    updateGreetings();
    renderFormStatus();
    renderNameStatus();
    renderPhotos();
    renderPostList();
    if (gateErrShown) authGate.innerHTML = "<p>" + t("gate.err") + "</p>";
    // プレビューを開いたまま切り替えたら、接頭辞なども含めて作り直す
    if (previewOverlay && !previewOverlay.hidden) buildPreview();
  } catch (err) {
    console.error("[admin] i18n:change handler error:", err);
  }
});

/* ----------------------- ログイン状態の監視 ----------------------- */
let authResolved = false;

function showGateError() {
  gateErrShown = true;
  authGate.hidden = false;
  authGate.innerHTML = "<p>" + t("gate.err") + "</p>";
}

auth.onAuthStateChanged(
  (user) => {
    // ここに来た時点で「ログイン済みか未ログインか」の判定は完了。
    authResolved = true;

    if (!user) {
      // 未ログインで編集画面を開いた → ログインページへ確実に誘導。
      // （replace なので「戻る」でここへは戻らない）
      window.location.replace("login.html");
      return;
    }

    // --- 認証OK。まず「確認しています…」の表示を消す ---
    currentUser = user;
    updateGreetings();   // まず暫定表示（Googleアカウントの名前）

    authGate.hidden = true;
    adminApp.hidden = false;

    loadProfile();    // 保存済みの表示名を読み込んで、あいさつ／編集者名の初期値に反映
    resetForm();
    loadPosts();      // 一覧は裏で用意しておく（自分の記事だけ）
    showHome();       // まずは「新規作成 / 既存を編集」の選択画面を出す
  },
  (err) => {
    // 認証状態の取得自体に失敗したときも、確認中表示のまま固まらせない
    authResolved = true;
    console.error("onAuthStateChanged error:", err);
    showGateError();
  }
);

// 保険：一定時間たっても認証状態が返ってこないとき（通信不良など）は案内を出す
setTimeout(() => {
  if (!authResolved) showGateError();
}, 8000);

/* ----------------------- イベント ----------------------- */
chooseNewBtn.addEventListener("click", startNew);
chooseEditBtn.addEventListener("click", startEdit);
menuBtn.addEventListener("click", showHome);

editNameBtn.addEventListener("click", toggleNameEditor);
nameSaveBtn.addEventListener("click", saveName);
nameCancelBtn.addEventListener("click", closeNameEditor);
nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); saveName(); }
  if (e.key === "Escape") closeNameEditor();
});
newPostBtn.addEventListener("click", startNew);
saveDraftBtn.addEventListener("click", () => save("draft"));
publishBtn.addEventListener("click", () => save("published"));

/* プレビュー関連は document 委譲で拾う。
   （個別 addEventListener が何かの拍子に外れても・要素が差し替わっても反応するように） */
document.addEventListener("click", (e) => {
  const node = e.target;
  if (!node || !node.closest) return;
  if (node.closest("#previewBtn"))   { e.preventDefault(); openPreview();  return; }
  if (node.closest("#previewClose")) { e.preventDefault(); closePreview(); return; }
  if (node === previewOverlay)       { closePreview(); }               // 背景クリックで閉じる
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && previewOverlay && !previewOverlay.hidden) closePreview();
});

photoInput.addEventListener("change", (e) => {
  try {
    addFiles(e.target.files);
  } catch (err) {
    console.error("[admin] addFiles error:", err);
  }
  e.target.value = ""; // 同じファイルを選び直せるようにクリア
});

logoutBtn.addEventListener("click", async () => {
  try {
    await auth.signOut();
    window.location.replace("login.html");
  } catch (err) {
    console.error("signOut error:", err);
  }
});

/* すべての初期化が終わったあとに、もう一度だけ翻訳をあて直す。
   i18n.js の初回適用と editor.js の起動の順序ズレ（スクリプトの再取得・
   キャッシュずれ等）があっても、data-i18n が確実に反映されるようにする保険。 */
if (window.I18N && typeof window.I18N.apply === "function") {
  window.I18N.apply(document);
}
