/* =========================================================
   On Your Mark! Staff Blog Edit — 言語切り替え（JP / EN）
   ---------------------------------------------------------
   HTMLには一切JSを書かず、ここだけで動きを管理します。

   使い方（HTML側は属性だけ）：
   - data-i18n="key"             … textContent を差し替え
   - data-i18n-html="key"        … innerHTML を差し替え（リンク入りの文）
   - data-i18n-placeholder="key" … placeholder を差し替え
   - data-i18n-aria-label="key"  … aria-label を差し替え
   - [data-lang-btn="ja"|"en"]   … 言語切り替えボタン（クリックで切替）

   - 選んだ言語は localStorage("oym-admin-lang") に保存。
     redirect ログインをはさんでも保たれるよう sessionStorage は使わない。
   - デフォルトは "ja"。
   - 動的な文字列は window.I18N.t("key", { name }) で取得。
   - 言語が変わるたびに window で "i18n:change" イベントが飛ぶ
     （editor.js / login.js が拾って動的な文言を出し直す）。
========================================================= */
(function () {
  "use strict";

  var STORE_KEY = "oym-admin-lang";
  var DEFAULT_LANG = "ja";
  var SUPPORTED = ["ja", "en"];

  var STRINGS = {
    ja: {
      /* ---- ドキュメントタイトル ---- */
      "login.docTitle": "On Your Mark! Staff Blog Edit — ログイン",
      "edit.docTitle": "On Your Mark! Staff Blog Edit — 編集",

      /* ---- 言語切り替え ---- */
      "lang.group": "言語",

      /* ---- ログインページ ---- */
      "login.kicker": "スタッフ専用",
      "login.lead": "記事の作成・編集はスタッフ専用です。Googleアカウントでログインしてください。",
      "login.googleBtn": "Googleでログイン",
      "login.back": "← 公開サイトへもどる",
      "login.msg.opening": "ログイン画面をひらいています…",
      "login.msg.switching": "別画面でのログインに切り替えます…",
      "login.msg.cantStart": "ログインを開始できませんでした。時間をおいて再度お試しください。",
      "login.msg.failed": "ログインに失敗しました。もう一度お試しください。",
      "login.msg.cantReturn": "ログインに戻れませんでした。もう一度お試しください。",

      /* ---- ヘッダー ---- */
      "gate.checking": "ログイン状態を確認しています…",
      "gate.err": 'ログイン状態を確認できませんでした。<a href="login.html">ログインページへ</a>',
      "header.menu": "← メニュー",
      "header.changeName": "表示名を変更",
      "header.logout": "ログアウト",

      /* ---- あいさつ ---- */
      "welcome": "{name}さん ようこそ！",
      "choice.greeting": "{name}さん、何をしますか？",
      "name.fallback": "スタッフ",

      /* ---- 表示名エディタ ---- */
      "name.label": "表示名",
      "name.note": "ヘッダーのあいさつに表示される名前です。新しい記事の「編集者名」の初期値にもなります（記事ごとに書き換え可）。",
      "name.placeholder": "ヘッダーに表示する名前",
      "name.save": "保存",
      "name.cancel": "キャンセル",
      "name.unsetHint": "表示名が未設定です。いまはGoogleアカウントの名前を表示しています。「表示名を変更」から自分の呼び名を設定できます。",
      "name.err.empty": "表示名を入力してください。",
      "name.err.long": "表示名は40文字以内にしてください。",
      "name.saving": "保存しています…",
      "name.saved": "保存しました。",
      "name.err.save": "保存に失敗しました。もう一度お試しください。",

      /* ---- 選択画面 ---- */
      "choice.title": "何をしますか？",
      "choice.newLabel": "新しい記事を作成",
      "choice.newDesc": "白紙から記事を書きます",
      "choice.editLabel": "既存の記事を編集",
      "choice.editDesc": "自分が書いた記事を選んで直します",

      /* ---- 編集フォーム ---- */
      "form.newTitle": "新しい記事",
      "form.editTitle": "記事を編集",
      "form.new": "＋ 新規作成",
      "field.title": "タイトル",
      "field.title.ph": "記事のタイトル",
      "field.date": "日付",
      "field.editor": "編集者名",
      "field.editor.ph": "記事に表示する名前",
      "field.category": "カテゴリ",
      "field.photos": "写真（最大2枚）",
      "field.body": "本文",
      "field.body.ph": "ここに本文を書きます。段落は空行で区切ってください。",
      "form.preview": "プレビュー",
      "form.saveDraft": "一時保存",
      "form.publish": "公開",

      "preview.heading": "プレビュー（公開時の見え方）",
      "preview.note": "表示の確認用です。保存・公開はされません。",
      "preview.close": "閉じる",
      "preview.editorPrefix": "編集 ",

      "cat.camp": "キャンプ当日",
      "cat.meeting": "ミーティング",
      "cat.other": "その他",

      "photo.add": "＋ 写真を追加",
      "photo.hint": "JPEG / PNG など。保存・公開したときにアップロードされます。",
      "photo.hintFull": "写真は最大2枚です。差し替えるには、どれか削除してください。",
      "photo.alt": "写真 {n}",
      "photo.remove": "写真 {n} を削除",
      "photo.err.max": "写真は最大2枚までです。",
      "photo.err.type": "画像ファイルを選んでください。",

      "hint.published": "この記事は現在【公開中】です。保存すると内容が更新されます。",
      "hint.draft": "この記事は【下書き】です。「公開」を押すと公開サイトに出ます。",

      "err.title": "タイトルを入力してください。",
      "err.date": "日付を選んでください。",
      "err.editor": "編集者名を入力してください。",
      "err.category": "カテゴリを選んでください。",
      "err.body": "本文を入力してください。",

      "save.uploading": "写真をアップロードしています…（{n}枚目）",
      "save.publishing": "公開しています…",
      "save.saving": "保存しています…",
      "save.published": "公開しました。公開サイトに反映されます。",
      "save.savedDraft": "下書きとして保存しました。",
      "save.err": "保存に失敗しました。通信状況を確認してもう一度お試しください。",

      "del.label": "「{title}」",
      "del.thisPost": "この記事",
      "del.pubNote": "\n\n※ 公開中の記事です。公開サイトからも消えます。",
      "del.confirm": "{label}を削除します。元に戻せません。{pubNote}\n\n削除してよろしいですか？",
      "del.deleting": "削除しています…",
      "del.done": "削除しました。",
      "del.err": "削除に失敗しました。通信状況や権限を確認してもう一度お試しください。",

      /* ---- 記事一覧 ---- */
      "list.title": "自分が書いた記事",
      "list.empty": "あなたが書いた記事はまだありません。",
      "list.loadErr": "一覧を読み込めませんでした。",
      "list.editBtn": "編集",
      "list.delBtn": "削除",
      "list.untitled": "(タイトルなし)",
      "list.editorPrefix": "編集：{name}",
      "badge.live": "公開中",
      "badge.draft": "下書き"
    },

    en: {
      "login.docTitle": "On Your Mark! Staff Blog Edit — Login",
      "edit.docTitle": "On Your Mark! Staff Blog Edit — Edit",

      "lang.group": "Language",

      "login.kicker": "Staff only",
      "login.lead": "Creating and editing posts is for staff only. Please sign in with your Google account.",
      "login.googleBtn": "Sign in with Google",
      "login.back": "← Back to the blog",
      "login.msg.opening": "Opening the sign-in window…",
      "login.msg.switching": "Switching to a full-page sign-in…",
      "login.msg.cantStart": "Could not start sign-in. Please try again later.",
      "login.msg.failed": "Sign-in failed. Please try again.",
      "login.msg.cantReturn": "Could not return from sign-in. Please try again.",

      "gate.checking": "Checking your sign-in status…",
      "gate.err": 'Could not check your sign-in status. <a href="login.html">Go to the sign-in page</a>',
      "header.menu": "← Menu",
      "header.changeName": "Change display name",
      "header.logout": "Log out",

      "welcome": "Welcome, {name}!",
      "choice.greeting": "Hi {name}, what would you like to do?",
      "name.fallback": "there",

      "name.label": "Display name",
      "name.note": "The name shown in the header greeting. It's also used as the default “editor name” on new posts (you can still change it per post).",
      "name.placeholder": "Name to show in the header",
      "name.save": "Save",
      "name.cancel": "Cancel",
      "name.unsetHint": "Display name not set — showing your Google account name for now. Use “Change display name” to set your own.",
      "name.err.empty": "Please enter a display name.",
      "name.err.long": "Please keep the display name to 40 characters or fewer.",
      "name.saving": "Saving…",
      "name.saved": "Saved.",
      "name.err.save": "Save failed. Please try again.",

      "choice.title": "What would you like to do?",
      "choice.newLabel": "Create a new post",
      "choice.newDesc": "Start writing from scratch",
      "choice.editLabel": "Edit an existing post",
      "choice.editDesc": "Pick one of your posts and revise it",

      "form.newTitle": "New post",
      "form.editTitle": "Edit post",
      "form.new": "＋ New",
      "field.title": "Title",
      "field.title.ph": "Article title",
      "field.date": "Date",
      "field.editor": "Editor name",
      "field.editor.ph": "Name to show on the post",
      "field.category": "Category",
      "field.photos": "Photos (up to 2)",
      "field.body": "Body",
      "field.body.ph": "Write the body here. Separate paragraphs with a blank line.",
      "form.preview": "Preview",
      "form.saveDraft": "Save draft",
      "form.publish": "Publish",

      "preview.heading": "Preview (how it will look once published)",
      "preview.note": "For checking the look only — nothing is saved or published.",
      "preview.close": "Close",
      "preview.editorPrefix": "Editor ",

      "cat.camp": "Camp day",
      "cat.meeting": "Meeting",
      "cat.other": "Other",

      "photo.add": "＋ Add photo",
      "photo.hint": "JPEG / PNG, etc. Uploaded when you save or publish.",
      "photo.hintFull": "Up to 2 photos. Delete one to swap it out.",
      "photo.alt": "Photo {n}",
      "photo.remove": "Remove photo {n}",
      "photo.err.max": "You can add up to 2 photos.",
      "photo.err.type": "Please choose an image file.",

      "hint.published": "This post is currently LIVE. Saving updates it right away.",
      "hint.draft": "This post is a DRAFT. Press Publish to make it live on the blog.",

      "err.title": "Please enter a title.",
      "err.date": "Please choose a date.",
      "err.editor": "Please enter an editor name.",
      "err.category": "Please choose a category.",
      "err.body": "Please enter the body text.",

      "save.uploading": "Uploading photo {n}…",
      "save.publishing": "Publishing…",
      "save.saving": "Saving…",
      "save.published": "Published. It will appear on the blog.",
      "save.savedDraft": "Saved as a draft.",
      "save.err": "Save failed. Check your connection and try again.",

      "del.label": "“{title}”",
      "del.thisPost": "this post",
      "del.pubNote": "\n\n* This post is live and will also disappear from the blog.",
      "del.confirm": "Delete {label}? This can't be undone.{pubNote}\n\nAre you sure?",
      "del.deleting": "Deleting…",
      "del.done": "Deleted.",
      "del.err": "Delete failed. Check your connection and permissions, then try again.",

      "list.title": "Your posts",
      "list.empty": "You haven't written any posts yet.",
      "list.loadErr": "Could not load the list.",
      "list.editBtn": "Edit",
      "list.delBtn": "Delete",
      "list.untitled": "(untitled)",
      "list.editorPrefix": "Editor: {name}",
      "badge.live": "Live",
      "badge.draft": "Draft"
    }
  };

  /* ----------------------- 保存された言語の読み書き ----------------------- */
  function readStored() {
    try {
      var v = localStorage.getItem(STORE_KEY);
      if (v && SUPPORTED.indexOf(v) !== -1) return v;
    } catch (e) { /* localStorage 不可でも既定で動く */ }
    return DEFAULT_LANG;
  }
  function writeStored(lang) {
    try { localStorage.setItem(STORE_KEY, lang); } catch (e) { /* 保存できなくても続行 */ }
  }

  var current = readStored();

  /* ----------------------- 文字列の取得 ----------------------- */
  /* キー → 現在言語の文字列。無ければ ja → キーそのもの の順にフォールバック */
  function raw(key) {
    var table = STRINGS[current] || {};
    if (Object.prototype.hasOwnProperty.call(table, key)) return table[key];
    if (STRINGS.ja && Object.prototype.hasOwnProperty.call(STRINGS.ja, key)) return STRINGS.ja[key];
    return key;
  }
  /* {name} などのプレースホルダを置換して返す */
  function t(key, params) {
    var s = raw(key);
    if (params) {
      Object.keys(params).forEach(function (k) {
        s = s.split("{" + k + "}").join(String(params[k]));
      });
    }
    return s;
  }

  /* ----------------------- 画面への反映 ----------------------- */
  function applyStatic(root) {
    var scope = root || document;

    scope.querySelectorAll("[data-i18n]").forEach(function (elm) {
      elm.textContent = t(elm.getAttribute("data-i18n"));
    });
    scope.querySelectorAll("[data-i18n-html]").forEach(function (elm) {
      elm.innerHTML = t(elm.getAttribute("data-i18n-html"));
    });
    scope.querySelectorAll("[data-i18n-placeholder]").forEach(function (elm) {
      elm.setAttribute("placeholder", t(elm.getAttribute("data-i18n-placeholder")));
    });
    scope.querySelectorAll("[data-i18n-aria-label]").forEach(function (elm) {
      elm.setAttribute("aria-label", t(elm.getAttribute("data-i18n-aria-label")));
    });
  }

  function syncToggle() {
    document.querySelectorAll("[data-lang-btn]").forEach(function (btn) {
      var on = btn.getAttribute("data-lang-btn") === current;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function setLang(lang, opts) {
    if (SUPPORTED.indexOf(lang) === -1) return;
    current = lang;
    if (!opts || opts.persist !== false) writeStored(lang);
    document.documentElement.setAttribute("lang", lang);
    applyStatic(document);
    syncToggle();
    window.dispatchEvent(new CustomEvent("i18n:change", { detail: { lang: lang } }));
  }

  /* ----------------------- 公開API ----------------------- */
  window.I18N = {
    t: t,
    getLang: function () { return current; },
    setLang: setLang,
    apply: applyStatic
  };

  /* 切り替えボタン（イベント委譲。HTMLには data-lang-btn だけ書けばよい） */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest("[data-lang-btn]") : null;
    if (!btn) return;
    e.preventDefault();
    setLang(btn.getAttribute("data-lang-btn"));
  });

  /* 初期適用（defer で読み込むので DOM は構築済み）。保存はしない。 */
  setLang(current, { persist: false });
})();
