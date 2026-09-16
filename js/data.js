/* =====================================================
   UMRAGOO — namunaviy ma'lumotlar
   Haqiqiy narx va dasturlarni shu faylda yangilang.
   Narxlar USD da; UZS ga avtomatik aylantiriladi.
   ===================================================== */
window.UMRAGOO_DATA = {
  usdToUzs: 12700,

  hajj: [
    {
      code: "HAJ-ECO-01", title: "Haj — Ekonom", days: 21, from: "Toshkent", rating: 4.5, seats: 18,
      makkah: "Al Kiswah Towers · 3★", madinah: "Al Madinah Concorde · 3★",
      includes: ["Aviachipta", "Viza", "Mehmonxona", "Transport", "Rahbar"],
      price: 4950, img: "https://images.unsplash.com/photo-1564769625905-50e93615e769?w=800&q=70&auto=format&fit=crop", tag: "Tejamkor"
    },
    {
      code: "HAJ-STD-02", title: "Haj — Standart", days: 25, from: "Toshkent", rating: 4.7, seats: 12,
      makkah: "Elaf Kinda · 4★", madinah: "Dar Al Taqwa · 4★",
      includes: ["Aviachipta", "Viza", "Mehmonxona", "3 mahal ovqat", "Transport", "Rahbar"],
      price: 6400, img: "https://images.unsplash.com/photo-1580418827493-f2b22c0a76cb?w=800&q=70&auto=format&fit=crop", tag: "Mashhur"
    },
    {
      code: "HAJ-PRM-03", title: "Haj — Premium", days: 28, from: "Toshkent", rating: 4.8, seats: 8,
      makkah: "Swissôtel Al Maqam · 5★", madinah: "Anwar Al Madinah Mövenpick · 5★",
      includes: ["Aviachipta", "Viza", "Mehmonxona", "3 mahal ovqat", "VIP transport", "Rahbar"],
      price: 8900, img: "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?w=800&q=70&auto=format&fit=crop", tag: "Premium"
    },
    {
      code: "HAJ-VIP-04", title: "Haj — VIP", days: 30, from: "Toshkent", rating: 4.9, seats: 4,
      makkah: "Raffles Makkah Palace · 5★", madinah: "The Oberoi Madina · 5★",
      includes: ["Biznes klass", "Viza", "Mehmonxona", "3 mahal ovqat", "Shaxsiy transport", "Shaxsiy rahbar"],
      price: 14500, img: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=70&auto=format&fit=crop", tag: "VIP"
    }
  ],

  umrah: [
    {
      code: "UMR-RMZ-01", title: "Ramazon umrasi", days: 10, from: "Toshkent", airline: "Uzbekistan Airways", rating: 4.8, seats: 22,
      makkah: "Al Shohada Hotel · 4★", madinah: "Taiba Front Hotel · 4★",
      includes: ["Aviachipta", "Viza", "Mehmonxona", "Transfer", "Ziyoratlar"],
      price: 1890, img: "https://images.unsplash.com/photo-1580418827493-f2b22c0a76cb?w=800&q=70&auto=format&fit=crop", tag: "Mavsumiy"
    },
    {
      code: "UMR-ECO-02", title: "Tejamkor umra", days: 7, from: "Toshkent", airline: "Flydubai", rating: 4.5, seats: 30,
      makkah: "Al Kiswah Towers · 3★", madinah: "Odst Al Madinah · 3★",
      includes: ["Aviachipta", "Viza", "Mehmonxona", "Transfer"],
      price: 1150, img: "https://images.unsplash.com/photo-1564769625905-50e93615e769?w=800&q=70&auto=format&fit=crop", tag: "Tejamkor"
    },
    {
      code: "UMR-FAM-03", title: "Oilaviy umra", days: 12, from: "Toshkent", airline: "Uzbekistan Airways", rating: 4.9, seats: 10,
      makkah: "Hilton Suites Makkah · 5★", madinah: "Pullman Zamzam Madina · 5★",
      includes: ["Aviachipta", "Viza", "Mehmonxona", "Nonushta", "Transfer", "Ziyoratlar"],
      price: 2650, img: "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?w=800&q=70&auto=format&fit=crop", tag: "Oilaviy"
    },
    {
      code: "UMR-LQ-04", title: "Laylatul Qadr umrasi", days: 14, from: "Toshkent", airline: "Saudia", rating: 4.9, seats: 6,
      makkah: "Swissôtel Makkah · 5★", madinah: "Dar Al Iman InterContinental · 5★",
      includes: ["Aviachipta", "Viza", "Mehmonxona", "3 mahal ovqat", "VIP transfer", "Ziyoratlar"],
      price: 3400, img: "https://images.unsplash.com/photo-1512632578888-169bbbc64f33?w=800&q=70&auto=format&fit=crop", tag: "Premium"
    }
  ],

  hotels: [
    { name: "Swissôtel Al Maqam Makkah", city: "Makka", stars: 5, rating: 4.6, dist: "Haramgacha 150 m", price: 185, img: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=70&auto=format&fit=crop" },
    { name: "Anjum Hotel Makkah", city: "Makka", stars: 4, rating: 4.4, dist: "Haramgacha 500 m", price: 120, img: "https://images.unsplash.com/photo-1455587734955-081b22074882?w=800&q=70&auto=format&fit=crop" },
    { name: "Al Shohada Hotel", city: "Makka", stars: 4, rating: 4.1, dist: "Haramgacha 300 m", price: 95, img: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=70&auto=format&fit=crop" },
    { name: "Novotel Thakher Makkah", city: "Makka", stars: 4, rating: 4.2, dist: "Haramgacha 2.5 km · shuttle", price: 45, img: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=70&auto=format&fit=crop" },
    { name: "Pullman Zamzam Madina", city: "Madina", stars: 5, rating: 4.5, dist: "Masjidun Nabaviygacha 100 m", price: 140, img: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=70&auto=format&fit=crop" },
    { name: "Taiba Front Hotel", city: "Madina", stars: 4, rating: 4.3, dist: "Masjidun Nabaviygacha 150 m", price: 80, img: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=70&auto=format&fit=crop" }
  ],

  visas: [
    { title: "Umra vizasi (Nusuk)", issue: "3 ish kuni", valid: "90 kun", entry: "Bir martalik", price: 160, note: "Umra paketi bilan birga" },
    { title: "Turistik viza (eVisa)", issue: "5–7 ish kuni", valid: "1 yil, ko'p martalik", entry: "Har safar 90 kun", price: 145, note: "Sug'urta bilan birga" },
    { title: "Elektron umra vizasi (shtrix-kod)", issue: "5–7 ish kuni", valid: "90 kun", entry: "Bir martalik", price: 175, note: "Mustaqil sayohat uchun" },
    { title: "Tranzit viza", issue: "1–3 ish kuni", valid: "96 soat", entry: "Bir martalik", price: 40, note: "Saudia / Flynas chiptasi bilan" }
  ],

  flights: [
    { airline: "Uzbekistan Airways", code: "HY", flight: "HY 351", from: "TAS", fromCity: "Toshkent", to: "JED", toCity: "Jidda", dep: "08:40", arr: "12:10", dur: "5 s 30 daq", stops: "To'g'ridan-to'g'ri", price: 520 },
    { airline: "Flydubai", code: "FZ", flight: "FZ 1032 · FZ 665", from: "TAS", fromCity: "Toshkent", to: "MED", toCity: "Madina", dep: "05:30", arr: "13:45", dur: "10 s 15 daq", stops: "1 to'xtash · Dubay", price: 410 },
    { airline: "Qatar Airways", code: "QR", flight: "QR 320 · QR 1176", from: "TAS", fromCity: "Toshkent", to: "JED", toCity: "Jidda", dep: "14:15", arr: "22:30", dur: "11 s 15 daq", stops: "1 to'xtash · Doha", price: 560 }
  ],

  testimonials: [
    { name: "Dilnoza Karimova", place: "Toshkent · Umra paketi", stars: 5, text: "Hammasi juda tartibli va aniq tashkil etilgan edi. Mehmonxona toza, Haramga yaqin, transport qulay. Umragoo jamoasiga katta rahmat!" },
    { name: "Bobur Rahimov", place: "Samarqand · Haj dasturi", stars: 5, text: "Unutilmas tajriba bo'ldi. Xizmat a'lo darajada, rahbarimiz har bir amalni sabr bilan tushuntirib berdi. Barchaga tavsiya qilaman." },
    { name: "Nilufar Yusupova", place: "Buxoro · Oilaviy umra", stars: 5, text: "Har bir tafsilot o'ylangan. Bolalar bilan sayohat qilish qo'rqinchli edi, lekin jamoa hammasini oson qildi. Ziyoratlar ham juda foydali bo'ldi." },
    { name: "Jasur Toshmatov", place: "Farg'ona · Umra vizasi", stars: 5, text: "Bron qilish juda oson, qo'llab-quvvatlash kechayu kunduz ishlaydi. Viza uch kunda tayyor bo'ldi, hech qanday muammosiz." },
    { name: "Malika Abdullayeva", place: "Andijon · Ramazon umrasi", stars: 5, text: "Ishonchli platforma va raqobatbardosh narxlar. Ramazonda umrani xotirjam ado etdim. Alloh rozi bo'lsin!" },
    { name: "Sardor Mirzayev", place: "Namangan · Mehmonxona broni", stars: 4, text: "Mehmonxona aynan rasmda ko'rsatilganidek edi. Faqat kirish vaqtida biroz kutishga to'g'ri keldi, qolgani a'lo." },
    { name: "Gulnora Saidova", place: "Xorazm · Haj dasturi", stars: 5, text: "Onam bilan birga bordik. Keksa yoshdagi odamlarga alohida e'tibor berishdi, hamma joyda yordam berishdi. Chin dildan minnatdorman." },
    { name: "Otabek Qodirov", place: "Qashqadaryo · Tranzit viza", stars: 5, text: "Shoshilinch viza kerak edi — Umragoo bir kunda hal qilib berdi. Juda tez va professional 🫡" }
  ],

  /* Muhim sanalar (Gregorian) — kelgusi yil uchun yangilang */
  dates: {
    ramadan: "2027-02-08",
    hajj: "2027-05-14",
    promoEnd: "2026-10-01"
  }
};
