#!/usr/bin/env python3
"""
UMRAGOO — lokal server va admin panel API (faqat Python 3 standart kutubxonasi)

    python3 server.py [--host 127.0.0.1] [--port 8080]
    python3 server.py --password YANGI_PAROL      # admin parolini o'rnatish

Sayt fayllari loyiha papkasidan beriladi, /api/ ostida JSON API ishlaydi.
Maxfiy ma'lumotlar (parol xeshi, so'rovlar, sharhlar, zaxira nusxalar)
data/ papkasida saqlanadi va HTTP orqali hech qachon berilmaydi.
"""

import argparse
import base64
import binascii
import hashlib
import hmac
import json
import math
import os
import re
import secrets
import socket
import ssl
import sys
import threading
import time
import traceback
import urllib.error
import urllib.request
from collections import deque
from datetime import datetime
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

# ---------- yo'llar va sozlamalar ----------
ROOT = os.path.dirname(os.path.abspath(__file__))
SEED_DATA_JS = os.path.join(ROOT, "js", "data.js")
# Hostingda (masalan Render diski) o'zgaruvchan ma'lumotlar alohida doimiy papkada turadi:
# UMRAGOO_STORAGE=/var/data -> data.js, private/ (parol, so'rovlar, zaxira) va uploads/ shu yerda.
# Birinchi ishga tushishda data.js loyihadagi js/data.js dan nusxalanadi.
STORAGE = os.environ.get("UMRAGOO_STORAGE", "").strip()
if STORAGE:
    DATA_JS = os.path.join(STORAGE, "data.js")
    DATA_DIR = os.path.join(STORAGE, "private")
    UPLOAD_DIR = os.path.join(STORAGE, "uploads")
else:
    DATA_JS = SEED_DATA_JS
    DATA_DIR = os.path.join(ROOT, "data")
    UPLOAD_DIR = os.path.join(ROOT, "assets", "uploads")
# Reverse proxy (Render, Cloudflare) ortida mijozning haqiqiy IP manzilini sarlavhalardan olish
TRUST_PROXY = os.environ.get("UMRAGOO_TRUST_PROXY", "").strip() not in ("", "0")
CONFIG_FILE = os.path.join(DATA_DIR, "config.json")
REQUESTS_FILE = os.path.join(DATA_DIR, "requests.json")
REVIEWS_FILE = os.path.join(DATA_DIR, "reviews.json")
BACKUP_DIR = os.path.join(DATA_DIR, "backups")

MARKER = "window.UMRAGOO_DATA ="
DATA_JS_HEADER = """/* =====================================================
   UMRAGOO — sayt ma'lumotlari
   Bu fayl admin panel (/admin) tomonidan avtomatik yaratiladi —
   ma'lumotlarni o'sha yerdan tahrirlang. Qo'lda tahrirlasangiz,
   fayl to'g'ri JSON bo'lib qolsin (kalitlar qo'shtirnoqda,
   oxirgi elementdan keyin vergul yo'q).
   Narxlar USD da; UZS ga avtomatik aylantiriladi.
   ===================================================== */
"""
LIST_KEYS = ("umrah", "hotels", "visas", "flights", "testimonials", "services")
REQUEST_STATUSES = ("new", "progress", "done", "cancelled")

COOKIE = "umragoo_session"
SESSION_TTL = 7 * 24 * 3600
PBKDF2_ITERS = 200_000
MAX_BODY = 8 * 1024 * 1024
MAX_IMAGE = 5 * 1024 * 1024
KEEP_BACKUPS = 50

BACKUP_RE = re.compile(r"data-[0-9-]+\.js")
TOKEN_RE = re.compile(r"[0-9]+:[A-Za-z0-9_-]+")
DATA_URL_RE = re.compile(r"data:([\w.+/-]+);base64,(.*)", re.S)
IMAGE_TYPES = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif"}
BLOCKED_EXT = (".py", ".pyc", ".bat", ".command", ".sh", ".tmp")

FILE_LOCK = threading.Lock()  # barcha fayl yozuvlari shu qulf ostida bajariladi


class ApiError(Exception):
    """Mijozga {"error": ...} ko'rinishida qaytariladigan xato."""

    def __init__(self, status, message):
        super().__init__(message)
        self.status, self.message = status, message


def now_iso():
    return datetime.now().strftime("%Y-%m-%dT%H:%M:%S")


# ---------- fayllar ----------
def write_atomic(path, content):
    """Avval .tmp faylga yozadi, keyin os.replace bilan almashtiradi (FILE_LOCK ostida chaqiring)."""
    if isinstance(content, str):
        content = content.encode("utf-8")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    try:
        with open(tmp, "wb") as f:
            f.write(content)
            f.flush()
            os.fsync(f.fileno())
        for attempt in range(20):
            try:
                os.replace(tmp, path)
                break
            except PermissionError:  # Windows: fayl shu payt brauzerga berilayotgan bo'lsa, biroz kutamiz
                if attempt == 19:
                    raise
                time.sleep(0.05)
    except BaseException:
        try:
            os.remove(tmp)
        except OSError:
            pass
        raise


def read_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default
    except ValueError:
        raise ApiError(500, f"{os.path.relpath(path, ROOT)} fayli buzilgan — uni qo'lda tekshiring")


def write_json(path, value):
    write_atomic(path, json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def load_list(path):
    items = read_json(path, [])
    if not isinstance(items, list):
        raise ApiError(500, f"{os.path.relpath(path, ROOT)} fayli ro'yxat emas")
    return items


def find_item(items, item_id, not_found):
    for item in items:
        if isinstance(item, dict) and item.get("id") == item_id:
            return item
    raise ApiError(404, not_found)


# ---------- js/data.js ----------
def parse_site(text):
    pos = text.find(MARKER)
    if pos < 0:
        raise ValueError("'window.UMRAGOO_DATA =' topilmadi")
    body = text[pos + len(MARKER):].rstrip()
    if body.endswith(";"):
        body = body[:-1]
    data = json.loads(body)
    if not isinstance(data, dict):
        raise ValueError("ma'lumotlar obyekt emas")
    return data


def load_site():
    try:
        with open(DATA_JS, encoding="utf-8") as f:
            return parse_site(f.read())
    except (OSError, ValueError) as e:
        raise ApiError(500, f"js/data.js faylini o'qib bo'lmadi: {e}")


def site_rev():
    return str(os.stat(DATA_JS).st_mtime_ns)


def validate_site(data):
    """Xato matnini qaytaradi, hammasi joyida bo'lsa None."""
    if not isinstance(data, dict):
        return "Ma'lumotlar obyekt ko'rinishida bo'lishi kerak"
    for key in LIST_KEYS:
        if not isinstance(data.get(key), list):
            return f"\"{key}\" ro'yxat bo'lishi kerak"
    settings = data.get("settings")
    rate = settings.get("usdToUzs") if isinstance(settings, dict) else None
    if isinstance(rate, bool) or not isinstance(rate, (int, float)) or not math.isfinite(rate) or rate <= 0:
        return "Dollar kursi (settings.usdToUzs) musbat son bo'lishi kerak"
    return None


def list_backups():
    """Zaxira nusxalar nomlari, eng yangisi birinchi."""
    if not os.path.isdir(BACKUP_DIR):
        return []
    return sorted((n for n in os.listdir(BACKUP_DIR) if BACKUP_RE.fullmatch(n)), reverse=True)


def backup_site():
    """Joriy js/data.js ni data/backups/ ga nusxalaydi va faqat eng yangi 50 tasini qoldiradi."""
    if not os.path.exists(DATA_JS):
        return
    with open(DATA_JS, "rb") as f:
        content = f.read()
    while True:
        path = os.path.join(BACKUP_DIR, datetime.now().strftime("data-%Y%m%d-%H%M%S-%f.js"))
        if not os.path.exists(path):
            break
        time.sleep(0.001)
    write_atomic(path, content)
    for old in list_backups()[KEEP_BACKUPS:]:
        os.remove(os.path.join(BACKUP_DIR, old))


def save_site(data):
    """js/data.js ni qayta yozadi (avval zaxira nusxa oladi) va yangi rev qaytaradi."""
    old_rev = site_rev() if os.path.exists(DATA_JS) else None
    backup_site()
    body = json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False)
    write_atomic(DATA_JS, DATA_JS_HEADER + MARKER + " " + body + ";\n")
    rev = site_rev()
    if rev == old_rev:  # juda tez ketma-ket saqlansa ham rev albatta o'zgarsin
        os.utime(DATA_JS, ns=(time.time_ns(), int(old_rev) + 1))
        rev = site_rev()
    return rev


# ---------- parol va sozlamalar ----------
def hash_password(password):
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8", "surrogatepass"), salt, PBKDF2_ITERS)
    return f"pbkdf2_sha256${PBKDF2_ITERS}${salt.hex()}${digest.hex()}"


def check_password(password, stored):
    try:
        algo, iters, salt, digest = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        calc = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8", "surrogatepass"),
                                   bytes.fromhex(salt), int(iters))
        return hmac.compare_digest(calc, bytes.fromhex(digest))
    except (AttributeError, TypeError, ValueError):
        return False


def load_config():
    cfg = read_json(CONFIG_FILE, {})
    if not isinstance(cfg, dict):
        cfg = {}
    tg = cfg.get("telegram") if isinstance(cfg.get("telegram"), dict) else {}
    cfg["telegram"] = {"token": str(tg.get("token") or ""), "chat_id": str(tg.get("chat_id") or "")}
    return cfg


def set_password(password):
    with FILE_LOCK:
        cfg = load_config()
        cfg["password_hash"] = hash_password(password)
        write_json(CONFIG_FILE, cfg)


# ---------- sessiyalar ----------
SESSIONS = {}  # token -> tugash vaqti (time.time())
SESSIONS_LOCK = threading.Lock()


def session_create():
    token = secrets.token_urlsafe(32)
    now = time.time()
    with SESSIONS_LOCK:
        for t, expires in list(SESSIONS.items()):
            if expires <= now:
                del SESSIONS[t]
        SESSIONS[token] = now + SESSION_TTL
    return token


def session_valid(token):
    if not token:
        return False
    with SESSIONS_LOCK:
        expires = SESSIONS.get(token)
        if expires is not None and expires <= time.time():
            del SESSIONS[token]
            expires = None
        return expires is not None


def session_drop(token, keep_only=False):
    """keep_only=True bo'lsa shu tokendan boshqa barcha sessiyalarni o'chiradi."""
    with SESSIONS_LOCK:
        if keep_only:
            for t in [t for t in SESSIONS if t != token]:
                del SESSIONS[t]
        else:
            SESSIONS.pop(token, None)


# ---------- urinishlar cheklovi ----------
class RateLimit:
    """IP bo'yicha vaqt oynasi ichidagi urinishlarni sanaydi."""

    def __init__(self, limit, window):
        self.limit, self.window = limit, window
        self.hits = {}
        self.lock = threading.Lock()

    def allow(self, ip):
        """Chegaradan oshmagan bo'lsa urinishni yozib, True qaytaradi."""
        now = time.time()
        with self.lock:
            if len(self.hits) > 10_000:  # eskirgan yozuvlarni tozalash
                for key in [k for k, q in self.hits.items() if not q or q[-1] <= now - self.window]:
                    del self.hits[key]
            q = self.hits.setdefault(ip, deque())
            while q and q[0] <= now - self.window:
                q.popleft()
            if len(q) >= self.limit:
                return False
            q.append(now)
            return True

    def reset(self, ip):
        with self.lock:
            self.hits.pop(ip, None)


LOGIN_LIMIT = RateLimit(5, 10 * 60)
REQUEST_LIMIT = RateLimit(20, 3600)
REVIEW_LIMIT = RateLimit(20, 3600)


# ---------- Telegram ----------
def ssl_context():
    """python.org macOS buildida sertifikatlar o'rnatilmagan bo'lishi mumkin — tizim to'plamidan olamiz."""
    ctx = ssl.create_default_context()
    if not ctx.cert_store_stats().get("x509_ca") and os.path.exists("/etc/ssl/cert.pem"):
        ctx.load_verify_locations("/etc/ssl/cert.pem")
    return ctx


def telegram_send(text, token, chat_id):
    """Xabar yuboradi. Muvaffaqiyatli bo'lsa None, aks holda xato sababini qaytaradi."""
    if not token or not chat_id:
        return "bot token yoki chat ID kiritilmagan"
    payload = json.dumps({"chat_id": chat_id, "text": text, "disable_web_page_preview": True}).encode("utf-8")
    req = urllib.request.Request(f"https://api.telegram.org/bot{token}/sendMessage", data=payload,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10, context=ssl_context()) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        return None if result.get("ok") else (result.get("description") or "noma'lum xato")
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode("utf-8")).get("description") or f"HTTP {e.code}"
        except Exception:
            return f"HTTP {e.code}"
    except Exception as e:  # tarmoq xatosi, timeout va h.k.
        return str(getattr(e, "reason", None) or e) or type(e).__name__


def notify(text):
    """Telegram sozlangan bo'lsa xabarni fon oqimida yuboradi; xato faqat logga yoziladi."""
    try:
        tg = load_config()["telegram"]
    except ApiError as e:
        print(f"[telegram] {e.message}", file=sys.stderr)
        return
    if not tg["token"] or not tg["chat_id"]:
        return

    def run():
        err = telegram_send(text, tg["token"], tg["chat_id"])
        if err:
            print(f"[telegram] xabar yuborilmadi: {err}", file=sys.stderr)

    threading.Thread(target=run, daemon=True).start()


def show(value):
    return str(value) if value not in ("", None) else "—"


# ---------- so'rov maydonlarini tekshirish ----------
def text_field(body, key, max_len, label, min_len=0):
    value = body.get(key)
    if value is None:
        value = ""
    elif isinstance(value, (int, float)) and not isinstance(value, bool):
        value = str(value)
    if not isinstance(value, str):
        raise ApiError(400, f"{label} matn bo'lishi kerak")
    value = value.strip()
    if len(value) < min_len:
        raise ApiError(400, f"{label} kiritilmagan" if not value else f"{label} kamida {min_len} belgidan iborat bo'lsin")
    if len(value) > max_len:
        raise ApiError(400, f"{label} {max_len} belgidan oshmasligi kerak")
    return value


def int_field(body, key, lo, hi, label, default=None):
    value = body.get(key)
    if default is not None and (value is None or value == ""):
        return default
    if isinstance(value, str) and re.fullmatch(r"\s*[0-9]{1,6}\s*", value):
        value = int(value)
    elif isinstance(value, float) and value.is_integer():
        value = int(value)
    if isinstance(value, bool) or not isinstance(value, int) or not lo <= value <= hi:
        raise ApiError(400, f"{label} {lo} dan {hi} gacha bo'lishi kerak")
    return value


def sniff_image(raw):
    """Fayl boshidagi "sehrli baytlar" bo'yicha rasm turini aniqlaydi."""
    if raw.startswith(b"\x89PNG"):
        return "image/png"
    if raw.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if raw.startswith(b"GIF8"):
        return "image/gif"
    if raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return "image/webp"
    return None


def is_private(path):
    """Brauzerga berilmaydigan yo'llar: yashirin fayllar, data/ papkasi, server va skript fayllari."""
    parts = [p for p in path.replace("\\", "/").split("/") if p]
    if any(p.startswith(".") or ":" in p or "\x00" in p for p in parts):
        return True
    clean = [p.rstrip(" .").lower() for p in parts]
    if clean and clean[0] == "data":
        return True
    return bool(clean) and clean[-1].endswith(BLOCKED_EXT)


# ---------- API marshrutlari ----------
ROUTES = [(method, re.compile(pattern), name, auth) for method, pattern, name, auth in [
    ("POST", r"/api/login", "login", False),
    ("POST", r"/api/logout", "logout", False),
    ("GET", r"/api/me", "me", False),
    ("POST", r"/api/requests", "request_create", False),
    ("POST", r"/api/reviews", "review_create", False),
    ("GET", r"/api/site", "site_get", True),
    ("PUT", r"/api/site", "site_put", True),
    ("POST", r"/api/upload", "upload", True),
    ("GET", r"/api/requests", "requests_list", True),
    ("PATCH", r"/api/requests/([\w-]+)", "request_update", True),
    ("DELETE", r"/api/requests/([\w-]+)", "request_delete", True),
    ("GET", r"/api/reviews", "reviews_list", True),
    ("POST", r"/api/reviews/([\w-]+)/approve", "review_approve", True),
    ("DELETE", r"/api/reviews/([\w-]+)", "review_delete", True),
    ("GET", r"/api/backups", "backups_list", True),
    ("POST", r"/api/backups/([^/]+)/restore", "backup_restore", True),
    ("GET", r"/api/settings", "settings_get", True),
    ("PUT", r"/api/settings", "settings_put", True),
    ("POST", r"/api/settings/test", "settings_test", True),
    ("POST", r"/api/password", "password", True),
]]


# ---------- HTTP ----------
class Handler(SimpleHTTPRequestHandler):
    server_version = "Umragoo"
    timeout = 60
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
    }

    # ----- yordamchilar -----
    def version_string(self):
        return self.server_version  # Python versiyasini oshkor qilmaymiz

    def clean_path(self):
        """So'rov yo'li (query va # siz, URL-dekodlangan)."""
        return unquote(getattr(self, "path", "").split("?", 1)[0].split("#", 1)[0])

    def is_api(self):
        path = self.clean_path()
        return path == "/api" or path.startswith("/api/")

    def end_headers(self):
        path = self.clean_path().lower()
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        if path in ("/admin", "/api") or path.startswith(("/admin/", "/api/")):
            self.send_header("X-Frame-Options", "DENY")
            self.send_header("Cache-Control", "no-store")
        elif path == "/js/data.js":
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def client_ip(self):
        ip = self.client_address[0]
        if TRUST_PROXY:  # hosting proxy'si ortida: Cloudflare/Render sarlavhalari
            for name in ("CF-Connecting-IP", "True-Client-IP", "X-Real-IP"):
                value = (self.headers.get(name) or "").strip()
                if value:
                    return value
            forwarded = (self.headers.get("X-Forwarded-For") or "").split(",")[0].strip()
            return forwarded or ip
        if ip in ("127.0.0.1", "::1"):  # shu kompyuterdagi reverse proxy orqali kelgan
            real = (self.headers.get("X-Real-IP") or "").strip()
            forwarded = (self.headers.get("X-Forwarded-For") or "").split(",")[-1].strip()
            return real or forwarded or ip
        return ip

    def session_token(self):
        for part in (self.headers.get("Cookie") or "").split(";"):
            name, _, value = part.strip().partition("=")
            if name == COOKIE:
                return value.strip()
        return None

    def make_cookie(self, token, max_age):
        cookie = f"{COOKIE}={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age={max_age}"
        if (self.headers.get("X-Forwarded-Proto") or "").strip().lower() == "https":
            cookie += "; Secure"
        return cookie

    def send_json(self, status, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        if self._cookie:
            self.send_header("Set-Cookie", self._cookie)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def read_body(self):
        """So'rov tanasini o'qiydi: Content-Length bo'lishi shart, 8 MB gacha."""
        length = self.headers.get("Content-Length")
        if length is None:
            return
        try:
            size = int(length)
        except ValueError:
            raise ApiError(400, "Content-Length noto'g'ri")
        if size < 0:
            raise ApiError(400, "Content-Length noto'g'ri")
        if size > MAX_BODY:
            raise ApiError(413, "So'rov juda katta (ko'pi bilan 8 MB)")
        self._raw = self.rfile.read(size) if size else b""

    def json_body(self):
        if self._raw is None:
            raise ApiError(411, "Content-Length sarlavhasi kerak")
        try:
            data = json.loads(self._raw.decode("utf-8"), parse_constant=_reject_constant)
        except (UnicodeDecodeError, ValueError, RecursionError):
            raise ApiError(400, "So'rov JSON formatida emas")
        if not isinstance(data, dict):
            raise ApiError(400, "So'rov JSON obyekt bo'lishi kerak")
        return data

    # ----- statik fayllar -----
    def send_head(self):
        path = self.clean_path()
        if is_private(path):
            self.send_error(404)
            return None
        if path == "/admin":
            self.send_response(301)
            self.send_header("Location", "/admin/")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return None
        if path.lower() == "/js/data.js":
            del self.headers["If-Modified-Since"]  # saqlangandan keyin doim yangi nusxa berilsin
        return super().send_head()

    def translate_path(self, path):
        if STORAGE:  # data.js va yuklangan rasmlar doimiy papkadan beriladi
            clean = self.clean_path()
            if clean.lower() == "/js/data.js":
                return DATA_JS
            if clean.startswith("/assets/uploads/"):
                name = clean[len("/assets/uploads/"):]
                if name and not name.startswith(".") and "/" not in name and "\\" not in name:
                    candidate = os.path.join(UPLOAD_DIR, name)
                    if os.path.isfile(candidate):
                        return candidate
        return super().translate_path(path)

    def list_directory(self, path):
        self.send_error(404)  # papka ichini ko'rsatmaymiz
        return None

    def do_GET(self):
        if self.is_api():
            self.handle_api()
        else:
            super().do_GET()

    def do_HEAD(self):
        if self.is_api():
            self.send_error(405)
        else:
            super().do_HEAD()

    # ----- API -----
    def handle_api(self):
        method = self.command
        if not self.is_api():
            self.send_error(405)
            return
        self._raw, self._cookie = None, None
        try:
            if method != "GET":
                self.read_body()  # xato javobida ham tana o'qilgan bo'lsin (aks holda ulanish uziladi)
            handler, args, auth = self.route(method, self.clean_path())
            if auth:
                if not session_valid(self.session_token()):
                    raise ApiError(401, "Avval tizimga kiring")
                if method != "GET" and self.headers.get("X-Requested-With") != "umragoo":
                    raise ApiError(403, "So'rov rad etildi: X-Requested-With sarlavhasi yo'q")
            status, result = 200, handler(*args)
        except ApiError as e:
            status, result = e.status, {"error": e.message}
        except Exception:
            traceback.print_exc()
            status, result = 500, {"error": "Serverda kutilmagan xatolik yuz berdi"}
        self.send_json(status, result)

    do_POST = do_PUT = do_PATCH = do_DELETE = handle_api

    def route(self, method, path):
        known = False
        for route_method, pattern, name, auth in ROUTES:
            match = pattern.fullmatch(path)
            if match:
                if route_method == method:
                    return getattr(self, "api_" + name), match.groups(), auth
                known = True
        if known:
            raise ApiError(405, "Bu so'rov turi qo'llab-quvvatlanmaydi")
        raise ApiError(404, "API manzili topilmadi")

    # ----- kirish / chiqish -----
    def api_login(self):
        ip = self.client_ip()
        if not LOGIN_LIMIT.allow(ip):
            raise ApiError(429, "Juda ko'p noto'g'ri urinish. 10 daqiqadan so'ng qayta urinib ko'ring")
        password = self.json_body().get("password")
        if not isinstance(password, str) or not check_password(password, load_config().get("password_hash", "")):
            raise ApiError(401, "Parol noto'g'ri")
        LOGIN_LIMIT.reset(ip)
        self._cookie = self.make_cookie(session_create(), SESSION_TTL)
        return {"ok": True}

    def api_logout(self):
        session_drop(self.session_token())
        self._cookie = self.make_cookie("", 0)
        return {"ok": True}

    def api_me(self):
        if not session_valid(self.session_token()):
            raise ApiError(401, "Avval tizimga kiring")
        return {"ok": True}

    def api_password(self):
        body = self.json_body()
        current, new = body.get("current"), body.get("new")
        with FILE_LOCK:
            cfg = load_config()
            if not isinstance(current, str) or not check_password(current, cfg.get("password_hash", "")):
                raise ApiError(403, "Joriy parol noto'g'ri")
            if not isinstance(new, str) or len(new) < 8:
                raise ApiError(400, "Yangi parol kamida 8 belgidan iborat bo'lishi kerak")
            cfg["password_hash"] = hash_password(new)
            write_json(CONFIG_FILE, cfg)
        session_drop(self.session_token(), keep_only=True)  # boshqa qurilmalardagi sessiyalar yopiladi
        return {"ok": True}

    # ----- sayt ma'lumotlari -----
    def api_site_get(self):
        with FILE_LOCK:
            rev = site_rev() if os.path.exists(DATA_JS) else ""
            return {"data": load_site(), "rev": rev}

    def api_site_put(self):
        body = self.json_body()
        data = body.get("data")
        error = validate_site(data)
        if error:
            raise ApiError(400, error)
        with FILE_LOCK:
            if str(body.get("rev")) != site_rev():
                raise ApiError(409, "Ma'lumotlar boshqa joyda o'zgargan (boshqa oyna yoki boshqa admin). "
                                    "Sahifani yangilang va o'zgarishlarni qaytadan kiriting")
            rev = save_site(data)
        return {"ok": True, "rev": rev}

    def api_upload(self):
        value = self.json_body().get("data")
        match = DATA_URL_RE.fullmatch(value) if isinstance(value, str) else None
        if not match:
            raise ApiError(400, "Rasm data URL (base64) ko'rinishida yuborilishi kerak")
        if match.group(1).lower() not in IMAGE_TYPES:
            raise ApiError(400, "Faqat PNG, JPEG, WEBP yoki GIF rasm yuklash mumkin")
        if len(match.group(2)) > (MAX_IMAGE // 3 + 1) * 4:
            raise ApiError(413, "Rasm 5 MB dan katta bo'lmasligi kerak")
        try:
            raw = base64.b64decode(match.group(2), validate=True)
        except (binascii.Error, ValueError):
            raise ApiError(400, "Rasm ma'lumotlari buzilgan")
        if len(raw) > MAX_IMAGE:
            raise ApiError(413, "Rasm 5 MB dan katta bo'lmasligi kerak")
        kind = sniff_image(raw)
        if kind is None:
            raise ApiError(400, "Fayl haqiqiy rasm emas (PNG, JPEG, WEBP yoki GIF kerak)")
        with FILE_LOCK:
            while True:
                name = datetime.now().strftime("%Y%m%d") + "-" + secrets.token_hex(4) + IMAGE_TYPES[kind]
                if not os.path.exists(os.path.join(UPLOAD_DIR, name)):
                    break
            write_atomic(os.path.join(UPLOAD_DIR, name), raw)
        return {"url": "assets/uploads/" + name}

    # ----- mijoz so'rovlari -----
    def api_request_create(self):
        if not REQUEST_LIMIT.allow(self.client_ip()):
            raise ApiError(429, "Juda ko'p so'rov yuborildi. Birozdan so'ng qayta urinib ko'ring")
        body = self.json_body()
        if body.get("website"):  # honeypot: odam ko'rmaydigan maydonni bot to'ldirgan
            return {"ok": True}
        name = text_field(body, "name", 100, "Ism", min_len=1)
        phone = text_field(body, "phone", 40, "Telefon raqami")
        if len(re.findall(r"[0-9]", phone)) < 7:
            raise ApiError(400, "Telefon raqamini to'liq kiriting")
        item = {
            "id": secrets.token_hex(6), "created": now_iso(), "status": "new",
            "name": name, "phone": phone,
            "service": text_field(body, "service", 100, "Xizmat"),
            "people": int_field(body, "people", 1, 500, "Kishilar soni", default=1),
            "date": text_field(body, "date", 20, "Sana"),
            "note": text_field(body, "note", 2000, "Izoh"),
            "comment": "",
        }
        with FILE_LOCK:
            items = load_list(REQUESTS_FILE)
            items.insert(0, item)
            write_json(REQUESTS_FILE, items)
        notify(f"🕋 Yangi so'rov\nIsm: {show(item['name'])}\nTelefon: {show(item['phone'])}\n"
               f"Xizmat: {show(item['service'])}\nKishilar: {show(item['people'])}\n"
               f"Sana: {show(item['date'])}\nIzoh: {show(item['note'])}")
        return {"ok": True}

    def api_requests_list(self):
        with FILE_LOCK:
            return {"items": load_list(REQUESTS_FILE)}

    def api_request_update(self, item_id):
        body = self.json_body()
        changes = {}
        if "status" in body:
            if body["status"] not in REQUEST_STATUSES:
                raise ApiError(400, "Holat noto'g'ri (new, progress, done yoki cancelled)")
            changes["status"] = body["status"]
        if "comment" in body:
            changes["comment"] = text_field(body, "comment", 2000, "Izoh")
        with FILE_LOCK:
            items = load_list(REQUESTS_FILE)
            item = find_item(items, item_id, "So'rov topilmadi")
            if changes:
                item.update(changes)
                write_json(REQUESTS_FILE, items)
        return {"ok": True, "item": item}

    def api_request_delete(self, item_id):
        with FILE_LOCK:
            items = load_list(REQUESTS_FILE)
            items.remove(find_item(items, item_id, "So'rov topilmadi"))
            write_json(REQUESTS_FILE, items)
        return {"ok": True}

    # ----- sharhlar -----
    def api_review_create(self):
        if not REVIEW_LIMIT.allow(self.client_ip()):
            raise ApiError(429, "Juda ko'p so'rov yuborildi. Birozdan so'ng qayta urinib ko'ring")
        body = self.json_body()
        if body.get("website"):  # honeypot
            return {"ok": True}
        item = {
            "id": secrets.token_hex(6), "created": now_iso(),
            "name": text_field(body, "name", 100, "Ism", min_len=1),
            "city": text_field(body, "city", 100, "Shahar"),
            "service": text_field(body, "service", 100, "Xizmat"),
            "stars": int_field(body, "stars", 1, 5, "Baho"),
            "text": text_field(body, "text", 2000, "Sharh matni", min_len=5),
        }
        with FILE_LOCK:
            items = load_list(REVIEWS_FILE)
            items.insert(0, item)
            write_json(REVIEWS_FILE, items)
        notify(f"⭐ Yangi sharh (tasdiqlash kutilmoqda)\nIsm: {item['name']}\nBaho: {item['stars']}\n{item['text']}")
        return {"ok": True}

    def api_reviews_list(self):
        with FILE_LOCK:
            return {"items": load_list(REVIEWS_FILE)}

    def api_review_approve(self, item_id):
        with FILE_LOCK:
            reviews = load_list(REVIEWS_FILE)
            review = find_item(reviews, item_id, "Sharh topilmadi")
            site = load_site()
            place = " · ".join(p for p in (review.get("city"), review.get("service")) if p) or "Umragoo mijozi"
            if not isinstance(site.get("testimonials"), list):
                site["testimonials"] = []
            site["testimonials"].insert(0, {
                "name": review.get("name", ""), "place": place, "stars": review.get("stars", 5),
                "text": review.get("text", ""), "hidden": False,
            })
            rev = save_site(site)
            reviews.remove(review)
            write_json(REVIEWS_FILE, reviews)
        return {"ok": True, "rev": rev}

    def api_review_delete(self, item_id):
        with FILE_LOCK:
            items = load_list(REVIEWS_FILE)
            items.remove(find_item(items, item_id, "Sharh topilmadi"))
            write_json(REVIEWS_FILE, items)
        return {"ok": True}

    # ----- zaxira nusxalar -----
    def api_backups_list(self):
        items = []
        with FILE_LOCK:
            for name in list_backups():
                st = os.stat(os.path.join(BACKUP_DIR, name))
                items.append({"name": name, "size": st.st_size,
                              "time": datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%dT%H:%M:%S")})
        return {"items": items}

    def api_backup_restore(self, name):
        if not BACKUP_RE.fullmatch(name):
            raise ApiError(400, "Zaxira nusxa nomi noto'g'ri")
        with FILE_LOCK:
            try:
                with open(os.path.join(BACKUP_DIR, name), encoding="utf-8") as f:
                    data = parse_site(f.read())
            except FileNotFoundError:
                raise ApiError(404, "Zaxira nusxa topilmadi")
            except ValueError as e:
                raise ApiError(400, f"Zaxira nusxani o'qib bo'lmadi: {e}")
            error = validate_site(data)
            if error:
                raise ApiError(400, f"Zaxira nusxa yaroqsiz: {error}")
            rev = save_site(data)  # joriy fayl ham avval zaxiraga olinadi
        return {"ok": True, "rev": rev}

    # ----- sozlamalar -----
    def api_settings_get(self):
        return {"telegram": load_config()["telegram"]}

    def api_settings_put(self):
        tg = self.json_body().get("telegram")
        if not isinstance(tg, dict):
            raise ApiError(400, "telegram sozlamalari yuborilmagan")
        token = text_field(tg, "token", 200, "Bot token")
        chat_id = text_field(tg, "chat_id", 100, "Chat ID")
        if token and not TOKEN_RE.fullmatch(token):
            raise ApiError(400, "Bot token noto'g'ri formatda (masalan: 123456789:AAE...)")
        with FILE_LOCK:
            cfg = load_config()
            cfg["telegram"] = {"token": token, "chat_id": chat_id}
            write_json(CONFIG_FILE, cfg)
        return {"ok": True}

    def api_settings_test(self):
        tg = load_config()["telegram"]
        error = telegram_send("✅ Umragoo: test xabar", tg["token"], tg["chat_id"])
        if error:
            raise ApiError(502, f"Telegram: {error}")
        return {"ok": True}


def _reject_constant(name):
    raise ValueError(f"{name} ruxsat etilmagan")


# ---------- ishga tushirish ----------
def ensure_storage():
    """Doimiy papka ishlatilsa, birinchi ishga tushishda data.js ni loyihadan nusxalaydi."""
    if STORAGE and not os.path.exists(DATA_JS):
        with open(SEED_DATA_JS, "rb") as f:
            write_atomic(DATA_JS, f.read())


def ensure_password():
    """Parol hali o'rnatilmagan bo'lsa uni o'rnatadi: UMRAGOO_ADMIN_PASSWORD dan yoki tasodifiy.
    Konsolda ko'rsatish kerak bo'lgan tasodifiy parolni qaytaradi."""
    with FILE_LOCK:
        cfg = load_config()
        if cfg.get("password_hash"):
            return None
        from_env = os.environ.get("UMRAGOO_ADMIN_PASSWORD", "").strip()
        password = from_env if len(from_env) >= 8 else secrets.token_urlsafe(9)
        cfg["password_hash"] = hash_password(password)
        write_json(CONFIG_FILE, cfg)
    if password == from_env:
        print("Admin parol UMRAGOO_ADMIN_PASSWORD muhit o'zgaruvchisidan o'rnatildi.")
        return None
    return password


def main():
    for stream in (sys.stdout, sys.stderr):  # Windows konsolida maxsus belgilar (—, ’) xato bermasin
        try:
            stream.reconfigure(errors="replace")
        except (AttributeError, ValueError):
            pass

    parser = argparse.ArgumentParser(description="Umragoo lokal server va admin panel")
    parser.add_argument("--host", default="127.0.0.1", help="tinglanadigan manzil (standart: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8080, help="port (standart: 8080)")
    parser.add_argument("--password", metavar="YANGI_PAROL", help="admin parolini o'rnatadi va chiqadi")
    args = parser.parse_args()

    try:
        if args.password is not None:
            if len(args.password) < 8:
                print("Xato: parol kamida 8 belgidan iborat bo'lishi kerak.", file=sys.stderr)
                return 1
            set_password(args.password)
            print("Admin parol yangilandi (data/config.json). Endi /admin manzilida yangi parol bilan kiring.")
            return 0

        server_class = ThreadingHTTPServer
        if ":" in args.host:  # IPv6 manzil
            server_class = type("ThreadingHTTPServerV6", (ThreadingHTTPServer,), {"address_family": socket.AF_INET6})
        try:
            httpd = server_class((args.host, args.port), partial(Handler, directory=ROOT))
        except OSError as e:
            print(f"Xato: serverni {args.host}:{args.port} da ishga tushirib bo'lmadi ({e}).\n"
                  f"Port band bo'lishi mumkin — boshqa port tanlang: python3 server.py --port 8081", file=sys.stderr)
            return 1
        ensure_storage()
        first_password = ensure_password()
    except ApiError as e:
        print(f"Xato: {e.message}", file=sys.stderr)
        return 1

    host = "127.0.0.1" if args.host in ("", "0.0.0.0", "::") else args.host
    base = f"http://[{host}]:{args.port}" if ":" in host else f"http://{host}:{args.port}"
    line = "=" * 64
    print(line)
    print("  Umragoo server ishga tushdi")
    print(f"  Sayt:        {base}/")
    print(f"  Admin panel: {base}/admin/")
    print("  To'xtatish:  Ctrl+C")
    print(line)
    if first_password:
        print()
        print("*" * 64)
        print(f"  Admin parol: {first_password} — /admin manzilida kiring,")
        print("  keyin Sozlamalar bo'limida o'zgartiring.")
        print("  Parolni unutsangiz: python3 server.py --password YANGI_PAROL")
        print("*" * 64)
        print()
    sys.stdout.flush()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer to'xtatildi.")
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
