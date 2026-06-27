# راهنمای دیپلویِ رایگانِ Bordino

استکِ رایگان (برای دمو/تست): **Vercel** (فرانت) + **Render** (بک‌اند، Docker) +
**Neon** (Postgres) + **Upstash** (Redis). Celery فعلاً خاموش (تیرِ رایگانِ worker نداریم).

> ⚠️ محدودیتِ تیرِ رایگان: بک‌اندِ Render بعد از ~۱۵ دقیقه بی‌فعالیتی می‌خوابد (درخواستِ بعدی چند ثانیه طول می‌کشد)؛
> دیسکِ Render موقتی است (فایل‌های آپلودیِ مدیا با هر deploy پاک می‌شوند).

پیش‌نیاز: ریپو روی گیت‌هاب است (`DanielJahan/bordino`). فایل‌های `render.yaml` و
`main_app/.env.example` از قبل آماده‌اند.

---

## ۱) دیتابیس — Neon (Postgres رایگان و ماندگار)
1. در [neon.tech](https://neon.tech) ثبت‌نام و یک پروژه/دیتابیس بساز.
2. از Connection Details این‌ها را بردار: host، database، user، password (پورت 5432).
   - این مقادیر می‌شوند `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_PORT`.

## ۲) Redis — Upstash (رایگان)
1. در [upstash.com](https://upstash.com) یک Redis database بساز.
2. آدرسِ TLS را بردار (شکل: `rediss://default:<password>@<host>.upstash.io:6379`).
   - این می‌شود `REDIS_LOCATION`.

## ۳) بک‌اند — Render (با Docker از روی render.yaml)
1. در [render.com](https://render.com) ثبت‌نام کن → **New > Blueprint** → ریپوی گیت‌هاب را وصل کن.
   Render فایلِ `render.yaml` را می‌خواند و سرویسِ `bordino-backend` را می‌سازد.
2. متغیرهای محیطی (در داشبوردِ سرویس → Environment) را پر کن:
   - `DB_NAME, DB_USER, DB_PASSWORD, DB_HOST` (از Neon)، `DB_PORT=5432`
   - `REDIS_LOCATION` (از Upstash)
   - `ALLOWED_HOSTS` = دامنهٔ Render، مثلاً `bordino-backend.onrender.com`
   - `APP_DOMAIN` = `https://bordino-backend.onrender.com`
   - `CSRF_TRUSTED_ORIGINS` = `https://bordino-backend.onrender.com` (بعداً دامنهٔ Vercel را هم اضافه کن)
   - `CORS_ALLOWED_ORIGINS` = دامنهٔ فرانت در Vercel (بعد از مرحلهٔ ۴)
   - `SECRET_KEY` خودکار ساخته می‌شود؛ `DJANGO_ENV=production` و `DEBUG=false` از قبل ست‌اند.
   - بقیهٔ کلیدها را از `Bordino_Backend-develop/Bordino_Backend-develop/main_app/.env.example`
     کپی کن (Render گزینهٔ **Add from .env** دارد).
3. Deploy کن. آدرسِ بک‌اند را یادداشت کن (مثلاً `https://bordino-backend.onrender.com`).
   - تست: `https://bordino-backend.onrender.com/swagger/` باید بالا بیاید.
4. **مقداردهیِ اولیهٔ داده** (Render → سرویس → Shell):
   ```
   python manage.py createsuperuser
   python manage.py load_tarot
   python manage.py seed_wheel        # اگر گردونه می‌خواهی
   ```
   (مهاجرت‌ها هنگامِ استارت خودکار اجرا می‌شوند.)

## ۴) فرانت — Vercel
1. در [vercel.com](https://vercel.com) → **Add New > Project** → همین ریپو را Import کن.
2. **Root Directory** را روی `Bordino_Frontend-develop/Bordino_Frontend-develop` بگذار
   (دکمهٔ Edit کنارِ Root Directory). فریم‌ورک خودکار Next.js تشخیص داده می‌شود.
3. Environment Variables:
   - `NEXT_PUBLIC_API_BASE_URL` = `https://bordino-backend.onrender.com/api/v1/`
   - `NEXT_PUBLIC_REFRESH_URL` = `https://bordino-backend.onrender.com/`
4. Deploy کن. دامنهٔ فرانت را بردار (مثلاً `https://bordino.vercel.app`).

## ۵) اتصالِ نهایی (CORS/CSRF)
به Render برگرد و مقادیر را با دامنهٔ واقعیِ Vercel کامل کن، سپس Manual Deploy:
- `CORS_ALLOWED_ORIGINS` = `https://bordino.vercel.app`
- `CSRF_TRUSTED_ORIGINS` = `https://bordino-backend.onrender.com,https://bordino.vercel.app`

تمام — فرانت روی Vercel به بک‌اندِ Render وصل است. ✅

---

## نکته‌ها
- **Celery (کارهای پس‌زمینه/زمان‌بندی):** worker‌های دائمی در تیرِ رایگان نیستند؛ فعلاً خاموش است.
  اگر لازم شد: یا روی **Fly.io** (VMِ کوچکِ رایگان) یک worker بالا بیاور، یا یک Background Worker
  پولیِ Render بساز. broker از قبل env-محور است؛ کافی است `CELERY__broker_url` و
  `CELERY__result_backend` را به همان Redisِ Upstash بدهی (`rediss://...`).
- **فایل‌های مدیا (عکس پروفایل و ...):** دیسکِ Render موقتی است. برای ماندگاری از
  **Cloudflare R2** یا **Supabase Storage** استفاده کن و `USE_MINIO`/تنظیماتِ ذخیره‌ساز را ست کن.
- **Postgresِ رایگانِ Render** را عمداً استفاده نکردیم چون منقضی می‌شود؛ Neon ماندگار است.
