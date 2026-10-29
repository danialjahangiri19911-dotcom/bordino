"use client";

import { useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import Icon from "../Icon";
import JalaliDateField from "../JalaliDateField";
import { fa } from "../format";
import { AuthShell, LoadState, Notice, Panel, R, usePoints } from "../ui";
import { usernameProblem } from "./Personal";
import { useQueryClient } from "@tanstack/react-query";

import useGetCustomerProfile from "@/api/customer/hooks/useGetCustomerProfile";
import { gameErrorMessage } from "@/api/games/request";
import { CUSTOMER_URLS } from "@/api/urls";
import useMutate from "@/libs/http/useMutate";
import useAuthStore from "@/libs/stores/authStore";
import useUserStore from "@/libs/stores/userStore";

const INTRO = [
	{
		art: "discover",
		tag: "کشف کن",
		title: "سرگرمی‌ای که به تو می‌آید.",
		text: "از سودوکو تا بازی‌های دیگر؛ تجربهٔ دلخواهت را از گیمنت انتخاب کن و قبل از شروع، راهنمایش را ببین.",
		detail: "بازی‌های در دسترس را یک‌جا پیدا کن.",
	},
	{
		art: "wallet",
		tag: "امتیازهایت را ببین",
		title: "همهٔ امتیازها، یک‌جا.",
		text: "امتیازها، بلیت‌های قرعه‌کشی و تاریخچهٔ حسابت را در کیف‌پول ببین؛ هر جایزه را سرور ثبت می‌کند.",
		detail: "موجودی و گردش حساب همیشه در دسترس است.",
	},
	{
		art: "personalize",
		tag: "شخصی‌سازی کن",
		title: "این فضا، برای توست.",
		text: "ظاهر برنامه را از پروفایل تنظیم کن. هر وقت خواستی می‌توانی انتخاب‌هایت را تغییر بدهی.",
		detail: "روشن، تیره یا هماهنگ با دستگاه.",
	},
] as const;

function Intro({ welcome, onDone }: { welcome: string | null; onDone: () => void }) {
	const [step, setStep] = useState(0);
	const heading = useRef<HTMLHeadingElement>(null);
	const first = useRef(true);
	useEffect(() => {
		if (first.current) {
			first.current = false;
			return;
		}
		heading.current?.focus();
	}, [step]);
	const item = INTRO[step];
	const last = step === INTRO.length - 1;
	// Swipe between the slides. Right to left like the app: «ادامه» points left, so the next slide
	// comes by swiping to the right and the previous one by swiping to the left. A swipe on the
	// last slide stays there (leaving is the button's job, not an accidental flick).
	const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
	const [enter, setEnter] = useState<"" | "next" | "prev">("");
	const go = (to: number) => {
		if (to < 0 || to >= INTRO.length || to === step) return;
		setEnter(to > step ? "next" : "prev");
		setStep(to);
	};
	return (
		<div
			className="au-onboarding au-layout-1 au-swipeable"
			onPointerDown={(e) => {
				if (e.pointerType === "mouse" && e.button !== 0) return;
				swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
			}}
			onPointerUp={(e) => {
				const start = swipe.current;
				swipe.current = null;
				if (!start || start.id !== e.pointerId) return;
				const dx = e.clientX - start.x;
				const dy = e.clientY - start.y;
				// A clear sideways move: far enough, and more sideways than up/down (a scroll).
				if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
				go(dx > 0 ? step + 1 : step - 1);
			}}
			onPointerCancel={() => {
				swipe.current = null;
			}}
		>
			<div className="au-onboarding-top">
				<span className="au-eyebrow">آشنایی با بردینو</span>
				<button type="button" className="bd-text-btn" onClick={onDone}>
					رد کردن
				</button>
			</div>
			{welcome ? <Notice tone="ok">{welcome}</Notice> : null}
			<div className={`au-step-layout ${enter ? `au-enter-${enter}` : ""}`} key={step}>
				<section className="au-intro-art">
					<div className="au-image-art" aria-hidden="true">
						<img
							src={`/bd/art/${item.art}-400.webp`}
							srcSet={`/bd/art/${item.art}-400.webp 400w, /bd/art/${item.art}-840.webp 840w`}
							sizes="(max-width: 540px) 80vw, 420px"
							alt=""
							width={1280}
							height={1280}
							decoding="async"
						/>
					</div>
				</section>
				<section className="au-intro-copy">
					<span className="bd-tag">
						{fa(step + 1)} از ۳ · {item.tag}
					</span>
					<h2 ref={heading} tabIndex={-1}>
						{item.title}
					</h2>
					<p>{item.text}</p>
					<div className="au-intro-detail">
						<Icon name="check" />
						<span>{item.detail}</span>
					</div>
					<div className="au-intro-footer">
						<div className="au-step-dots" aria-label={`مرحلهٔ ${fa(step + 1)} از سه`}>
							{INTRO.map((_, i) => (
								<button key={i} type="button" aria-label={`رفتن به مرحلهٔ ${fa(i + 1)}`} aria-pressed={i === step} onClick={() => go(i)}>
									<span />
								</button>
							))}
						</div>
						<div className="bd-actions">
							<button type="button" className="bd-action" onClick={() => (last ? onDone() : go(step + 1))}>
								{last ? "ورود به خانه" : "ادامه"}
								<Icon name="arrow-left" />
							</button>
							{step > 0 ? (
								<button type="button" className="bd-secondary" onClick={() => go(step - 1)}>
									<Icon name="arrow-right" />
									قبلی
								</button>
							) : null}
						</div>
					</div>
				</section>
			</div>
		</div>
	);
}

/**
 * New players complete their profile (the server's ProfileSetup step), then see three intro
 * slides. Skipping the slides is fine; the profile cannot be skipped. Anyone else goes home.
 */
export default function Onboarding() {
	const { replace } = useRouter();
	const { isLoggedIn } = useAuthStore();
	const { setUser } = useUserStore();
	const queryClient = useQueryClient();
	const points = usePoints();
	const profileQuery = useGetCustomerProfile();
	const profile = profileQuery.data?.result;
	const [phase, setPhase] = useState<"profile" | "intro" | null>(null);
	const [welcome, setWelcome] = useState<string | null>(null);
	const [username, setUsername] = useState("");
	const [birthdate, setBirthdate] = useState("");
	const [gender, setGender] = useState<"" | "M" | "F">("");
	const [tried, setTried] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);

	useEffect(() => {
		if (!isLoggedIn) replace(R.login);
	}, [isLoggedIn, replace]);

	// Decided once, from the first answer: saving the profile moves the server's step on, and that
	// must not throw the player out before the intro.
	const mustCreate = useRef<boolean | null>(null);
	useEffect(() => {
		if (phase !== null) return;
		if (profile) {
			if (profile.registration_step !== "ProfileSetup") {
				replace(R.home);
				return;
			}
			mustCreate.current = !(profile.birthdate && profile.username);
			setUsername(profile.username ?? "");
			setBirthdate(profile.birthdate ?? "");
			setGender(profile.gender === "M" || profile.gender === "F" ? profile.gender : "");
			setPhase("profile");
		} else if (profileQuery.error && (profileQuery.error as { status?: number }).status === 404) {
			mustCreate.current = true;
			setPhase("profile");
		}
	}, [phase, profile, profileQuery.error, replace]);

	const onSaved = () => {
		setUser({ username: username.trim(), gender: gender as "M" | "F", birthdate, registrationStep: "DailyUsageTime" });
		setWelcome(`«${username.trim()}» به بردینو خوش آمدی!`);
		setPhase("intro");
		queryClient.invalidateQueries();
	};
	const create = useMutate({ url: CUSTOMER_URLS.CUSTOMER_REGISTER, onSuccess: onSaved, onError: (e) => setServerError(gameErrorMessage(e)) });
	const update = useMutate({ url: CUSTOMER_URLS.PROFILE_SETUP, method: "PATCH", onSuccess: onSaved, onError: (e) => setServerError(gameErrorMessage(e)) });
	const sending = create.isSending || update.isSending;

	const nameError = usernameProblem(username.trim());
	const problem = nameError ?? (!birthdate ? "تاریخ تولد را کامل انتخاب کن." : !gender ? "جنسیت را انتخاب کن." : null);

	if (phase === "intro") {
		return (
			<AuthShell title="معرفی بردینو">
				<Intro
					welcome={welcome && points.points ? `${welcome} موجودی امتیاز تو: ${fa(points.points)}` : welcome}
					onDone={() => replace(R.home)}
				/>
			</AuthShell>
		);
	}

	return (
		<AuthShell title="تکمیل ثبت‌نام">
			{phase !== "profile" ? (
				<LoadState loading={!profileQuery.error} error={profileQuery.error} onRetry={profileQuery.refetch} />
			) : (
				<Panel title="پروفایلت را کامل کن">
					<form
						noValidate
						onSubmit={(event) => {
							event.preventDefault();
							setTried(true);
							setServerError(null);
							if (problem || sending) return;
							const body = { username: username.trim(), birthdate, gender };
							(mustCreate.current ? create : update).submitHandler(body);
						}}
					>
						<div className="rt-form-grid">
							<label className="rt-field">
								<span>نام کاربری</span>
								<input
									type="text"
									dir="ltr"
									autoComplete="username"
									placeholder="مثل bordino_fan"
									value={username}
									aria-invalid={tried && !!nameError}
									onChange={(event) => setUsername(event.target.value)}
								/>
								{tried && nameError ? <p className="bd-field-error">{nameError}</p> : null}
							</label>
							<JalaliDateField label="تاریخ تولد" value={birthdate} onChange={setBirthdate} error={tried && !birthdate ? "تاریخ تولد را کامل انتخاب کن." : null} />
							<fieldset className="rt-field">
								<legend>جنسیت</legend>
								{(
									[
										["M", "مرد"],
										["F", "زن"],
									] as const
								).map(([value, label]) => (
									<label key={value}>
										<input type="radio" name="gender" checked={gender === value} onChange={() => setGender(value)} /> {label}
									</label>
								))}
								{tried && !gender ? <p className="bd-field-error">جنسیت را انتخاب کن.</p> : null}
							</fieldset>
						</div>
						{serverError ? <Notice>{serverError}</Notice> : null}
						<div className="bd-actions">
							<button type="submit" className="bd-action" disabled={sending}>
								{sending ? "در حال ثبت…" : "تأیید و ادامه"}
							</button>
						</div>
					</form>
				</Panel>
			)}
		</AuthShell>
	);
}
