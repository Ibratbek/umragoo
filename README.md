# Umragoo — Umra platformasi (sayt + admin panel)

go-umrah.com tuzilishi asosida yaratilgan, o'zbek tilidagi sayt va uning admin paneli.
Hech qanday o'rnatish (npm, pip) kerak emas — faqat Python 3.

## Ishga tushirish

| Tizim | Qanday |
|---|---|
| macOS | `start-server.command` faylini ikki marta bosing yoki terminalda `python3 server.py` |
| Windows | `start-server.bat` faylini ikki marta bosing yoki `python server.py` |

- Sayt: http://127.0.0.1:8080/
- Admin panel: http://127.0.0.1:8080/admin/

**Birinchi ishga tushirishda** server konsolda tasodifiy admin parolini chiqaradi — uni yozib oling,
keyin admin paneldagi **Sozlamalar → Parolni o'zgartirish** bo'limida o'zingiznikiga almashtiring.
Parolni unutsangiz: `python3 server.py --password YANGI_PAROL`.

## Admin panelda nimalarni o'zgartirish mumkin

- **Takliflar** — umra paketlari, mehmonxonalar, vizalar, aviachiptalar (qo'shish, tahrirlash, o'chirish, tartibini o'zgartirish, vaqtincha yashirish, rasm yuklash)
- **Sayt matnlari** — bosh qism, statistika, xizmatlar, bo'lim sarlavhalari, poyezd, hamkorlik, mobil ilova, footer
- **Aksiya va sanalar** — promo-kod, aksiya muddati, Ramazon sanasi, dollar kursi
- **Rafiq yordamchi** — salomlashish, tezkor savollar, javoblar
- **Aloqa** — telefon, pochta, manzil, ijtimoiy tarmoqlar
- **SEO** — sahifa sarlavhasi, tavsif, kalit so'zlar
- **So'rovlar** — saytdagi formadan kelgan arizalar (holat, izoh, CSV eksport)
- **Sharhlar** — mijozlar sharhlarini tasdiqlash yoki o'chirish
- **Telegram bildirishnoma** — yangi so'rov kelganda botga xabar
- **Zaxira nusxalar** — har saqlashdan oldin avtomatik nusxa olinadi, istalganini tiklash mumkin

## Fayllar

| Fayl | Vazifasi |
|---|---|
| `index.html` | Sahifa tuzilishi |
| `css/style.css` | Dizayn (teal + gold rang tizimi) |
| `js/data.js` | **Saytdagi barcha ma'lumotlar** — admin panel shu faylni yozadi |
| `js/main.js` | Ma'lumotlarni sahifaga chizish, valyuta, qidiruv, modallar, chat-yordamchi, formalar |
| `server.py` | Sayt + admin API serveri (faqat Python standart kutubxonasi) |
| `admin/` | Admin panel |
| `assets/uploads/` | Admin paneldan yuklangan rasmlar |
| `data/` | **Maxfiy**: parol xeshi, mijozlar so'rovlari, zaxira nusxalar. Git'ga qo'shilmaydi, internetdan ochilmaydi |

## Internetga joylash

Admin panel va formalar ishlashi uchun saytni `server.py` bilan **VPS/serverda** ishga tushiring
(masalan, nginx orqasida HTTPS bilan): `python3 server.py --host 127.0.0.1 --port 8080`,
nginx esa `proxy_pass http://127.0.0.1:8080;` va `proxy_set_header X-Forwarded-Proto $scheme;` bilan.

Faqat statik hosting (GitHub Pages, Netlify va h.k.) ishlatsangiz: sayt ochiladi, lekin admin panel va
formalar ishlamaydi. Bunday holda o'zgarishlarni kompyuteringizda admin panel orqali qiling va
yangilangan `js/data.js` hamda `assets/uploads/` ni hostingga yuklang.
