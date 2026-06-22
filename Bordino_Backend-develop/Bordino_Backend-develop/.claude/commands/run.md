# راه‌اندازی پروژه بردینو

> **مهم:** پروژه دو بخش دارد و **هر دو باید بالا باشند**:
> - **بک‌اند** (Django) روی پورت **8000**
> - **فرانت‌اند** (Next.js) روی پورت **3000** — صفحه اصلی سایت
>
> فرانت برای کار کردن به بک‌اند نیاز دارد (`.env.local` فرانت به `http://localhost:8000/api/v1/` وصل است).

## وضعیت سیستم
- **Docker:** غیرفعال — Virtualization در BIOS خاموش است، WSL2 کار نمی‌کند
- **روش اجرا:** مستقیم با Poetry (بک‌اند) و pnpm (فرانت) روی Windows
- **دیتابیس:** PostgreSQL 17 نصب‌شده روی Windows (سرویس `postgresql-x64-17`)
- **مسیر بک‌اند:** `e:\Bordino\claude\Bordino_Backend-develop\Bordino_Backend-develop`
- **مسیر فرانت:** `e:\Bordino\claude\Bordino_Frontend-develop\Bordino_Frontend-develop`

## بررسی وضعیت سرویس‌ها

```powershell
# بررسی PostgreSQL
Get-Service postgresql-x64-17

# بررسی اینکه سرور Django در حال اجراست
Invoke-WebRequest -Uri "http://localhost:8000/swagger/" -TimeoutSec 3
```

## ۱) راه‌اندازی بک‌اند (Django — پورت 8000)

> **مهم — مشکل localhost روی این سیستم:** `localhost` روی این ویندوز اول به IPv6 (`::1`) resolve می‌شود، اما `runserver` پیش‌فرض فقط روی IPv4 (`127.0.0.1`) گوش می‌دهد. برای همین آدرس `localhost:8000` در مرورگر بالا نمی‌آید. راه‌حل: سرور را روی IPv6 اجرا کن (دستور زیر). فایل hosts قابل ویرایش نیست (نیاز به admin) پس bind روی IPv6 تنها راه بدون elevation است.

```powershell
cd "e:\Bordino\claude\Bordino_Backend-develop\Bordino_Backend-develop"
poetry run python manage.py runserver "[::]:8000"
```

با این روش از آدرس **`http://localhost:8000`** استفاده کن (نه `127.0.0.1` — چون IPv6-only است).

اگر برعکس می‌خواهی فقط `127.0.0.1` کار کند (نه localhost)، دستور پیش‌فرض را اجرا کن:

```powershell
poetry run python manage.py runserver
```

## ۲) راه‌اندازی فرانت‌اند (Next.js — پورت 3000، صفحه اصلی سایت)

پروژه Next.js است و با **pnpm** اجرا می‌شود (`node_modules` از قبل نصب است). اگر نصب نبود اول `pnpm install`.

```powershell
cd "e:\Bordino\claude\Bordino_Frontend-develop\Bordino_Frontend-develop"
pnpm dev
```

صفحه اصلی روی **http://localhost:3000/** بالا می‌آید. اولین بار compile چند ثانیه طول می‌کشد.

> warning مربوط به `require-in-the-middle` (از Sentry) در لاگ بی‌خطر است و dev را متوقف نمی‌کند.

## ریستارت سرور

اگر سرور در حال اجراست، ابتدا آن را متوقف کن (Ctrl+C در ترمینال) سپس:

```powershell
cd "e:\Bordino\claude\Bordino_Backend-develop\Bordino_Backend-develop"
poetry run python manage.py runserver "[::]:8000"
```

## اگر PostgreSQL خاموش بود

```powershell
Start-Service postgresql-x64-17
```

## آدرس‌های مهم

> با اجرای `runserver "[::]:8000"` از `localhost` استفاده کن (نه `127.0.0.1`).

| سرویس | آدرس |
|-------|-------|
| **فرانت (صفحه اصلی سایت)** | http://localhost:3000/ |
| Swagger | http://localhost:8000/swagger/ |
| Admin | http://localhost:8000/admin/ |
| API | http://localhost:8000/api/v1/ |

## Migration (در صورت تغییر مدل)

```powershell
cd "e:\Bordino\claude\Bordino_Backend-develop\Bordino_Backend-develop"
poetry run python manage.py migrate
```
