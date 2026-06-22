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
		<Dialog open={open} onClose={onExit}>
			<DialogTitle sx={{ fontFamily: '"Special Elite", cursive' }}>
				Game Over
				<IconButton
					aria-label="close"
					onClick={onExit}
					sx={{ position: "absolute", right: 8, top: 8 }}
				>
					<CloseIcon />
				</IconButton>
			</DialogTitle>
			<DialogContent sx={{ fontFamily: '"Special Elite", cursive' }}>
				<Paper sx={{ p: 2, bgcolor: DeepOrange200 }}>
					<Typography variant="h6" align="center">
						{mistakes >= maxMistakes ? "Too many mistakes!" : "Time's up!"}
					</Typography>
					<Typography variant="body1" align="center" sx={{ mt: 1 }}>
						Would you like to try again?
					</Typography>
				</Paper>
			</DialogContent>
			<DialogActions>
				<Button onClick={onNewGame} variant="contained">
					New Game
				</Button>
				<Button onClick={onExit} variant="outlined">
					Exit to Menu
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
		<Dialog open={open} onClose={onCancel}>
			<DialogTitle sx={{ fontFamily: '"Special Elite", cursive' }}>
				Exit to menu?
				<IconButton
					aria-label="close"
					onClick={onCancel}
					sx={{ position: "absolute", right: 8, top: 8 }}
				>
					<CloseIcon />
				</IconButton>
			</DialogTitle>
			<DialogContent sx={{ fontFamily: '"Special Elite", cursive' }}>
				Your current progress will be lost.
			</DialogContent>
			<DialogActions>
				<Button onClick={onCancel}>Cancel</Button>
				<Button onClick={onConfirm} variant="contained" color="primary">
					Exit
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
			sx={{
				mt: 2,
				p: 2,
				bgcolor: LightBlue200,
				maxWidth: "400px",
				textAlign: "center",
			}}
		>
			<Typography variant="h6" align="center">
				🎉 Puzzle solved! 🎉
			</Typography>
			{difficulty === "easy" && !mediumUnlocked && completions.easy === 1 && (
				<Typography variant="body2" align="center" sx={{ mt: 1 }}>
					Congratulations! Medium difficulty is now unlocked.
				</Typography>
			)}
			{difficulty === "medium" && completions.medium === 1 && (
				<Typography variant="body2" align="center" sx={{ mt: 1 }}>
					Great! One more Medium win to unlock Hard.
				</Typography>
			)}
			{difficulty === "medium" && completions.medium === 2 && hardUnlocked && (
				<Typography variant="body2" align="center" sx={{ mt: 1 }}>
					Amazing! Hard difficulty is now unlocked.
				</Typography>
			)}
			<Button variant="contained" onClick={onContinue} sx={{ mt: 2 }}>
				Continue
			</Button>
		</Paper>
	);
}
