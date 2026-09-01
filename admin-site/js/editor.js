/* =========================================================
   On Your Mark! Staff Blog Edit — 編集画面のロジック
   ---------------------------------------------------------
   HTMLには一切JSを書かず、ここだけで動きを管理します。

   やること：
   - ログイン状態を監視。未ログインなら login.html へ送る
   - 上部に「◯◯さん ようこそ!」（Googleの表示名）
   - フォーム：タイトル / 日付 / 編集者名 / カテゴリ / 写真（最大2枚） / 本文
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
   ========================================================= */

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp;

const MAX_PHOTOS = 2; // 写真は最大2枚まで

/* カテゴリ：値（Firestore） と 表示名 の対応。初期値は "other"（その他）。 */
const CATEGORIES = [
  { key: "camp",    label: "キャンプ当日" },
  { key: "meeting", label: "ミーティング" },
  { key: "other",   label: "その他" }
];
const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
const DEFAULT_CATEGORY = "other";
const categoryLabel = (key) => {
  const found = CATEGORIES.find((c) => c.key === key);
  return found ? found.label : "その他";
};

const el = (id) => document.getElementById(id);

/* ----------------------- 要素 ----------------------- */
const authGate   = el("authGate");
const adminApp   = el("adminApp");
const welcome    = el("welcome");
const logoutBtn  = el("logoutBtn");

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

/* ----------------------- 状態 ----------------------- */
let currentUser = null;
let editingId = null;      // 編集中ドキュメントID（新規なら null）
let editingSnapshot = null; // 編集中ドキュメントの現在の中身

/* 写真スロット（順番＝表示順・最大2）
   { kind: "existing", url }            … すでにStorageにある写真
   { kind: "new", file, previewUrl }    … これからアップロードする写真 */
let photoSlots = [];
let removedPhotoUrls = []; // 保存時に Storage から消したい既存写真のURL

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
function setFormStatus(text, isError = false) {
  formStatus.textContent = text || "";
  formStatus.classList.toggle("is-error", !!isError);
}
function setBusy(busy) {
  saveDraftBtn.disabled = busy;
  publishBtn.disabled = busy;
  newPostBtn.disabled = busy;
  photoInput.disabled = busy;
  photoUploader.classList.toggle("is-busy", busy);
  postList.classList.toggle("is-busy", busy); // 保存・削除中は一覧の操作を止める
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
    img.alt = `写真 ${i + 1}`;

    const del = document.createElement("button");
    del.type = "button";
    del.className = "photo-item__del";
    del.setAttribute("aria-label", `写真 ${i + 1} を削除`);
    del.textContent = "×";
    del.addEventListener("click", () => removePhoto(i));

    li.append(img, del);
    photoList.appendChild(li);
  });

  photoAddLabel.hidden = photoSlots.length >= MAX_PHOTOS;
  photoHint.textContent =
    photoSlots.length >= MAX_PHOTOS
      ? "写真は最大2枚です。差し替えるには、どれか削除してください。"
      : "JPEG / PNG など。保存・公開したときにアップロードされます。";
}

function addFiles(fileList) {
  const files = Array.from(fileList || []);
  let added = 0;
  for (const file of files) {
    if (photoSlots.length >= MAX_PHOTOS) {
      setFormStatus("写真は最大2枚までです。", true);
      break;
    }
    if (!file.type || !file.type.startsWith("image/")) {
      setFormStatus("画像ファイルを選んでください。", true);
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

/* ----------------------- フォーム操作 ----------------------- */
function resetForm() {
  editingId = null;
  editingSnapshot = null;
  form.reset();
  fDate.value = todayIso();
  fCategory.value = DEFAULT_CATEGORY; // 初期選択は「その他」
  if (currentUser && currentUser.displayName) fEditor.value = currentUser.displayName;

  clearPhotoPreviews();
  photoSlots = [];
  removedPhotoUrls = [];
  renderPhotos();

  formTitle.textContent = "新しい記事";
  editingHint.hidden = true;
  setFormStatus("");
  highlightSelected();
}

function fillForm(id, data) {
  editingId = id;
  editingSnapshot = data;
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

  formTitle.textContent = "記事を編集";
  editingHint.hidden = false;
  editingHint.textContent =
    data.status === "published"
      ? "この記事は現在【公開中】です。保存すると内容が更新されます。"
      : "この記事は【下書き】です。「公開」を押すと公開サイトに出ます。";
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

function validate(v) {
  if (!v.title) return "タイトルを入力してください。";
  if (!v.date) return "日付を選んでください。";
  if (!v.editorName) return "編集者名を入力してください。";
  if (!CATEGORY_KEYS.includes(v.category)) return "カテゴリを選んでください。";
  if (!v.body) return "本文を入力してください。";
  return null;
}

/* ----------------------- 保存（下書き / 公開 共通） ----------------------- */
async function save(status) {
  const v = readForm();
  const error = validate(v);
  if (error) { setFormStatus(error, true); return; }

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
        setFormStatus(`写真をアップロードしています…（${photos.length + 1}枚目）`);
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

    setFormStatus(status === "published" ? "公開しています…" : "保存しています…");

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

    setFormStatus(
      status === "published" ? "公開しました。公開サイトに反映されます。" : "下書きとして保存しました。"
    );
    formTitle.textContent = "記事を編集";
    editingHint.hidden = false;
    // 一覧を読み直す（onSnapshot にしていないので手動で）
    await loadPosts();
  } catch (err) {
    console.error("save error:", err);
    setFormStatus("保存に失敗しました。通信状況を確認してもう一度お試しください。", true);
  } finally {
    setBusy(false);
  }
}

/* ----------------------- 削除（下書き・公開済みどちらも） ----------------------- */
async function deletePost(id, data) {
  const label = data && data.title ? `「${data.title}」` : "この記事";
  const pubNote = data && data.status === "published" ? "\n※ 公開中の記事です。公開サイトからも消えます。" : "";
  if (!window.confirm(`${label}を削除します。元に戻せません。${pubNote}\n\n削除してよろしいですか？`)) return;

  setBusy(true);
  setFormStatus("削除しています…");
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
    if (editingId === id) resetForm();

    setFormStatus("削除しました。");
    await loadPosts();
  } catch (err) {
    console.error("deletePost error:", err);
    setFormStatus("削除に失敗しました。通信状況や権限を確認してもう一度お試しください。", true);
  } finally {
    setBusy(false);
  }
}

/* ----------------------- 一覧の読み込み ----------------------- */
async function loadPosts() {
  try {
    const snap = await db.collection("posts").orderBy("date", "desc").get();

    postList.innerHTML = "";
    listEmpty.hidden = snap.size > 0;

    snap.forEach((doc) => {
      const p = doc.data();
      const li = document.createElement("li");
      li.className = "post-list__item";
      li.dataset.id = doc.id;

      const badgeClass = p.status === "published" ? "badge--pub" : "badge--draft";
      const badgeText = p.status === "published" ? "公開中" : "下書き";

      li.innerHTML = `
        <button class="post-list__pick" type="button">
          <span class="post-list__row">
            <span class="badge ${badgeClass}">${badgeText}</span>
            <span class="post-list__cat"></span>
            <time class="post-list__date"></time>
          </span>
          <span class="post-list__title"></span>
          <span class="post-list__editor"></span>
        </button>
        <div class="post-list__actions">
          <button class="post-list__act post-list__act--edit" type="button">編集</button>
          <button class="post-list__act post-list__act--del" type="button">削除</button>
        </div>`;

      // category が無い既存記事は「その他」表示
      li.querySelector(".post-list__cat").textContent =
        categoryLabel(CATEGORY_KEYS.includes(p.category) ? p.category : DEFAULT_CATEGORY);
      li.querySelector(".post-list__date").textContent = formatDate(p.date);
      li.querySelector(".post-list__title").textContent = p.title || "(タイトルなし)";
      li.querySelector(".post-list__editor").textContent = p.editorName ? `編集：${p.editorName}` : "";

      // カード本体クリック／「編集」ボタン＝フォームに読み込んで編集
      li.querySelector(".post-list__pick").addEventListener("click", () => fillForm(doc.id, p));
      li.querySelector(".post-list__act--edit").addEventListener("click", () => fillForm(doc.id, p));
      // 「削除」ボタン＝公開済みでも記事を削除
      li.querySelector(".post-list__act--del").addEventListener("click", () => deletePost(doc.id, p));
      postList.appendChild(li);
    });

    highlightSelected();
  } catch (err) {
    console.error("loadPosts error:", err);
    listEmpty.hidden = false;
    listEmpty.textContent = "一覧を読み込めませんでした。";
  }
}

function highlightSelected() {
  postList.querySelectorAll(".post-list__item").forEach((li) => {
    li.classList.toggle("is-selected", li.dataset.id === editingId);
  });
}

/* ----------------------- ログイン状態の監視 ----------------------- */
let authResolved = false;

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
    const name = user.displayName || user.email || "スタッフ";
    welcome.textContent = `${name}さん ようこそ!`;

    authGate.hidden = true;
    adminApp.hidden = false;

    resetForm();
    loadPosts();
  },
  (err) => {
    // 認証状態の取得自体に失敗したときも、確認中表示のまま固まらせない
    authResolved = true;
    console.error("onAuthStateChanged error:", err);
    authGate.hidden = false;
    authGate.innerHTML =
      'ログイン状態を確認できませんでした。<a href="login.html">ログインページへ</a>';
  }
);

// 保険：一定時間たっても認証状態が返ってこないとき（通信不良など）は案内を出す
setTimeout(() => {
  if (!authResolved) {
    authGate.hidden = false;
    authGate.innerHTML =
      'ログイン状態を確認できませんでした。<a href="login.html">ログインページへ</a>';
  }
}, 8000);

/* ----------------------- イベント ----------------------- */
newPostBtn.addEventListener("click", resetForm);
saveDraftBtn.addEventListener("click", () => save("draft"));
publishBtn.addEventListener("click", () => save("published"));

photoInput.addEventListener("change", (e) => {
  addFiles(e.target.files);
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
