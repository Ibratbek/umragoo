/* =====================================================
   UMRAGOO — admin panel (bitta sahifali ilova)
   server.py dagi /api/ bilan ishlaydi. Saytdagi barcha
   ma'lumotlar (js/data.js) shu yerdan tahrirlanadi.
   Kutubxonalarsiz, oddiy JavaScript (ES2020).
   ===================================================== */
(function () {
  "use strict";

  /* ---------- umumiy yordamchilar ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ico = (id, cls) => `<svg class="ic${cls ? " " + cls : ""}" aria-hidden="true"><use href="#${esc(id)}"/></svg>`;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const pad = (n) => String(n).padStart(2, "0");
  const isNum = (v) => typeof v === "number" && isFinite(v);
  const getAt = (o, path) => path.reduce((a, k) => (a == null ? undefined : a[k]), o);
  function setAt(o, path, val) {
    let cur = o;
    for (let i = 0; i < path.length - 1; i++) {
      const k = path[i];
      if (cur[k] == null || typeof cur[k] !== "object") cur[k] = typeof path[i + 1] === "number" ? [] : {};
      cur = cur[k];
    }
    cur[path[path.length - 1]] = val;
  }
  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  function daysUntil(ymd) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || "");
    if (!m) return null;
    const t = new Date();
    return Math.round((Date.UTC(+m[1], m[2] - 1, +m[3]) - Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())) / 864e5);
  }
  function fmtNum(n) {
    const x = Number(n);
    if (!isFinite(x)) return "";
    const p = String(Math.round(Math.abs(x) * 100) / 100).split(".");
    return (x < 0 ? "-" : "") + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ") + (p[1] ? "." + p[1] : "");
  }
  const fmtUsd = (v) => (v === "" || v == null || !isFinite(v) ? "" : "$" + fmtNum(v));
  // "2026-10-17T14:05:00" -> "17.10.2026 14:05"
  function fmtDate(s, empty = "—") {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(s || ""));
    if (!m) return s ? String(s) : empty;
    return `${m[3]}.${m[2]}.${m[1]}` + (m[4] ? ` ${m[4]}:${m[5]}` : "");
  }
  const fmtSize = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(2)} MB`);
  const rate = () => Number(getAt(S.site, ["settings", "usdToUzs"])) || 0;
  const uzs = (usd) => fmtNum(Math.round(usd * rate())) + " so'm";
  const initial = (s) => (String(s || "?").trim()[0] || "?").toUpperCase();
  function resolveUrl(u) {
    u = String(u || "").trim();
    if (!u || /^(javascript|vbscript|data):/i.test(u)) return "";
    try { return new URL(u, location.origin + "/").href; } catch (e) { return ""; }
  }
  function download(content, name, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  async function busy(btn, fn) {
    if (btn) btn.disabled = true;
    try { return await fn(); } finally { if (btn && btn.isConnected) btn.disabled = false; }
  }
  const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
  const WEEKDAYS = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];

  /* ---------- holat ---------- */
  const S = {
    authed: false, site: null, saved: "", savedObj: null, rev: "", saving: false,
    requests: [], reviews: [], reqLoaded: false, page: "dashboard",
    reqFilter: "all", reqSearch: "", filters: {}, tg: null, pollT: 0, icons: null,
  };
  let openItems = new WeakSet();      // ochiq turgan ro'yxat elementlari (obyekt bo'yicha)
  const REG = new Map();              // maydon id -> {def, path}
  let regSeq = 0, openPop = null, pendingFocus = null, spriteP = null;
  const STATUS = { new: "Yangi", progress: "Jarayonda", done: "Yakunlangan", cancelled: "Bekor qilingan" };

  /* ---------- ikonkalar ---------- */
  const ICON_NAMES = {
    "i-kaaba": "Ka'ba", "i-moon": "Hilol", "i-bed": "Karavot", "i-file": "Hujjat", "i-plane": "Samolyot", "i-bus": "Avtobus",
    "i-train": "Poyezd", "i-store": "Do'kon", "i-sliders": "Sozlash", "i-star": "Yulduz", "i-pin": "Manzil", "i-clock": "Soat",
    "i-calendar": "Kalendar", "i-check": "Belgi", "i-check-circle": "Tasdiq", "i-shield": "Qalqon", "i-users": "Odamlar",
    "i-zap": "Chaqmoq", "i-headset": "Operator", "i-message": "Xabar", "i-send": "Yuborish", "i-gift": "Sovg'a",
    "i-user": "Foydalanuvchi", "i-search": "Qidiruv", "i-sparkles": "Uchqun", "i-megaphone": "Karnay", "i-briefcase": "Portfel",
    "i-percent": "Foiz", "i-award": "Mukofot", "i-smartphone": "Smartfon", "i-building": "Bino", "i-clipboard": "Ro'yxat",
    "i-rocket": "Raketa", "i-globe": "Globus", "i-phone": "Telefon", "i-mail": "Pochta",
  };
  const ICON_IDS = Object.keys(ICON_NAMES);
  const iconName = (id) => (id ? ICON_NAMES[id] || id : "Tanlanmagan");

  // index.html dagi <defs> li birinchi <svg> dan faqat <symbol> larni xavfsiz ko'chiramiz
  async function loadSprite() {
    try {
      const res = await fetch("/index.html", { credentials: "same-origin", cache: "no-cache" });
      if (!res.ok) return;
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      const svg = Array.from(doc.querySelectorAll("svg")).find((s) => s.querySelector("defs"));
      const defs = $("#site-sprite defs");
      if (!svg || !defs) return;
      svg.querySelectorAll("symbol[id]").forEach((sym) => {
        if (document.getElementById(sym.id)) return;
        const node = document.importNode(sym, true);
        node.querySelectorAll("script,foreignObject,a").forEach((n) => n.remove());
        [node, ...node.querySelectorAll("*")].forEach((el) => Array.from(el.attributes).forEach((at) => {
          if (/^on/i.test(at.name) || /javascript:/i.test(at.value)) el.removeAttribute(at.name);
        }));
        defs.appendChild(node);
      });
    } catch (e) { /* ikonkalarsiz ham ishlayveradi */ }
    const have = ICON_IDS.filter((id) => document.getElementById(id));
    S.icons = have.length ? have : ICON_IDS.slice();
  }

  /* ---------- toast va dialog oynalari ---------- */
  function toast(msg, type = "info") {
    const box = $("#toasts");
    if (!box) return;
    const el = document.createElement("div");
    el.className = "toast t-" + type;
    el.setAttribute("role", type === "err" ? "alert" : "status");
    el.innerHTML = ico(type === "err" ? "a-alert" : type === "ok" ? "a-check" : "a-info") + `<span>${esc(msg)}</span>`;
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 300); }, type === "err" ? 6500 : 3500);
  }
  const fail = (e) => { if (!e || !e.silent) toast((e && e.message) || "Xatolik yuz berdi", "err"); };

  function dialog({ title, html, buttons, danger }) {
    return new Promise((resolve) => {
      const prev = document.activeElement;
      const wrap = document.createElement("div");
      wrap.className = "dlg-backdrop";
      wrap.innerHTML = `<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-t">
        <h3 id="dlg-t">${danger ? ico("a-alert") : ""}${esc(title)}</h3><div class="dlg-body">${html || ""}</div>
        <div class="dlg-foot">${buttons.map((b, i) => `<button type="button" class="btn ${b.cls || "btn-outline"}" data-i="${i}">${esc(b.label)}</button>`).join("")}</div></div>`;
      document.body.appendChild(wrap);
      const onKey = (e) => {
        if (e.key === "Escape") { e.stopPropagation(); close(null); }
        if (e.key === "Tab") { // fokusni oyna ichida ushlab turish
          const f = $$("button", wrap), i = f.indexOf(document.activeElement);
          if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        }
      };
      const close = (v) => {
        wrap.remove();
        document.removeEventListener("keydown", onKey, true);
        if (prev && prev.isConnected && prev.focus) prev.focus();
        resolve(v);
      };
      document.addEventListener("keydown", onKey, true);
      wrap.addEventListener("click", (e) => {
        const b = e.target.closest("[data-i]");
        if (b) close(buttons[+b.dataset.i].value);
        else if (e.target === wrap) close(null);
      });
      const btns = $$(".dlg-foot .btn", wrap);
      (danger ? btns[0] : btns[btns.length - 1]).focus();
    });
  }
  const confirmDlg = (title, text, okLabel = "Ha", danger = false) => dialog({
    title, danger, html: `<p>${esc(text)}</p>`,
    buttons: [{ label: "Bekor qilish", value: false }, { label: okLabel, cls: danger ? "btn-danger" : "btn-primary", value: true }],
  }).then(Boolean);

  /* ---------- API ---------- */
  class ApiError extends Error {
    constructor(msg, status, silent) { super(msg); this.status = status; this.silent = !!silent; }
  }
  async function api(method, url, body, opts = {}) {
    const init = { method, credentials: "same-origin", cache: "no-store", headers: { "X-Requested-With": "umragoo", Accept: "application/json" } };
    if (body !== undefined) { init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(body); }
    let res, data = null;
    try { res = await fetch(url, init); } catch (e) { throw new ApiError("Server bilan aloqa yo'q. Server ishlab turganini tekshiring.", 0); }
    try { data = await res.json(); } catch (e) { data = null; }
    if (res.status === 401 && !opts.login) {
      showLogin("Sessiya muddati tugagan. Iltimos, qayta kiring.");
      throw new ApiError("Sessiya tugagan", 401, true);
    }
    if (!res.ok) throw new ApiError((data && data.error) || `Server xatosi (${res.status})`, res.status);
    if (!data || typeof data !== "object") throw new ApiError("Serverdan noto'g'ri javob keldi", res.status);
    return data;
  }

  /* ---------- sxema: maydon yordamchilari ---------- */
  const F = (t, k, l, o) => Object.assign({ t, k, l }, o || {});
  const daysPrev = (v) => {
    const n = daysUntil(v);
    if (n == null) return "";
    return n > 0 ? `${fmtNum(n)} kun qoldi` : n === 0 ? "Bugun" : `Sana o'tib ketgan (${fmtNum(-n)} kun oldin)`;
  };
  const uzsPrev = (v) => (isNum(v) && rate() ? `≈ ${uzs(v)}` : "");
  const lenPrev = (v) => `${String(v || "").length} belgi`;
  const PRICE = (l) => F("number", "price", l, { req: true, min: 1, step: 1, w: "quarter", preview: uzsPrev, ph: "0" });
  const CITIES = ["Toshkent", "Samarqand", "Buxoro", "Farg'ona", "Namangan", "Andijon", "Urganch", "Qarshi", "Termiz", "Nukus", "Navoiy", "Jizzax"];
  const ANCHORS = ["#umra", "#mehmonxonalar", "#vizalar", "#aviachiptalar", "#poyezd", "#sorov", "#hamkorlik", "#sharhlar", "#ilova", "#aloqa"];
  const TOKENS = ["umra_min", "umra_max", "mehmonxona_min", "viza_min", "chipta_min"];

  function newCode() {
    const codes = new Set((S.site.umrah || []).map((x) => x && x.code));
    let n = (S.site.umrah || []).length + 1;
    while (codes.has("UMR-" + pad(n))) n++;
    return "UMR-" + pad(n);
  }
  function uniqueCode(base) {
    const codes = new Set((S.site.umrah || []).map((x) => x && x.code));
    const b = String(base).replace(/-\d+$/, "") || "UMR";
    let n = 2;
    while (codes.has(`${b}-${n}`)) n++;
    return `${b}-${n}`;
  }
  function checkCode(v) {
    const c = String(v).trim();
    if (/[\s{}]/.test(c)) return "«Kod»da bo'sh joy yoki { } belgilari bo'lmasligi kerak";
    const n = (S.site.umrah || []).filter((x) => x && String(x.code || "").trim() === c).length;
    return n > 1 ? `«Kod» takrorlangan (${c}) — har bir paketning kodi noyob bo'lishi kerak` : null;
  }
  // Rafiq javoblaridagi {…} belgilarini tekshirish
  function checkTokens(v) {
    const codes = new Set((S.site.umrah || []).map((x) => x && String(x.code || "").trim()));
    const re = /\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(String(v)))) {
      const t = m[1].trim();
      if (TOKENS.includes(t)) continue;
      const n = /^narx:(.+)$/.exec(t);
      if (n) { if (!codes.has(n[1].trim())) return `{${t}} — «${n[1].trim()}» kodli umra paketi topilmadi`; continue; }
      return `Noma'lum belgi: {${t}}`;
    }
    return null;
  }
  const checkPhone = (v) => (String(v).replace(/\D/g, "").length < 7 ? "Telefon raqami to'liq emas" : null);
  const checkEmail = (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim()) ? null : "Elektron pochta manzili noto'g'ri");

  /* ---------- sxema: ro'yxatlar ---------- */
  const SEC_FIELDS = [
    F("text", "badge", "Kichik yozuv (belgi)", { w: "half", hint: "Sarlavha ustidagi kichik yorliq" }),
    F("text", "title", "Sarlavha", { w: "half", req: true }),
    F("textarea", "text", "Izoh matni", { rows: 2 }),
  ];
  const secCard = (key, title) => ({ title: title || "Bo'lim sarlavhasi", desc: "Saytdagi bo'lim tepasida ko'rinadigan yozuvlar", base: ["sections", key], fields: SEC_FIELDS });

  const L_UMRAH = F("list", "umrah", "Umra paketlari", {
    main: true, nolabel: true, hide: true, search: true, add: "Paket qo'shish",
    fields: [
      F("text", "title", "Nomi", { req: true, w: "half", ph: "Masalan: Ramazon umrasi" }),
      F("text", "code", "Kod", { req: true, w: "quarter", ph: "UMR-RMZ-01", check: checkCode, hint: "Noyob bo'lsin: Rafiq {narx:KOD} uchun ishlatadi" }),
      F("text", "tag", "Yorliq", { w: "quarter", ph: "Premium", hint: "Rasm ustidagi belgi" }),
      PRICE("Narx (USD, kishi boshiga)"),
      F("number", "days", "Kunlar soni", { w: "quarter", min: 1, step: 1 }),
      F("number", "seats", "Bo'sh o'rinlar", { w: "quarter", min: 0, step: 1, hint: "10 va undan kam bo'lsa «Faqat N o'rin qoldi» chiqadi" }),
      F("number", "rating", "Reyting", { w: "quarter", min: 0, max: 5, step: 0.1, ph: "4.8" }),
      F("text", "makkah", "Makkadagi mehmonxona", { w: "half", ph: "Hilton Suites Makkah · 5★" }),
      F("text", "madinah", "Madinadagi mehmonxona", { w: "half", ph: "Pullman Zamzam Madina · 5★" }),
      F("text", "from", "Jo'nash shahri", { w: "half", list: CITIES }),
      F("text", "airline", "Aviakompaniya", { w: "half", list: ["Uzbekistan Airways", "Saudia", "Flynas", "Flydubai", "Qatar Airways", "Turkish Airlines"] }),
      F("tags", "includes", "Narxga kiradi", { hint: "Masalan: Aviachipta, Viza, Mehmonxona, Transfer, Ziyoratlar" }),
      F("image", "img", "Rasm"),
    ],
    def: () => ({ code: newCode(), title: "", days: 7, from: "Toshkent", airline: "", rating: 4.5, seats: 20, makkah: "", madinah: "", includes: ["Aviachipta", "Viza", "Mehmonxona"], price: "", img: "", tag: "", hidden: false }),
    sum: (it) => ({ img: it.img || "", title: it.title, sub: [it.code, it.days ? it.days + " kun" : "", fmtUsd(it.price)].filter(Boolean).join(" · ") }),
  });
  const L_HOTELS = F("list", "hotels", "Mehmonxonalar", {
    main: true, nolabel: true, hide: true, search: true, add: "Mehmonxona qo'shish",
    fields: [
      F("text", "name", "Nomi", { req: true, w: "half", ph: "Swissôtel Al Maqam Makkah" }),
      F("select", "city", "Shahar", { w: "quarter", opts: ["Makka", "Madina", "Jidda", "Toif"] }),
      F("stars", "stars", "Yulduzlar", { w: "quarter" }),
      PRICE("Narx (USD, bir kecha)"),
      F("number", "rating", "Reyting", { w: "quarter", min: 0, max: 5, step: 0.1, ph: "4.5" }),
      F("text", "dist", "Masofa", { w: "half", ph: "Haramgacha 150 m" }),
      F("tags", "features", "Afzalliklar", { hint: "Masalan: Bepul bekor qilish, Nonushta" }),
      F("image", "img", "Rasm"),
    ],
    def: () => ({ name: "", city: "Makka", stars: 4, rating: 4.5, dist: "Haramgacha 500 m", price: "", features: ["Bepul bekor qilish", "Nonushta"], img: "", hidden: false }),
    sum: (it) => ({ img: it.img || "", title: it.name, sub: [it.city, it.stars ? it.stars + "★" : "", it.price ? fmtUsd(it.price) + " / kecha" : ""].filter(Boolean).join(" · ") }),
  });
  const L_VISAS = F("list", "visas", "Vizalar", {
    main: true, nolabel: true, hide: true, search: true, add: "Viza qo'shish",
    fields: [
      F("text", "title", "Nomi", { req: true, w: "half", ph: "Umra vizasi (Nusuk)" }),
      PRICE("Narx (USD)"),
      F("text", "entry", "Kirish turi", { w: "quarter", list: ["Bir martalik", "Ko'p martalik"] }),
      F("text", "issue", "Rasmiylashtirish muddati", { w: "third", ph: "3 ish kuni" }),
      F("text", "valid", "Amal qilish muddati", { w: "third", ph: "90 kun" }),
      F("text", "note", "Izoh", { w: "third", ph: "Umra paketi bilan birga" }),
    ],
    def: () => ({ title: "", issue: "3 ish kuni", valid: "90 kun", entry: "Bir martalik", price: "", note: "", hidden: false }),
    sum: (it) => ({ icon: "i-file", title: it.title, sub: [fmtUsd(it.price), it.issue, it.entry].filter(Boolean).join(" · ") }),
  });
  const L_FLIGHTS = F("list", "flights", "Aviachiptalar", {
    main: true, nolabel: true, hide: true, search: true, add: "Reys qo'shish",
    fields: [
      F("text", "airline", "Aviakompaniya", { req: true, w: "half", list: ["Uzbekistan Airways", "Saudia", "Flynas", "Flydubai", "Qatar Airways", "Turkish Airlines"] }),
      F("text", "code", "Qisqa kod", { w: "quarter", ph: "HY", hint: "Logotip o'rnida chiqadi" }),
      F("text", "flight", "Reys raqami", { w: "quarter", ph: "HY 351" }),
      F("text", "from", "Qayerdan (kod)", { w: "quarter", ph: "TAS", list: ["TAS", "SKD", "BHK", "FEG", "NMA", "UGC"] }),
      F("text", "fromCity", "Qayerdan (shahar)", { w: "quarter", list: CITIES }),
      F("text", "to", "Qayerga (kod)", { w: "quarter", ph: "JED", list: ["JED", "MED", "TIF"] }),
      F("text", "toCity", "Qayerga (shahar)", { w: "quarter", list: ["Jidda", "Madina", "Toif"] }),
      F("time", "dep", "Uchish vaqti", { w: "quarter" }),
      F("time", "arr", "Qo'nish vaqti", { w: "quarter" }),
      F("text", "dur", "Yo'l davomiyligi", { w: "quarter", ph: "5 s 30 daq" }),
      F("text", "stops", "To'xtashlar", { w: "quarter", list: ["To'g'ridan-to'g'ri", "1 to'xtash", "2 to'xtash"] }),
      PRICE("Narx (USD)"),
    ],
    def: () => ({ airline: "", code: "", flight: "", from: "TAS", fromCity: "Toshkent", to: "JED", toCity: "Jidda", dep: "08:00", arr: "12:00", dur: "", stops: "To'g'ridan-to'g'ri", price: "", hidden: false }),
    sum: (it) => ({ icon: "i-plane", title: [it.airline, it.flight].filter(Boolean).join(" · "), sub: `${it.from || "?"} → ${it.to || "?"} · ${it.dep || "--:--"}${it.price ? " · " + fmtUsd(it.price) : ""}` }),
  });
  const L_TESTI = F("list", "testimonials", "Sharhlar", {
    main: true, nolabel: true, hide: true, search: true, addTop: true, add: "Sharh qo'shish",
    fields: [
      F("text", "name", "Ism", { req: true, w: "third" }),
      F("text", "place", "Shahar · xizmat", { w: "third", ph: "Toshkent · Umra paketi" }),
      F("stars", "stars", "Baho", { w: "third" }),
      F("textarea", "text", "Sharh matni", { req: true, rows: 3 }),
    ],
    def: () => ({ name: "", place: "", stars: 5, text: "", hidden: false }),
    sum: (it) => ({ av: initial(it.name), title: it.name, sub: "★".repeat(Math.max(0, Math.min(5, +it.stars || 0))) + (it.place ? " · " + it.place : "") }),
  });
  const L_SERVICES = F("list", "services", "Xizmatlar", {
    main: true, hide: true, add: "Xizmat qo'shish",
    fields: [
      F("icon", "icon", "Ikonka", { w: "third" }),
      F("text", "title", "Nomi", { req: true, w: "third" }),
      F("text", "tag", "Yorliq", { w: "third", ph: "Yangi", hint: "Bo'sh qolsa ko'rinmaydi" }),
      F("text", "text", "Qisqa izoh", { w: "half" }),
      F("text", "link", "Havola", { w: "half", list: ANCHORS, hint: "Saytdagi bo'lim (#umra) yoki to'liq URL" }),
    ],
    def: () => ({ icon: "i-kaaba", title: "", text: "", link: "#sorov", tag: "", hidden: false }),
    sum: (it) => ({ icon: it.icon || "i-kaaba", title: it.title, sub: [it.text, it.tag ? "«" + it.tag + "»" : ""].filter(Boolean).join(" · ") }),
  });
  // kichik ro'yxatlar (ixcham qatorlar)
  const L_STATS = F("list", "stats", "Raqamlar (statistika)", {
    compact: true, add: "Ko'rsatkich qo'shish",
    fields: [F("text", "value", "Qiymat", { w: "third", req: true, ph: "50 000+" }), F("text", "label", "Izoh", { w: "wide", ph: "Umra ziyoratchilari" })],
    def: () => ({ value: "", label: "" }),
  });
  const L_FACTS = F("list", "facts", "Qisqa faktlar", {
    compact: true, add: "Fakt qo'shish",
    fields: [F("icon", "icon", "Ikonka", { w: "third" }), F("text", "text", "Matn", { w: "wide", req: true, ph: "300 km/soat" })],
    def: () => ({ icon: "i-check-circle", text: "" }),
  });
  const L_BENEFITS = F("list", "benefits", "Afzalliklar", {
    compact: true, add: "Afzallik qo'shish",
    fields: [F("icon", "icon", "Ikonka", { w: "quarter" }), F("text", "title", "Sarlavha", { w: "quarter", req: true }), F("text", "text", "Matn", { w: "half" })],
    def: () => ({ icon: "i-check-circle", title: "", text: "" }),
  });
  const L_STEPS = F("list", "steps", "Hamkorlik bosqichlari", {
    compact: true, add: "Bosqich qo'shish",
    fields: [F("text", "title", "Sarlavha", { w: "third", req: true }), F("text", "text", "Matn", { w: "wide" })],
    def: () => ({ title: "", text: "" }),
  });
  const L_LICENSES = F("list", "licenses", "Litsenziyalar va guvohnomalar", {
    compact: true, add: "Qo'shish",
    fields: [F("icon", "icon", "Ikonka", { w: "third" }), F("text", "text", "Matn", { w: "wide", req: true })],
    def: () => ({ icon: "i-shield", text: "" }),
  });
  const L_ANSWERS = F("list", "answers", "Javoblar", {
    compact: true, add: "Javob qo'shish",
    fields: [
      F("text", "keys", "Kalit so'zlar", { req: true, ph: "umra, narx, paket", hint: "Vergul bilan ajrating. Mijoz xabarida shu so'zlardan biri bo'lsa, quyidagi javob beriladi" }),
      F("textarea", "text", "Javob matni", { req: true, rows: 3, check: checkTokens }),
    ],
    def: () => ({ keys: "", text: "" }),
  });
  const partnerGroup = (k, l) => F("group", k, l, {
    w: "half", fields: [F("text", "title", "Sarlavha", { req: true }), F("textarea", "text", "Matn", { rows: 3 }), F("tags", "points", "Afzalliklar ro'yxati")],
  });

  /* ---------- sxema: sahifalar ---------- */
  const PAGES = [
    { id: "dashboard", group: "Asosiy", title: "Boshqaruv paneli", icon: "i-sliders", pre: () => pgDashboard() },
    { id: "requests", group: "Asosiy", title: "So'rovlar", icon: "i-send", badge: "requests", pre: () => pgRequests(),
      desc: "Saytdagi formalar orqali kelgan mijoz so'rovlari. Ro'yxat har daqiqada avtomatik yangilanadi." },
    { id: "reviews", group: "Asosiy", title: "Sharhlar", icon: "i-star", badge: "reviews", pre: () => pgPending(),
      desc: "Mijozlar yuborgan sharhlarni tasdiqlang va saytdagi sharhlarni tahrirlang.",
      cards: [
        { title: "Saytdagi sharhlar", desc: "Saytdagi «Mijozlarimiz fikri» bo'limida ko'rsatiladi. Yashirin sharhlar chiqmaydi.", base: [], fields: [L_TESTI] },
        { title: "Umumiy baho", desc: "Sharhlar bo'limidagi o'rtacha baho va sharhlar soni", base: ["reviewsSummary"], fields: [
          F("text", "rating", "O'rtacha baho", { w: "quarter", req: true, ph: "4.9" }),
          F("number", "count", "Sharhlar soni", { w: "quarter", min: 0, step: 1 }),
        ] },
        secCard("sharhlar", "«Sharhlar» bo'limi sarlavhasi"),
      ] },
    { id: "umrah", group: "Takliflar", title: "Umra paketlari", icon: "i-kaaba",
      desc: "Saytdagi «Umra dasturlari» bo'limi. Yashirin paketlar saytda ko'rinmaydi, lekin shu yerda saqlanib qoladi.",
      cards: [secCard("umra"), { title: "Paketlar", base: [], fields: [L_UMRAH] }] },
    { id: "hotels", group: "Takliflar", title: "Mehmonxonalar", icon: "i-bed",
      desc: "Makka va Madina mehmonxonalari. Narx — bir kecha uchun, USD da.",
      cards: [secCard("mehmonxonalar"), { title: "Mehmonxonalar ro'yxati", base: [], fields: [L_HOTELS] }] },
    { id: "visas", group: "Takliflar", title: "Vizalar", icon: "i-file",
      desc: "Viza turlari va narxlari (USD). Saytda so'mga avtomatik aylantiriladi.",
      cards: [secCard("vizalar"), { title: "Viza turlari", base: [], fields: [L_VISAS] }] },
    { id: "flights", group: "Takliflar", title: "Aviachiptalar", icon: "i-plane",
      desc: "Aviareyslar ro'yxati. Narxlar USD da.",
      cards: [secCard("aviachiptalar"), { title: "Reyslar", base: [], fields: [L_FLIGHTS] }] },
    { id: "home", group: "Sayt matnlari", title: "Bosh sahifa", icon: "i-sparkles",
      desc: "Saytning birinchi ekrani (hero) va uning ostidagi xizmatlar qatori.",
      cards: [
        { title: "Birinchi ekran (hero)", base: ["hero"], fields: [
          F("text", "badge", "Yuqoridagi belgi", { w: "half" }),
          F("text", "chip", "Pastki shior", { w: "half" }),
          F("text", "bismillah", "Arabcha yozuv", { rtl: true }),
          F("text", "title", "Sarlavha", { w: "half", req: true }),
          F("text", "titleAccent", "Sarlavha davomi (oltin rangda)", { w: "half" }),
          F("textarea", "subtitle", "Qisqa tavsif", { rows: 2 }),
          F("image", "image", "Fon rasmi", { hint: "Keng (gorizontal) rasm tanlang" }),
          L_STATS,
        ] },
        { title: "Xizmatlar qatori", desc: "Hero ostidagi aylanuvchi xizmat kartochkalari", base: [], fields: [L_SERVICES] },
      ] },
    { id: "blocks", group: "Sayt matnlari", title: "Bo'limlar", icon: "i-train",
      desc: "Poyezd banneri, moslashuvchan so'rov, hamkorlik va mobil ilova bo'limlari.",
      cards: [
        { title: "Haramayn poyezdi banneri", base: ["train"], fields: [
          F("text", "badge", "Belgi", { w: "third" }), F("text", "title", "Sarlavha", { w: "third", req: true }), F("text", "button", "Tugma matni", { w: "third" }),
          F("textarea", "text", "Matn", { rows: 3 }), F("image", "image", "Rasm"), L_FACTS,
        ] },
        { title: "Moslashuvchan so'rov bloki", base: ["cta"], fields: [
          F("text", "badge", "Belgi", { w: "half" }), F("text", "title", "Sarlavha", { w: "half", req: true }),
          F("textarea", "text", "Matn", { rows: 3 }), L_BENEFITS,
        ] },
        secCard("hamkorlik", "«Hamkorlik» bo'limi sarlavhasi"),
        { title: "Hamkorlik kartalari", base: ["partners"], fields: [partnerGroup("marketer", "Marketolog kartasi"), partnerGroup("supplier", "Ta'minotchi kartasi"), L_STEPS] },
        { title: "Mobil ilova banneri", base: ["app"], fields: [
          F("text", "badge", "Belgi", { w: "third" }), F("text", "title", "Sarlavha", { w: "wide", req: true }),
          F("textarea", "text", "Matn", { rows: 2 }),
          F("url", "appStore", "App Store havolasi", { w: "half", hint: "Bo'sh qolsa, tugma «tez orada» xabarini ko'rsatadi" }),
          F("url", "googlePlay", "Google Play havolasi", { w: "half", hint: "Bo'sh qolsa, tugma «tez orada» xabarini ko'rsatadi" }),
        ] },
      ] },
    { id: "promo", group: "Sayt matnlari", title: "Aksiya va sanalar", icon: "i-gift",
      desc: "Aksiya oynasi, muhim sanalar va valyuta kursi.",
      cards: [
        { title: "Aksiya (sovg'alar oynasi)", base: ["promo"], fields: [
          F("bool", "enabled", "Aksiya yoqilgan", { hint: "O'chirilsa, aksiya oynasi saytda ko'rsatilmaydi" }),
          F("text", "badge", "Belgi", { w: "half" }), F("text", "title", "Sarlavha", { w: "half", req: true }),
          F("text", "subtitle", "Qisqa izoh"), F("text", "heading", "Oyna ichidagi sarlavha"),
          F("text", "button", "Tugma matni", { w: "third" }),
          F("text", "code", "Promo-kod", { w: "third", ph: "UMRAGOO10" }),
          F("date", "end", "Tugash sanasi", { w: "third", preview: daysPrev, hint: "Oynada shu sanagacha teskari sanoq ko'rsatiladi" }),
        ] },
        { title: "Muhim sanalar", base: ["dates"], fields: [
          F("date", "ramadan", "Ramazon boshlanishi", { w: "half", preview: daysPrev, hint: "Bosh sahifadagi «Ramazongacha N kun» sanog'i uchun" }),
        ] },
        { title: "Valyuta kursi", desc: "Barcha narxlar USD da kiritiladi va saytda so'mga avtomatik aylantiriladi", base: ["settings"], fields: [
          F("number", "usdToUzs", "1 USD necha so'm", { w: "half", req: true, min: 1, step: "any", preview: (v) => (isNum(v) && v > 0 ? `1 USD = ${fmtNum(v)} so'm · $100 = ${fmtNum(Math.round(v * 100))} so'm` : "") }),
        ] },
      ] },
    { id: "chat", group: "Sayt matnlari", title: "Rafiq yordamchi", icon: "i-message", pre: () => pgChatHelp(),
      desc: "Saytdagi «Rafiq» chat-yordamchisining matnlari va tayyor javoblari.",
      cards: [
        { title: "Asosiy matnlar", base: ["chat"], fields: [
          F("text", "name", "Yordamchi nomi", { w: "third", req: true }),
          F("textarea", "greeting", "Salomlashish xabari", { rows: 2 }),
          F("tags", "quick", "Tezkor savollar", { hint: "Chat ochilganda ko'rinadigan tayyor savol tugmalari" }),
          F("textarea", "fallback", "Javob topilmaganda", { rows: 2, hint: "Hech qaysi kalit so'z mos kelmasa shu matn chiqadi" }),
        ] },
        { title: "Tayyor javoblar", desc: "Yuqoridan pastga tekshiriladi — birinchi mos kelgan javob beriladi", base: ["chat"], fields: [L_ANSWERS] },
      ] },
    { id: "contacts", group: "Sayt matnlari", title: "Aloqa va footer", icon: "i-headset",
      desc: "Telefon, manzil, ijtimoiy tarmoqlar va sayt pastki qismi (footer). Bo'sh qoldirilgan maydonlar saytda ko'rsatilmaydi.",
      cards: [
        { title: "Aloqa ma'lumotlari", base: ["contacts"], fields: [
          F("text", "phone", "Telefon", { w: "third", ph: "+998 90 123 45 67", check: checkPhone }),
          F("text", "phone2", "Qo'shimcha telefon", { w: "third", ph: "+998 …", check: checkPhone }),
          F("text", "email", "Elektron pochta", { w: "third", ph: "info@umragoo.uz", check: checkEmail }),
          F("text", "hours", "Ish vaqti", { w: "half", ph: "Har kuni 09:00 – 21:00" }),
          F("text", "support", "Qo'llab-quvvatlash matni", { w: "half" }),
          F("text", "address", "Manzil", { ph: "Toshkent sh., …" }),
          F("url", "telegram", "Telegram", { w: "half", ph: "https://t.me/…" }),
          F("url", "instagram", "Instagram", { w: "half", ph: "https://instagram.com/…" }),
          F("url", "facebook", "Facebook", { w: "half", ph: "https://facebook.com/…" }),
          F("url", "youtube", "YouTube", { w: "half", ph: "https://youtube.com/…" }),
        ] },
        { title: "Footer", base: ["footer"], fields: [
          F("textarea", "about", "Kompaniya haqida", { rows: 3 }),
          F("text", "motto", "Shior", { w: "half" }),
          F("text", "copyright", "Mualliflik huquqi matni", { w: "half" }),
          L_LICENSES,
        ] },
      ] },
    { id: "settings", group: "Tizim", title: "Sozlamalar", icon: "i-shield", post: () => pgSettingsExtra(), after: () => loadSettingsExtra(),
      desc: "SEO, Telegram bildirishnomalari, parol, zaxira nusxalar va JSON eksport/import.",
      cards: [
        { title: "SEO (qidiruv tizimlari uchun)", desc: "«Saqlash» tugmasi bilan boshqa ma'lumotlar bilan birga saqlanadi", base: ["seo"], fields: [
          F("text", "title", "Sahifa sarlavhasi", { req: true, preview: lenPrev, hint: "Brauzer yorlig'i va Google natijalarida ko'rinadi (tavsiya: 50–65 belgi)" }),
          F("textarea", "description", "Tavsif", { rows: 3, preview: lenPrev, hint: "Google natijalaridagi qisqa matn (tavsiya: 140–160 belgi)" }),
          F("textarea", "keywords", "Kalit so'zlar", { rows: 2, hint: "Vergul bilan ajrating" }),
        ] },
      ] },
  ];
  const pageById = (id) => PAGES.find((p) => p.id === id) || PAGES[0];

  /* ---------- forma chizuvchi (rekursiv) ---------- */
  function reg(def, path) { const id = "f" + ++regSeq; REG.set(id, { def, path }); return id; }

  function cardHTML(card) {
    return `<section class="card">
      <header class="card-h"><div><h2>${esc(card.title)}</h2>${card.desc ? `<p>${esc(card.desc)}</p>` : ""}</div></header>
      <div class="fgrid">${card.fields.map((f) => fieldHTML(f, card.base.concat(f.k))).join("")}</div>
    </section>`;
  }

  function fieldHTML(f, path) {
    const id = reg(f, path), iid = "in-" + id, v = getAt(S.site, path);
    const w = f.w || "full", ph = f.ph ? ` placeholder="${esc(f.ph)}"` : "";
    const val = v == null ? "" : v;
    const hint = f.hint ? `<div class="fld-hint">${esc(f.hint)}</div>` : "";
    let ctl, lbl = `<label class="fld-l" for="${iid}">${esc(f.l)}${f.req ? '<span class="rq" title="Majburiy">*</span>' : ""}</label>`;
    switch (f.t) {
      case "list": return listHTML(f, path, id, v);
      case "group":
        return `<fieldset class="grp w-${w}" data-fid="${id}"><legend>${esc(f.l)}</legend>
          <div class="fgrid">${f.fields.map((sf) => fieldHTML(sf, path.concat(sf.k))).join("")}</div></fieldset>`;
      case "bool":
        return `<div class="fld fld-bool w-${w}" data-fid="${id}"><label class="switch"><input type="checkbox" id="${iid}"${v ? " checked" : ""}>
          <span class="sl" aria-hidden="true"></span><span class="sw-l">${esc(f.l)}</span></label>${hint}</div>`;
      case "textarea": ctl = `<textarea id="${iid}" rows="${f.rows || 3}"${ph}>${esc(val)}</textarea>`; break;
      case "number":
        ctl = `<input id="${iid}" type="number" inputmode="decimal" step="${f.step || "any"}"${f.min != null ? ` min="${f.min}"` : ""}${f.max != null ? ` max="${f.max}"` : ""} value="${esc(val)}"${ph}>`;
        break;
      case "date": case "time": ctl = `<input id="${iid}" type="${f.t}" value="${esc(val)}">`; break;
      case "url": ctl = `<input id="${iid}" type="url" inputmode="url" spellcheck="false" value="${esc(val)}" placeholder="${esc(f.ph || "https://")}">`; break;
      case "select": {
        const opts = f.opts.slice();
        if (!opts.includes(val)) opts.unshift(val);
        ctl = `<select id="${iid}">${opts.map((o) => `<option value="${esc(o)}"${o === val ? " selected" : ""}>${esc(o || "— tanlang —")}</option>`).join("")}</select>`;
        break;
      }
      case "stars": {
        const n = Math.round(Number(v) || 0);
        lbl = `<span class="fld-l">${esc(f.l)}</span>`;
        ctl = `<div class="stars-in" role="radiogroup" aria-label="${esc(f.l)}">${[1, 2, 3, 4, 5].map((i) =>
          `<button type="button" data-act="star" data-v="${i}" class="${i <= n ? "on" : ""}" role="radio" aria-checked="${i === n}" aria-label="${i} yulduz">★</button>`).join("")}
          <span class="stars-n">${n || "—"} / 5</span></div>`;
        break;
      }
      case "icon":
        ctl = `<div class="icon-sel"><button type="button" class="icon-cur" id="${iid}" data-act="icon-open" aria-haspopup="true" aria-expanded="false">
          <span class="ip">${v ? ico(v) : ""}</span><span class="in">${esc(iconName(v))}</span>${ico("a-down", "chev")}</button><div class="icon-pop" hidden></div></div>`;
        break;
      case "tags": {
        const arr = Array.isArray(v) ? v : [];
        ctl = `<div class="tags" data-act="tags-focus">${arr.map((t, i) =>
          `<span class="tag">${esc(t)}<button type="button" data-act="tag-del" data-ti="${i}" aria-label="«${esc(t)}» ni olib tashlash">${ico("a-x")}</button></span>`).join("")}
          <input id="${iid}" class="tag-input" type="text" autocomplete="off" placeholder="${arr.length ? "Yana qo'shish…" : "Yozing va Enter bosing…"}"></div>`;
        break;
      }
      case "image": {
        const src = resolveUrl(val);
        ctl = `<div class="img-fld"><div class="img-prev">${ico("a-image")}${src ? `<img src="${esc(src)}" alt="">` : ""}</div>
          <div class="img-ctl"><input id="${iid}" type="text" inputmode="url" spellcheck="false" value="${esc(val)}" placeholder="https://… yoki assets/uploads/…">
          <div class="img-btns"><button type="button" class="btn btn-outline btn-sm" data-act="img-upload">${ico("a-upload")}<span>Yuklash</span></button>
          ${val ? `<button type="button" class="btn btn-ghost btn-sm" data-act="img-clear">Tozalash</button>` : ""}
          <input type="file" accept="image/*" data-img-file hidden></div>
          <div class="fld-hint">JPG, PNG, WEBP yoki GIF. Katta rasm avtomatik 1600 px gacha kichraytiriladi.</div></div></div>`;
        break;
      }
      default: {
        const dl = f.list ? `<datalist id="dl-${id}">${f.list.map((o) => `<option value="${esc(o)}">`).join("")}</datalist>` : "";
        ctl = `<input id="${iid}" type="text" value="${esc(val)}"${ph}${f.list ? ` list="dl-${id}"` : ""}${f.rtl ? ' dir="rtl" class="rtl"' : ""}>${dl}`;
      }
    }
    return `<div class="fld fld-${f.t} w-${w}" data-fid="${id}">${lbl}${ctl}
      ${f.preview ? `<div class="fld-prev" data-prev>${esc(f.preview(v))}</div>` : ""}${hint}</div>`;
  }

  const matchItem = (it, q) => Object.values(it || {}).map((x) => (Array.isArray(x) ? x.join(" ") : x)).join(" ").toLowerCase().includes(q.toLowerCase());

  function listHTML(f, path, id, v) {
    const arr = Array.isArray(v) ? v : [];
    const q = S.filters[JSON.stringify(path)] || "";
    const hid = f.hide ? arr.filter((x) => x && x.hidden).length : 0;
    const items = arr.map((it, i) => (f.compact ? rowHTML(f, path, id, it, i, arr.length) : itemHTML(f, path, id, it, i, arr.length, q))).join("");
    const none = q && !arr.some((it) => matchItem(it, q));
    return `<div class="fld fld-list w-full${f.compact ? " compact" : ""}" data-fid="${id}">
      <div class="list-tb">${!f.nolabel ? `<span class="fld-l">${esc(f.l)}</span>` : ""}
        <span class="list-count">${arr.length} ta${hid ? ` · ${hid} ta yashirin` : ""}</span>
        ${f.search && arr.length > 3 ? `<label class="search">${ico("a-search")}<input type="search" data-filter value="${esc(q)}" placeholder="Ro'yxatdan qidirish…" aria-label="Ro'yxatdan qidirish"></label>` : ""}
      </div>
      <div class="list-items">${items}<div class="list-none"${none ? "" : " hidden"}>Hech narsa topilmadi</div>
        ${arr.length ? "" : `<div class="list-empty">Hozircha bo'sh. Quyidagi tugma orqali qo'shing.</div>`}</div>
      <button type="button" class="btn-add" data-act="add">${ico("a-plus")}${esc(f.add || "Qo'shish")}</button>
      ${f.hint ? `<div class="fld-hint">${esc(f.hint)}</div>` : ""}</div>`;
  }

  const actBtn = (act, icon, title, dis, cls) =>
    `<button type="button" class="icon-btn${cls ? " " + cls : ""}" data-act="${act}" title="${esc(title)}" aria-label="${esc(title)}"${dis ? " disabled" : ""}>${ico(icon)}</button>`;

  function itemHTML(f, path, lid, it, i, n, q) {
    it = it || {};
    const open = openItems.has(it), hid = f.hide && it.hidden;
    return `<div class="item${open ? " open" : ""}${hid ? " is-hidden" : ""}" data-lf="${lid}" data-i="${i}"${q && !matchItem(it, q) ? " hidden" : ""}>
      <div class="it-head"><div class="it-sum">${itemSumHTML(f, it, i)}</div>
        <div class="it-act">${actBtn("up", "a-up", "Yuqoriga", i === 0)}${actBtn("down", "a-down", "Pastga", i === n - 1)}${actBtn("dup", "a-copy", "Nusxa olish")}
          ${f.hide ? actBtn("hide", hid ? "a-eye-off" : "a-eye", hid ? "Saytda ko'rsatish" : "Saytda yashirish", false, hid ? "on" : "") : ""}${actBtn("del", "a-trash", "O'chirish", false, "danger")}</div>
      </div>
      ${open ? `<div class="it-body"><div class="fgrid">${f.fields.map((sf) => fieldHTML(sf, path.concat(i, sf.k))).join("")}</div></div>` : ""}
    </div>`;
  }

  function itemSumHTML(f, it, i) {
    const s = f.sum ? f.sum(it) : {};
    let th;
    if (s.img !== undefined) th = `<span class="it-thumb">${ico("a-image")}${s.img ? `<img src="${esc(resolveUrl(s.img))}" alt="" loading="lazy">` : ""}</span>`;
    else if (s.icon) th = `<span class="it-thumb ic-th">${ico(s.icon)}</span>`;
    else if (s.av !== undefined) th = `<span class="it-thumb av">${esc(s.av)}</span>`;
    else th = `<span class="it-thumb num">${i + 1}</span>`;
    return `<button type="button" class="it-toggle" data-act="toggle" aria-expanded="${openItems.has(it)}">${ico("a-down", "chev")}${th}
      <span class="it-txt"><b>${esc(s.title || "Nomsiz element")}</b>${s.sub ? `<small>${esc(s.sub)}</small>` : ""}</span>
      ${f.hide && it.hidden ? `<span class="pill pill-muted">Yashirin</span>` : ""}</button>`;
  }

  function rowHTML(f, path, lid, it, i, n) {
    return `<div class="crow" data-lf="${lid}" data-i="${i}"><span class="crow-n">${i + 1}</span>
      <div class="fgrid">${f.fields.map((sf) => fieldHTML(sf, path.concat(i, sf.k))).join("")}</div>
      <div class="crow-act">${actBtn("up", "a-up", "Yuqoriga", i === 0)}${actBtn("down", "a-down", "Pastga", i === n - 1)}${actBtn("del", "a-trash", "O'chirish", false, "danger")}</div>
    </div>`;
  }

  // bitta maydonni (yoki ro'yxatni) joyida qayta chizish
  function rerenderField(fid) {
    const r = REG.get(fid), el = $(`[data-fid="${fid}"]`);
    if (!r || !el) return null;
    const tmp = document.createElement("div");
    tmp.innerHTML = fieldHTML(r.def, r.path);
    const nel = tmp.firstElementChild;
    el.replaceWith(nel);
    return nel;
  }
  function updateItemHead(w) {
    const item = w && w.closest(".item[data-lf]");
    if (!item) return;
    const r = REG.get(item.dataset.lf), i = +item.dataset.i;
    const it = r && (getAt(S.site, r.path) || [])[i];
    const sum = item.querySelector(":scope > .it-head > .it-sum");
    if (it && sum) sum.innerHTML = itemSumHTML(r.def, it, i);
  }
  function clearErr(w) {
    w.classList.remove("has-error");
    const x = w.querySelector(":scope > .fld-err");
    if (x) x.remove();
  }
  function setImgPrev(w, v) {
    const box = w.querySelector(".img-prev");
    if (!box) return;
    box.classList.remove("bad");
    const src = resolveUrl(v);
    let img = box.querySelector("img");
    if (!src) { if (img) img.remove(); return; }
    if (!img) { img = document.createElement("img"); img.alt = ""; box.appendChild(img); }
    img.classList.remove("bad");
    img.src = src;
  }

  /* ---------- o'zgarishlarni kuzatish ---------- */
  const isDirty = () => !!S.site && JSON.stringify(S.site) !== S.saved;
  function markSaved(snap) { S.saved = snap; S.savedObj = JSON.parse(snap); }
  function updateDirty() {
    const d = isDirty(), el = $("#dirty"), btn = $("#save-btn");
    if (!el || !btn) return;
    el.classList.toggle("on", d);
    const txt = d ? "Saqlanmagan o'zgarishlar bor" : "Barcha o'zgarishlar saqlangan";
    el.querySelector("span").textContent = txt;
    el.title = txt;
    btn.disabled = !d || S.saving;
    btn.classList.toggle("ready", d && !S.saving);
    btn.querySelector("span").textContent = S.saving ? "Saqlanmoqda…" : "Saqlash";
    // menyuda o'zgargan sahifalarni belgilash
    PAGES.forEach((p) => {
      const a = $(`.sb-nav a[data-page="${p.id}"]`);
      if (!a) return;
      const ch = d && (p.cards || []).some((c) => c.fields.some((f) => {
        const path = c.base.concat(f.k);
        return JSON.stringify(getAt(S.site, path)) !== JSON.stringify(getAt(S.savedObj, path));
      }));
      a.classList.toggle("changed", !!ch);
    });
  }
  const changed = () => updateDirty();

  /* ---------- tekshiruv (validatsiya) ---------- */
  function checkField(f, v) {
    const empty = v == null || (typeof v === "string" && !v.trim()) || (f.t === "number" && !isNum(v));
    if (empty) return f.req ? `«${f.l}» to'ldirilmagan` : null;
    if (f.t === "number") {
      if (f.min != null && v < f.min) return `«${f.l}» kamida ${f.min} bo'lishi kerak`;
      if (f.max != null && v > f.max) return `«${f.l}» ${f.max} dan oshmasligi kerak`;
    }
    if (f.t === "url" && !/^https?:\/\/\S+$/i.test(String(v).trim())) return `«${f.l}» to'liq havola bo'lishi kerak (https:// bilan boshlanadi)`;
    if (f.t === "image" && /^\s*(javascript|vbscript|data):/i.test(v)) return `«${f.l}»: rasm manzili noto'g'ri`;
    return f.check ? f.check(v) : null;
  }
  function walkValidate(fields, base, page, trail) {
    for (const f of fields) {
      const path = base.concat(f.k), v = getAt(S.site, path);
      if (f.t === "group") { const e = walkValidate(f.fields, path, page, trail); if (e) return e; continue; }
      if (f.t === "list") {
        const arr = Array.isArray(v) ? v : [];
        for (let i = 0; i < arr.length; i++) {
          const e = walkValidate(f.fields, path.concat(i), page, trail.concat({ f, i, it: arr[i], lp: path }));
          if (e) return e;
        }
        continue;
      }
      const msg = checkField(f, v);
      if (msg) {
        const crumbs = [page.title].concat(trail.map((t) => (t.f.main ? "" : t.f.l + " → ") + (t.i + 1) + "-element"));
        return { page, path, trail, short: msg, full: crumbs.join(" → ") + (trail.length ? ": " : " → ") + msg };
      }
    }
    return null;
  }
  function validate() {
    for (const p of PAGES) for (const c of p.cards || []) {
      const e = walkValidate(c.fields, c.base, p, []);
      if (e) return e;
    }
    return null;
  }
  function showValidationError(err) {
    err.trail.forEach((t) => { if (!t.f.compact && t.it) openItems.add(t.it); delete S.filters[JSON.stringify(t.lp)]; });
    go(err.page.id, { path: err.path, msg: err.short });
    toast(err.full, "err");
  }
  function highlightPath(path, msg) {
    const pk = JSON.stringify(path);
    let el = null;
    REG.forEach((r, id) => { if (JSON.stringify(r.path) === pk) el = $(`[data-fid="${id}"]`) || el; });
    if (!el) return;
    clearErr(el);
    if (msg) { el.classList.add("has-error"); el.insertAdjacentHTML("beforeend", `<div class="fld-err" role="alert">${esc(msg)}</div>`); }
    else { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const inp = el.querySelector("input:not([type=file]):not([type=search]), textarea, select, button");
    if (inp) inp.focus({ preventScroll: true });
  }

  /* ---------- saqlash ---------- */
  async function loadSite() {
    const r = await api("GET", "/api/site");
    if (!r.data || typeof r.data !== "object" || Array.isArray(r.data)) throw new ApiError("Sayt ma'lumotlari noto'g'ri formatda", 0);
    S.site = r.data; S.rev = r.rev; markSaved(JSON.stringify(r.data));
    openItems = new WeakSet(); S.filters = {};
    updateDirty();
  }
  async function save() {
    if (!S.site || S.saving) return false;
    if (!isDirty()) return true;
    closeIconPop();
    const ae = document.activeElement;
    if (ae && ae.classList.contains("tag-input") && ae.value.trim()) addTags(ae, false);
    const err = validate();
    if (err) { showValidationError(err); return false; }
    const snap = JSON.stringify(S.site);
    S.saving = true; updateDirty();
    try {
      const r = await api("PUT", "/api/site", { data: JSON.parse(snap), rev: S.rev });
      if (r.rev != null) S.rev = r.rev;
      markSaved(snap);
      toast("Saqlandi — saytda yangilandi", "ok");
      return true;
    } catch (e) {
      if (e.status === 409) conflictDialog(); else fail(e);
      return false;
    } finally { S.saving = false; updateDirty(); }
  }
  async function conflictDialog() {
    const v = await dialog({
      title: "Ma'lumotlar boshqa joyda o'zgargan", danger: true,
      html: `<p>Siz tahrirlashni boshlaganingizdan keyin sayt ma'lumotlari boshqa oynada yoki qurilmada o'zgartirilgan (yoki sharh tasdiqlangan, zaxira tiklangan). Saqlansa, o'sha o'zgarishlar yo'qolib ketardi.</p>
        <p><b>Qayta yuklash</b> eng so'nggi ma'lumotlarni ochadi — sizning saqlanmagan o'zgarishlaringiz o'chadi. Kerak bo'lsa, avval ularni JSON faylga yuklab oling.</p>`,
      buttons: [{ label: "Bekor qilish", value: null }, { label: "JSON yuklab olish", value: "export" }, { label: "Qayta yuklash", cls: "btn-danger", value: "reload" }],
    });
    if (v === "export") { exportJson(); return conflictDialog(); }
    if (v === "reload") {
      try { await loadSite(); rerenderCurrent(); toast("Eng so'nggi ma'lumotlar yuklandi", "ok"); } catch (e) { fail(e); }
    }
  }

  /* ---------- rasm yuklash ---------- */
  const readDataURL = (file) => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(new Error("Faylni o'qib bo'lmadi"));
    fr.readAsDataURL(file);
  });
  const dataBytes = (d) => Math.floor(((d.length - d.indexOf(",") - 1) * 3) / 4);
  async function prepareImage(file) {
    const type = (file.type || "").toLowerCase();
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(type)) throw new Error("Faqat JPG, PNG, WEBP yoki GIF rasm yuklash mumkin");
    if (type === "image/gif") {
      if (file.size > 5 * 1048576) throw new Error("GIF fayl juda katta — 5 MB dan oshmasligi kerak");
      return readDataURL(file);
    }
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => rej(new Error("Rasmni ochib bo'lmadi — fayl buzilgan bo'lishi mumkin"));
        im.src = url;
      });
      const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
      const cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      const ctx = cv.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      let alpha = false;
      if (type !== "image/jpeg" && type !== "image/jpg") {
        const d = ctx.getImageData(0, 0, w, h).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] < 255) { alpha = true; break; }
      }
      let out;
      if (alpha) out = cv.toDataURL("image/png");
      else {
        ctx.globalCompositeOperation = "destination-over";
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
        out = cv.toDataURL("image/jpeg", 0.85);
      }
      if (dataBytes(out) > 5 * 1048576) throw new Error("Rasm juda katta — 5 MB dan oshmasligi kerak");
      return out;
    } finally { URL.revokeObjectURL(url); }
  }
  async function uploadImage(file, w) {
    const r = w && REG.get(w.dataset.fid);
    if (!r) return;
    const btn = w.querySelector("[data-act=img-upload]");
    btn.disabled = true; btn.classList.add("busy"); btn.querySelector("span").textContent = "Yuklanmoqda…";
    try {
      const data = await prepareImage(file);
      const res = await api("POST", "/api/upload", { name: file.name, data });
      if (!res.url) throw new Error("Server rasm manzilini qaytarmadi");
      setAt(S.site, r.path, res.url);
      const nel = rerenderField(w.dataset.fid);
      updateItemHead(nel); changed();
      toast("Rasm yuklandi. O'zgarishni saytga chiqarish uchun «Saqlash» ni bosing", "ok");
    } catch (e) {
      fail(e);
      if (btn.isConnected) { btn.disabled = false; btn.classList.remove("busy"); btn.querySelector("span").textContent = "Yuklash"; }
    }
  }

  /* ---------- teg (chip) va ikonka tanlagich ---------- */
  function addTags(input, refocus) {
    const w = input.closest(".fld[data-fid]"), r = w && REG.get(w.dataset.fid);
    if (!r) return;
    const parts = input.value.split(",").map((s) => s.trim()).filter(Boolean);
    input.value = "";
    if (!parts.length) return;
    let arr = getAt(S.site, r.path);
    if (!Array.isArray(arr)) { arr = []; setAt(S.site, r.path, arr); }
    parts.forEach((p) => { if (!arr.includes(p)) arr.push(p); });
    const nel = rerenderField(w.dataset.fid);
    updateItemHead(nel); changed();
    if (refocus && nel) nel.querySelector(".tag-input").focus();
  }
  function toggleIconPop(btn) {
    const pop = btn.parentElement.querySelector(".icon-pop");
    const was = !pop.hidden;
    closeIconPop();
    if (was) return;
    const w = btn.closest(".fld[data-fid]"), cur = getAt(S.site, REG.get(w.dataset.fid).path);
    const list = (S.icons || ICON_IDS).slice();
    if (cur && !list.includes(cur)) list.unshift(cur);
    pop.innerHTML = list.map((id) => `<button type="button" data-act="icon-set" data-v="${esc(id)}" class="${id === cur ? "on" : ""}" title="${esc(id)}">${ico(id)}<span>${esc(iconName(id))}</span></button>`).join("");
    pop.hidden = false; pop.style.left = "";
    btn.setAttribute("aria-expanded", "true");
    openPop = pop;
    const rc = pop.getBoundingClientRect();
    if (rc.right > window.innerWidth - 8) pop.style.left = Math.round(window.innerWidth - 8 - rc.right) + "px";
    (pop.querySelector(".on") || pop.querySelector("button")).focus();
  }
  function closeIconPop() {
    if (!openPop) return false;
    openPop.hidden = true;
    const b = openPop.parentElement && openPop.parentElement.querySelector(".icon-cur");
    if (b) b.setAttribute("aria-expanded", "false");
    openPop = null;
    return true;
  }
  function setFieldVal(el, v) {
    const w = el.closest(".fld[data-fid]"), r = w && REG.get(w.dataset.fid);
    if (!r) return null;
    setAt(S.site, r.path, v);
    const nel = rerenderField(w.dataset.fid);
    updateItemHead(nel); changed();
    return nel;
  }

  /* ---------- ro'yxat amallari ---------- */
  function dupItem(f, it) {
    const c = clone(it);
    if (f.k === "umrah" && c.code) c.code = uniqueCode(c.code);
    if (typeof c.title === "string" && c.title) c.title += " (nusxa)";
    else if (typeof c.name === "string" && c.name) c.name += " (nusxa)";
    return c;
  }
  async function itemAction(btn, act) {
    const host = btn.closest("[data-lf]"), lf = host.dataset.lf, i = +host.dataset.i;
    const r = REG.get(lf), arr = r && getAt(S.site, r.path);
    if (!Array.isArray(arr) || !arr[i]) return;
    const f = r.def, it = arr[i];
    let fi = null, fa = act;
    if (act === "toggle") { if (openItems.has(it)) openItems.delete(it); else openItems.add(it); fi = i; }
    else if (act === "up" && i > 0) { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); fi = i - 1; }
    else if (act === "down" && i < arr.length - 1) { arr.splice(i + 1, 0, arr.splice(i, 1)[0]); fi = i + 1; }
    else if (act === "dup") { const c = dupItem(f, it); arr.splice(i + 1, 0, c); openItems.add(c); fi = i + 1; fa = "toggle"; }
    else if (act === "hide") { it.hidden = !it.hidden; fi = i; }
    else if (act === "del") {
      const name = f.sum ? f.sum(it).title : "";
      const filled = f.fields.some((sf) => sf.t !== "icon" && String(it[sf.k] == null ? "" : it[sf.k]).trim());
      if (filled && !(await confirmDlg("O'chirishni tasdiqlang", name ? `«${name}» o'chirilsinmi? O'zgarish «Saqlash» bosilgandan keyin saytda aks etadi.` : "Ushbu element o'chirilsinmi?", "O'chirish", true))) return;
      if (arr[i] !== it) return;
      arr.splice(i, 1);
    }
    const nel = rerenderField(lf);
    if (act !== "toggle") changed();
    if (nel && fi != null) {
      const b = nel.querySelector(`:scope > .list-items > [data-i="${fi}"] [data-act="${fa}"]`);
      if (b && !b.disabled) b.focus();
      if (act === "dup") { const row = nel.querySelector(`:scope > .list-items > [data-i="${fi}"]`); if (row) row.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
    }
  }
  function addItem(btn) {
    const w = btn.closest(".fld[data-fid]"), r = w && REG.get(w.dataset.fid);
    if (!r) return;
    const f = r.def;
    let arr = getAt(S.site, r.path);
    if (!Array.isArray(arr)) { arr = []; setAt(S.site, r.path, arr); }
    const it = f.def ? f.def(arr) : {}, idx = f.addTop ? 0 : arr.length;
    arr.splice(idx, 0, it);
    if (!f.compact) openItems.add(it);
    delete S.filters[JSON.stringify(r.path)];
    const nel = rerenderField(w.dataset.fid);
    changed();
    const row = nel && nel.querySelector(`:scope > .list-items > [data-i="${idx}"]`);
    if (row) {
      row.scrollIntoView({ block: "center", behavior: "smooth" });
      const inp = row.querySelector("input:not([type=file]):not([type=checkbox]), textarea");
      if (inp) inp.focus({ preventScroll: true });
    }
  }
  function applyFilter(el) {
    const w = el.closest(".fld[data-fid]"), r = w && REG.get(w.dataset.fid);
    if (!r) return;
    const q = el.value.trim(), arr = getAt(S.site, r.path) || [];
    S.filters[JSON.stringify(r.path)] = q;
    let shown = 0;
    $$(":scope > .list-items > .item", w).forEach((it) => { const ok = !q || matchItem(arr[+it.dataset.i], q); it.hidden = !ok; if (ok) shown++; });
    const none = w.querySelector(":scope > .list-items > .list-none");
    if (none) none.hidden = !(q && !shown);
  }

  /* ---------- hodisalar ---------- */
  function fieldInput(el) {
    const w = el.closest(".fld[data-fid]"), r = w && REG.get(w.dataset.fid);
    if (!r) return;
    const f = r.def;
    if (["list", "group", "tags", "stars", "icon"].includes(f.t)) return;
    let v;
    if (f.t === "bool") v = el.checked;
    else if (f.t === "number") {
      const s = el.value.trim();
      v = s === "" ? "" : Number(s);
      if (!isNum(v)) v = f.req ? "" : 0;
    } else v = el.value;
    setAt(S.site, r.path, v);
    clearErr(w);
    if (f.t === "image") { clearTimeout(w._pt); w._pt = setTimeout(() => setImgPrev(w, v), 350); }
    if (f.preview) { const p = w.querySelector("[data-prev]"); if (p) p.textContent = f.preview(v); }
    updateItemHead(w);
    changed();
  }
  function onInput(e) {
    const el = e.target;
    if (!(el instanceof Element)) return;
    if (el.id === "req-search") { S.reqSearch = el.value; renderReqList(true); return; }
    if (el.matches("[data-filter]")) { applyFilter(el); return; }
    if (el.classList.contains("tag-input")) { if (el.value.includes(",")) addTags(el, true); return; }
    if (el.type === "file") return;
    fieldInput(el);
  }
  function onChange(e) {
    const el = e.target;
    if (!(el instanceof Element)) return;
    if (el.matches("[data-img-file]")) {
      const file = el.files && el.files[0];
      const w = el.closest(".fld[data-fid]");
      el.value = "";
      if (file) uploadImage(file, w);
      return;
    }
    if (el.id === "json-file") { const file = el.files && el.files[0]; el.value = ""; if (file) importJson(file); return; }
    if (el.matches("select[data-req]")) { changeReqStatus(el); return; }
    if (el.matches("textarea[data-req]")) { changeReqComment(el); return; }
    if (el.type === "checkbox" || el.tagName === "SELECT") fieldInput(el);
  }
  function onKeydown(e) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "s" || e.key === "S" || e.code === "KeyS")) {
      if (S.authed && S.site && $("#save-btn")) { e.preventDefault(); save(); }
      return;
    }
    if (e.key === "Escape") { if (!closeIconPop()) closeDrawer(); return; }
    const el = e.target;
    if (el.classList && el.classList.contains("tag-input")) {
      if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTags(el, true); }
      else if (e.key === "Backspace" && !el.value) {
        const w = el.closest(".fld[data-fid]"), r = REG.get(w.dataset.fid), arr = getAt(S.site, r.path);
        if (Array.isArray(arr) && arr.length) {
          arr.pop();
          const nel = rerenderField(w.dataset.fid);
          updateItemHead(nel); changed();
          if (nel) nel.querySelector(".tag-input").focus();
        }
      }
    }
  }
  function onFocusOut(e) {
    const el = e.target;
    if (el.classList && el.classList.contains("tag-input") && el.value.trim() && el.isConnected) {
      // fokus o'sha maydon ichida qolsa (masalan × tugmasi), hozircha qo'shmaymiz
      const w = el.closest(".fld");
      if (e.relatedTarget && w && w.contains(e.relatedTarget)) return;
      addTags(el, false);
    }
  }
  function onImgError(e) {
    const img = e.target;
    if (!img || img.tagName !== "IMG" || !img.closest("#app")) return;
    img.classList.add("bad");
    if (img.parentElement) img.parentElement.classList.add("bad");
  }
  function onSubmit(e) {
    const f = e.target;
    if (f.id === "login-form") { e.preventDefault(); doLogin(); }
    else if (f.id === "pw-form") { e.preventDefault(); changePassword(f); }
  }
  function onClick(e) {
    if (openPop && !e.target.closest(".icon-sel")) closeIconPop();
    const a = e.target.closest("[data-act], [data-reqf], [data-focus], .sb-nav a");
    if (!a) return;
    if (a.dataset.reqf) { S.reqFilter = a.dataset.reqf; S.reqSearch = ""; }
    if (a.dataset.focus) { e.preventDefault(); go(a.dataset.go, { path: JSON.parse(a.dataset.focus) }); return; }
    const act = a.dataset.act;
    if (!act || a.disabled) { if (a.closest(".sb-nav")) closeDrawer(); return; }
    switch (act) {
      case "toggle": case "up": case "down": case "dup": case "hide": case "del": itemAction(a, act); break;
      case "add": addItem(a); break;
      case "tag-del": {
        const w = a.closest(".fld[data-fid]"), r = REG.get(w.dataset.fid), arr = getAt(S.site, r.path);
        if (!Array.isArray(arr)) break;
        arr.splice(+a.dataset.ti, 1);
        const nel = rerenderField(w.dataset.fid);
        updateItemHead(nel); changed();
        if (nel) nel.querySelector(".tag-input").focus();
        break;
      }
      case "tags-focus": if (e.target === a) { const inp = a.querySelector(".tag-input"); if (inp) inp.focus(); } break;
      case "star": { const v = +a.dataset.v, nel = setFieldVal(a, v); if (nel) { const b = nel.querySelector(`[data-act=star][data-v="${v}"]`); if (b) b.focus(); } break; }
      case "icon-open": toggleIconPop(a); break;
      case "icon-set": { const nel = setFieldVal(a, a.dataset.v); openPop = null; if (nel) nel.querySelector(".icon-cur").focus(); break; }
      case "img-upload": { const inp = a.closest(".fld").querySelector("[data-img-file]"); if (inp) inp.click(); break; }
      case "img-clear": setFieldVal(a, ""); break;
      case "drawer-open": { const sh = $(".shell"); if (sh) sh.classList.add("drawer"); break; }
      case "drawer-close": closeDrawer(); break;
      case "logout": doLogout(); break;
      case "save": save(); break;
      case "retry": boot(); break;
      case "pw-toggle": {
        const inp = a.parentElement.querySelector("input"), show = inp.type === "password";
        inp.type = show ? "text" : "password";
        a.innerHTML = ico(show ? "a-eye-off" : "a-eye");
        a.setAttribute("aria-label", show ? "Parolni yashirish" : "Parolni ko'rsatish");
        break;
      }
      case "req-tab": S.reqFilter = a.dataset.f; renderReqList(); break;
      case "req-refresh": busy(a, () => refreshRequests(false)).then((ok) => { if (ok) { renderReqList(); toast("Ro'yxat yangilandi", "ok"); } }); break;
      case "req-csv": exportCsv(); break;
      case "req-del": deleteReq(a.closest("[data-rid]").dataset.rid); break;
      case "rev-approve": busy(a, () => approveReview(a.closest("[data-rvid]").dataset.rvid)); break;
      case "rev-del": deleteReview(a.closest("[data-rvid]").dataset.rvid); break;
      case "rev-refresh": busy(a, () => refreshReviews(false)).then((ok) => { if (ok) { rerenderPending(); toast("Yangilandi", "ok"); } }); break;
      case "tg-save": busy(a, () => saveTelegram(false)); break;
      case "tg-test": busy(a, testTelegram); break;
      case "bk-refresh": busy(a, loadBackups); break;
      case "bk-restore": restoreBackup(a.dataset.name); break;
      case "json-export": exportJson(); toast("JSON fayl yuklab olindi", "ok"); break;
      case "json-import": { const inp = $("#json-file"); if (inp) inp.click(); break; }
      case "copy": copyText(a.dataset.v); break;
    }
  }
  function copyText(t) {
    const ok = () => toast(`Nusxalandi: ${t}`, "ok");
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(ok, () => toast(t));
    else toast(t);
  }

  /* ---------- sahifa va menyu ---------- */
  function closeDrawer() { const sh = $(".shell"); if (sh) sh.classList.remove("drawer"); }
  function go(id, focus) {
    const h = "#/" + id;
    if (location.hash !== h) { pendingFocus = focus || null; location.hash = h; }
    else renderPage(pageById(id), focus);
  }
  function route(focus) {
    const m = /^#\/([\w-]+)/.exec(location.hash);
    renderPage(pageById(m ? m[1] : "dashboard"), focus);
  }
  function renderPage(page, focus, keep) {
    const content = $("#content");
    if (!content || !S.site) return;
    S.page = page.id; REG.clear(); openPop = null;
    $("#tb-title").textContent = page.title;
    $$(".sb-nav a").forEach((a) => {
      const on = a.dataset.page === page.id;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    const body = (page.pre ? page.pre() : "") + (page.cards || []).map(cardHTML).join("") + (page.post ? page.post() : "");
    content.innerHTML = `<div class="page page-${page.id}">${page.desc ? `<p class="page-desc">${esc(page.desc)}</p>` : ""}${body}</div>`;
    if (page.after) page.after();
    if (!keep) window.scrollTo(0, 0);
    if (focus && focus.path) highlightPath(focus.path, focus.msg);
    closeDrawer();
    updateDirty();
  }
  function rerenderCurrent() {
    const y = window.scrollY;
    renderPage(pageById(S.page), null, true);
    window.scrollTo(0, y);
  }

  function renderShell() {
    const groups = [];
    PAGES.forEach((p) => {
      let g = groups.find((x) => x.name === p.group);
      if (!g) groups.push((g = { name: p.group, items: [] }));
      g.items.push(p);
    });
    $("#app").innerHTML = `
    <div class="shell">
      <aside class="sb" id="sb" aria-label="Admin menyusi">
        <div class="sb-brand">
          <img src="../assets/logo.svg" alt="">
          <div><b>Umra<span>goo</span></b><small>Admin panel</small></div>
          <button type="button" class="icon-btn sb-close" data-act="drawer-close" aria-label="Menyuni yopish">${ico("a-x")}</button>
        </div>
        <nav class="sb-nav">${groups.map((g) => `<div class="sb-group"><div class="sb-gt">${esc(g.name)}</div>
          ${g.items.map((p) => `<a href="#/${p.id}" data-page="${p.id}">${ico(p.icon)}<span>${esc(p.title)}</span>${p.badge ? `<em class="nav-badge" data-badge="${p.badge}" hidden></em>` : ""}<i class="nav-dot" title="Saqlanmagan o'zgarishlar"></i></a>`).join("")}</div>`).join("")}
        </nav>
        <div class="sb-foot">
          <a href="/" target="_blank" rel="noopener">${ico("a-external")}<span>Saytni ko'rish</span></a>
          <button type="button" data-act="logout">${ico("a-logout")}<span>Chiqish</span></button>
        </div>
      </aside>
      <div class="sb-backdrop" data-act="drawer-close"></div>
      <div class="main">
        <header class="tb">
          <button type="button" class="icon-btn burger" data-act="drawer-open" aria-label="Menyuni ochish">${ico("a-menu")}</button>
          <h1 class="tb-title" id="tb-title"></h1>
          <div class="tb-actions">
            <span class="dirty" id="dirty" role="status"><i aria-hidden="true"></i><span></span></span>
            <a class="btn btn-ghost btn-sm hide-m" href="/" target="_blank" rel="noopener">${ico("a-external")}<span>Saytni ko'rish</span></a>
            <button type="button" class="btn btn-primary" id="save-btn" data-act="save" disabled title="Saqlash (Ctrl+S)">${ico("a-save")}<span>Saqlash</span></button>
            <button type="button" class="btn btn-ghost btn-sm hide-m" data-act="logout">${ico("a-logout")}<span>Chiqish</span></button>
          </div>
        </header>
        <main class="content" id="content" tabindex="-1"></main>
      </div>
    </div>`;
  }
  function updateBadges() {
    const n = S.requests.filter((r) => r.status === "new").length;
    const set = (k, v) => $$(`[data-badge="${k}"]`).forEach((b) => { b.textContent = v; b.hidden = !v; });
    set("requests", n);
    set("reviews", S.reviews.length);
    document.title = (n ? `(${n}) ` : "") + "Umragoo — Admin panel";
  }

  /* ---------- boshqaruv paneli ---------- */
  function getWarnings() {
    const d = S.site, t = todayStr(), w = [];
    const p = d.promo || {}, dt = d.dates || {};
    if (p.enabled && p.end && p.end < t) w.push({ msg: `Aksiya yoqilgan, lekin muddati ${fmtDate(p.end)} da tugagan`, fix: "Yangi tugash sanasini kiriting yoki aksiyani o'chiring", page: "promo", path: ["promo", "end"] });
    if (dt.ramadan && dt.ramadan < t) w.push({ msg: `Ramazon sanasi (${fmtDate(dt.ramadan)}) o'tib ketgan`, fix: "Keyingi Ramazon boshlanish sanasini kiriting", page: "promo", path: ["dates", "ramadan"] });
    if (!String((d.contacts || {}).phone || "").trim()) w.push({ msg: "Telefon raqami kiritilmagan", fix: "Mijozlar siz bilan bog'lana olishi uchun telefon raqamini kiriting", page: "contacts", path: ["contacts", "phone"] });
    if (!(d.umrah || []).some((x) => x && !x.hidden)) w.push({ msg: "Saytda birorta ham umra paketi ko'rinmayapti", fix: "Paket qo'shing yoki yashirin paketni ko'rsating", page: "umrah", path: ["umrah"] });
    return w;
  }
  function pgDashboard() {
    const c = reqCounts(), d = S.site, now = new Date();
    const offers = ["umrah", "hotels", "visas", "flights"].reduce((n, k) => n + (Array.isArray(d[k]) ? d[k].filter((x) => x && !x.hidden).length : 0), 0);
    const tile = (l, v, icon, href, sub, accent, f) => `<a class="tile${accent ? " accent" : ""}" href="${href}"${f ? ` data-reqf="${f}"` : ""}>
      <span class="ti">${ico(icon)}</span><span class="tt"><b>${fmtNum(v)}</b><span>${esc(l)}</span>${sub ? `<small>${esc(sub)}</small>` : ""}</span></a>`;
    const warns = getWarnings(), latest = S.requests.slice(0, 5);
    return `
    <div class="hello"><div><h2>Assalomu alaykum!</h2><p>Bugun ${now.getDate()}-${MONTHS[now.getMonth()]}, ${WEEKDAYS[now.getDay()]}. Saytning umumiy holati shu yerda.</p></div></div>
    <div class="tiles">
      ${tile("Yangi so'rovlar", c.new, "i-send", "#/requests", c.new ? "Javob kutmoqda" : "Hammasi ko'rib chiqilgan", c.new > 0, "new")}
      ${tile("Jami so'rovlar", c.all, "i-clipboard", "#/requests", "", false, "all")}
      ${tile("Kutilayotgan sharhlar", S.reviews.length, "i-message", "#/reviews", S.reviews.length ? "Tasdiqlash kerak" : "Yangi sharh yo'q", S.reviews.length > 0)}
      ${tile("Saytdagi takliflar", offers, "i-kaaba", "#/umrah", "Umra, mehmonxona, viza, chipta")}
    </div>
    <div class="dash-grid">
      <section class="card">
        <header class="card-h"><div><h2>So'nggi so'rovlar</h2></div><a class="btn btn-ghost btn-sm" href="#/requests" data-reqf="all">Barchasi${ico("a-chev-r")}</a></header>
        ${latest.length ? `<div class="mini-list">${latest.map((r) => `<a class="mini" href="#/requests" data-reqf="all">
          <span class="mini-av">${esc(initial(r.name))}</span><span class="mini-t"><b>${esc(r.name)}</b><small>${esc(r.service || "Xizmat ko'rsatilmagan")} · ${esc(fmtDate(r.created))}</small></span>
          <span class="pill pill-${esc(r.status)}">${esc(STATUS[r.status] || r.status)}</span></a>`).join("")}</div>`
        : `<div class="empty">Hozircha so'rovlar yo'q. Saytdagi formalar orqali kelgan so'rovlar shu yerda ko'rinadi.</div>`}
      </section>
      <section class="card">
        <header class="card-h"><div><h2>Diqqat talab qiladi</h2></div></header>
        ${warns.length ? `<div class="warns">${warns.map((w) => `<a class="warn" href="#/${w.page}" data-go="${w.page}" data-focus="${esc(JSON.stringify(w.path))}">
          ${ico("a-alert")}<span><b>${esc(w.msg)}</b><small>${esc(w.fix)}</small></span>${ico("a-chev-r", "go")}</a>`).join("")}</div>`
        : `<div class="all-ok">${ico("a-check")}<span>Hammasi joyida — muammo topilmadi</span></div>`}
      </section>
    </div>`;
  }

  /* ---------- so'rovlar ---------- */
  function reqCounts() {
    const c = { all: S.requests.length, new: 0, progress: 0, done: 0, cancelled: 0 };
    S.requests.forEach((r) => { if (r.status in c) c[r.status]++; });
    return c;
  }
  function filteredRequests() {
    const q = S.reqSearch.trim().toLowerCase(), qd = q.replace(/\D/g, "");
    return S.requests.filter((r) => (S.reqFilter === "all" || r.status === S.reqFilter) && (!q
      || [r.name, r.phone, r.service, r.note, r.comment].join(" ").toLowerCase().includes(q)
      || (qd.length >= 3 && String(r.phone || "").replace(/\D/g, "").includes(qd))));
  }
  const reqTabsHTML = () => {
    const c = reqCounts();
    return [["all", "Barchasi"]].concat(Object.entries(STATUS)).map(([k, l]) =>
      `<button type="button" class="tab${S.reqFilter === k ? " on" : ""}" data-act="req-tab" data-f="${k}" role="tab" aria-selected="${S.reqFilter === k}">${esc(l)}<em>${c[k]}</em></button>`).join("");
  };
  function reqCardHTML(r) {
    const tel = String(r.phone || "").replace(/[^\d+]/g, "");
    return `<article class="req st-${esc(r.status)}" data-rid="${esc(r.id)}">
      <div class="req-head">
        <div class="req-who"><b>${esc(r.name)}</b><a class="req-phone" href="tel:${esc(tel)}">${ico("a-phone")}${esc(r.phone)}</a></div>
        <div class="req-when"><span class="pill pill-${esc(r.status)}">${esc(STATUS[r.status] || r.status)}</span><time>${esc(fmtDate(r.created))}</time></div>
      </div>
      <dl class="req-meta">
        <div><dt>Xizmat</dt><dd>${esc(r.service || "—")}</dd></div>
        <div><dt>Kishilar</dt><dd>${esc(r.people || 1)}</dd></div>
        <div><dt>Istalgan sana</dt><dd>${esc(fmtDate(r.date))}</dd></div>
      </dl>
      ${r.note ? `<p class="req-note">${esc(r.note)}</p>` : ""}
      <div class="req-admin">
        <label class="req-st"><span>Holat</span><select data-req="status">${Object.entries(STATUS).map(([k, l]) => `<option value="${k}"${r.status === k ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
        <label class="req-cm"><span>Admin izohi <small>(faqat sizga ko'rinadi)</small></span><textarea data-req="comment" rows="2" placeholder="Masalan: qo'ng'iroq qilindi, ertaga javob beradi">${esc(r.comment || "")}</textarea></label>
        ${actBtn("req-del", "a-trash", "So'rovni o'chirish", false, "danger")}
      </div>
    </article>`;
  }
  const reqListHTML = () => {
    const list = filteredRequests();
    if (list.length) return list.map(reqCardHTML).join("");
    return `<div class="empty card">${S.requests.length ? "Bu filtr bo'yicha so'rov topilmadi" : "Hozircha so'rovlar yo'q. Saytdagi «So'rov yuborish» formasi orqali kelganlari shu yerda paydo bo'ladi."}</div>`;
  };
  function pgRequests() {
    return `<section class="card req-tb">
      <div class="tabs" role="tablist" id="req-tabs">${reqTabsHTML()}</div>
      <div class="req-tools">
        <label class="search">${ico("a-search")}<input type="search" id="req-search" value="${esc(S.reqSearch)}" placeholder="Ism, telefon, xizmat yoki izoh…" aria-label="So'rovlardan qidirish"></label>
        <button type="button" class="btn btn-outline btn-sm" data-act="req-refresh">${ico("a-refresh")}<span>Yangilash</span></button>
        <button type="button" class="btn btn-outline btn-sm" data-act="req-csv">${ico("a-download")}<span>CSV yuklab olish</span></button>
      </div>
    </section>
    <div class="req-list" id="req-list">${reqListHTML()}</div>`;
  }
  function renderReqList(listOnly) {
    const t = $("#req-tabs"), l = $("#req-list");
    if (t && !listOnly) t.innerHTML = reqTabsHTML();
    if (l) l.innerHTML = reqListHTML();
  }
  async function refreshRequests(silent, fromPoll) {
    try {
      const r = await api("GET", "/api/requests");
      const items = Array.isArray(r.items) ? r.items : [];
      const old = new Set(S.requests.map((x) => String(x.id)));
      const fresh = S.reqLoaded ? items.filter((x) => !old.has(String(x.id)) && x.status === "new").length : 0;
      const diff = JSON.stringify(items) !== JSON.stringify(S.requests);
      S.requests = items; S.reqLoaded = true;
      updateBadges();
      if (fromPoll && fresh) toast(`${fresh} ta yangi so'rov keldi`, "info");
      if (fromPoll && diff) {
        const ae = document.activeElement;
        if (S.page === "requests" && !(ae && ae.closest && ae.closest("#req-list"))) renderReqList();
        if (S.page === "dashboard") rerenderCurrent();
      }
      return true;
    } catch (e) { if (!silent) fail(e); return false; }
  }
  async function patchReq(id, patch) {
    const r = await api("PATCH", `/api/requests/${encodeURIComponent(id)}`, patch);
    const i = S.requests.findIndex((x) => String(x.id) === String(id));
    if (i >= 0) S.requests[i] = r.item && typeof r.item === "object" ? r.item : Object.assign({}, S.requests[i], patch);
    updateBadges();
  }
  async function changeReqStatus(sel) {
    const id = sel.closest("[data-rid]").dataset.rid;
    sel.disabled = true;
    try { await patchReq(id, { status: sel.value }); toast(`Holat: ${STATUS[sel.value]}`, "ok"); } catch (e) { fail(e); }
    renderReqList();
  }
  async function changeReqComment(ta) {
    const id = ta.closest("[data-rid]").dataset.rid;
    try { await patchReq(id, { comment: ta.value }); toast("Izoh saqlandi", "ok"); } catch (e) { fail(e); }
  }
  async function deleteReq(id) {
    const r = S.requests.find((x) => String(x.id) === String(id));
    if (!(await confirmDlg("So'rovni o'chirish", `${r ? "«" + r.name + "» so'rovi" : "So'rov"} butunlay o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.`, "O'chirish", true))) return;
    try {
      await api("DELETE", `/api/requests/${encodeURIComponent(id)}`);
      S.requests = S.requests.filter((x) => String(x.id) !== String(id));
      updateBadges(); renderReqList();
      toast("So'rov o'chirildi", "ok");
    } catch (e) { fail(e); }
  }
  function exportCsv() {
    const rows = filteredRequests();
    if (!rows.length) { toast("Eksport uchun so'rov yo'q", "err"); return; }
    const cell = (v) => {
      let s = String(v == null ? "" : v);
      if (/^[=@\t\r]/.test(s) || /^[+-][^\d\s]/.test(s)) s = "'" + s; // Excel formulalaridan himoya
      return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = ["Sana", "Ism", "Telefon", "Xizmat", "Kishilar", "Istalgan sana", "Izoh", "Holat", "Admin izohi"];
    const lines = [head].concat(rows.map((r) => [fmtDate(r.created, ""), r.name, r.phone, r.service, r.people, fmtDate(r.date, ""), r.note, STATUS[r.status] || r.status, r.comment]));
    download("﻿" + lines.map((a) => a.map(cell).join(";")).join("\r\n"), `sorovlar-${todayStr()}.csv`, "text/csv;charset=utf-8");
    toast(`${rows.length} ta so'rov CSV faylga yuklandi`, "ok");
  }

  /* ---------- sharhlar ---------- */
  function pgPending() {
    const items = S.reviews;
    return `<section class="card pending" id="pending">
      <header class="card-h"><div><h2>Tasdiq kutayotgan sharhlar ${items.length ? `<span class="pill pill-new">${items.length}</span>` : ""}</h2>
        <p>Mijozlar saytdagi «Fikr qoldirish» formasi orqali yuborgan sharhlar. Tasdiqlangan sharh saytdagi ro'yxat boshiga qo'shiladi.</p></div>
        <button type="button" class="btn btn-outline btn-sm" data-act="rev-refresh">${ico("a-refresh")}<span>Yangilash</span></button></header>
      ${items.length ? `<div class="rev-list">${items.map((r) => `<article class="rev" data-rvid="${esc(r.id)}">
        <div class="rev-head"><span class="mini-av">${esc(initial(r.name))}</span><div class="rev-who"><b>${esc(r.name)}</b>
          <small>${esc([r.city, r.service].filter(Boolean).join(" · ") || "Umragoo mijozi")} · ${esc(fmtDate(r.created))}</small></div>
          <span class="rev-stars" aria-label="${+r.stars || 0} yulduz">${"★".repeat(Math.max(0, Math.min(5, +r.stars || 0)))}<i>${"★".repeat(5 - Math.max(0, Math.min(5, +r.stars || 0)))}</i></span></div>
        <p class="rev-text">${esc(r.text)}</p>
        <div class="rev-act"><button type="button" class="btn btn-primary btn-sm" data-act="rev-approve">${ico("a-check")}<span>Tasdiqlash</span></button>
          <button type="button" class="btn btn-danger-o btn-sm" data-act="rev-del">${ico("a-trash")}<span>O'chirish</span></button></div>
      </article>`).join("")}</div>` : `<div class="empty">Yangi sharhlar yo'q</div>`}
    </section>`;
  }
  function rerenderPending() { const el = $("#pending"); if (el) el.outerHTML = pgPending(); }
  async function refreshReviews(silent, fromPoll) {
    try {
      const r = await api("GET", "/api/reviews");
      const items = Array.isArray(r.items) ? r.items : [];
      const diff = JSON.stringify(items) !== JSON.stringify(S.reviews);
      S.reviews = items;
      updateBadges();
      if (fromPoll && diff) { if (S.page === "reviews") rerenderPending(); if (S.page === "dashboard") rerenderCurrent(); }
      return true;
    } catch (e) { if (!silent) fail(e); return false; }
  }
  async function approveReview(id) {
    if (isDirty()) {
      const ok = await dialog({
        title: "Avval saqlash kerak",
        html: "<p>Sharhni tasdiqlash saytdagi ma'lumotlarni (js/data.js) o'zgartiradi. Sizda saqlanmagan o'zgarishlar bor — avval ular saqlanadi, keyin sharh tasdiqlanadi.</p>",
        buttons: [{ label: "Bekor qilish", value: false }, { label: "Saqlash va tasdiqlash", cls: "btn-primary", value: true }],
      });
      if (!ok || !(await save())) return;
    }
    try {
      await api("POST", `/api/reviews/${encodeURIComponent(id)}/approve`, {});
      S.reviews = S.reviews.filter((x) => String(x.id) !== String(id));
      updateBadges();
      try { await loadSite(); } catch (e) { fail(e); }
      if (S.page === "reviews") rerenderCurrent();
      toast("Sharh tasdiqlandi va saytga qo'shildi", "ok");
    } catch (e) { fail(e); }
  }
  async function deleteReview(id) {
    const r = S.reviews.find((x) => String(x.id) === String(id));
    if (!(await confirmDlg("Sharhni o'chirish", `${r ? r.name + " yuborgan sharh" : "Sharh"} o'chiriladi va saytga chiqmaydi.`, "O'chirish", true))) return;
    try {
      await api("DELETE", `/api/reviews/${encodeURIComponent(id)}`);
      S.reviews = S.reviews.filter((x) => String(x.id) !== String(id));
      updateBadges(); rerenderPending();
      toast("Sharh o'chirildi", "ok");
    } catch (e) { fail(e); }
  }

  /* ---------- Rafiq: narx belgilari ---------- */
  function pgChatHelp() {
    const d = S.site;
    const prices = (k) => (Array.isArray(d[k]) ? d[k] : []).filter((x) => x && !x.hidden && isNum(x.price)).map((x) => x.price);
    const mm = (k, fn) => { const a = prices(k); return a.length ? fmtUsd(fn(...a)) : "—"; };
    const pkg = (d.umrah || []).find((x) => x && x.code && !x.hidden) || (d.umrah || []).find((x) => x && x.code);
    const code = pkg ? pkg.code : "KOD";
    const rows = [
      ["{umra_min}", "{umra_min}", "Eng arzon umra paketi narxi", mm("umrah", Math.min)],
      ["{umra_max}", "{umra_max}", "Eng qimmat umra paketi narxi", mm("umrah", Math.max)],
      ["{mehmonxona_min}", "{mehmonxona_min}", "Eng arzon mehmonxona narxi (bir kecha)", mm("hotels", Math.min)],
      ["{viza_min}", "{viza_min}", "Eng arzon viza narxi", mm("visas", Math.min)],
      ["{chipta_min}", "{chipta_min}", "Eng arzon aviachipta narxi", mm("flights", Math.min)],
      ["{narx:KOD}", `{narx:${code}}`, `Kodi ko'rsatilgan umra paketining narxi. Masalan: {narx:${code}}`, pkg && isNum(pkg.price) ? fmtUsd(pkg.price) : "—"],
    ];
    return `<section class="card help-card">
      <header class="card-h"><div><h2>${ico("a-info")}Narx belgilari</h2>
        <p>Javob matniga quyidagi belgilarni yozsangiz, sayt ularni joriy narx bilan almashtiradi. Narx mijoz tanlagan valyutada (USD yoki so'm) chiqadi, yashirin elementlar hisobga olinmaydi. Nusxalash uchun belgini bosing.</p></div></header>
      <div class="tok-list">${rows.map(([lab, val, l, v]) => `<div class="tok"><button type="button" class="tok-code" data-act="copy" data-v="${esc(val)}" title="Nusxalash">${esc(lab)}</button>
        <span>${esc(l)}</span><b title="Hozirgi qiymat">${esc(v)}</b></div>`).join("")}</div>
    </section>`;
  }

  /* ---------- sozlamalar: Telegram, parol, zaxira, JSON ---------- */
  function pgSettingsExtra() {
    return `
    <section class="card" id="tg-card">
      <header class="card-h"><div><h2>Telegram bildirishnomalari</h2><p>Saytga yangi so'rov yoki sharh kelganda Telegram orqali darhol xabar olasiz.</p></div></header>
      <div class="fgrid">
        <div class="fld w-half"><label class="fld-l" for="tg-token">Bot tokeni</label><input id="tg-token" type="text" autocomplete="off" spellcheck="false" placeholder="123456789:AAH…"></div>
        <div class="fld w-half"><label class="fld-l" for="tg-chat">Chat ID</label><input id="tg-chat" type="text" autocomplete="off" spellcheck="false" placeholder="Masalan: 123456789"></div>
      </div>
      <div class="help"><b>Qanday sozlanadi?</b><ol>
        <li>Telegramda <b>@BotFather</b> ga yozing, <code>/newbot</code> buyrug'i bilan bot yarating va bergan tokenni nusxalang.</li>
        <li>O'zingiz yaratgan botni oching va <code>/start</code> bosing (aks holda bot sizga yoza olmaydi).</li>
        <li><b>@userinfobot</b> ga yozib, o'z chat ID raqamingizni bilib oling. Guruhga yuborish uchun botni guruhga qo'shing — guruh ID si odatda <code>-100…</code> bilan boshlanadi.</li>
        <li>Saqlang va «Test xabar» tugmasini bosing.</li></ol></div>
      <div class="card-foot"><button type="button" class="btn btn-primary btn-sm" data-act="tg-save">${ico("a-save")}<span>Saqlash</span></button>
        <button type="button" class="btn btn-outline btn-sm" data-act="tg-test">${ico("i-send")}<span>Test xabar</span></button></div>
    </section>
    <form class="card" id="pw-form" novalidate>
      <header class="card-h"><div><h2>Parolni o'zgartirish</h2><p>Kamida 8 belgi. Harf, raqam va belgilarni aralashtirib ishlating.</p></div></header>
      <input type="text" name="username" value="admin" autocomplete="username" hidden>
      <div class="fgrid">
        <div class="fld w-third"><label class="fld-l" for="pw-cur">Joriy parol</label><input id="pw-cur" type="password" autocomplete="current-password"></div>
        <div class="fld w-third"><label class="fld-l" for="pw-new">Yangi parol</label><input id="pw-new" type="password" autocomplete="new-password"></div>
        <div class="fld w-third"><label class="fld-l" for="pw-rep">Yangi parolni takrorlang</label><input id="pw-rep" type="password" autocomplete="new-password"></div>
      </div>
      <div class="form-msg" id="pw-msg" role="status" hidden></div>
      <div class="card-foot"><button type="submit" class="btn btn-primary btn-sm">${ico("a-key")}<span>Parolni o'zgartirish</span></button></div>
    </form>
    <section class="card" id="bk-card">
      <header class="card-h"><div><h2>Zaxira nusxalar</h2><p>Har saqlashdan oldin sayt ma'lumotlarining nusxasi avtomatik olinadi (oxirgi 50 tasi saqlanadi).</p></div>
        <button type="button" class="btn btn-outline btn-sm" data-act="bk-refresh">${ico("a-refresh")}<span>Yangilash</span></button></header>
      <div class="bk-list" id="bk-list"><div class="empty">Yuklanmoqda…</div></div>
    </section>
    <section class="card">
      <header class="card-h"><div><h2>JSON eksport / import</h2><p>Barcha sayt ma'lumotlarini bitta faylga yuklab oling yoki avval olingan fayldan tiklang. Import qilingan ma'lumotlar darhol saqlanmaydi — tekshirib, «Saqlash» ni bosing.</p></div></header>
      <div class="card-foot flat"><button type="button" class="btn btn-outline btn-sm" data-act="json-export">${ico("a-download")}<span>JSON eksport</span></button>
        <button type="button" class="btn btn-outline btn-sm" data-act="json-import">${ico("a-upload")}<span>JSON import</span></button>
        <input type="file" id="json-file" accept=".json,application/json" hidden></div>
    </section>`;
  }
  function loadSettingsExtra() {
    api("GET", "/api/settings").then((r) => {
      const tg = (r && r.telegram) || {};
      S.tg = { token: String(tg.token || ""), chat_id: String(tg.chat_id == null ? "" : tg.chat_id) };
      const t = $("#tg-token"), c = $("#tg-chat");
      if (t && c) { t.value = S.tg.token; c.value = S.tg.chat_id; }
    }).catch(fail);
    loadBackups();
  }
  async function saveTelegram(quiet) {
    const token = $("#tg-token").value.trim(), chat_id = $("#tg-chat").value.trim();
    try {
      await api("PUT", "/api/settings", { telegram: { token, chat_id } });
      S.tg = { token, chat_id };
      if (!quiet) toast("Telegram sozlamalari saqlandi", "ok");
      return true;
    } catch (e) { fail(e); return false; }
  }
  async function testTelegram() {
    const token = $("#tg-token").value.trim(), chat_id = $("#tg-chat").value.trim();
    if (!token || !chat_id) { toast("Avval bot tokeni va chat ID ni kiriting", "err"); return; }
    if ((!S.tg || S.tg.token !== token || S.tg.chat_id !== chat_id) && !(await saveTelegram(true))) return;
    try { await api("POST", "/api/settings/test", {}); toast("Test xabar yuborildi — Telegramni tekshiring", "ok"); } catch (e) { fail(e); }
  }
  async function changePassword(form) {
    const cur = $("#pw-cur").value, nw = $("#pw-new").value, rep = $("#pw-rep").value;
    const msg = (t, ok) => { const m = $("#pw-msg"); m.textContent = t; m.className = "form-msg " + (ok ? "ok" : "err"); m.hidden = false; };
    if (!cur) return msg("Joriy parolni kiriting");
    if (nw.length < 8) return msg("Yangi parol kamida 8 belgidan iborat bo'lishi kerak");
    if (nw !== rep) return msg("Yangi parollar bir-biriga mos emas");
    if (nw === cur) return msg("Yangi parol joriy paroldan farq qilishi kerak");
    await busy(form.querySelector("[type=submit]"), async () => {
      try {
        await api("POST", "/api/password", { current: cur, new: nw });
        form.reset(); msg("Parol muvaffaqiyatli o'zgartirildi", true);
        toast("Parol o'zgartirildi", "ok");
      } catch (e) { if (!e.silent) msg(e.message); }
    });
  }
  function bkTime(b) {
    const m = /^data-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/.exec(b.name || "");
    if (m) return `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}:${m[6]}`;
    if (isNum(b.time)) { const d = new Date(b.time > 1e12 ? b.time : b.time * 1000); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
    return fmtDate(b.time, b.name || "");
  }
  async function loadBackups() {
    try {
      const r = await api("GET", "/api/backups");
      const items = Array.isArray(r.items) ? r.items : [], box = $("#bk-list");
      if (!box) return;
      box.innerHTML = items.length ? items.map((b) => `<div class="bk"><span class="bk-ic">${ico("a-db")}</span>
        <div class="bk-t"><b>${esc(bkTime(b))}</b><small>${esc(b.name)}${isNum(b.size) ? " · " + esc(fmtSize(b.size)) : ""}</small></div>
        <button type="button" class="btn btn-outline btn-sm" data-act="bk-restore" data-name="${esc(b.name)}">${ico("a-refresh")}<span>Tiklash</span></button></div>`).join("")
        : `<div class="empty">Hozircha zaxira nusxalar yo'q. Birinchi saqlashda avtomatik yaratiladi.</div>`;
    } catch (e) {
      const box = $("#bk-list");
      if (box) box.innerHTML = `<div class="empty">Ro'yxatni yuklab bo'lmadi</div>`;
      fail(e);
    }
  }
  async function restoreBackup(name) {
    const ok = await confirmDlg("Zaxira nusxani tiklash",
      `Sayt ma'lumotlari ${bkTime({ name })} holatiga qaytarilsinmi? Joriy holat ham avval zaxiraga saqlanadi.${isDirty() ? " Diqqat: saqlanmagan o'zgarishlaringiz yo'qoladi!" : ""}`, "Tiklash", true);
    if (!ok) return;
    try {
      await api("POST", `/api/backups/${encodeURIComponent(name)}/restore`, {});
      await loadSite();
      rerenderCurrent();
      toast("Zaxira nusxa tiklandi — saytda yangilandi", "ok");
    } catch (e) { fail(e); }
  }
  function exportJson() {
    if (S.site) download(JSON.stringify(S.site, null, 2) + "\n", `umragoo-data-${todayStr()}.json`, "application/json");
  }
  const SITE_KEYS = ["settings", "seo", "contacts", "hero", "services", "sections", "train", "cta", "partners", "reviewsSummary", "app", "footer", "promo", "dates", "chat", "umrah", "hotels", "visas", "flights", "testimonials"];
  function checkSiteShape(d) {
    if (!d || typeof d !== "object" || Array.isArray(d)) return "Noto'g'ri fayl: JSON obyekt kutilgan edi";
    const miss = SITE_KEYS.filter((k) => !(k in d));
    if (miss.length) return "Faylda quyidagi bo'limlar yo'q: " + miss.join(", ");
    const bad = ["umrah", "hotels", "visas", "flights", "testimonials", "services"].filter((k) => !Array.isArray(d[k]));
    if (bad.length) return "Quyidagilar ro'yxat bo'lishi kerak: " + bad.join(", ");
    if (!(d.settings && Number(d.settings.usdToUzs) > 0)) return "settings.usdToUzs musbat son bo'lishi kerak";
    return null;
  }
  function importJson(file) {
    const fr = new FileReader();
    fr.onerror = () => toast("Faylni o'qib bo'lmadi", "err");
    fr.onload = async () => {
      let d;
      try { d = JSON.parse(String(fr.result).replace(/^﻿/, "")); } catch (e) { toast("Fayl JSON formatida emas", "err"); return; }
      if (d && d.data && typeof d.data === "object" && !d.umrah) d = d.data;
      const err = checkSiteShape(d);
      if (err) { toast(err, "err"); return; }
      if (isDirty() && !(await confirmDlg("JSON import", "Saqlanmagan o'zgarishlaringiz import qilingan ma'lumotlar bilan almashtiriladi. Davom etasizmi?", "Import qilish", true))) return;
      const keep = new Set(SITE_KEYS.concat(Object.keys(S.site || {})));
      const out = {};
      Object.keys(d).forEach((k) => { if (keep.has(k)) out[k] = d[k]; });
      S.site = out; openItems = new WeakSet(); S.filters = {};
      rerenderCurrent(); changed();
      toast("JSON yuklandi. Ma'lumotlarni tekshirib, «Saqlash» tugmasini bosing", "ok");
    };
    fr.readAsText(file);
  }

  /* ---------- kirish, chiqish, ishga tushirish ---------- */
  function startPolling() {
    stopPolling();
    S.pollT = setInterval(() => { if (S.authed) { refreshRequests(true, true); refreshReviews(true, true); } }, 60000);
  }
  function stopPolling() { if (S.pollT) clearInterval(S.pollT); S.pollT = 0; }

  function authCard(inner, wide) {
    return `<div class="auth"><div class="auth-card${wide ? " wide" : ""}">${inner}</div></div>`;
  }
  function showNoServer() {
    S.authed = false; stopPolling();
    $("#app").innerHTML = authCard(`
      <img class="auth-logo" src="../assets/logo.svg" alt="Umragoo">
      <h1 class="auth-h">Admin panel server.py orqali ishlaydi</h1>
      <p>Sahifa server ishga tushirilmagan holda ochilgan (faylning o'zi yoki oddiy statik hosting orqali). Ma'lumotlarni o'qish va saqlash uchun Umragoo serveri kerak.</p>
      <ol class="steps-list">
        <li><b>Serverni ishga tushiring.</b> Loyiha papkasida terminalni oching va quyidagini bajaring:<code class="cmd">python3 server.py</code>
          Yoki shunchaki <code>start-server.command</code> (macOS) yoki <code>start-server.bat</code> (Windows) faylini ikki marta bosing.</li>
        <li><b>Admin panelni brauzerda oching:</b> <a href="http://127.0.0.1:8080/admin/">http://127.0.0.1:8080/admin/</a></li>
      </ol>
      <p class="muted">Server oynasini yopmang — u yopilsa, admin panel ishlashdan to'xtaydi.</p>
      <div class="auth-actions"><button type="button" class="btn btn-outline" data-act="retry">${ico("a-refresh")}<span>Qayta tekshirish</span></button></div>`, true);
  }
  function showFatal(msg) {
    $("#app").innerHTML = authCard(`
      <img class="auth-logo" src="../assets/logo.svg" alt="Umragoo">
      <h1 class="auth-h">Ma'lumotlarni yuklab bo'lmadi</h1>
      <div class="auth-msg err">${esc(msg || "Noma'lum xatolik")}</div>
      <div class="auth-actions"><button type="button" class="btn btn-primary" data-act="retry">${ico("a-refresh")}<span>Qayta urinish</span></button></div>`);
  }
  function showLogin(note) {
    S.authed = false; stopPolling(); closeIconPop();
    if ($("#login-form")) return;
    $("#app").innerHTML = `<div class="auth"><form class="auth-card" id="login-form" novalidate>
      <img class="auth-logo" src="../assets/logo.svg" alt="">
      <h1 class="auth-brand">Umra<b>goo</b></h1><p class="auth-sub">Admin panel</p>
      ${note ? `<div class="auth-msg info" role="status">${esc(note)}${isDirty() ? " Saqlanmagan o'zgarishlaringiz yo'qolmadi — kirganingizdan so'ng saqlashingiz mumkin." : ""}</div>` : ""}
      <label class="fld-l" for="login-pass">Parol</label>
      <div class="pass-wrap"><input id="login-pass" type="password" autocomplete="current-password" placeholder="Admin parolini kiriting">
        <button type="button" class="icon-btn" data-act="pw-toggle" aria-label="Parolni ko'rsatish">${ico("a-eye")}</button></div>
      <div class="auth-msg err" id="login-err" role="alert" hidden></div>
      <button class="btn btn-primary btn-block" type="submit" id="login-btn">Kirish</button>
      <a class="auth-back" href="/">← Saytga qaytish</a>
    </form></div>`;
    setTimeout(() => { const p = $("#login-pass"); if (p) p.focus(); }, 30);
  }
  async function doLogin() {
    const inp = $("#login-pass"), btn = $("#login-btn"), err = $("#login-err");
    err.hidden = true;
    if (!inp.value) { err.textContent = "Parolni kiriting"; err.hidden = false; inp.focus(); return; }
    btn.disabled = true; btn.textContent = "Tekshirilmoqda…";
    try {
      await api("POST", "/api/login", { password: inp.value }, { login: true });
    } catch (e) {
      err.textContent = e.status === 429
        ? "Juda ko'p noto'g'ri urinish bo'ldi. Xavfsizlik uchun kirish vaqtincha to'xtatildi — 10 daqiqadan so'ng qayta urinib ko'ring."
        : e.message || "Kirib bo'lmadi";
      err.hidden = false; btn.disabled = false; btn.textContent = "Kirish";
      inp.select(); inp.focus();
      return;
    }
    startApp();
  }
  async function doLogout() {
    if (isDirty() && !(await confirmDlg("Chiqish", "Saqlanmagan o'zgarishlar bor — chiqsangiz ular yo'qoladi. Baribir chiqasizmi?", "Chiqish", true))) return;
    try { await api("POST", "/api/logout", {}, { login: true }); } catch (e) { /* baribir chiqamiz */ }
    S.site = null; S.saved = ""; S.savedObj = null; S.requests = []; S.reviews = []; S.reqLoaded = false; S.tg = null;
    document.title = "Umragoo — Admin panel";
    showLogin();
  }
  async function startApp() {
    S.authed = true;
    if (!S.site) $("#app").innerHTML = `<div class="boot"><span class="spin" aria-hidden="true"></span>Ma'lumotlar yuklanmoqda…</div>`;
    try {
      await Promise.all([S.site ? null : loadSite(), refreshRequests(true), refreshReviews(true), spriteP]);
    } catch (e) { if (!e.silent) showFatal(e.message); return; }
    if (!S.authed) return;
    renderShell(); updateBadges(); route(); startPolling();
  }
  async function boot() {
    if (location.protocol === "file:") { showNoServer(); return; }
    $("#app").innerHTML = `<div class="boot"><span class="spin" aria-hidden="true"></span>Yuklanmoqda…</div>`;
    if (!spriteP) spriteP = loadSprite();
    let res, data = null;
    try { res = await fetch("/api/me", { credentials: "same-origin", cache: "no-store", headers: { "X-Requested-With": "umragoo" } }); }
    catch (e) { showNoServer(); return; }
    try { data = await res.json(); } catch (e) { showNoServer(); return; }
    if (res.status === 401) { showLogin(); return; }
    if (!res.ok || !data) { showFatal((data && data.error) || `Server xatosi (${res.status})`); return; }
    startApp();
  }

  /* ---------- global tinglovchilar ---------- */
  document.addEventListener("click", onClick);
  document.addEventListener("input", onInput);
  document.addEventListener("change", onChange);
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("focusout", onFocusOut);
  document.addEventListener("submit", onSubmit);
  document.addEventListener("error", onImgError, true);
  window.addEventListener("hashchange", () => {
    if (!S.authed || !S.site || !$("#content")) return;
    const f = pendingFocus;
    pendingFocus = null;
    route(f);
  });
  window.addEventListener("beforeunload", (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ""; } });

  boot();
})();
