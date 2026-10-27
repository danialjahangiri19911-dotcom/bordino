"use client";

import { useEffect } from "react";

import Link from "next/link";

import Icon from "../Icon";
import { Art, Brand, R } from "../ui";

import useAuthStore from "@/libs/stores/authStore";

export default function Landing() {
	const { isLoggedIn } = useAuthStore();
	const appHref = isLoggedIn ? R.home : R.login;
	useEffect(() => {
		document.title = "بوردینو | بازی کن، امتیاز بگیر، در قرعه‌کشی شرکت کن";
	}, []);
	return (
		<article className="bd-product bd-landing st-brutal lay-1 bd-page" aria-label="بوردینو">
			<header className="bd-header">
				<Brand href={R.landing} />
				<nav className="bd-header-links" aria-label="بخش‌های صفحه">
					<a href="#how">چطور کار می‌کند؟</a>
					<a href="#games">بازی‌ها</a>
					<Link href={R.rules}>راهنما</Link>
				</nav>
				<Link className="bd-action" href={appHref}>
					{isLoggedIn ? "ورود به برنامه" : "ورود به بوردینو"} <Icon name="arrow-up-left" />
				</Link>
			</header>
			<main id="main">
				<section className="bd-hero">
					<div className="bd-hero-copy">
						<p className="bd-overline">
							<Icon name="sparkles" /> سرگرمیِ امتیازمحور
						</p>
						<h1>
							وقتشه
							<br />
							<span className="bd-em">یه چالش بری!</span>
						</h1>
						<p>بازی کن، امتیاز جمع کن و امتیازهایت را به بلیت قرعه‌کشی یا فرصت گردونه تبدیل کن.</p>
						<div className="bd-actions">
							<Link className="bd-action" href={appHref}>
								شروع یک بازی <Icon name="arrow-left" />
							</Link>
							<a className="bd-secondary" href="#how">
								بوردینو چطور کار می‌کند؟
							</a>
						</div>
						<span className="bd-note">وب‌اپلیکیشن بوردینو · همراهت در موبایل و مرورگر</span>
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
							<h3>امتیاز جمع کن</h3>
							<p>با بازی و همراهی روزانه، امتیازهای تو بیشتر می‌شوند.</p>
						</div>
						<div className="bd-step">
							<span className="bd-step-num">۰۳</span>
							<h3>امتیازها را استفاده کن</h3>
							<p>بلیت قرعه‌کشی یا فرصت گردونه را انتخاب کن.</p>
						</div>
					</div>
				</section>
				<section className="bd-feature-band">
					<Art name="rewards" />
					<div>
						<h3>چالش بعدی منتظر توست.</h3>
						<p>بازی‌ها، امتیازها و بلیت‌هایت را در فضای خودت ببین.</p>
					</div>
					<Link className="bd-action" href={appHref}>
						دیدن محیط اپلیکیشن <Icon name="arrow-left" />
					</Link>
				</section>
			</main>
			<footer className="bd-landing-footer">
				<span>بوردینو · بازی، امتیاز، قرعه‌کشی</span>
				<span>
					<Link href={R.rules}>قوانین</Link> · <Link href={R.rules}>راهنما</Link>
				</span>
			</footer>
		</article>
	);
}
