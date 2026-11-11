"use client";

import { styleClass, useBdStyle } from "../appearance";
import { useEffect, useState } from "react";

import Link from "next/link";

import Icon from "../Icon";
import { Art, Brand, R } from "../ui";

import useAuthStore from "@/libs/stores/authStore";

/** The Android app (Bordino_Mobile) only wraps this site, so website changes reach it without an update. */
const APK_HREF = "/download/bordino.apk";

/** How to make a birthday game with Game Master (a 90 s screen recording, 720×1280, in public/). */
const MAKE_VIDEO = { src: "/bd/video/birthday-game.mp4", poster: "/bd/video/birthday-game.jpg" };

/** Inside the Android app or an installed PWA there is nothing left to install. */
function useInstalled() {
	const [installed, setInstalled] = useState(false);
	useEffect(() => {
		setInstalled(
			/BordinoApp\//.test(navigator.userAgent) ||
				window.matchMedia("(display-mode: standalone)").matches ||
				(navigator as Navigator & { standalone?: boolean }).standalone === true,
		);
	}, []);
	return installed;
}

export default function Landing() {
	const st = styleClass(useBdStyle());
	const installed = useInstalled();
	const { isLoggedIn } = useAuthStore();
	const appHref = isLoggedIn ? R.home : R.login;
	useEffect(() => {
		document.title = "بردینو | بازی کن، سکه بگیر، در قرعه‌کشی شرکت کن";
	}, []);
	return (
		<article className={`bd-product bd-landing ${st} lay-1 bd-page`} aria-label="بردینو">
			<header className="bd-header">
				<Brand href={R.landing} />
				<nav className="bd-header-links" aria-label="بخش‌های صفحه">
					<a href="#how">چطور کار می‌کند؟</a>
					<a href="#games">بازی‌ها</a>
					<a href="#make">بازی خودت را بساز</a>
					{!installed && <a href="#app">نصب برنامه</a>}
					<Link href={R.rules}>راهنما</Link>
				</nav>
				<Link className="bd-action" href={appHref}>
					{isLoggedIn ? "ورود به برنامه" : "ورود به بردینو"} <Icon name="arrow-up-right" />
				</Link>
			</header>
			<main id="main">
				<section className="bd-hero">
					<div className="bd-hero-copy">
						<p className="bd-overline">
							<Icon name="sparkles" /> سرگرمیِ سکه‌محور
						</p>
						<h1>
							وقتشه
							<br />
							<span className="bd-em">یه چالش بری!</span>
						</h1>
						<p>بازی کن، سکه جمع کن و سکه‌هایت را به بلیت قرعه‌کشی یا فرصت گردونه تبدیل کن.</p>
						<div className="bd-actions">
							<Link className="bd-action" href={appHref}>
								شروع یک بازی <Icon name="arrow-right" />
							</Link>
							<a className="bd-secondary" href="#how">
								بردینو چطور کار می‌کند؟
							</a>
						</div>
						<span className="bd-note">وب‌اپلیکیشن بردینو · همراهت در موبایل و مرورگر</span>
					</div>
					<Art name="hero" eager />
				</section>
				<section className="bd-how" id="how">
					<div className="bd-section-head">
						<h2>
							از یک بازی ساده
							<br />
							شروع می‌شود.
						</h2>
					</div>
					<div className="bd-steps" id="games">
						<div className="bd-step">
							<span className="bd-step-num">۰۱</span>
							<h3>بازی انتخاب کن</h3>
							<p>سودوکو، ۲۰۴۸، انفجار، مرغ فراری و گردونه.</p>
						</div>
						<div className="bd-step">
							<span className="bd-step-num">۰۲</span>
							<h3>سکه جمع کن</h3>
							<p>با بازی و همراهی روزانه، سکه‌های تو بیشتر می‌شوند.</p>
						</div>
						<div className="bd-step">
							<span className="bd-step-num">۰۳</span>
							<h3>سکه‌ها را استفاده کن</h3>
							<p>بلیت قرعه‌کشی یا فرصت گردونه را انتخاب کن.</p>
						</div>
					</div>
				</section>
				<section className="bd-how bd-make" id="make" aria-labelledby="make-title">
					<div className="bd-section-head">
						<h2 id="make-title">
							بازی خودت را بساز؛
							<br />
							مثلاً برای تولد یک دوست
						</h2>
					</div>
					<div className="bd-make-row">
						{/* (downloaded only when played: preload none, a poster frame first) */}
						<video
							className="bd-make-video"
							controls
							playsInline
							preload="none"
							poster={MAKE_VIDEO.poster}
							width={720}
							height={1280}
							aria-label="ویدیوی آموزش ساخت بازی تولد با گیم مستر"
						>
							<source src={MAKE_VIDEO.src} type="video/mp4" />
						</video>
						<div className="bd-make-copy">
							<p>
								با گیم مستر چند سرنخ می‌نویسی که آخرش به هدیهٔ تولد می‌رسد؛ بعد لینک دعوت یا QR آن را برای دوستت می‌فرستی. فقط کسی که لینک را دارد وارد بازی می‌شود.
							</p>
							<ol className="bd-make-steps">
								<li>
									<b>۱</b> در پروفایل «گیم مستر» را بزن و قالب «تولد معمایی» را بردار.
								</li>
								<li>
									<b>۲</b> سرنخ‌ها، پیام خودت و جای هدیه را بنویس و امتحانش کن.
								</li>
								<li>
									<b>۳</b> برای بررسی بردینو بفرست؛ بعد از تأیید، منتشرش کن.
								</li>
								<li>
									<b>۴</b> لینک دعوت یا QR را برای دوستت بفرست.
								</li>
							</ol>
							<Link className="bd-action" href={isLoggedIn ? R.gm : R.login}>
								ساخت بازی تولد <Icon name="gift" />
							</Link>
						</div>
					</div>
				</section>
				{!installed && (
					<section className="bd-how bd-get-app" id="app" aria-labelledby="get-app-title">
						<div className="bd-section-head">
							<h2 id="get-app-title">بردینو روی گوشی</h2>
						</div>
						<div className="bd-steps">
							<div className="bd-step bd-get-app-card">
								<span className="bd-step-num">
									<Icon name="smartphone" />
								</span>
								<h3>اندروید</h3>
								<p>برنامهٔ بردینو را دانلود و نصب کن. اگر گوشی پرسید، نصب از این منبع را اجازه بده.</p>
								<a className="bd-action" href={APK_HREF} download="bordino.apk">
									دانلود برنامه <Icon name="download" />
								</a>
							</div>
							<div className="bd-step bd-get-app-card">
								<span className="bd-step-num">
									<Icon name="smartphone" />
								</span>
								<h3>آیفون</h3>
								<ol className="bd-get-app-steps">
									<li>این صفحه را در Safari باز کن.</li>
									<li>
										دکمهٔ اشتراک‌گذاری <Icon name="share" size={14} label="اشتراک‌گذاری" /> را بزن.
									</li>
									<li>
										«Add to Home Screen» <Icon name="plus" size={14} /> و بعد «Add» را بزن.
									</li>
								</ol>
							</div>
						</div>
					</section>
				)}
				<section className="bd-feature-band">
					<Art name="rewards" />
					<div>
						<h3>چالش بعدی منتظر توست.</h3>
						<p>بازی‌ها، سکه‌ها و بلیت‌هایت را در فضای خودت ببین.</p>
					</div>
					<Link className="bd-action" href={appHref}>
						دیدن محیط اپلیکیشن <Icon name="arrow-right" />
					</Link>
				</section>
			</main>
			<footer className="bd-landing-footer">
				<span>بردینو · بازی، سکه، قرعه‌کشی</span>
				<span>
					<Link href={R.rules}>قوانین</Link> · <Link href={R.rules}>راهنما</Link>
				</span>
			</footer>
		</article>
	);
}
