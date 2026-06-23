import React from "react";

import CloseIcon from "@mui/icons-material/Close";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import { DeepOrange200, LightBlue200 } from "@/libs/games/sudoku/theme";

interface GameOverDialogProps {
	open: boolean;
	mistakes: number;
	maxMistakes: number;
	onNewGame: () => void;
	onExit: () => void;
}

export function GameOverDialog({
	open,
	mistakes,
	maxMistakes,
	onNewGame,
	onExit,
}: GameOverDialogProps) {
	return (
		<Dialog open={open} onClose={onExit} dir="rtl">
			<DialogTitle>
				پایان بازی
				<IconButton
					aria-label="بستن"
					onClick={onExit}
					sx={{ position: "absolute", right: 8, top: 8 }}
				>
					<CloseIcon />
				</IconButton>
			</DialogTitle>
			<DialogContent>
				<Paper sx={{ p: 2, bgcolor: DeepOrange200 }}>
					<Typography variant="h6" align="center">
						{mistakes >= maxMistakes ? "خطاهای زیاد!" : "زمان تمام شد!"}
					</Typography>
					<Typography variant="body1" align="center" sx={{ mt: 1 }}>
						می‌خواهی دوباره تلاش کنی؟
					</Typography>
				</Paper>
			</DialogContent>
			<DialogActions>
				<Button onClick={onNewGame} variant="contained">
					بازی جدید
				</Button>
				<Button onClick={onExit} variant="outlined">
					خروج به منو
				</Button>
			</DialogActions>
		</Dialog>
	);
}

interface ExitConfirmDialogProps {
	open: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}

export function ExitConfirmDialog({
	open,
	onConfirm,
	onCancel,
}: ExitConfirmDialogProps) {
	return (
		<Dialog open={open} onClose={onCancel} dir="rtl">
			<DialogTitle>
				خروج به منو؟
				<IconButton
					aria-label="بستن"
					onClick={onCancel}
					sx={{ position: "absolute", right: 8, top: 8 }}
				>
					<CloseIcon />
				</IconButton>
			</DialogTitle>
			<DialogContent>پیشرفت فعلی بازی از بین می‌رود.</DialogContent>
			<DialogActions>
				<Button onClick={onCancel}>انصراف</Button>
				<Button onClick={onConfirm} variant="contained" color="primary">
					خروج
				</Button>
			</DialogActions>
		</Dialog>
	);
}

interface VictoryMessageProps {
	difficulty: string | null;
	mediumUnlocked: boolean;
	hardUnlocked: boolean;
	completions: { easy: number; medium: number };
	onContinue: () => void;
}

export function VictoryMessage({
	difficulty,
	mediumUnlocked,
	hardUnlocked,
	completions,
	onContinue,
}: VictoryMessageProps) {
	if (!difficulty) return null;
	return (
		<Paper
			dir="rtl"
			sx={{
				mt: 2,
				p: 2,
				bgcolor: LightBlue200,
				maxWidth: "400px",
				textAlign: "center",
			}}
		>
			<Typography variant="h6" align="center">
				🎉 آفرین! حل شد 🎉
			</Typography>
			{difficulty === "easy" && !mediumUnlocked && completions.easy === 1 && (
				<Typography variant="body2" align="center" sx={{ mt: 1 }}>
					تبریک! سطح «متوسط» باز شد.
				</Typography>
			)}
			{difficulty === "medium" && completions.medium === 1 && (
				<Typography variant="body2" align="center" sx={{ mt: 1 }}>
					عالی بود! یک برد دیگر در «متوسط» تا باز شدن «سخت».
				</Typography>
			)}
			{difficulty === "medium" && completions.medium === 2 && hardUnlocked && (
				<Typography variant="body2" align="center" sx={{ mt: 1 }}>
					فوق‌العاده! سطح «سخت» باز شد.
				</Typography>
			)}
			<Button variant="contained" onClick={onContinue} sx={{ mt: 2 }}>
				ادامه
			</Button>
		</Paper>
	);
}
