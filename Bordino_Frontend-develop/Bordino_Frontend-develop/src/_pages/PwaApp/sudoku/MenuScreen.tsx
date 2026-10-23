import React from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";

import { toFa } from "@/libs/games/sudoku/faDigits";

interface MenuScreenProps {
	completions: { easy: number; medium: number };
	mediumUnlocked: boolean;
	hardUnlocked: boolean;
	onSelectDifficulty: (difficulty: "easy" | "medium" | "hard") => void;
	/** A game is being started (and paid for): no second tap. */
	busy?: boolean;
}

export function MenuScreen({
	completions,
	mediumUnlocked,
	hardUnlocked,
	onSelectDifficulty,
	busy = false,
}: MenuScreenProps) {
	return (
		<Container
			dir="rtl"
			maxWidth="sm"
			sx={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				minHeight: "100vh",
				py: 4,
			}}
		>
			<Typography variant="h4" gutterBottom fontWeight={700}>
				سودوکو
			</Typography>
			<Typography variant="body1" paragraph align="center">
				سطح بازی را انتخاب کن. با بردن «آسان»، «متوسط» باز می‌شود و با دو برد در
				«متوسط»، «سخت» باز می‌شود.
			</Typography>

			<Box sx={{ width: "100%", maxWidth: 300, mt: 4 }}>
				<Typography variant="h6" gutterBottom align="center">
					انتخاب سطح
				</Typography>

				<Button
					fullWidth
					variant="contained"
					size="large"
					sx={{ mb: 2 }}
					disabled={busy}
					onClick={() => onSelectDifficulty("easy")}
				>
					آسان
					{completions.easy > 0 && (
						<Typography variant="caption" sx={{ mr: 1 }}>
							({toFa(completions.easy)} برد)
						</Typography>
					)}
				</Button>

				<Button
					fullWidth
					variant={mediumUnlocked ? "contained" : "outlined"}
					size="large"
					sx={{ mb: 2 }}
					disabled={!mediumUnlocked || busy}
					onClick={() => mediumUnlocked && onSelectDifficulty("medium")}
				>
					متوسط
					{!mediumUnlocked && " (قفل)"}
					{mediumUnlocked && completions.medium > 0 && (
						<Typography variant="caption" sx={{ mr: 1 }}>
							({toFa(completions.medium)}/۲ برد)
						</Typography>
					)}
				</Button>

				<Button
					fullWidth
					variant={hardUnlocked ? "contained" : "outlined"}
					size="large"
					disabled={!hardUnlocked || busy}
					onClick={() => hardUnlocked && onSelectDifficulty("hard")}
				>
					سخت
					{!hardUnlocked && " (قفل)"}
				</Button>
			</Box>
		</Container>
	);
}
