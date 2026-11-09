"use client";

import { type FormEvent, useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import Icon from "@/bd/Icon";
import { styleClass, useBdStyle } from "@/bd/appearance";
import { Notice } from "@/bd/ui";

import { type OpsMe, errorText, ops, saveSession, session } from "./client";
import { OPS } from "./Shell";

const DIGITS: Record<string, string> = { "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9" };
const latin = (s: string) => s.replace(/[۰-۹]/g, (c) => DIGITS[c] ?? c);

/** Sign in to «بردینو ادمین»: a staff member's phone, then the SMS code. */
export default function OpsLogin() {
	const st = styleClass(useBdStyle());
	const router = useRouter();
	const [phone, setPhone] = useState("");
	const [code, setCode] = useState("");
	const [step, setStep] = useState<"phone" | "code">("phone");
	const [busy, setBusy] = useState(false);
	const [info, setInfo] = useState<string | null>(null);
	const [problem, setProblem] = useState<string | null>(null);
	useEffect(() => {
		document.title = "ورود | بردینو ادمین";
		if (session()?.access) router.replace(OPS.home);
	}, [router]);
	const send = async (e?: FormEvent) => {
		e?.preventDefault();
		setBusy(true);
		setProblem(null);
		try {
			const r = await ops<{ message: string }>("auth/send/", "POST", { phone: latin(phone) });
			setInfo(r.message);
			setStep("code");
		} catch (err) {
			setProblem(errorText(err));
		}
		setBusy(false);
	};
	const verify = async (e: FormEvent) => {
		e.preventDefault();
		setBusy(true);
		setProblem(null);
		try {
			const r = await ops<{ tokens: { access: string; refresh: string }; me: OpsMe }>("auth/verify/", "POST", { phone: latin(phone), code: latin(code) });
			saveSession({ ...r.tokens, me: r.me });
			router.replace(OPS.home);
		} catch (err) {
			setProblem(errorText(err));
			setBusy(false);
		}
	};
	return (
		<article className={`bd-product bd-app rt-product ${st} lay-1 bd-page ops-product ops-login`} aria-label="ورود به بردینو ادمین">
			<main className="bd-dash rt-content" id="main">
				<section className="bd-panel ops-login-card">
					<span className="bd-logomark ops-logomark" aria-hidden="true">
						ب
					</span>
					<h1>بردینو ادمین</h1>
					<p className="bd-muted">ورود کارکنان بردینو با کد پیامکی.</p>
					{step === "phone" ? (
						<form onSubmit={(e) => void send(e)}>
							<label className="rt-field gm-field">
								<span>شمارهٔ موبایل</span>
								<input dir="ltr" inputMode="tel" autoComplete="tel" placeholder="09121234567" value={phone} onChange={(e) => setPhone(e.target.value)} required />
							</label>
							<button type="submit" className="bd-action" disabled={busy || latin(phone).replace(/\D/g, "").length < 10}>
								{busy ? <Icon name="loader-circle" className="bd-spin" /> : <Icon name="message-circle" />} فرستادن کد
							</button>
						</form>
					) : (
						<form onSubmit={(e) => void verify(e)}>
							{info ? <Notice tone="info">{info}</Notice> : null}
							<label className="rt-field gm-field">
								<span>کد ۶ رقمی</span>
								<input
									dir="ltr"
									inputMode="numeric"
									autoComplete="one-time-code"
									maxLength={6}
									value={code}
									onChange={(e) => setCode(latin(e.target.value).replace(/\D/g, ""))}
									autoFocus
									required
								/>
							</label>
							<button type="submit" className="bd-action" disabled={busy || code.length !== 6}>
								{busy ? <Icon name="loader-circle" className="bd-spin" /> : <Icon name="log-in" />} ورود
							</button>
							<div className="bd-actions">
								<button type="button" className="bd-text-btn" disabled={busy} onClick={() => void send()}>
									کد دوباره
								</button>
								<button
									type="button"
									className="bd-text-btn"
									onClick={() => {
										setStep("phone");
										setCode("");
										setInfo(null);
									}}
								>
									شمارهٔ دیگر
								</button>
							</div>
						</form>
					)}
					{problem ? <Notice>{problem}</Notice> : null}
				</section>
			</main>
		</article>
	);
}
