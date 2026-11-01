"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";

import Icon from "../Icon";
import { AD_PLAYERS } from "../ads/players";
import { useBackHandler } from "../back";
import { fa } from "../format";
import { KIND_ICON, STATE_LABEL, progressText } from "./labels";
import { PhotoError, openPhoto } from "../photo";
import { type Mission, claimMission, openedMission, sendProof, startMission } from "./api";
import { useQueryClient } from "@tanstack/react-query";

import { gameErrorMessage } from "@/api/games/request";

const KIND_LABEL: Record<Mission["kind"], string> = {
	video: "تماشای ویدیو",
	banner: "کلیک روی بنر",
	signup: "ثبت‌نام",
	install: "نصب اپلیکیشن",
	qr: "حضور و اسکن QR",
};

type Step = { kind: "idle" } | { kind: "busy" } | { kind: "video" } | { kind: "rewarded"; points: number };

const inApp = () => typeof navigator !== "undefined" && navigator.userAgent.includes("BordinoApp/");

function dateText(iso: string) {
	return new Intl.DateTimeFormat("fa-IR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new PhotoError("ساخت تصویر ممکن نشد."))), "image/jpeg", 0.85));
}

/** One mission: what it asks, its state, and the next step (start, open the link, claim, send proof). */
export default function MissionSheet({ mission, onClose, onChanged }: { mission: Mission; onClose: () => void; onChanged: () => void }) {
	const queryClient = useQueryClient();
	const [m, setM] = useState(mission);
	const [step, setStep] = useState<Step>({ kind: "idle" });
	const [problem, setProblem] = useState<string | null>(null);
	const [text, setText] = useState("");
	const [image, setImage] = useState<Blob | null>(null);
	const [preview, setPreview] = useState<string | null>(null);
	const [now, setNow] = useState(() => Date.now());
	const claimAt = useRef(0);
	const file = useRef<HTMLInputElement>(null);

	useEffect(() => setM(mission), [mission]);
	useEffect(() => {
		claimAt.current = Date.now() + (m.attempt?.claim_in ?? 0) * 1000;
		setNow(Date.now());
	}, [m]);
	const waitSeconds = Math.max(0, Math.ceil((claimAt.current - now) / 1000));
	useEffect(() => {
		if (!waitSeconds) return;
		const t = window.setTimeout(() => setNow(Date.now()), 500);
		return () => window.clearTimeout(t);
	}, [waitSeconds, now]);
	useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);
	useEffect(() => {
		if (step.kind !== "rewarded") return;
		const t = window.setTimeout(onClose, 1600);
		return () => window.clearTimeout(t);
	}, [step, onClose]);

	useBackHandler(step.kind !== "video", onClose);

	const update = (next: Mission | undefined) => {
		if (next) setM(next);
		onChanged();
	};

	const start = async () => {
		setProblem(null);
		setStep({ kind: "busy" });
		try {
			const { mission: next } = await startMission(m.id);
			update(next);
			setStep(next.kind === "video" && next.attempt?.ad ? { kind: "video" } : { kind: "idle" });
		} catch (e) {
			setProblem(gameErrorMessage(e));
			setStep({ kind: "idle" });
			onChanged();
		}
	};

	const opened = () => {
		if (!m.attempt || m.attempt.opened) return;
		// The banner's wait starts when the server hears of the opening.
		openedMission(m.attempt.id)
			.then(({ mission: next }) => update(next))
			.catch(() => undefined);
	};

	const claim = async () => {
		if (!m.attempt) return;
		setProblem(null);
		setStep({ kind: "busy" });
		try {
			const reward = await claimMission(m.attempt.id);
			void queryClient.invalidateQueries();
			update(reward.mission);
			setStep({ kind: "rewarded", points: reward.points });
		} catch (e) {
			setProblem(gameErrorMessage(e));
			setStep({ kind: "idle" });
			onChanged();
		}
	};

	const choose = async (event: ChangeEvent<HTMLInputElement>) => {
		const picked = event.target.files?.[0];
		event.target.value = "";
		if (!picked) return;
		setProblem(null);
		try {
			const blob = await toJpeg(await openPhoto(picked));
			setImage(blob);
			setPreview(URL.createObjectURL(blob));
		} catch (e) {
			setProblem(e instanceof PhotoError ? e.message : "این فایل باز نشد؛ یک تصویر دیگر انتخاب کن.");
		}
	};

	const send = async () => {
		if (!m.attempt) return;
		setProblem(null);
		setStep({ kind: "busy" });
		try {
			const { mission: next } = await sendProof(m.attempt.id, text.trim(), image);
			update(next);
			setStep({ kind: "idle" });
		} catch (e) {
			setProblem(gameErrorMessage(e));
			setStep({ kind: "idle" });
		}
	};

	if (step.kind === "video" && m.attempt?.ad) {
		const Player = AD_PLAYERS[m.attempt.ad.provider] ?? AD_PLAYERS.demo;
		return (
			<Player
				session={m.attempt.ad}
				onWatched={() => void claim()}
				onAbort={() => {
					setStep({ kind: "idle" });
					onChanged();
				}}
			/>
		);
	}

	const busy = step.kind === "busy";
	const open = m.attempt?.status === "started" ? m.attempt : null;
	const canStart = m.state === "available" || m.state === "rejected" || (m.state === "in_progress" && m.kind === "video");
	const partner = m.partner_name || "سایت همکار";
	const linkTarget = inApp() ? {} : { target: "_blank", rel: "noopener noreferrer" };
	const proofReady = (!m.proof_label || text.trim()) && (!m.proof_image_required || image) && (text.trim() || image);
	const progress = progressText(m);

	return (
		<div className="bd-sheet-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
			<div className="bd-sheet bd-reward mi-sheet" role="dialog" aria-modal="true" aria-labelledby="mission-title">
				{step.kind === "rewarded" ? (
					<div className="bd-reward-done" role="status">
						<span className="bd-reward-coin">
							<Icon name="check" />
						</span>
						<b id="mission-title">
							<bdi dir="ltr">+{fa(step.points)}</bdi> امتیاز
						</b>
						<p>به کیف امتیازت اضافه شد.</p>
					</div>
				) : (
					<>
						<span className={`bd-reward-coin ${m.image ? "mi-logo" : ""}`} aria-hidden="true">
							{m.image ? <img src={m.image} alt="" width={64} height={64} /> : <Icon name={KIND_ICON[m.kind]} />}
						</span>
						<p className="bd-reward-heading" id="mission-title">
							{m.title}
						</p>
						<div className="mi-sheet-tags">
							<span className={`bd-tag mi-state mi-${m.state}`}>{STATE_LABEL[m.state]}</span>
							<span className="bd-tag">{KIND_LABEL[m.kind]}</span>
							<span className="bd-tag mi-points-tag">
								<bdi dir="ltr">+{fa(m.points)}</bdi> امتیاز
							</span>
						</div>
						{m.summary ? <p className="bd-reward-text">{m.summary}</p> : null}
						{m.description ? <p className="mi-description">{m.description}</p> : null}
						<ul className="mi-facts">
							{progress ? <li>{progress}</li> : <li>یک بار</li>}
							{m.starts_at && m.state === "upcoming" ? <li>شروع: {dateText(m.starts_at)}</li> : null}
							{m.ends_at ? <li>پایان: {dateText(m.ends_at)}</li> : null}
						</ul>

						{m.state === "pending" || m.pending > 0 ? <p className="mi-note mi-note-wait">مدرکت رسید و در انتظار بررسی است؛ بعد از تأیید، امتیاز خودکار اضافه می‌شود.</p> : null}
						{m.state === "rejected" && m.attempt?.review_note ? <p className="mi-note mi-note-bad">دلیل رد: {m.attempt.review_note}</p> : null}
						{m.state === "done" ? <p className="mi-note mi-note-ok">این مأموریت را انجام داده‌ای و امتیازش را گرفته‌ای.</p> : null}
						{m.state === "done_today" ? <p className="mi-note mi-note-ok">سهم امروزت را گرفتی؛ فردا دوباره بیا.</p> : null}
						{m.state === "upcoming" ? <p className="mi-note">این مأموریت هنوز شروع نشده است.</p> : null}
						{m.state === "expired" ? <p className="mi-note">زمان این مأموریت تمام شده است.</p> : null}
						{m.state === "full" ? <p className="mi-note">ظرفیت این مأموریت تکمیل شده است.</p> : null}
						{m.state === "inactive" ? <p className="mi-note">این مأموریت فعلاً غیرفعال است.</p> : null}
						{m.kind === "qr" && m.state === "available" ? (
							<p className="mi-note">
								<Icon name="map-pin" /> به محل برو و QR آن‌جا را با دوربین گوشی اسکن کن؛ امتیاز همان لحظه اضافه می‌شود.
							</p>
						) : null}

						{open && m.kind !== "video" && open.link ? (
							<a className="bd-sheet-item mi-link" href={open.link} {...linkTarget} onClick={opened}>
								<Icon name="external-link" /> {m.kind === "banner" ? "باز کردن بنر" : `رفتن به ${partner}`}
							</a>
						) : null}
						{open && m.kind === "banner" ? (
							<button type="button" className="bd-sheet-item bd-reward-main" disabled={busy || !open.opened || waitSeconds > 0} onClick={() => void claim()}>
								{busy ? <Icon name="loader-circle" className="bd-spin" /> : <Icon name="coins" />}
								{!open.opened ? "اول بنر را باز کن" : waitSeconds > 0 ? `دریافت امتیاز تا ${fa(waitSeconds)} ثانیهٔ دیگر` : `دریافت ${fa(m.points)} امتیاز`}
							</button>
						) : null}
						{open && m.verification === "callback" ? (
							<p className="mi-note mi-note-wait">بعد از {m.kind === "install" ? "نصب و ثبت‌نام" : "ثبت‌نام"} در {partner}، تأیید از طرف خود {partner} می‌رسد و امتیاز خودکار اضافه می‌شود.</p>
						) : null}
						{open && m.verification === "review" ? (
							<div className="mi-proof">
								<p className="mi-note">بعد از انجام، مدرکش را بفرست تا بررسی شود.</p>
								{m.proof_label ? (
									<label className="rt-field">
										<span>{m.proof_label}</span>
										<input value={text} maxLength={200} onChange={(e) => setText(e.target.value)} disabled={busy} />
									</label>
								) : null}
								<input ref={file} type="file" accept="image/*" hidden onChange={(e) => void choose(e)} />
								<button type="button" className="bd-sheet-item" disabled={busy} onClick={() => file.current?.click()}>
									<Icon name={preview ? "image" : "upload"} />
									{preview ? "تغییر اسکرین‌شات" : m.proof_image_required ? "افزودن اسکرین‌شات (لازم)" : "افزودن اسکرین‌شات (اختیاری)"}
								</button>
								{preview ? <img className="mi-proof-preview" src={preview} alt="اسکرین‌شات انتخاب‌شده" /> : null}
								{!m.proof_label && !m.proof_image_required ? (
									<label className="rt-field">
										<span>توضیح (اختیاری)</span>
										<input value={text} maxLength={200} onChange={(e) => setText(e.target.value)} disabled={busy} />
									</label>
								) : null}
								<button type="button" className="bd-sheet-item bd-reward-main" disabled={busy || !proofReady} onClick={() => void send()}>
									{busy ? <Icon name="loader-circle" className="bd-spin" /> : <Icon name="badge-check" />} ارسال برای بررسی
								</button>
							</div>
						) : null}
						{canStart && m.kind !== "qr" && !(open && m.kind !== "video") ? (
							<button type="button" className="bd-sheet-item bd-reward-main" autoFocus disabled={busy} onClick={() => void start()}>
								{busy ? <Icon name="loader-circle" className="bd-spin" /> : <Icon name={m.kind === "video" ? "play" : "arrow-left"} />}
								{m.kind === "video" ? `تماشای ویدیو و دریافت ${fa(m.points)} امتیاز` : m.state === "rejected" ? "تلاش دوباره" : "شروع مأموریت"}
							</button>
						) : null}
						{problem ? (
							<p className="mi-note mi-note-bad" role="alert">
								{problem}
							</p>
						) : null}
						<button type="button" className="bd-sheet-item bd-sheet-cancel" disabled={busy} onClick={onClose}>
							بستن
						</button>
					</>
				)}
			</div>
		</div>
	);
}
