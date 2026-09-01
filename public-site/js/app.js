/* =========================================================
   On Your Mark! Staff Blog — 公開サイトのロジック
   HTMLには一切JSを書かず、ここだけで動きを管理します。
   ========================================================= */

/* -----------------------------------------------------------
   カテゴリの定義
   Firestore / sample-posts.json の category フィールドは
   "camp" | "meeting" | "other" の3値。表示名はここで対応づける。
   category が無い（未設定の）記事は "other"（その他）として扱う。
----------------------------------------------------------- */
const CATEGORIES = [
  { key: "camp",    label: "キャンプ当日" },
  { key: "meeting", label: "ミーティング" },
  { key: "other",   label: "その他" }
];
const categoryLabel = (key) => {
  const found = CATEGORIES.find((c) => c.key === key);
  return found ? found.label : "その他";
};
const categoryOf = (p) => (p && p.category) || "other";

/* -----------------------------------------------------------
   データの読み込み（Firestore）
   posts コレクションから status == "published" の記事を取得し、
   これまで（sample-posts.json）と同じ形の配列にして返す。

   - 返す各要素: id, pinned, status, category, photos,
                 date, title, editorName, body
   - 新しい順（date の降順）に並べて返す
   - status の等値フィルタだけにして、複合インデックスを不要にする
     （並び替えはクライアント側）
   - Firestore SDK(compat) の読み込みと初期化は
     index.html / firebase-config.js 側で済んでいる前提

   ※ 一般ユーザー（未ログイン）が読めるようにするには、Firestoreの
     セキュリティルールで posts の status=="published" を公開読み取り可に
     しておく必要があります（ルール設定は別ステップ）。
----------------------------------------------------------- */
async function loadPosts() {
  const db = firebase.firestore();
  const snap = await db
    .collection("posts")
    .where("status", "==", "published")
    .get();

  const posts = snap.docs.map((doc) => {
    const d = doc.data() || {};
    return {
      id: doc.id,
      pinned: d.pinned === true,
      status: d.status,
      category: d.category || "other",
      photos: Array.isArray(d.photos) ? d.photos.slice(0, 2) : [],
      date: d.date || "",
      title: d.title || "",
      editorName: d.editorName || "",
      body: d.body || ""
    };
  });

  // 新しい順（date の降順）。日付が無いものは末尾へ。
  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return posts;
}

/* ----------------------- 状態 ----------------------- */
let ALL_POSTS = [];
const PAGE_SIZE = 5;
// いま表示している絞り込み条件とページ番号
let view = { year: null, category: null, page: 1 };
// カテゴリ選択ステップで「どの年を選んだか」を一時的に覚えておく
let pendingYear = null;

/* ----------------------- 要素 ----------------------- */
const el = (id) => document.getElementById(id);

const listView    = el("listView");
const articleView = el("articleView");
const hero        = el("hero");
const heroMedia   = el("heroMedia");
const heroInner   = el("heroInner");
const feed        = el("feed");
const feedEmpty   = el("feedEmpty");
const feedTitle   = el("feedTitle");
const feedReset   = el("feedReset");
const pagination  = el("pagination");
const pinnedArea  = el("pinnedArea");

const yearStep     = el("yearStep");
const yearList     = el("yearList");
const catStep      = el("catStep");
const catList      = el("catList");
const catBack      = el("catBack");
const catStepLabel = el("catStepLabel");

const menuToggle    = el("menuToggle");
const yearDrawer    = el("yearDrawer");
const drawerBackdrop= el("drawerBackdrop");

/* ----------------------- 便利関数 ----------------------- */
function formatDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${y}.${m}.${d}`;
}
function yearOf(iso) { return iso.split("-")[0]; }
function excerpt(body, n = 70) {
  const flat = body.replace(/\n+/g, " ").trim();
  return flat.length > n ? flat.slice(0, n) + "…" : flat;
}
// 通常記事（pinned以外）を新しい順に
function sortedNormalPosts(posts) {
  return posts
    .filter((p) => !p.pinned)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}
// いまの view 条件で絞り込んだ記事（新しい順）
function filteredPosts() {
  let posts = sortedNormalPosts(ALL_POSTS);
  if (view.year) posts = posts.filter((p) => yearOf(p.date) === view.year);
  if (view.category) posts = posts.filter((p) => categoryOf(p) === view.category);
  return posts;
}

/* ----------------------- 初期固定ポスト ----------------------- */
function renderPinned() {
  const pin = ALL_POSTS.find((p) => p.pinned);
  if (!pin) { pinnedArea.hidden = true; return; }
  pinnedArea.hidden = false;
  el("pinnedTitle").textContent = pin.title;

  // pinnedカードだけは本文を省略せず、空行ごとに段落<p>で全文表示する
  const box = el("pinnedExcerpt");
  box.innerHTML = "";
  pin.body.split(/\n{2,}/).forEach((para) => {
    const pEl = document.createElement("p");
    pEl.textContent = para.replace(/\n/g, " ");
    box.appendChild(pEl);
  });
}

/* ----------------------- 見出し ----------------------- */
function updateFeedHead() {
  let title = "最新の記事";
  if (view.year && view.category)      title = `${view.year}年 ・ ${categoryLabel(view.category)}`;
  else if (view.year)                  title = `${view.year}年の記事`;
  else if (view.category)              title = categoryLabel(view.category);
  feedTitle.textContent = title;
  feedReset.hidden = !(view.year || view.category);
}

/* ----------------------- 記事一覧（ページ送り付き） ----------------------- */
function renderFeed() {
  const posts = filteredPosts();

  const totalPages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  if (view.page > totalPages) view.page = totalPages;
  if (view.page < 1) view.page = 1;

  const start = (view.page - 1) * PAGE_SIZE;
  const pagePosts = posts.slice(start, start + PAGE_SIZE);

  feed.innerHTML = "";
  feedEmpty.hidden = posts.length > 0;

  pagePosts.forEach((p) => {
    const card = document.createElement("button");
    card.className = "post-card";
    card.setAttribute("aria-label", `${p.title} を読む`);

    const thumb = document.createElement("div");
    thumb.className = "post-card__thumb";
    if (p.photos && p.photos[0]) thumb.style.backgroundImage = `url("${p.photos[0]}")`;

    const body = document.createElement("div");
    body.className = "post-card__body";
    body.innerHTML = `
      <div class="post-card__meta">
        <time class="stamp">${formatDate(p.date)}</time>
        <span class="cat-chip"></span>
        <span class="editor-badge"></span>
      </div>
      <h3 class="post-card__title"></h3>
      <p class="post-card__excerpt"></p>`;
    body.querySelector(".cat-chip").textContent = categoryLabel(categoryOf(p));
    body.querySelector(".editor-badge").textContent = p.editorName;
    body.querySelector(".post-card__title").textContent = p.title;
    body.querySelector(".post-card__excerpt").textContent = excerpt(p.body);

    card.append(thumb, body);
    card.addEventListener("click", () => openArticle(p.id));
    feed.appendChild(card);
  });

  renderPagination(totalPages);
  revealOnScroll();
}

/* ----------------------- ページネーション ----------------------- */
// 1 2 3 … の並びを組み立てる（現在ページの前後1つ＋先頭・末尾は常に表示）
function pageNumbers(current, total) {
  const around = 1;
  const out = [];
  for (let i = 1; i <= total; i++) {
    const keep = i === 1 || i === total || (i >= current - around && i <= current + around);
    if (keep) {
      out.push(i);
    } else if (out[out.length - 1] !== "…") {
      out.push("…");
    }
  }
  return out;
}

function renderPagination(totalPages) {
  pagination.innerHTML = "";
  pagination.hidden = totalPages <= 1;
  if (totalPages <= 1) return;

  pageNumbers(view.page, totalPages).forEach((n) => {
    if (n === "…") {
      const gap = document.createElement("span");
      gap.className = "pagination__gap";
      gap.textContent = "…";
      gap.setAttribute("aria-hidden", "true");
      pagination.appendChild(gap);
      return;
    }
    const btn = document.createElement("button");
    btn.className = "pagination__num" + (n === view.page ? " is-current" : "");
    btn.textContent = String(n);
    btn.setAttribute("aria-label", `${n}ページ目`);
    if (n === view.page) btn.setAttribute("aria-current", "page");
    btn.addEventListener("click", () => {
      view.page = n;
      renderFeed();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    pagination.appendChild(btn);
  });
}

/* ----------------------- 記事詳細 ----------------------- */
function openArticle(id) {
  const p = ALL_POSTS.find((x) => x.id === id);
  if (!p) return;

  el("articleDate").textContent = formatDate(p.date);
  el("articleEditor").textContent = p.editorName;
  el("articleTitle").textContent = p.title;

  const photos = el("articlePhotos");
  photos.innerHTML = "";
  const pics = (p.photos || []).slice(0, 2); // 写真は最大2枚
  photos.className = "article__photos" + (pics.length === 2 ? " count-2" : pics.length === 1 ? " count-1" : "");
  pics.forEach((src) => {
    const img = document.createElement("img");
    img.src = src; img.alt = p.title; img.loading = "lazy";
    photos.appendChild(img);
  });

  const bodyBox = el("articleBody");
  bodyBox.innerHTML = "";
  p.body.split(/\n{2,}/).forEach((para) => {
    const pEl = document.createElement("p");
    pEl.textContent = para.replace(/\n/g, " ");
    bodyBox.appendChild(pEl);
  });

  listView.hidden = true;
  articleView.hidden = false;
  if (hero) hero.hidden = true; // ヒーローは一覧トップだけに出す
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

function showList() {
  articleView.hidden = true;
  listView.hidden = false;
  if (hero) hero.hidden = false;
}

/* ----------------------- トップへ戻す ----------------------- */
function goHome() {
  view = { year: null, category: null, page: 1 };
  showList();
  updateFeedHead();
  renderFeed();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ----------------------- 絞り込みを適用 ----------------------- */
function applyView(year, category) {
  view = { year: year || null, category: category || null, page: 1 };
  showList();
  updateFeedHead();
  renderFeed();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ----------------------- ドロワー：年ステップ ----------------------- */
function renderYearList() {
  const normals = sortedNormalPosts(ALL_POSTS);
  const years = [...new Set(normals.map((p) => yearOf(p.date)))].sort((a, b) => b - a);

  // 記事が1件も無いときは、年別メニュー（ハンバーガー）自体を出さない
  menuToggle.hidden = normals.length === 0;
  if (normals.length === 0) return;

  yearList.innerHTML = "";

  const makeItem = (label, count, onClick) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.innerHTML = `<span></span><span class="count">${count}</span>`;
    btn.querySelector("span").textContent = label;
    btn.addEventListener("click", onClick);
    li.appendChild(btn);
    return li;
  };

  // 「すべて」= 全カテゴリ・全年（トップと同じ）
  yearList.appendChild(makeItem("すべて", normals.length, () => {
    goHome();
    closeDrawer();
  }));

  // 年をえらぶと、次のステップ（カテゴリ）へ
  years.forEach((y) => {
    const count = normals.filter((p) => yearOf(p.date) === y).length;
    yearList.appendChild(makeItem(`${y}`, count, () => openCategoryStep(y)));
  });
}

/* ----------------------- ドロワー：カテゴリステップ ----------------------- */
function openCategoryStep(year) {
  pendingYear = year;
  catStepLabel.textContent = `${year}年 ・ カテゴリをえらぶ`;

  const yearPosts = sortedNormalPosts(ALL_POSTS).filter((p) => yearOf(p.date) === year);
  catList.innerHTML = "";

  const makeItem = (label, count, category) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.innerHTML = `<span></span><span class="count">${count}</span>`;
    btn.querySelector("span").textContent = label;
    btn.addEventListener("click", () => {
      applyView(year, category);
      closeDrawer();
    });
    li.appendChild(btn);
    return li;
  };

  // その年の全カテゴリ
  catList.appendChild(makeItem("すべて", yearPosts.length, null));
  // カテゴリごと
  CATEGORIES.forEach((c) => {
    const count = yearPosts.filter((p) => categoryOf(p) === c.key).length;
    catList.appendChild(makeItem(c.label, count, c.key));
  });

  yearStep.hidden = true;
  catStep.hidden = false;
}

function backToYearStep() {
  catStep.hidden = true;
  yearStep.hidden = false;
}

/* ----------------------- ドロワー開閉 ----------------------- */
function openDrawer() {
  backToYearStep(); // 開くときは必ず年ステップから
  yearDrawer.hidden = false;
  drawerBackdrop.hidden = false;
  requestAnimationFrame(() => {
    yearDrawer.classList.add("show");
    drawerBackdrop.classList.add("show");
  });
  menuToggle.setAttribute("aria-expanded", "true");
}
function closeDrawer() {
  yearDrawer.classList.remove("show");
  drawerBackdrop.classList.remove("show");
  menuToggle.setAttribute("aria-expanded", "false");
  setTimeout(() => {
    yearDrawer.hidden = true;
    drawerBackdrop.hidden = true;
    backToYearStep();
  }, 340);
}
function toggleDrawer() {
  menuToggle.getAttribute("aria-expanded") === "true" ? closeDrawer() : openDrawer();
}

/* ----------------------- スクロールで出現 ----------------------- */
function revealOnScroll() {
  const cards = feed.querySelectorAll(".post-card");
  if (!("IntersectionObserver" in window)) {
    cards.forEach((c) => c.classList.add("reveal"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add("reveal"), i * 60);
        io.unobserve(e.target);
      }
    });
  }, { threshold: .12 });
  cards.forEach((c) => io.observe(c));
}

/* ----------------------- ヒーローのスクロール演出（パララックス） ----------------------- */
function initHero() {
  if (!hero || !heroMedia) return;

  // 写真が未設置・読み込み失敗のときは <img> を外して下地グラデだけにする
  const heroImg = el("heroImg");
  if (heroImg) {
    heroImg.addEventListener("error", () => heroImg.remove());
    if (heroImg.complete && heroImg.naturalWidth === 0) heroImg.remove();
  }

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // --- Welcome テキスト：少しスクロールしたら出現（動きを抑える設定なら即表示） ---
  const revealText = () => heroInner && heroInner.classList.add("is-in");
  if (reduce) {
    revealText();
  } else {
    let revealed = false;
    const tryReveal = () => {
      if (!revealed && window.scrollY > 40) {
        revealed = true;
        revealText();
        window.removeEventListener("scroll", tryReveal);
      }
    };
    window.addEventListener("scroll", tryReveal, { passive: true });
    // スクロールしない人向けの保険（数秒たったら出す）
    setTimeout(() => { if (!revealed) { revealed = true; revealText(); window.removeEventListener("scroll", tryReveal); } }, 3500);
    tryReveal();
  }

  if (reduce) return;

  // --- 写真パララックス：スクロールに合わせてゆっくり流す＋わずかに拡大 ---
  let ticking = false;
  const apply = () => {
    ticking = false;
    if (hero.hidden) return;
    const h = hero.offsetHeight || 1;
    const p = Math.min(Math.max(window.scrollY / h, 0), 1); // 0〜1
    heroMedia.style.transform = `translate3d(0, ${p * 56}px, 0) scale(${1 + p * 0.05})`;
  };
  const onScroll = () => {
    if (!ticking) { ticking = true; requestAnimationFrame(apply); }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  apply();
}

/* ----------------------- イベント ----------------------- */
function bindGlobalEvents() {
  menuToggle.addEventListener("click", toggleDrawer);
  drawerBackdrop.addEventListener("click", closeDrawer);
  catBack.addEventListener("click", backToYearStep);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });

  feedReset.addEventListener("click", goHome);

  // data-action="home" のリンク/ボタンは一覧トップへ戻す
  document.querySelectorAll('[data-action="home"]').forEach((node) => {
    node.addEventListener("click", (e) => {
      e.preventDefault();
      goHome();
    });
  });
}

/* ----------------------- 起動 ----------------------- */
async function init() {
  bindGlobalEvents();
  initHero();
  try {
    ALL_POSTS = await loadPosts();
    renderPinned();
    updateFeedHead();
    renderFeed();
    renderYearList();
  } catch (err) {
    feedEmpty.hidden = false;
    feedEmpty.textContent = "記事を読み込めませんでした。時間をおいてもう一度お試しください。";
    console.error(err);
  }
}

init();
