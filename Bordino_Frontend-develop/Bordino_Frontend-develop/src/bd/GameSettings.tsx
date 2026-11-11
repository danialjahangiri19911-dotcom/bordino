"use client";

import { useEffect, useRef, useState } from "react";

import Icon from "./Icon";
import { useBackHandler } from "./back";

/**
 * One settings dialog for every game (the header's «تنظیمات» button): the same look in each game,
 * following the app's style and scheme, with that game's own options. A game passes its rows:
 * a switch, a choice, or an action (an action that cannot be undone asks once more).
 */
export type GameSettingRow =
	| { kind: "toggle"; id: string; label: string; hint?: string; on: boolean; onChange: (on: boolean) => void; disabled?: boolean }
	| {
			kind: "choice";
			id: string;
			label: string;
			hint?: string;
			value: string;
			options: { value: string; label: string; disabled?: boolean }[];
			onChange: (value: string) => void;
			disabled?: boolean;
	  }
	| { kind: "action"; id: string; label: string; hint?: string; button: string; confirm?: string; onClick: () => void; disabled?: boolean };

export type GameLook = "brutal" | "neon" | "neu";

/** The header button that opens it (each game gives its own button class, so it sits with the others). */
export function GameSettingsButton({ className, open, onClick }: { className: string; open: boolean; onClick: () => void }) {
	return (
		<button type="button" className={className} aria-label="تنظیمات بازی" aria-haspopup="dialog" aria-expanded={open} onClick={onClick}>
			<Icon name="settings-2" />
		</button>
	);
}

function ActionRow({ row }: { row: Extract<GameSettingRow, { kind: "action" }> }) {
	const [asking, setAsking] = useState(false);
	if (asking && row.confirm) {
		return (
			<div className="gs-confirm" role="group" aria-label={row.label}>
				<span>{row.confirm}</span>
				<button
					type="button"
					className="gs-button gs-danger"
					onClick={() => {
						setAsking(false);
						row.onClick();
					}}
				>
					بله
				</button>
				<button type="button" className="gs-button" onClick={() => setAsking(false)}>
					نه
				</button>
			</div>
		);
	}
	return (
		<button type="button" className="gs-button" disabled={row.disabled} onClick={() => (row.confirm ? setAsking(true) : row.onClick())}>
			{row.button}
		</button>
	);
}

export default function GameSettings({
	open,
	onClose,
	game,
	rows,
	look,
	dark,
}: {
	open: boolean;
	onClose: () => void;
	/** The game's name, as in «تنظیمات سودوکو». */
	game: string;
	rows: GameSettingRow[];
	look: GameLook;
	dark: boolean;
}) {
	const panel = useRef<HTMLElement>(null);
	useBackHandler(open, onClose);
	useEffect(() => {
		if (!open) return undefined;
		const back = document.activeElement as HTMLElement | null;
		panel.current?.querySelector<HTMLElement>("button, [tabindex]")?.focus();
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("keydown", onKey);
			back?.focus?.();
		};
	}, [open, onClose]);
	if (!open) return null;
	return (
		<div className={`gs-backdrop gs-${look}${dark || look === "neon" ? " gs-dark" : ""}`} role="presentation" dir="rtl" onClick={(e) => e.target === e.currentTarget && onClose()}>
			<section className="gs-panel" ref={panel} role="dialog" aria-modal="true" aria-labelledby="gs-title">
				<header className="gs-head">
					<h2 id="gs-title">
						<Icon name="settings-2" /> تنظیمات {game}
					</h2>
					<button type="button" className="gs-close" aria-label="بستن تنظیمات" onClick={onClose}>
						<Icon name="x" />
					</button>
				</header>
				<ul className="gs-rows">
					{rows.map((row) => (
						<li key={row.id} className={`gs-row gs-${row.kind}`}>
							<div className="gs-text">
								<b id={`gs-${row.id}`}>{row.label}</b>
								{row.hint ? <small>{row.hint}</small> : null}
							</div>
							{row.kind === "toggle" ? (
								<button
									type="button"
									role="switch"
									className="gs-switch"
									aria-checked={row.on}
									aria-labelledby={`gs-${row.id}`}
									disabled={row.disabled}
									onClick={() => row.onChange(!row.on)}
								>
									<span aria-hidden="true" />
								</button>
							) : row.kind === "choice" ? (
								<div className="gs-choices" role="radiogroup" aria-labelledby={`gs-${row.id}`}>
									{row.options.map((o) => (
										<button
											key={o.value}
											type="button"
											role="radio"
											aria-checked={row.value === o.value}
											disabled={row.disabled || o.disabled}
											onClick={() => row.onChange(o.value)}
										>
											{o.label}
										</button>
									))}
								</div>
							) : (
								<ActionRow row={row} />
							)}
						</li>
					))}
				</ul>
				<button type="button" className="gs-button gs-done" onClick={onClose}>
					<Icon name="check" /> تمام
				</button>
			</section>
		</div>
	);
}
