"use client";

import Link from "next/link";

import { AppShell, Notice, Panel, R } from "../ui";

import useAuthStore from "@/libs/stores/authStore";
import { GuideSteps, PrizeTable } from "./Guide";

/**
 * «شرایط و قوانین». Only what the app really does is stated here; the operator's official terms
 * text has not been supplied yet, and the page says so instead of showing placeholder legal text.
 */
export default function Rules() {
	// The prize table comes from the lottery API, which needs a session: guests read the steps only.
	const { isLoggedIn } = useAuthStore();
	return (
		<AppShell nav="profile" title="شرایط و قوانین" allowGuest>
			<Panel title="شرایط استفاده از بوردینو">
				<Notice tone="info">متن رسمی و کامل شرایط استفاده به‌زودی در همین صفحه منتشر می‌شود. آنچه در ادامه آمده، نحوهٔ کار بخش‌های فعلی برنامه است.</Notice>
				<div className="rt-document">
					<details open>
						<summary>حساب کاربری و ورود</summary>
						<p>ورود و ثبت‌نام فقط با شمارهٔ موبایل و کد یک‌بارمصرف پیامکی انجام می‌شود. هر شماره یک حساب دارد.</p>
					</details>
					<details>
						<summary>امتیازها و کیف‌پول</summary>
						<p>امتیاز در کیف امتیاز جمع می‌شود و برای بلیت قرعه‌کشی، گردونه و بازی‌ها خرج می‌شود. جایزه‌های نقدی به کیف نقدی (تومان) می‌روند و فقط به حساب بانکیِ تأییدشده قابل برداشت‌اند.</p>
					</details>
					<details>
						<summary>قرعه‌کشی و جوایز</summary>
						<GuideSteps />
						{isLoggedIn ? <PrizeTable /> : null}
					</details>
					<details>
						<summary>بازی‌ها</summary>
						<p>نتیجهٔ بازی‌های امتیازی (انفجار، مرغ فراری و گردونه) را سرور تعیین می‌کند؛ قوانین و ضرایب هر بازی با دکمهٔ اطلاعات در صفحهٔ همان بازی دیده می‌شود.</p>
					</details>
				</div>
				<div className="bd-actions">
					<Link className="bd-secondary" href={isLoggedIn ? R.lotteryGuide : R.login}>
						راهنمای کامل قرعه‌کشی
					</Link>
				</div>
			</Panel>
		</AppShell>
	);
}
