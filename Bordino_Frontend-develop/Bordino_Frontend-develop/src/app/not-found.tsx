import Link from "next/link";

export default function NotFound() {
	return (
		<article className="bd-product bd-app rt-product st-brutal lay-1 bd-page" aria-label="صفحه پیدا نشد">
			<header className="bd-app-top">
				<Link href="/" className="bd-brand">
					<span className="bd-logomark" aria-hidden="true">
						ب
					</span>
					بردینو
				</Link>
			</header>
			<div className="rt-auth-shell">
				<main className="bd-dash rt-content">
					<section className="bd-panel rt-panel">
						<div className="rt-empty">
							<h3>این صفحه پیدا نشد</h3>
							<p>نشانی را بررسی کن یا به صفحهٔ اصلی برگرد.</p>
							<Link className="bd-action" href="/pwa">
								صفحهٔ اصلی
							</Link>
						</div>
					</section>
				</main>
			</div>
		</article>
	);
}
