"use client";

import { useEffect, useState } from "react";

import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Dialog from "@mui/material/Dialog";
import InputBase from "@mui/material/InputBase";
import Typography from "@mui/material/Typography";

import { CRASH_COLORS } from "./utils";
import { toPersianDigits } from "@/libs/utils/persianNumberConverter";

/** What the dialog shows about the last finished round of any points game. */
export interface FairRound {
	server_seed_hash: string;
	server_seed: string | null;
	client_seed: string;
	nonce: number;
	/** e.g. «×۲.۴۱» or «خط ۷». */
	resultLabel: string | null;
}

interface Props {
	open: boolean;
	onClose: () => void;
	clientSeed: string;
	nextNonce: number;
	lastRound: FairRound | null;
	seedLocked: boolean;
	onChangeSeed: (seed: string) => Promise<boolean>;
	/** How this game turns the seeds into a result (monospace, left-to-right). */
	formula: React.ReactNode;
	/** Recomputes the last round in the browser and describes the outcome. */
	onVerify?: () => Promise<string>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<Box sx={{ mb: 1.5 }}>
			<Typography sx={{ fontSize: 12, color: CRASH_COLORS.muted, mb: 0.5 }}>{label}</Typography>
			<Box
				sx={{
					bgcolor: CRASH_COLORS.page,
					border: `1px solid ${CRASH_COLORS.border}`,
					borderRadius: 1,
					px: 1.25,
					py: 1,
					fontFamily: "monospace",
					fontSize: 12,
					color: CRASH_COLORS.text,
					wordBreak: "break-all",
					direction: "ltr",
					textAlign: "left",
				}}
			>
				{value}
			</Box>
		</Box>
	);
}

export default function FairnessDialog({
	open,
	onClose,
	clientSeed,
	nextNonce,
	lastRound,
	seedLocked,
	onChangeSeed,
	formula,
	onVerify,
}: Props) {
	const [seed, setSeed] = useState("");
	const [check, setCheck] = useState<string | null>(null);

	useEffect(() => {
		if (open) {
			setSeed(clientSeed);
			setCheck(null);
		}
	}, [open, clientSeed]);

	return (
		<Dialog
			open={open}
			onClose={onClose}
			fullWidth
			maxWidth="xs"
			PaperProps={{ sx: { bgcolor: CRASH_COLORS.panel, color: CRASH_COLORS.text, borderRadius: 3, p: 2.5 } }}
		>
			<Typography sx={{ fontWeight: 800, fontSize: 18, mb: 1 }}>منصفانه بودن بازی</Typography>
			<Typography component="div" sx={{ fontSize: 13, color: CRASH_COLORS.muted, mb: 2, lineHeight: 1.9 }}>
				نتیجهٔ هر دست پیش از شرط با «بذر سرور» تعیین می‌شود و هش آن را همان لحظه می‌بینی. بعد از پایان
				دست خودِ بذر نمایش داده می‌شود تا بتوانی نتیجه را دوباره حساب کنی:
				<Box sx={{ direction: "ltr", textAlign: "left", fontFamily: "monospace", fontSize: 11, mt: 1 }}>
					{formula}
				</Box>
			</Typography>

			<Typography sx={{ fontSize: 12, color: CRASH_COLORS.muted, mb: 0.5 }}>
				بذر شما (client seed) — در همهٔ بازی‌ها مشترک است
			</Typography>
			<Box sx={{ display: "flex", gap: 1, mb: 1.5 }}>
				<InputBase
					value={seed}
					onChange={(e) => setSeed(e.target.value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64))}
					inputProps={{ "aria-label": "بذر شما", dir: "ltr" }}
					disabled={seedLocked}
					sx={{
						flex: 1,
						bgcolor: CRASH_COLORS.page,
						border: `1px solid ${CRASH_COLORS.border}`,
						borderRadius: 1,
						px: 1.25,
						height: 40,
						color: CRASH_COLORS.text,
						fontFamily: "monospace",
						fontSize: 13,
					}}
				/>
				<ButtonBase
					disabled={seedLocked || !seed || seed === clientSeed}
					onClick={() => onChangeSeed(seed)}
					sx={{
						px: 2,
						borderRadius: 1,
						bgcolor: CRASH_COLORS.border,
						color: CRASH_COLORS.text,
						fontWeight: 700,
						"&.Mui-disabled": { opacity: 0.5 },
					}}
				>
					ذخیره
				</ButtonBase>
			</Box>
			<Row label="شمارهٔ دست بعدی (nonce)" value={toPersianDigits(nextNonce)} />

			{lastRound && (
				<>
					<Typography sx={{ fontWeight: 700, fontSize: 14, mt: 1, mb: 1 }}>
						آخرین دست {lastRound.resultLabel ? `(${lastRound.resultLabel})` : ""}
					</Typography>
					<Row label="هش بذر سرور" value={lastRound.server_seed_hash} />
					<Row label="بذر سرور" value={lastRound.server_seed ?? "بعد از پایان دست نمایش داده می‌شود"} />
					<Row label="بذر شما : nonce" value={`${lastRound.client_seed}:${lastRound.nonce}`} />
					{lastRound.server_seed && onVerify && (
						<ButtonBase
							onClick={async () => setCheck(await onVerify())}
							sx={{ width: "100%", height: 42, borderRadius: 1, bgcolor: CRASH_COLORS.border, color: CRASH_COLORS.text, fontWeight: 700 }}
						>
							بررسی نتیجه
						</ButtonBase>
					)}
					{check && <Typography sx={{ mt: 1, fontSize: 13, textAlign: "center" }}>{check}</Typography>}
				</>
			)}
		</Dialog>
	);
}
