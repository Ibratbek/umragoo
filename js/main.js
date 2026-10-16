/* =====================================================
   UMRAGOO — interaktivlik va render
   ===================================================== */
(function () {
  "use strict";
  const D = window.UMRAGOO_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- valyuta ---------- */
  let currency = localStorage.getItem("umragoo.cur") || "USD";
  const fmt = (usd) => {
    if (currency === "UZS") return Math.round(usd * D.usdToUzs).toLocaleString("ru-RU").replace(/,/g, " ") + " so'm";
    return "$" + usd.toLocaleString("en-US");
  };
  const ico = (id) => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;
  const starsTxt = (n) => "★".repeat(n) + "☆".repeat(5 - n);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- kartalarni render qilish ---------- */
  function packageCard(p, kind) {
    return `
    <article class="card" data-search="${esc(p.title + " " + p.code + " " + p.makkah + " " + p.madinah)}">
      <div class="media">
        <img src="${p.img}" alt="${esc(p.title)}" loading="lazy">
        <div class="badges"><span class="badge badge-gold">${esc(p.tag)}</span></div>
        <span class="rating">${ico("i-star")}${p.rating}</span>
        <span class="code">${esc(p.code)}</span>
      </div>
      <div class="body">
        <h3>${esc(p.title)}</h3>
        <div class="meta">
          <span>${ico("i-calendar")}${p.days} kun</span>
          <span>${ico("i-plane")}${esc(p.from)}${p.airline ? " · " + esc(p.airline) : ""}</span>
        </div>
        <div class="hotel-lines">
          <span>${ico("i-bed")}<b>Makka:</b>&nbsp;${esc(p.makkah)}</span>
          <span>${ico("i-bed")}<b>Madina:</b>&nbsp;${esc(p.madinah)}</span>
        </div>
        <div class="includes">${p.includes.map((i) => `<span>✓ ${esc(i)}</span>`).join("")}</div>
        <div class="foot">
          <div class="price"><small>Narx boshlanadi</small><b>${fmt(p.price)}</b> <i>/ kishi</i>${p.seats <= 10 ? `<div style="margin-top:4px"><span class="seats">Faqat ${p.seats} o'rin qoldi</span></div>` : ""}</div>
          <button class="btn btn-primary btn-sm" data-open="request" data-service="${esc(kind + ": " + p.title + " (" + p.code + ")")}">Band qilish</button>
        </div>
      </div>
    </article>`;
  }

  function hotelCard(h) {
    return `
    <article class="card" data-search="${esc(h.name + " " + h.city)}">
      <div class="media">
        <img src="${h.img}" alt="${esc(h.name)}" loading="lazy">
        <div class="badges"><span class="badge badge-teal">${esc(h.city)}</span></div>
        <span class="rating">${ico("i-star")}${h.rating}</span>
      </div>
      <div class="body">
        <div class="stars">${starsTxt(h.stars)}</div>
        <h3>${esc(h.name)}</h3>
        <span class="dist">${ico("i-pin")}${esc(h.dist)}</span>
        <div class="meta"><span>${ico("i-check-circle")}Bepul bekor qilish</span><span>${ico("i-check-circle")}Nonushta</span></div>
        <div class="foot">
          <div class="price"><small>Bir kecha</small><b>${fmt(h.price)}</b> <i>/ xona</i></div>
          <button class="btn btn-primary btn-sm" data-open="request" data-service="${esc("Mehmonxona: " + h.name)}">Bron qilish</button>
        </div>
      </div>
    </article>`;
  }

  function visaCard(v) {
    return `
    <article class="visa-card" data-search="${esc(v.title)}">
      <span class="ic">${ico("i-file")}</span>
      <h3>${esc(v.title)}</h3>
      <ul>
        <li>${ico("i-clock")}Rasmiylashtirish: <b>&nbsp;${esc(v.issue)}</b></li>
        <li>${ico("i-calendar")}Amal qilish: <b>&nbsp;${esc(v.valid)}</b></li>
        <li>${ico("i-check-circle")}${esc(v.entry)}</li>
        <li>${ico("i-sparkles")}${esc(v.note)}</li>
      </ul>
      <div class="foot">
        <div class="price"><b>${fmt(v.price)}</b> <i>/ kishi</i></div>
        <button class="btn btn-outline btn-sm" data-open="request" data-service="${esc("Viza: " + v.title)}">Ariza berish</button>
      </div>
    </article>`;
  }

  function flightRow(f) {
    return `
    <div class="flight" data-search="${esc(f.airline + " " + f.fromCity + " " + f.toCity)}">
      <div class="airline"><span class="lg">${esc(f.code)}</span><div>${esc(f.airline)}<small>${esc(f.flight)}</small></div></div>
      <div class="route">
        <div><b>${f.dep}</b><small>${esc(f.from)} · ${esc(f.fromCity)}</small></div>
        <div class="line">${ico("i-plane")}<span>${esc(f.dur)} · ${esc(f.stops)}</span></div>
        <div><b>${f.arr}</b><small>${esc(f.to)} · ${esc(f.toCity)}</small></div>
      </div>
      <div class="price"><small>Borish-kelish, dan</small><b>${fmt(f.price)}</b></div>
      <button class="btn btn-primary btn-sm" data-open="request" data-service="${esc("Aviachipta: " + f.airline + " " + f.from + "→" + f.to)}">Tanlash</button>
    </div>`;
  }

  function testimonialCard(t) {
    const initials = t.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    return `
    <article class="t-card">
      <div class="q">“</div>
      <p>${esc(t.text)}</p>
      <div class="who">
        <span class="av">${initials}</span>
        <div><b>${esc(t.name)}</b><span>${esc(t.place)}</span></div>
        <span class="stars">${starsTxt(t.stars)}</span>
      </div>
    </article>`;
  }

  function renderAll() {
    $("#hajj-grid").innerHTML = D.hajj.map((p) => packageCard(p, "Haj")).join("");
    $("#umrah-grid").innerHTML = D.umrah.map((p) => packageCard(p, "Umra")).join("");
    $("#hotels-grid").innerHTML = D.hotels.map(hotelCard).join("");
    $("#visa-grid").innerHTML = D.visas.map(visaCard).join("");
    $("#flights-list").innerHTML = D.flights.length
      ? D.flights.map(flightRow).join("")
      : `<div class="empty-state">Hozircha aviachipta takliflari mavjud emas.</div>`;
    const tt = $("#t-track");
    tt.innerHTML = D.testimonials.concat(D.testimonials).map(testimonialCard).join("");
    $("#review-count").textContent = D.testimonials.length * 47;
  }
  renderAll();

  /* ---------- valyuta almashtirgich ---------- */
  $$("#cur-select button").forEach((b) => {
    b.classList.toggle("active", b.dataset.cur === currency);
    b.addEventListener("click", () => {
      currency = b.dataset.cur;
      localStorage.setItem("umragoo.cur", currency);
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
    const daysTo = (iso) => Math.max(0, Math.ceil((new Date(iso + "T00:00:00") - new Date()) / 864e5));
    $("#cd-ramadan").textContent = daysTo(D.dates.ramadan);
    $("#cd-hajj").textContent = daysTo(D.dates.hajj);
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
    const target = cat !== "all" ? $("#" + cat) : (first ? first.closest("section") : $("#haj"));
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
          <label class="f">Ismingiz *<input name="name" required placeholder="Abdulloh Karimov"></label>
          <label class="f">Telefon *<input name="phone" type="tel" required placeholder="+998 90 000 00 00"></label>
          <label class="f full">Xizmat turi<select name="service">
            ${["Umra paketi", "Haj dasturi", "Mehmonxona", "Viza", "Aviachipta", "Transport", "Haramayn poyezdi", "Moslashuvchan dastur", "Hamkorlik", "Boshqa"].map((s) => `<option${service && service.startsWith(s.split(" ")[0]) ? " selected" : ""}>${s}</option>`).join("")}
          </select></label>
          <label class="f">Kishilar soni<input name="people" type="number" min="1" value="1"></label>
          <label class="f">Taxminiy sana<input name="date" type="date"></label>
          <label class="f full">Izoh / istaklaringiz<textarea name="note" rows="3" placeholder="Byudjet, mehmonxona darajasi, maxsus talablar...">${service ? esc(service) : ""}</textarea></label>
          <button class="btn btn-primary btn-block full" type="submit">${ico("i-send")}So'rovni yuborish</button>
        </form>
        <p class="form-note">Yuborish orqali siz <a href="#" data-toast="Sahifa tayyorlanmoqda" style="color:var(--teal-600)">maxfiylik siyosati</a>ga rozilik bildirasiz. Ma'lumotlaringiz himoyalangan.</p>
      </div>`),

    review: () => openModal(`
      <div class="m-head">${closeBtn}<h3>Tajribangiz bilan bo'lishing</h3><p>Sharhingiz moderatsiyadan so'ng saytda ko'rinadi</p></div>
      <div class="m-body">
        <form id="review-form" class="form-grid">
          <label class="f">Ismingiz *<input name="name" required></label>
          <label class="f">Xizmat turi<input name="service" placeholder="Haj / Umra / Mehmonxona ..."></label>
          <label class="f full">Bahoyingiz<select name="stars"><option value="5">★★★★★ — A'lo</option><option value="4">★★★★☆ — Yaxshi</option><option value="3">★★★☆☆ — O'rtacha</option><option value="2">★★☆☆☆ — Yomon</option><option value="1">★☆☆☆☆ — Juda yomon</option></select></label>
          <label class="f full">Sharhingiz *<textarea name="text" rows="4" required placeholder="Fikringizni samimiy yozing..."></textarea></label>
          <button class="btn btn-primary btn-block full" type="submit">Sharhni yuborish</button>
        </form>
      </div>`),

    promo: () => {
      openModal(`
        <div class="m-head">${closeBtn}<span class="badge" style="background:#0000001a;color:var(--teal-950)">${ico("i-gift")}&nbsp;Sovg'alar va aksiyalar</span><h3 style="margin-top:8px">Erta bron — 10% chegirma!</h3><p>Ramazon umrasi paketlariga muddat tugagunga qadar</p></div>
        <div class="m-body">
          <h4>Bu yil umraga borishni rejalashtiryapsizmi? 🕋</h4>
          <p style="color:var(--muted-fg)">Aksiya muddati tugashiga qoldi:</p>
          <div class="cd" id="promo-cd"><div><b>--</b><span>kun</span></div><div><b>--</b><span>soat</span></div><div><b>--</b><span>daq</span></div><div><b>--</b><span>son</span></div></div>
          <button class="btn btn-primary btn-block" id="promo-go">Umra paketlarini ko'rish</button>
          <p class="form-note">Promo-kod: <b style="color:var(--teal-700)">UMRAGOO10</b> — so'rov yuborayotganda izohga yozing</p>
        </div>`, "promo");
      $("#promo-go").addEventListener("click", () => { closeModal(); $("#umra").scrollIntoView({ behavior: "smooth" }); });
      const end = new Date(D.dates.promoEnd + "T00:00:00");
      const tick = () => {
        const box = $("#promo-cd"); if (!box) return;
        let s = Math.max(0, Math.floor((end - Date.now()) / 1000));
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

  /* ---------- forma yuborish (demo) ---------- */
  root.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = e.target.id;
    const modal = $(".modal", root);
    if (id === "login-form") {
      closeModal(); toast("Xush kelibsiz! Tizimga muvaffaqiyatli kirdingiz (demo)");
    } else if (id === "request-form") {
      const fd = new FormData(e.target);
      modal.innerHTML = successHtml("So'rovingiz qabul qilindi!", `Rahmat, ${esc(fd.get("name"))}! Mutaxassisimiz tez orada siz bilan bog'lanadi.`);
      $$("[data-close]", root).forEach((b) => b.addEventListener("click", closeModal));
    } else if (id === "review-form") {
      const fd = new FormData(e.target);
      D.testimonials.unshift({ name: fd.get("name"), place: (fd.get("service") || "Umragoo xizmatlari") + " · yangi", stars: Number(fd.get("stars")), text: fd.get("text") });
      renderAll();
      modal.innerHTML = successHtml("Sharhingiz qabul qilindi", "Moderatsiyadan so'ng saytda e'lon qilinadi. Rahmat!");
      $$("[data-close]", root).forEach((b) => b.addEventListener("click", closeModal));
    }
  });

  /* ---------- promo popup (sessiyada bir marta) ---------- */
  if (!sessionStorage.getItem("umragoo.promo")) {
    setTimeout(() => { if (!root.children.length) { modals.promo(); sessionStorage.setItem("umragoo.promo", "1"); } }, 6000);
  }

  /* ---------- Rafiq — aqlli yordamchi (demo) ---------- */
  const chat = $("#chat"), msgs = $("#chat-msgs");
  $("#fab-ai").addEventListener("click", () => { chat.hidden = !chat.hidden; if (!chat.hidden) $("#chat-input").focus(); });
  $("#chat-close").addEventListener("click", () => (chat.hidden = true));
  const answers = [
    { k: ["umra", "narx", "paket"], a: `Umra paketlarimiz ${fmt(1150)} dan boshlanadi (7 kun, aviachipta + viza + mehmonxona). Ramazon umrasi ${fmt(1890)}, oilaviy paket ${fmt(2650)}. Batafsil "Umra" bo'limida ko'rishingiz mumkin.` },
    { k: ["viza", "vaqt", "muddat"], a: "Umra vizasi (Nusuk) odatda 3 ish kunida, turistik eVisa esa 5–7 ish kunida tayyor bo'ladi. Pasport kamida 6 oy amal qilishi kerak." },
    { k: ["haj"], a: `Haj dasturlari ${fmt(4950)} dan (Ekonom, 21 kun) ${fmt(14500)} gacha (VIP, 30 kun). O'rinlar cheklangan — erta bron qilishni tavsiya qilamiz.` },
    { k: ["operator", "odam", "bog'lan", "telefon"], a: "Albatta! \"So'rov yuborish\" tugmasi orqali ma'lumot qoldiring — operatorimiz siz bilan bog'lanadi. Ish vaqti 09:00–21:00." },
    { k: ["mehmonxona", "otel", "hotel"], a: `Makka va Madinada Haramga 100–500 m masofadagi 3–5 yulduzli mehmonxonalar bor. Narxlar bir kecha uchun ${fmt(45)} dan boshlanadi.` },
    { k: ["poyezd", "train"], a: "Haramayn tezyurar poyezdi Makka–Madina yo'nalishida 2 soat 20 daqiqada yetib boradi. Chiptani biz orqali bron qilishingiz mumkin." },
    { k: ["salom", "assalom"], a: "Va alaykum assalom! Sizga qanday yordam bera olaman? 😊" },
    { k: ["rahmat"], a: "Arzimaydi! Safaringiz qabul bo'lsin. Yana savollar bo'lsa, shu yerdaman 🤲" }
  ];
  function reply(q) {
    const l = q.toLowerCase();
    const hit = answers.find((x) => x.k.some((k) => l.includes(k)));
    return hit ? hit.a : "Savolingiz uchun rahmat! Aniq javob berish uchun mutaxassisimiz bog'lanishi kerak. \"So'rov yuborish\" tugmasi orqali ma'lumot qoldiring.";
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
  $$("#chat-quick button").forEach((b) => b.addEventListener("click", () => ask(b.textContent)));
})();
