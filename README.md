# Umragoo — Haj va Umra platformasi (sayt shabloni)

go-umrah.com tuzilishi asosida yaratilgan, o'zbek tilidagi statik sayt.
Hech qanday build yoki server kerak emas: `index.html` faylini brauzerda oching.

## Fayllar

| Fayl | Vazifasi |
|---|---|
| `index.html` | Sahifa tuzilishi va barcha matnlar |
| `css/style.css` | Dizayn (teal + gold rang tizimi), moslashuvchan uslublar |
| `js/data.js` | Paketlar, mehmonxonalar, vizalar, reyslar, sharhlar, sanalar — **shu yerda tahrirlang** |
| `js/main.js` | Kartalarni chizish, valyuta, qidiruv, modallar, chat-yordamchi |
| `assets/logo.svg`, `assets/favicon.svg` | Logotip |

## Nimani o'zgartirish kerak

1. **Telefon, pochta, manzil** — hozircha saytda yo'q. Kerak bo'lsa, `index.html` dagi yuqori chiziq (`topbar`) va footerdagi "Biz bilan bog'laning" bo'limiga qo'shing.
2. **Narxlar va dasturlar** — `js/data.js`. Narxlar USD da; `usdToUzs` kursini yangilab turing.
3. **Muhim sanalar** — `js/data.js` → `dates` (Ramazon, Haj, aksiya tugash sanasi).
4. **Rasmlar** — hozir Unsplash havolalari ishlatilgan. O'z rasmlaringizni `assets/` papkasiga qo'yib, `data.js` va `style.css` dagi URL larni almashtiring.
5. **Forma yuborish** — hozir demo (faqat tasdiq xabarini ko'rsatadi, hech qayerga yubormaydi). Haqiqiy backend yoki Telegram-bot ulash uchun `js/main.js` dagi `request-form` bo'limini o'zgartiring.
