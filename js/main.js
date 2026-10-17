/* =====================================================
   UMRAGOO — interaktivlik va render
   Barcha matn va ro'yxatlar js/data.js dan olinadi (uni admin
   panel tahrirlaydi). index.html dagi matnlar — zaxira nusxa.
   ===================================================== */
(function () {
  "use strict";
  const D = window.UMRAGOO_DATA || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- yordamchi funksiyalar ---------- */
  const obj = (x) => (x && typeof x === "object" && !Array.isArray(x) ? x : {});
  const arr = (x) => (Array.isArray(x) ? x : []);
  const str = (x) => (x == null ? "" : String(x).trim());
  // yashirilgan (hidden: true) elementlar saytda ko'rsatilmaydi
  const visible = (list) => arr(list).filter((x) => x && x.hidden !== true);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ico = (id) => `<svg aria-hidden="true"><use href="#${esc(id)}"/></svg>`;
  const starsTxt = (n) => {
    const k = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
    return "★".repeat(k) + "☆".repeat(5 - k);
  };
  const getPath = (path) => path.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), D);

  // localStorage / sessionStorage bloklangan bo'lsa ham sayt ishlashi uchun
  const storage = (type) => ({
    get: (k) => { try { return window[type].getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { window[type].setItem(k, v); } catch (e) { /* bloklangan */ } }
  });
  const local = storage("localStorage"), session = storage("sessionStorage");

  // Xavfsiz havola: http(s):, mailto:, tel:, "#..." va nisbiy yo'llar.
  // Boshqa sxemalar (javascript:, data: va h.k.) "#" ga aylanadi.
  function safeUrl(u) {
    const s = str(u);
    if (!s) return "";
    const probe = s.replace(/[\u0000-\u0020\u007f-\u009f]/g, "").toLowerCase();
    if (/^(https?:|mailto:|tel:)/.test(probe)) return s;
    if (/^[a-z][a-z0-9+.\-]*:/.test(probe)) return "#";
    return s;
  }
  const okUrl = (u) => !!u && u !== "#";
  // "t.me/umragoo" yoki "@umragoo" kabi qisqa yozuvni to'liq havolaga aylantirish
  function extUrl(u, handleBase) {
    let s = str(u);
    if (handleBase && /^@[\w.\-]+$/.test(s)) s = handleBase + s.slice(1);
    else if (/^[\w\-]+(\.[\w\-]+)+(\/|$)/.test(s)) s = "https://" + s;
    return safeUrl(s);
  }
  const blankAttrs = (u) => (/^https?:/i.test(u) ? ' target="_blank" rel="noopener"' : "");
  const telHref = (p) => "tel:" + str(p).replace(/[^\d+]/g, "");
  const cssUrl = (u) => `url("${u.replace(/["\\]/g, "\\$&").replace(/[\n\r\f]/g, "")}")`;
  function setBg(el, u) {
    const s = safeUrl(u);
    if (el && okUrl(s)) el.style.backgroundImage = cssUrl(s);
  }
  const img = (u, alt) => {
    const s = safeUrl(u);
    return okUrl(s) ? `<img src="${esc(s)}" alt="${esc(alt)}" loading="lazy">` : "";
  };
  // "YYYY-MM-DD" → mahalliy vaqt bo'yicha kun boshi (noto'g'ri bo'lsa null)
  function parseDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(iso));
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d) ? null : d;
  }

  /* ---------- valyuta ---------- */
  const rate = Number(obj(D.settings).usdToUzs) > 0 ? Number(D.settings.usdToUzs) : 12700;
  let currency = local.get("umragoo.cur") === "UZS" ? "UZS" : "USD";
  const fmt = (usd) => {
    const n = Number(usd) || 0;
    if (currency === "UZS") return Math.round(n * rate).toLocaleString("ru-RU").replace(/,/g, " ") + " so'm";
    return "$" + n.toLocaleString("en-US");
  };

  /* ---------- kartalarni render qilish ---------- */
  const emptyState = (text) => `<div class="empty-state">${esc(text)}</div>`;

  function packageCard(p) {
    const seats = Number(p.seats);
    const hotels = [["Makka", p.makkah], ["Madina", p.madinah]].filter((h) => str(h[1]));
    const route = [p.from, p.airline].map(str).filter(Boolean).join(" · ");
    return `
    <article class="card" data-search="${esc([p.title, p.code, p.makkah, p.madinah].map(str).join(" "))}">
      <div class="media">
        ${img(p.img, p.title)}
        ${str(p.tag) ? `<div class="badges"><span class="badge badge-gold">${esc(p.tag)}</span></div>` : ""}
        ${str(p.rating) ? `<span class="rating">${ico("i-star")}${esc(p.rating)}</span>` : ""}
        ${str(p.code) ? `<span class="code">${esc(p.code)}</span>` : ""}
      </div>
      <div class="body">
        <h3>${esc(p.title)}</h3>
        <div class="meta">
          ${str(p.days) ? `<span>${ico("i-calendar")}${esc(p.days)} kun</span>` : ""}
          ${route ? `<span>${ico("i-plane")}${esc(route)}</span>` : ""}
        </div>
        ${hotels.length ? `<div class="hotel-lines">${hotels.map((h) => `<span>${ico("i-bed")}<b>${h[0]}:</b>&nbsp;${esc(h[1])}</span>`).join("")}</div>` : ""}
        <div class="includes">${arr(p.includes).map(str).filter(Boolean).map((i) => `<span>✓ ${esc(i)}</span>`).join("")}</div>
        <div class="foot">
          <div class="price"><small>Narx boshlanadi</small><b>${fmt(p.price)}</b> <i>/ kishi</i>${seats > 0 && seats <= 10 ? `<div style="margin-top:4px"><span class="seats">Faqat ${esc(seats)} o'rin qoldi</span></div>` : ""}</div>
          <button class="btn btn-primary btn-sm" data-open="request" data-service="${esc("Umra: " + str(p.title) + (str(p.code) ? " (" + str(p.code) + ")" : ""))}">Band qilish</button>
        </div>
      </div>
    </article>`;
  }

  function hotelCard(h) {
    const feats = arr(h.features).map(str).filter(Boolean);
    return `
    <article class="card" data-search="${esc(str(h.name) + " " + str(h.city))}">
      <div class="media">
        ${img(h.img, h.name)}
        ${str(h.city) ? `<div class="badges"><span class="badge badge-teal">${esc(h.city)}</span></div>` : ""}
        ${str(h.rating) ? `<span class="rating">${ico("i-star")}${esc(h.rating)}</span>` : ""}
      </div>
      <div class="body">
        <div class="stars">${starsTxt(h.stars)}</div>
        <h3>${esc(h.name)}</h3>
        ${str(h.dist) ? `<span class="dist">${ico("i-pin")}${esc(h.dist)}</span>` : ""}
        ${feats.length ? `<div class="meta">${feats.map((f) => `<span>${ico("i-check-circle")}${esc(f)}</span>`).join("")}</div>` : ""}
        <div class="foot">
          <div class="price"><small>Bir kecha</small><b>${fmt(h.price)}</b> <i>/ xona</i></div>
          <button class="btn btn-primary btn-sm" data-open="request" data-service="${esc("Mehmonxona: " + str(h.name))}">Bron qilish</button>
        </div>
      </div>
    </article>`;
  }

  function visaCard(v) {
    const rows = [
      str(v.issue) && `${ico("i-clock")}Rasmiylashtirish: <b>&nbsp;${esc(v.issue)}</b>`,
      str(v.valid) && `${ico("i-calendar")}Amal qilish: <b>&nbsp;${esc(v.valid)}</b>`,
      str(v.entry) && `${ico("i-check-circle")}${esc(v.entry)}`,
      str(v.note) && `${ico("i-sparkles")}${esc(v.note)}`
    ].filter(Boolean);
    return `
    <article class="visa-card" data-search="${esc(v.title)}">
      <span class="ic">${ico("i-file")}</span>
      <h3>${esc(v.title)}</h3>
      <ul>${rows.map((r) => `<li>${r}</li>`).join("")}</ul>
      <div class="foot">
        <div class="price"><b>${fmt(v.price)}</b> <i>/ kishi</i></div>
        <button class="btn btn-outline btn-sm" data-open="request" data-service="${esc("Viza: " + str(v.title))}">Ariza berish</button>
      </div>
    </article>`;
  }

  function flightRow(f) {
    return `
    <div class="flight" data-search="${esc([f.airline, f.fromCity, f.toCity].map(str).join(" "))}">
      <div class="airline"><span class="lg">${esc(f.code)}</span><div>${esc(f.airline)}<small>${esc(f.flight)}</small></div></div>
      <div class="route">
        <div><b>${esc(f.dep)}</b><small>${esc(f.from)} · ${esc(f.fromCity)}</small></div>
        <div class="line">${ico("i-plane")}<span>${esc([f.dur, f.stops].map(str).filter(Boolean).join(" · "))}</span></div>
        <div><b>${esc(f.arr)}</b><small>${esc(f.to)} · ${esc(f.toCity)}</small></div>
      </div>
      <div class="price"><small>Borish-kelish, dan</small><b>${fmt(f.price)}</b></div>
      <button class="btn btn-primary btn-sm" data-open="request" data-service="${esc("Aviachipta: " + str(f.airline) + " " + str(f.from) + "→" + str(f.to))}">Tanlash</button>
    </div>`;
  }

  function testimonialCard(t) {
    const initials = str(t.name).split(/\s+/).map((w) => Array.from(w)[0] || "").join("").slice(0, 2).toUpperCase();
    return `
    <article class="t-card">
      <div class="q">“</div>
      <p>${esc(t.text)}</p>
      <div class="who">
        <span class="av">${esc(initials)}</span>
        <div><b>${esc(t.name)}</b><span>${esc(t.place)}</span></div>
        <span class="stars">${starsTxt(t.stars)}</span>
      </div>
    </article>`;
  }

  function renderList(sel, list, tpl, emptyText) {
    const el = $(sel);
    if (el) el.innerHTML = list.length ? list.map(tpl).join("") : emptyState(emptyText);
  }

  // Narxga bog'liq bloklar — valyuta almashganda qayta chiziladi
  function renderAll() {
    renderList("#umrah-grid", visible(D.umrah), packageCard, "Hozircha umra paketlari mavjud emas.");
    renderList("#hotels-grid", visible(D.hotels), hotelCard, "Hozircha mehmonxona takliflari mavjud emas.");
    renderList("#visa-grid", visible(D.visas), visaCard, "Hozircha viza takliflari mavjud emas.");
    renderList("#flights-list", visible(D.flights), flightRow, "Hozircha aviachipta takliflari mavjud emas.");
    const tl = visible(D.testimonials);
    $("#t-track").innerHTML = tl.concat(tl).map(testimonialCard).join("");
    const count = str(obj(D.reviewsSummary).count);
    if (count) $("#review-count").textContent = count;
  }
  renderAll();

  /* ---------- matnlarni ma'lumotdan bog'lash (data-t) ---------- */
  // data-t="yo'l.kalit" → textContent; bo'sh qiymat elementni (yoki [data-wrap] ota-elementni) yashiradi
  $$("[data-t]").forEach((el) => {
    const v = getPath(el.dataset.t);
    if (v == null || typeof v === "object") return; // ma'lumot yo'q — HTML dagi zaxira matn qoladi
    const s = String(v).trim();
    const box = el.closest("[data-wrap]") || el;
    box.hidden = !s;
    if (s) el.textContent = s;
  });

  /* ---------- SEO ---------- */
  (function seo() {
    const S = obj(D.seo);
    const setMeta = (sel, v) => { const m = $(sel); if (m && str(v)) m.setAttribute("content", str(v)); };
    if (str(S.title)) document.title = str(S.title);
    setMeta('meta[name="description"]', S.description);
    setMeta('meta[name="keywords"]', S.keywords);
    setMeta('meta[property="og:title"]', S.title);
    setMeta('meta[property="og:description"]', S.description);
  })();

  /* ---------- ma'lumotdan ro'yxatlar ---------- */
  // Massiv bo'lmasa HTML dagi zaxira qoladi; bo'sh bo'lsa konteyner yashiriladi
  function fill(sel, list, tpl, keep = () => true) {
    const el = $(sel);
    if (!el || !Array.isArray(list)) return;
    const html = list.filter((x) => x != null && x.hidden !== true && keep(x)).map(tpl).join("");
    el.innerHTML = html;
    el.hidden = !html;
  }
  const H = obj(D.hero), T = obj(D.train), PR = obj(D.partners);

  setBg($(".hero .bg"), H.image);
  setBg($(".train-banner .img"), T.image);

  fill("#hero-stats", H.stats, (s) => `<div class="stat"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`, (s) => str(s.value) || str(s.label));

  fill("#svc-track", D.services, (s) => {
    const u = safeUrl(s.link) || "#sorov";
    return `<a href="${esc(u)}" class="svc"${blankAttrs(u)}>${str(s.tag) ? `<span class="tag">${esc(s.tag)}</span>` : ""}<span class="ic">${ico(s.icon || "i-sparkles")}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></a>`;
  }, (s) => str(s.title));
  if ($("#svc-track").hidden) $("#xizmatlar").hidden = true;

  fill("#train-facts", T.facts, (f) => `<span>${ico(f.icon || "i-check-circle")}${esc(f.text)}</span>`, (f) => str(f.text));
  fill("#cta-benefits", obj(D.cta).benefits, (b) => `<div class="benefit"><span class="ic">${ico(b.icon || "i-check-circle")}</span><b>${esc(b.title)}</b><span>${esc(b.text)}</span></div>`, (b) => str(b.title) || str(b.text));

  const point = (p) => `<li>${ico("i-check-circle")}${esc(p)}</li>`;
  fill("#marketer-points", obj(PR.marketer).points, point, str);
  fill("#supplier-points", obj(PR.supplier).points, point, str);
  fill("#partner-steps", PR.steps, (s, i) => `<div class="step"><span class="n">${i + 1}</span><div><b>${esc(s.title)}</b><span>${esc(s.text)}</span></div></div>`, (s) => str(s.title) || str(s.text));

  fill("#footer-licenses", obj(D.footer).licenses, (l) => `<span class="lic">${ico(l.icon || "i-check-circle")}${esc(l.text)}</span>`, (l) => str(l.text));

  /* ---------- kontaktlar va ijtimoiy tarmoqlar ---------- */
  const C = obj(D.contacts);
  (function contacts() {
    if (!D.contacts) return;
    const phone = str(C.phone);
    const tb = $("#topbar-phone");
    if (tb && phone) {
      tb.href = telHref(phone);
      $("span", tb).textContent = phone;
      tb.hidden = false;
      $("#topbar-hours").classList.add("hide-m"); // mobil ekranda telefon raqami ko'rinib qoladi
    }

    const items = [];
    [C.phone, C.phone2].map(str).filter(Boolean).forEach((p) => items.push(`<li>${ico("i-phone")}<a href="${esc(telHref(p))}">${esc(p)}</a></li>`));
    if (str(C.email)) items.push(`<li>${ico("i-mail")}<a href="${esc(safeUrl("mailto:" + str(C.email)))}">${esc(C.email)}</a></li>`);
    if (str(C.address)) items.push(`<li>${ico("i-pin")}<span>${esc(C.address)}</span></li>`);
    items.push(`<li>${ico("i-send")}<a href="#" data-open="request">So'rov yuborish</a></li>`);
    if (str(C.support)) items.push(`<li>${ico("i-headset")}<span>${esc(C.support)}</span></li>`);
    $("#footer-contacts").innerHTML = items.join("");

    const handles = { telegram: "https://t.me/", instagram: "https://instagram.com/", facebook: "https://facebook.com/", youtube: "https://www.youtube.com/@" };
    let any = false;
    $$("#socials [data-social]").forEach((a) => {
      const key = a.dataset.social;
      const u = extUrl(C[key], handles[key]);
      a.hidden = !okUrl(u);
      if (okUrl(u)) { a.href = u; a.target = "_blank"; a.rel = "noopener"; any = true; }
    });
    $("#socials").hidden = !any;
  })();

  /* ---------- mobil ilova havolalari ---------- */
  (function appLinks() {
    const A = obj(D.app);
    [["#app-store", A.appStore], ["#google-play", A.googlePlay]].forEach(([sel, url]) => {
      const a = $(sel), u = extUrl(url);
      if (!a || !okUrl(u)) return; // bo'sh — "tez orada" xabari qoladi
      a.href = u; a.target = "_blank"; a.rel = "noopener";
      a.removeAttribute("data-toast");
    });
  })();

  /* ---------- aksiya (promo) holati ---------- */
  const P = obj(D.promo);
  const promoEnd = parseDate(P.end);
  const promoLive = !!P.enabled && !!promoEnd && promoEnd > Date.now();
  $$('[data-open="promo"]').forEach((el) => (el.hidden = !P.enabled));

  /* ---------- valyuta almashtirgich ---------- */
  $$("#cur-select button").forEach((b) => {
    b.classList.toggle("active", b.dataset.cur === currency);
    b.addEventListener("click", () => {
      currency = b.dataset.cur;
      local.set("umragoo.cur", currency);
      $$("#cur-select button").forEach((x) => x.classList.toggle("active", x === b));
      renderAll();
      toast(currency === "UZS" ? "Narxlar so'mda ko'rsatilmoqda" : "Narxlar dollarda ko'rsatilmoqda");
    });
  });
  $$("#lang-select button").forEach((b) => {
    b.addEventListener("click", () => {
      if (b.dataset.lang !== "uz") toast("Rus tili tez orada qo'shiladi");
    });
  });

  /* ---------- header scroll / burger ---------- */
  const header = $("#header");
  const toTop = $("#to-top");
  window.addEventListener("scroll", () => {
    header.classList.toggle("scrolled", window.scrollY > 10);
    toTop.classList.toggle("show", window.scrollY > 600);
  }, { passive: true });
  toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  const burger = $("#burger"), mnav = $("#mobile-nav");
  burger.addEventListener("click", () => mnav.classList.toggle("open"));
  $$("#mobile-nav a").forEach((a) => a.addEventListener("click", () => mnav.classList.remove("open")));

  /* ---------- gorizontal karusel tugmalari ---------- */
  $$("[data-scroll]").forEach((b) => {
    b.addEventListener("click", () => {
      const el = $(b.dataset.scroll);
      el.scrollBy({ left: Number(b.dataset.dir) * Math.min(el.clientWidth * 0.8, 640), behavior: "smooth" });
    });
  });
  // sharhlar avtomatik aylanishi
  (function autoScroll() {
    const tt = $("#t-track");
    let paused = false;
    tt.addEventListener("mouseenter", () => (paused = true));
    tt.addEventListener("mouseleave", () => (paused = false));
    tt.addEventListener("touchstart", () => (paused = true), { passive: true });
    setInterval(() => {
      if (paused || document.hidden) return;
      if (tt.scrollLeft + tt.clientWidth >= tt.scrollWidth - 4) tt.scrollTo({ left: 0, behavior: "smooth" });
      else tt.scrollBy({ left: 358, behavior: "smooth" });
    }, 4500);
  })();

  /* ---------- hijriy sana va sanoq ---------- */
  (function dates() {
    const months = ["Muharram", "Safar", "Rabiul avval", "Rabiul oxir", "Jumodiul avval", "Jumodiul oxir", "Rajab", "Sha'bon", "Ramazon", "Shavvol", "Zulqa'da", "Zulhijja"];
    try {
      const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "numeric", year: "numeric" }).formatToParts(new Date());
      const g = (t) => parts.find((p) => p.type === t).value;
      $("#hijri-date").textContent = `${g("day")} ${months[Number(g("month")) - 1]} ${g("year")} h.`;
    } catch (e) {
      $("#hijri-date").textContent = new Date().toLocaleDateString("uz-UZ");
    }
    // Ramazon sanog'i: sana bo'sh yoki o'tib ketgan bo'lsa chip yashiriladi
    const rd = parseDate(obj(D.dates).ramadan);
    if (rd && rd > Date.now()) $("#cd-ramadan").textContent = Math.ceil((rd - Date.now()) / 864e5);
    else $("#chip-ramadan").hidden = true;
    $("#year").textContent = new Date().getFullYear();
  })();

  /* ---------- ko'rinish animatsiyasi ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.08 });
  $$(".reveal").forEach((el) => io.observe(el));

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-toast]");
    if (el) { e.preventDefault(); toast(el.dataset.toast); }
  });

  /* ---------- qidiruv ---------- */
  $("#hero-search").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("#search-input").value.trim().toLowerCase();
    const cat = $("#search-cat").value;
    const items = $$("[data-search]");
    let hits = 0, first = null;
    items.forEach((el) => {
      const ok = !q || el.dataset.search.toLowerCase().includes(q);
      el.style.display = ok ? "" : "none";
      if (ok) { hits++; if (!first) first = el; }
    });
    const target = cat !== "all" ? $("#" + cat) : (first ? first.closest("section") : $("#umra"));
    if (target) target.scrollIntoView({ behavior: "smooth" });
    toast(q ? `"${q}" bo'yicha ${hits} ta natija topildi` : "Barcha takliflar ko'rsatilmoqda");
  });

  /* ---------- modal tizimi ---------- */
  const root = $("#modal-root");
  function closeModal() { root.innerHTML = ""; document.body.style.overflow = ""; }
  function openModal(html, cls = "") {
    root.innerHTML = `<div class="modal-backdrop"><div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div></div>`;
    document.body.style.overflow = "hidden";
    const bd = $(".modal-backdrop", root);
    bd.addEventListener("click", (e) => { if (e.target === bd) closeModal(); });
    $$(".close, [data-close]", root).forEach((b) => b.addEventListener("click", closeModal));
    const f = $("input, select, textarea", root); if (f) setTimeout(() => f.focus(), 50);
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeModal(); $("#chat").hidden = true; } });

  const closeBtn = `<button class="close" aria-label="Yopish">${ico("i-x")}</button>`;
  const successHtml = (title, text) => `
    <div class="m-body"><div class="success">
      <span class="ok">${ico("i-check-circle")}</span>
      <h3 style="margin-bottom:6px">${title}</h3>
      <p style="color:var(--muted-fg)">${text}</p>
      <button class="btn btn-primary" data-close style="margin-top:18px">Yopish</button>
    </div></div>`;
  // spam-botlar uchun tuzoq maydon (odamlarga ko'rinmaydi)
  const honeypot = `<div class="hp" aria-hidden="true"><label>Veb-saytingiz<input name="website" tabindex="-1" autocomplete="off" aria-hidden="true"></label></div>`;

  const modals = {
    login: () => openModal(`
      <div class="m-head">${closeBtn}<h3>Tizimga kirish</h3><p>Hisobingizga kirish uchun ma'lumotlaringizni kiriting</p></div>
      <div class="m-body">
        <button class="btn btn-outline btn-block" data-toast="Google orqali kirish tez orada"><svg viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.95l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>Google orqali kirish</button>
        <div class="divider">yoki elektron pochta orqali</div>
        <form id="login-form" class="form-grid">
          <label class="f full">Elektron pochta<input type="email" required placeholder="siz@pochta.uz"></label>
          <label class="f full">Parol<input type="password" required placeholder="••••••••" minlength="6"></label>
          <div class="full" style="display:flex;justify-content:space-between;font-size:12.5px">
            <label style="display:flex;gap:6px;align-items:center"><input type="checkbox"> Meni eslab qol</label>
            <a href="#" data-toast="Parolni tiklash havolasi pochtangizga yuboriladi" style="color:var(--teal-600);font-weight:700">Parolni unutdingizmi?</a>
          </div>
          <button class="btn btn-primary btn-block full" type="submit">Kirish</button>
        </form>
        <p class="form-note" style="text-align:center">${ico("i-shield")} Xavfsiz va shifrlangan ulanish · Hisobingiz yo'qmi? <a href="#" data-toast="Ro'yxatdan o'tish tez orada" style="color:var(--teal-600);font-weight:700">Ro'yxatdan o'ting</a></p>
      </div>`),

    request: (service) => openModal(`
      <div class="m-head">${closeBtn}<h3>So'rov yuborish</h3><p>Ma'lumotlaringizni qoldiring — mutaxassisimiz 24 soat ichida bog'lanadi</p></div>
      <div class="m-body">
        <form id="request-form" class="form-grid">
          <label class="f">Ismingiz *<input name="name" required maxlength="100" placeholder="Abdulloh Karimov"></label>
          <label class="f">Telefon *<input name="phone" type="tel" required maxlength="40" placeholder="+998 90 000 00 00"></label>
          <label class="f full">Xizmat turi<select name="service">
            ${["Umra paketi", "Mehmonxona", "Viza", "Aviachipta", "Transport", "Haramayn poyezdi", "Moslashuvchan dastur", "Hamkorlik", "Boshqa"].map((s) => `<option${service && service.startsWith(s.split(" ")[0]) ? " selected" : ""}>${s}</option>`).join("")}
          </select></label>
          <label class="f">Kishilar soni<input name="people" type="number" min="1" max="500" value="1"></label>
          <label class="f">Taxminiy sana<input name="date" type="date"></label>
          <label class="f full">Izoh / istaklaringiz<textarea name="note" rows="3" maxlength="2000" placeholder="Byudjet, mehmonxona darajasi, maxsus talablar...">${service ? esc(service) : ""}</textarea></label>
          ${honeypot}
          <button class="btn btn-primary btn-block full" type="submit">${ico("i-send")}So'rovni yuborish</button>
        </form>
        <p class="form-note">Yuborish orqali siz <a href="#" data-toast="Sahifa tayyorlanmoqda" style="color:var(--teal-600)">maxfiylik siyosati</a>ga rozilik bildirasiz. Ma'lumotlaringiz himoyalangan.</p>
      </div>`),

    review: () => openModal(`
      <div class="m-head">${closeBtn}<h3>Tajribangiz bilan bo'lishing</h3><p>Sharhingiz moderatsiyadan so'ng saytda ko'rinadi</p></div>
      <div class="m-body">
        <form id="review-form" class="form-grid">
          <label class="f">Ismingiz *<input name="name" required maxlength="100"></label>
          <label class="f">Shahringiz<input name="city" maxlength="100" placeholder="Toshkent"></label>
          <label class="f">Xizmat turi<input name="service" maxlength="100" placeholder="Umra / Mehmonxona / Viza ..."></label>
          <label class="f">Bahoyingiz<select name="stars"><option value="5">★★★★★ — A'lo</option><option value="4">★★★★☆ — Yaxshi</option><option value="3">★★★☆☆ — O'rtacha</option><option value="2">★★☆☆☆ — Yomon</option><option value="1">★☆☆☆☆ — Juda yomon</option></select></label>
          <label class="f full">Sharhingiz *<textarea name="text" rows="4" required minlength="5" maxlength="2000" placeholder="Fikringizni samimiy yozing..."></textarea></label>
          ${honeypot}
          <button class="btn btn-primary btn-block full" type="submit">Sharhni yuborish</button>
        </form>
      </div>`),

    promo: () => {
      const expired = promoEnd && promoEnd <= Date.now();
      openModal(`
        <div class="m-head">${closeBtn}${str(P.badge) ? `<span class="badge" style="background:#0000001a;color:var(--teal-950)">${ico("i-gift")}&nbsp;${esc(P.badge)}</span>` : ""}${str(P.title) ? `<h3 style="margin-top:8px">${esc(P.title)}</h3>` : ""}${str(P.subtitle) ? `<p>${esc(P.subtitle)}</p>` : ""}</div>
        <div class="m-body">
          ${str(P.heading) ? `<h4>${esc(P.heading)}</h4>` : ""}
          ${promoEnd && !expired ? `<p style="color:var(--muted-fg)">Aksiya muddati tugashiga qoldi:</p>
          <div class="cd" id="promo-cd"><div><b>--</b><span>kun</span></div><div><b>--</b><span>soat</span></div><div><b>--</b><span>daq</span></div><div><b>--</b><span>son</span></div></div>` : ""}
          ${expired ? `<p style="color:var(--muted-fg);margin:12px 0 18px">Aksiya muddati yakunlangan.</p>` : ""}
          <button class="btn btn-primary btn-block" id="promo-go"${promoEnd && !expired ? "" : ' style="margin-top:12px"'}>${esc(str(P.button) || "Umra paketlarini ko'rish")}</button>
          ${str(P.code) ? `<p class="form-note">Promo-kod: <b style="color:var(--teal-700)">${esc(P.code)}</b> — so'rov yuborayotganda izohga yozing</p>` : ""}
        </div>`, "promo");
      $("#promo-go").addEventListener("click", () => { closeModal(); $("#umra").scrollIntoView({ behavior: "smooth" }); });
      const tick = () => {
        const box = $("#promo-cd"); if (!box) return;
        let s = Math.max(0, Math.floor((promoEnd - Date.now()) / 1000));
        const v = [Math.floor(s / 86400), Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60];
        $$("b", box).forEach((b, i) => (b.textContent = String(v[i]).padStart(2, "0")));
        setTimeout(tick, 1000);
      };
      tick();
    }
  };

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-open]");
    if (!el) return;
    e.preventDefault();
    const fn = modals[el.dataset.open];
    if (fn) fn(el.dataset.service || "");
  });

  /* ---------- forma yuborish (API) ---------- */
  async function postJSON(url, data) {
    // fayldan (file://) ochilganda server yo'q — xato ko'rsatiladi
    if (location.protocol === "file:") throw new Error("file");
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    let body = null;
    try { body = await res.json(); } catch (e) { /* javob JSON emas */ }
    if (!res.ok) {
      const err = new Error("http " + res.status);
      if (body && typeof body.error === "string" && body.error.trim()) err.userMsg = body.error.trim();
      throw err;
    }
    return body;
  }

  function failHtml(serverMsg) {
    if (serverMsg) return esc(serverMsg);
    const phone = str(C.phone);
    return "Yuborib bo'lmadi. Iltimos, qayta urinib ko'ring" +
      (phone ? ` yoki qo'ng'iroq qiling: <a href="${esc(telHref(phone))}">${esc(phone)}</a>` : ".");
  }

  function showSuccess(form, title, text) {
    if (!form.isConnected) { toast(title); return; } // modal yopilib bo'lgan
    const modal = form.closest(".modal");
    modal.innerHTML = successHtml(title, text);
    $$("[data-close]", modal).forEach((b) => b.addEventListener("click", closeModal));
  }

  async function sendForm(form, url, payload, onOk) {
    if (form.dataset.busy) return;
    const btn = $('button[type="submit"]', form);
    const label = btn.innerHTML;
    const oldErr = $(".form-error", form); if (oldErr) oldErr.remove();
    form.dataset.busy = "1";
    btn.disabled = true;
    btn.textContent = "Yuborilmoqda...";
    try {
      await postJSON(url, payload);
      onOk();
    } catch (e) {
      delete form.dataset.busy;
      btn.disabled = false;
      btn.innerHTML = label;
      if (!form.isConnected) { toast(e.userMsg || "Yuborib bo'lmadi. Iltimos, qayta urinib ko'ring"); return; }
      const box = document.createElement("div");
      box.className = "form-error full";
      box.setAttribute("role", "alert");
      box.innerHTML = failHtml(e.userMsg);
      form.insertBefore(box, btn);
    }
  }

  root.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    if (form.id === "login-form") {
      closeModal(); toast("Xush kelibsiz! Tizimga muvaffaqiyatli kirdingiz (demo)");
      return;
    }
    const fd = new FormData(form);
    const val = (k) => str(fd.get(k));
    if (form.id === "request-form") {
      const name = val("name");
      sendForm(form, "/api/requests", {
        name, phone: val("phone"), service: val("service"), people: parseInt(val("people"), 10) || 1,
        date: val("date"), note: val("note"), website: val("website")
      }, () => showSuccess(form, "So'rovingiz qabul qilindi!", `Rahmat, ${esc(name)}! Mutaxassisimiz tez orada siz bilan bog'lanadi.`));
    } else if (form.id === "review-form") {
      // sharh moderatsiyaga yuboriladi — sahifaga darhol qo'shilmaydi
      sendForm(form, "/api/reviews", {
        name: val("name"), city: val("city"), service: val("service"), stars: Number(val("stars")) || 5,
        text: val("text"), website: val("website")
      }, () => showSuccess(form, "Sharhingiz qabul qilindi", "Moderatsiyadan so'ng saytda e'lon qilinadi. Rahmat!"));
    }
  });

  /* ---------- promo popup (sessiyada bir marta, faqat aksiya faol bo'lsa) ---------- */
  if (promoLive && !session.get("umragoo.promo")) {
    setTimeout(() => { if (!root.children.length) { modals.promo(); session.set("umragoo.promo", "1"); } }, 6000);
  }

  /* ---------- Rafiq — aqlli yordamchi ---------- */
  const CH = obj(D.chat);
  const chat = $("#chat"), msgs = $("#chat-msgs");
  if (typeof CH.name === "string") {
    const name = CH.name.trim();
    $("#chat-title").textContent = (name ? name + " · " : "") + "Aqlli yordamchi";
    $("#fab-ai").setAttribute("aria-label", name ? `Aqlli yordamchi ${name}ni ochish` : "Aqlli yordamchini ochish");
  }
  if (typeof CH.greeting === "string") {
    const g = $("#chat-greeting");
    g.textContent = CH.greeting.trim();
    g.hidden = !CH.greeting.trim();
  }
  fill("#chat-quick", CH.quick, (q) => `<button type="button">${esc(q)}</button>`, str);

  $("#fab-ai").addEventListener("click", () => { chat.hidden = !chat.hidden; if (!chat.hidden) $("#chat-input").focus(); });
  $("#chat-close").addEventListener("click", () => (chat.hidden = true));

  // o'zbekcha apostrof variantlari (ʻ ʼ ‘ ’ `) bir xil ko'rinishga keltiriladi
  const norm = (s) => str(s).toLowerCase().replace(/[ʻʼ‘’`´]/g, "'");
  const answers = arr(CH.answers).map((a) => ({
    keys: (Array.isArray(obj(a).keys) ? a.keys : str(obj(a).keys).split(",")).map(norm).filter(Boolean),
    text: str(obj(a).text)
  })).filter((a) => a.keys.length && a.text);

  // javob matnidagi narx belgilari: {umra_min} {umra_max} {mehmonxona_min} {viza_min} {chipta_min} {narx:KOD}
  const TOKENS = { umra_min: ["umrah"], umra_max: ["umrah", true], mehmonxona_min: ["hotels"], viza_min: ["visas"], chipta_min: ["flights"] };
  const priceOf = (x) => (x.price === "" || x.price == null || !isFinite(Number(x.price)) ? null : Number(x.price));
  function priceStat(list, max) {
    const ps = visible(list).map(priceOf).filter((n) => n !== null);
    return ps.length ? fmt(max ? Math.max(...ps) : Math.min(...ps)) : "—";
  }
  function fillTokens(text) {
    return text.replace(/\{(umra_min|umra_max|mehmonxona_min|viza_min|chipta_min)\}|\{narx:([^{}]+)\}/g, (m, key, code) => {
      if (key) return priceStat(D[TOKENS[key][0]], TOKENS[key][1]);
      const c = code.trim().toLowerCase();
      const p = visible(D.umrah).find((x) => str(x.code).toLowerCase() === c);
      const n = p ? priceOf(p) : null;
      return n === null ? "—" : fmt(n);
    });
  }

  function reply(q) {
    const l = norm(q);
    // eng ko'p (uzunroq) kalit so'z mos kelgan javob tanlanadi; teng bo'lsa — ro'yxatdagi birinchisi
    let best = null, bestScore = 0;
    answers.forEach((a) => {
      const score = a.keys.reduce((n, k) => n + (l.includes(k) ? k.length : 0), 0);
      if (score > bestScore) { best = a; bestScore = score; }
    });
    const text = best ? best.text : (str(CH.fallback) || "Savolingiz uchun rahmat! Aniq javob berish uchun mutaxassisimiz bog'lanishi kerak. \"So'rov yuborish\" tugmasi orqali ma'lumot qoldiring.");
    return fillTokens(text);
  }
  function addMsg(text, me) {
    const d = document.createElement("div");
    d.className = "msg " + (me ? "me" : "bot"); d.textContent = text;
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
  }
  function ask(q) {
    if (!q) return;
    addMsg(q, true);
    setTimeout(() => addMsg(reply(q), false), 600);
  }
  $("#chat-form").addEventListener("submit", (e) => { e.preventDefault(); const i = $("#chat-input"); ask(i.value.trim()); i.value = ""; });
  $("#chat-quick").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) ask(b.textContent.trim()); });
})();
