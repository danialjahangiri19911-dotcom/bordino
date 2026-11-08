"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import Icon, { type IconName } from "../Icon";
import { type AppMode as Mode, saveProfile, useGmProfile } from "../gm/api";
import { AppShell, Notice, Panel, R } from "../ui";
import { useQueryClient } from "@tanstack/react-query";

import { gameErrorMessage } from "@/api/games/request";

const MODES: [Mode, string, string, IconName][] = [
	["player", "حالت بازیکن", "بازی کن، مأموریت انجام بده و جایزه بگیر.", "gamepad-2"],
	["creator", "گیم مستر", "بازی خودت را بساز: معمای تولد، چالش فروشگاه یا گنج‌یابی شهری.", "sparkles"],
];

/** Settings → «حالت برنامه»: Player Mode or Game Master, in the same account and session. */
export default function AppMode() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { data } = useGmProfile();
	const profile = data?.result?.profile;
	const [busy, setBusy] = useState<Mode | null>(null);
	const [problem, setProblem] = useState<string | null>(null);
	const current: Mode = profile?.preferred_mode ?? "player";
	const pick = async (mode: Mode) => {
		setBusy(mode);
		setProblem(null);
		try {
			await saveProfile({ preferred_mode: mode });
			await queryClient.invalidateQueries();
			router.push(mode === "creator" ? "/pwa/gm" : R.home);
		} catch (e) {
			setProblem(gameErrorMessage(e));
		} finally {
			setBusy(null);
		}
	};
	return (
		<AppShell nav="profile" title="حالت برنامه">
			<Panel title="حالت برنامه">
				<div className="gm-choice-grid" role="radiogroup" aria-label="حالت برنامه">
					{MODES.map(([mode, label, text, icon]) => (
						<button
							key={mode}
							type="button"
							role="radio"
							aria-checked={current === mode}
							className="gm-choice"
							disabled={!!busy || (mode === "creator" && profile ? !profile.available : false)}
							onClick={() => void pick(mode)}
						>
							<Icon name={busy === mode ? "loader-circle" : icon} className={busy === mode ? "bd-spin" : undefined} />
							<b>{label}</b>
							<small>{text}</small>
						</button>
					))}
				</div>
				{profile && !profile.available ? <Notice tone="info">گیم مستر به‌زودی برای همه باز می‌شود.</Notice> : null}
				{problem ? <Notice>{problem}</Notice> : null}
				<small className="bd-muted">با عوض کردن حالت از حسابت خارج نمی‌شوی؛ امتیاز و کیف پولت همان می‌ماند. انتخابت برای دفعه‌های بعد هم یادمان می‌ماند.</small>
			</Panel>
		</AppShell>
	);
}
