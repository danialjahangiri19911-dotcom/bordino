"use client";

import { type FormEvent, useEffect, useState } from "react";

import Link from "next/link";

import Icon from "../Icon";
import { APK_URL } from "../BackButton";
import { fa } from "../format";
import { claimQr } from "../missions/api";
import QrScanner, { canScanQr } from "../missions/QrScanner";
import {
	LocationError,
	type MysteryDetail,
	type MysteryPlace,
	type MysteryQrReward,
	type MysteryStep,
	type Proof,
	appTooOld,
	checkinMystery,
	codeFromScan,
	currentPosition,
	startMystery,
	useMystery,
} from "../missions/mystery";
import { AppShell, EmptyState, LoadState, R } from "../ui";
import { useQueryClient } from "@tanstack/react-query";

import { gameErrorMessage } from "@/api/games/request";

const STATE_TEXT: Record<string, string> = {
	upcoming: "این معما هنوز شروع نشده است.",
	expired: "زمان این معما تمام شده است.",
	full: "ظرفیت این معما تکمیل شده است.",
	inactive: "این معما فعلاً غیرفعال است.",
	empty: "این معما هنوز آماده نیست.",
};

type Current = Extract<MysteryStep, { state: "current" }>;
type Win = { place: string; points: number; bonus: number; finished: boolean };

function dateText(iso: string) {
	return new Intl.DateTimeFormat("fa-IR", { month: "long", day: "numeric" }).format(new Date(iso));
}

/** A solved step's place: what the mystery is there to introduce. */
function PlaceCard({ place }: { place: MysteryPlace }) {
	return (
		<div className="my-place">
			<div className="my-place-head">
				{place.logo ? <img src={place.logo} alt="" width={48} height={48} /> : <Icon name="map-pin" />}
				<div>
					<b>{place.name}</b>
					{place.address ? <small>{place.address}</small> : null}
				</div>
			</div>
			{place.about ? <p className="my-place-about">{place.about}</p> : null}
			{place.offer ? (
				<p className="my-offer">
					<Icon name="gift" /> {place.offer}
				</p>
			) : null}
			{place.map || place.url ? (
				<div className="my-place-links">
					{place.map ? (
						<a className="bd-secondary" href={place.map} target="_blank" rel="noopener noreferrer">
							<Icon name="map-pin" /> مسیریابی
						</a>
					) : null}
					{place.url ? (
						<a className="bd-secondary" href={place.url} target="_blank" rel="noopener noreferrer">
							<Icon name="external-link" /> سایت یا صفحه
						</a>
					) : null}
				</div>
			) : null}
		</div>
	);
}

const PROOF_HELP: Record<Current["proof"], string> = {
	qr: "به محل که رسیدی، QR آنجا را اسکن کن.",
	gps: "به محل که رسیدی، «من اینجام» را بزن تا موقعیت گوشی سنجیده شود.",
	answer: "جواب این پرسش فقط در خود محل پیدا می‌شود.",
	staff: "به محل که رسیدی، از کارکنان آنجا «کد بردینو» را بگیر.",
};

/** The step to solve now: its clue, a hint, and the way to prove the player is there. */
function CurrentStep({
	step,
	lockedIn,
	busy,
	onProve,
	onScan,
}: {
	step: Current;
	lockedIn: number;
	busy: boolean;
	onProve: (proof: Proof) => void;
	onScan: () => void;
}) {
	const [hint, setHint] = useState(false);
	const [text, setText] = useState("");
	const [scanHere, setScanHere] = useState(false);
	const oldApp = appTooOld();
	useEffect(() => {
		if (!appTooOld()) void canScanQr().then(setScanHere);
	}, []);
	useEffect(() => {
		setHint(false);
		setText("");
	}, [step.id]);
	const typed = step.proof === "answer" || step.proof === "staff";
	const submit = (e: FormEvent) => {
		e.preventDefault();
		if (!text.trim()) return;
		onProve(step.proof === "staff" ? { code: text } : { answer: text });
	};
	return (
		<div className="my-current">
			<p className="my-clue">{step.clue}</p>
			{step.clue_image ? <img className="my-clue-image" src={step.clue_image} alt="تصویر سرنخ" /> : null}
			{step.hint ? (
				hint ? (
					<p className="my-hint">
						<Icon name="lightbulb" /> {step.hint}
					</p>
				) : (
					<button type="button" className="my-hint-button" onClick={() => setHint(true)}>
						<Icon name="lightbulb" /> راهنمایی
					</button>
				)
			) : null}
			<p className="my-proof-help">
				<Icon name="info" /> {PROOF_HELP[step.proof]}
				{step.check_location && step.proof !== "gps" ? " موقعیت گوشی هم سنجیده می‌شود." : ""}
			</p>
			{lockedIn > 0 ? (
				<p className="my-locked" role="status">
					<Icon name="hourglass" /> چند بار اشتباه شد؛ {fa(Math.ceil(lockedIn / 60))} دقیقهٔ دیگر دوباره امتحان کن.
				</p>
			) : null}
			{step.proof === "qr" ? (
				scanHere ? (
					<button type="button" className="bd-action my-go" disabled={busy} onClick={onScan}>
						<Icon name="qr-code" /> اسکن QR محل
					</button>
				) : (
					<p className="my-note">QR محل را با دوربین گوشی اسکن کن؛ همین معما باز می‌شود و مرحله ثبت می‌شود.</p>
				)
			) : null}
			{oldApp && step.check_location ? (
				<p className="my-note">
					برای سنجیدن موقعیت، اپ بردینو را به‌روز کن (نسخهٔ ۱٫۴). <a href={APK_URL}>دانلود نسخهٔ تازه</a>
				</p>
			) : null}
			{step.proof === "gps" && !oldApp ? (
				<button type="button" className="bd-action my-go" disabled={busy} onClick={() => onProve({})}>
					<Icon name={busy ? "loader-circle" : "map-pin"} className={busy ? "bd-spin" : undefined} /> من اینجام
				</button>
			) : null}
			{typed && !(oldApp && step.check_location) ? (
				<form className="my-answer" onSubmit={submit}>
					{step.proof === "answer" ? <label htmlFor={`my-${step.id}`}>{step.question}</label> : <label htmlFor={`my-${step.id}`}>کد کارکنان محل</label>}
					<div>
						<input
							id={`my-${step.id}`}
							value={text}
							onChange={(e) => setText(e.target.value)}
							maxLength={100}
							autoComplete="off"
							enterKeyHint="send"
							disabled={busy || lockedIn > 0}
							placeholder={step.proof === "staff" ? "کدی که گرفتی" : "جوابت"}
						/>
						<button type="submit" className="bd-action" disabled={busy || lockedIn > 0 || !text.trim()}>
							{busy ? <Icon name="loader-circle" className="bd-spin" /> : "ثبت"}
						</button>
					</div>
				</form>
			) : null}
		</div>
	);
}

/** «معمای شهری»: the mystery's story, the clue to solve now, and the places found so far. */
export default function Mystery({ id }: { id: string }) {
	const { data, isLoading, error, refetch } = useMystery(id);
	const queryClient = useQueryClient();
	const [live, setLive] = useState<MysteryDetail | null>(null);
	const [busy, setBusy] = useState(false);
	const [problem, setProblem] = useState<string | null>(null);
	const [win, setWin] = useState<Win | null>(null);
	const [scanning, setScanning] = useState(false);
	const [lockedUntil, setLockedUntil] = useState(0);
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => setLive(null), [data]);
	const m = live ?? data?.result?.mystery ?? null;
	const lockedIn = Math.max(0, Math.ceil((lockedUntil - now) / 1000));

	useEffect(() => {
		if (m?.run?.locked_in) setLockedUntil(Date.now() + m.run.locked_in * 1000);
	}, [m?.run?.locked_in]);
	useEffect(() => {
		if (!lockedIn) return;
		const t = window.setTimeout(() => setNow(Date.now()), 1000);
		return () => window.clearTimeout(t);
	}, [lockedIn, now]);

	const current = m?.step_list.find((s): s is Current => s.state === "current") ?? null;

	const refreshAll = () => void queryClient.invalidateQueries();

	const start = async () => {
		setBusy(true);
		setProblem(null);
		setWin(null);
		try {
			setLive((await startMystery(id)).mystery);
			refreshAll();
		} catch (e) {
			setProblem(gameErrorMessage(e));
		} finally {
			setBusy(false);
		}
	};

	const prove = async (proof: Proof) => {
		if (!current) return;
		setBusy(true);
		setProblem(null);
		setWin(null);
		try {
			const sent = { ...proof };
			if (current.check_location) Object.assign(sent, await currentPosition());
			const reward = await checkinMystery(id, current.id, sent);
			setLive(reward.mystery);
			if (!reward.already_rewarded) setWin({ place: placeOf(reward.mystery, current.id), points: reward.points, bonus: reward.bonus, finished: reward.finished });
			refreshAll();
		} catch (e) {
			setProblem(e instanceof LocationError ? e.message : gameErrorMessage(e));
			void refetch(); // a wrong answer's count and wait
		} finally {
			setBusy(false);
		}
	};

	const scanned = async (text: string) => {
		setScanning(false);
		const code = codeFromScan(text);
		if (!code) {
			setProblem("این QR مال بردینو نیست.");
			return;
		}
		setBusy(true);
		setProblem(null);
		setWin(null);
		try {
			const reward = (await claimQr(code)) as MysteryQrReward;
			if (reward.mystery && reward.mystery.id === id) {
				if (!reward.already_rewarded) setWin({ place: reward.title ?? "", points: reward.points - reward.mystery.bonus, bonus: reward.mystery.bonus, finished: reward.mystery.finished });
			} else if (reward.mystery) {
				setProblem(`این QR مال معمای دیگری است («${reward.summary ?? ""}»)؛ امتیازش ثبت شد.`);
			} else {
				setProblem(`این QR مال مأموریت «${reward.title ?? ""}» بود${reward.already_rewarded ? "" : ` و ${fa(reward.points)} امتیاز گرفتی`}.`);
			}
			refreshAll();
		} catch (e) {
			setProblem(gameErrorMessage(e));
		} finally {
			setBusy(false);
		}
	};

	useEffect(() => {
		if (!win || win.finished) return;
		const t = window.setTimeout(() => setWin(null), 6000);
		return () => window.clearTimeout(t);
	}, [win]);

	if (!m) {
		return (
			<AppShell nav="earn" title="معمای شهری">
				<LoadState loading={isLoading} error={error} onRetry={refetch} />
			</AppShell>
		);
	}

	const solved = m.step_list.filter((s) => s.state === "done").length;
	const finished = m.run?.status === "completed";
	const blocked = STATE_TEXT[m.state];

	return (
		<AppShell nav="earn" title={m.title}>
			<Link className="my-back" href={R.earn}>
				<Icon name="arrow-right" /> دریافت امتیاز
			</Link>
			<section className="bd-panel my-hero">
				{m.cover ? <img className="my-cover" src={m.cover} alt="" /> : null}
				<span className="bd-tag my-kicker">
					<Icon name="search" /> معمای شهری
				</span>
				<h2>{m.title}</h2>
				{m.summary ? <p className="my-summary">{m.summary}</p> : null}
				<ul className="my-facts">
					{m.area ? (
						<li>
							<Icon name="map-pin" /> {m.area}
						</li>
					) : null}
					<li>
						<Icon name="flag" /> {fa(m.steps)} مرحله
					</li>
					{m.duration_minutes ? (
						<li>
							<Icon name="clock" /> حدود {fa(m.duration_minutes)} دقیقه
						</li>
					) : null}
					<li>
						<Icon name="coins" /> تا {fa(m.points)} امتیاز
					</li>
					{m.ends_at ? (
						<li>
							<Icon name="calendar-clock" /> تا {dateText(m.ends_at)}
						</li>
					) : null}
				</ul>
				{m.story ? <p className="my-story">{m.story}</p> : null}
				{m.run ? (
					<div className="my-progress" aria-label={`${fa(solved)} از ${fa(m.steps)} مرحله`}>
						<span style={{ width: `${m.steps ? (solved / m.steps) * 100 : 0}%` }} />
					</div>
				) : null}
				{!m.run ? (
					blocked ? (
						<p className="my-note">{blocked}</p>
					) : (
						<button type="button" className="bd-action my-go" disabled={busy} onClick={() => void start()}>
							<Icon name="rocket" /> شروع معما
						</button>
					)
				) : null}
			</section>

			{win ? (
				<div className={`bd-panel my-win ${win.finished ? "my-win-final" : ""}`} role="status">
					<Icon name={win.finished ? "trophy" : "party-popper"} />
					<div>
						<b>{win.finished ? "معما را حل کردی!" : `پیدایش کردی${win.place ? `: «${win.place}»` : ""}!`}</b>
						<small>
							+{fa(win.points)} امتیاز{win.bonus ? ` و ${fa(win.bonus)} امتیاز جایزهٔ پایان` : ""} به کیف امتیازت اضافه شد.
						</small>
					</div>
				</div>
			) : null}
			{problem ? (
				<p className="my-problem" role="alert">
					<Icon name="circle-alert" /> {problem}
				</p>
			) : null}

			{m.run ? (
				<ol className="my-steps">
					{m.step_list.map((step) => (
						<li key={step.id} className={`bd-panel my-step my-${step.state}`}>
							<div className="my-step-head">
								<span className="my-step-number">{step.state === "done" ? <Icon name="check" /> : fa(step.number)}</span>
								<b>{step.state === "done" ? step.place.name : `مرحلهٔ ${fa(step.number)}`}</b>
								<span className="my-step-points">+{fa(step.points)}</span>
							</div>
							{step.state === "done" ? (
								<>
									<PlaceCard place={step.place} />
									<details className="my-old-clue">
										<summary>سرنخ این مرحله</summary>
										<p>{step.clue}</p>
									</details>
								</>
							) : step.state === "current" ? (
								m.state === "in_progress" ? (
									<CurrentStep step={step} lockedIn={lockedIn} busy={busy} onProve={(p) => void prove(p)} onScan={() => setScanning(true)} />
								) : (
									<>
										<p className="my-clue">{step.clue}</p>
										<p className="my-note">{blocked ?? "این معما الان باز نیست."}</p>
									</>
								)
							) : (
								<p className="my-locked-text">
									<Icon name="lock-keyhole" /> بعد از حل مرحلهٔ قبل باز می‌شود.
								</p>
							)}
						</li>
					))}
				</ol>
			) : null}

			{finished ? (
				<EmptyState
					icon="trophy"
					title="همهٔ مرحله‌ها را حل کردی"
					text={`${fa(m.run?.points_earned ?? 0)} امتیاز از این معما گرفتی. محل‌هایی که پیدا کردی همین بالا هستند.`}
					action={
						<Link className="bd-action" href={R.earn}>
							مأموریت‌های دیگر
						</Link>
					}
				/>
			) : null}
			{scanning ? <QrScanner onCode={(t) => void scanned(t)} onClose={() => setScanning(false)} /> : null}
		</AppShell>
	);
}

function placeOf(m: MysteryDetail, stepId: string) {
	const step = m.step_list.find((s) => s.id === stepId);
	return step && step.state === "done" ? step.place.name : "";
}
