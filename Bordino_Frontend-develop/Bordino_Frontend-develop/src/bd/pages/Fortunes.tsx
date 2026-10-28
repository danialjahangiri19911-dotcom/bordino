"use client";

import { useState } from "react";

import Icon from "../Icon";
import { fa } from "../format";
import { AppShell, Art, Chips, LoadState, Notice, Panel } from "../ui";

import useGetFortuneReading from "@/api/entertainment/hooks/useGetFortuneReading";
import useGetTarotReading from "@/api/entertainment/hooks/useGetTarotReading";
import type { TarotSpread } from "@/api/entertainment/types/tarotType";
import { parseHafezResult } from "@/api/entertainment/types/fortuneReadingType";

export function Hafez() {
	const { fortune, loading, error, fetchFortune } = useGetFortuneReading();
	const poem = fortune ? parseHafezResult(fortune.result) : null;
	return (
		<AppShell nav="home" title="فال حافظ">
			<div className="rt-game-layout">
				<div className="rt-book bi-literary">
					<Art name="hafez" />
					<strong>دیوان حافظ</strong>
					<small>چند لحظه برای آرامش</small>
				</div>
				<Panel title="فال امروز تو">
					<p>نیت کن و دکمهٔ زیر را بزن؛ یک غزل از دیوان حافظ برایت باز می‌شود.</p>
					<button type="button" className="bd-action" disabled={loading} onClick={() => void fetchFortune()}>
						{loading ? "در حال باز کردن دیوان…" : fortune ? "یک فال دیگر" : "گرفتن فال"}
					</button>
					{error ? <LoadState error onRetry={() => void fetchFortune()} errorText="فال باز نشد؛ اتصال را بررسی کن." /> : null}
					{poem && fortune ? (
						<div className="rt-fortune-result" aria-live="polite">
							<h3>{fortune.question}</h3>
							<div className="bd-poem">
								{poem.rightCol.map((line, i) => (
									<p key={i}>
										<span>{line}</span>
										{poem.leftCol[i] ? <span>{poem.leftCol[i]}</span> : null}
									</p>
								))}
							</div>
							{poem.interpretation ? (
								<>
									<h3>تعبیر</h3>
									<p style={{ whiteSpace: "pre-line" }}>{poem.interpretation}</p>
								</>
							) : null}
							{fortune.audio_url ? (
								<audio controls preload="none" src={fortune.audio_url} className="bd-audio">
									<track kind="captions" />
								</audio>
							) : null}
						</div>
					) : null}
				</Panel>
			</div>
		</AppShell>
	);
}

const POSITIONS: Record<TarotSpread, string[]> = {
	3: ["گذشته", "حال", "آینده"],
	5: ["وضعیت کنونی", "چالش / مانع", "گذشته", "آیندهٔ نزدیک", "نتیجه"],
};

export function Tarot() {
	const [spread, setSpread] = useState<TarotSpread>(3);
	const [open, setOpen] = useState<number | null>(null);
	const { cards, loading, error, fetchTarot } = useGetTarotReading();
	// The positions belong to the spread the cards were drawn with, not to the selector's value now.
	const [drawn, setDrawn] = useState<TarotSpread>(3);
	const draw = () => {
		setOpen(null);
		setDrawn(spread);
		void fetchTarot(spread);
	};
	const card = open !== null ? cards?.[open] : null;
	return (
		<AppShell nav="home" title="فال تاروت">
			<div className="rt-tarot-stage">
				<Art name="tarot" />
				<Chips
					label="تعداد کارت"
					value={String(spread) as "3" | "5"}
					onChange={(v) => {
						setSpread(Number(v) as TarotSpread);
						setOpen(null);
					}}
					options={[
						["3", "۳ کارت"],
						["5", "۵ کارت"],
					]}
				/>
				{!cards ? (
					<>
						<p className="bd-muted">نیت کن و کارت‌ها را بکش؛ کارت‌ها را سرور برایت برمی‌زند.</p>
						<button type="button" className="bd-action" disabled={loading} onClick={draw}>
							{loading ? "در حال بُر زدن…" : "کشیدن کارت‌ها"}
						</button>
						{error ? <Notice>کارت‌ها آماده نشد؛ دوباره تلاش کن.</Notice> : null}
					</>
				) : (
					<>
						<p className="bd-muted">یک کارت را برای دیدن تعبیرش لمس کن.</p>
						<div className="rt-tarot-cards">
							{cards.map((c, i) => (
								<button
									key={`${c.order}-${i}`}
									type="button"
									className="rt-tarot-card"
									aria-pressed={open === i}
									aria-label={`کارت ${fa(i + 1)}: ${POSITIONS[drawn][i] ?? ""}`}
									onClick={() => setOpen(i)}
								>
									{open === i || open !== null ? <span className="bd-tarot-symbol">{c.symbol}</span> : <Icon name="sparkles" />}
									<small>{POSITIONS[drawn][i] ?? "BORDINO"}</small>
								</button>
							))}
						</div>
						{card ? (
							<div className="rt-fortune-result" aria-live="polite">
								<h3>
									{POSITIONS[drawn][open ?? 0]}: {card.name}
								</h3>
								<p style={{ whiteSpace: "pre-line" }}>{card.interpretation}</p>
							</div>
						) : null}
						<button type="button" className="bd-secondary" disabled={loading} onClick={draw}>
							{loading ? "در حال بُر زدن…" : "فال تازه"}
						</button>
					</>
				)}
			</div>
		</AppShell>
	);
}
