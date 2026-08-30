/* =========================================================
   On Your Mark! Staff Blog — 公開サイトのロジック
   HTMLには一切JSを書かず、ここだけで動きを管理します。
   ========================================================= */

/* -----------------------------------------------------------
   データの読み込み
   いまはサンプルJSONを読みます。
   → 後でFirebaseにする時は、この関数の中だけを
     「Firestoreの published コレクションを取ってくる」処理に
     差し替えればOK（返す形は同じ配列）。
----------------------------------------------------------- */
async function loadPosts() {
  const res = await fetch("data/sample-posts.json");
  if (!res.ok) throw new Error("記事の読み込みに失敗しました");
  const data = await res.json();
  return data.posts.filter((p) => p.status === "published");
}

/* ----------------------- 状態 ----------------------- */
let ALL_POSTS = [];

/* ----------------------- 要素 ----------------------- */
const el = (id) => document.getElementById(id);

const listView    = el("listView");
const articleView = el("articleView");
const feed        = el("feed");
const feedEmpty   = el("feedEmpty");
const feedTitle   = el("feedTitle");
const feedReset   = el("feedReset");
const pinnedArea  = el("pinnedArea");
const yearList    = el("yearList");

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
// 通常記事を新しい順に
function sortedNormalPosts(posts) {
  return posts
    .filter((p) => !p.pinned)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
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

/* ----------------------- 記事一覧 ----------------------- */
function renderFeed(filterYear = null) {
  let posts = sortedNormalPosts(ALL_POSTS);
  if (filterYear) posts = posts.filter((p) => yearOf(p.date) === filterYear);

  feed.innerHTML = "";
  feedEmpty.hidden = posts.length > 0;

  posts.forEach((p) => {
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
        <span class="editor-badge">${p.editorName}</span>
      </div>
      <h3 class="post-card__title"></h3>
      <p class="post-card__excerpt"></p>`;
    body.querySelector(".post-card__title").textContent = p.title;
    body.querySelector(".post-card__excerpt").textContent = excerpt(p.body);

    card.append(thumb, body);
    card.addEventListener("click", () => openArticle(p.id));
    feed.appendChild(card);
  });

  revealOnScroll();
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
  const n = (p.photos || []).length;
  photos.className = "article__photos" + (n >= 2 ? ` count-${Math.min(n, 3)}` : "");
  (p.photos || []).slice(0, 3).forEach((src) => {
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
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

function showList() {
  articleView.hidden = true;
  listView.hidden = false;
}

/* ----------------------- 年別ドロワー ----------------------- */
function renderYearList() {
  const years = [...new Set(sortedNormalPosts(ALL_POSTS).map((p) => yearOf(p.date)))]
    .sort((a, b) => b - a);
  yearList.innerHTML = "";

  const makeItem = (label, count, year) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.innerHTML = `<span>${label}</span><span class="count">${count}</span>`;
    btn.addEventListener("click", () => {
      showList();
      renderFeed(year);
      feedTitle.textContent = year ? `${year}年の記事` : "最新の記事";
      feedReset.hidden = !year;
      closeDrawer();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    li.appendChild(btn);
    return li;
  };

  yearList.appendChild(makeItem("すべて", sortedNormalPosts(ALL_POSTS).length, null));
  years.forEach((y) => {
    const c = sortedNormalPosts(ALL_POSTS).filter((p) => yearOf(p.date) === y).length;
    yearList.appendChild(makeItem(`${y}`, c, y));
  });
}

function openDrawer() {
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
  setTimeout(() => { yearDrawer.hidden = true; drawerBackdrop.hidden = true; }, 340);
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

/* ----------------------- イベント ----------------------- */
function bindGlobalEvents() {
  menuToggle.addEventListener("click", toggleDrawer);
  drawerBackdrop.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });

  feedReset.addEventListener("click", () => {
    renderFeed(null);
    feedTitle.textContent = "最新の記事";
    feedReset.hidden = true;
  });

  // data-action="home" のリンク/ボタンは一覧へ戻す
  document.querySelectorAll('[data-action="home"]').forEach((node) => {
    node.addEventListener("click", (e) => {
      e.preventDefault();
      showList();
      renderFeed(null);
      feedTitle.textContent = "最新の記事";
      feedReset.hidden = true;
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

/* ----------------------- 起動 ----------------------- */
async function init() {
  bindGlobalEvents();
  try {
    ALL_POSTS = await loadPosts();
    renderPinned();
    renderFeed(null);
    renderYearList();
  } catch (err) {
    feedEmpty.hidden = false;
    feedEmpty.textContent = "記事を読み込めませんでした。時間をおいてもう一度お試しください。";
    console.error(err);
  }
}

init();
