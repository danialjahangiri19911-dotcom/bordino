import React from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";

interface MenuScreenProps {
	completions: { easy: number; medium: number };
	mediumUnlocked: boolean;
	hardUnlocked: boolean;
	onSelectDifficulty: (difficulty: "easy" | "medium" | "hard") => void;
}

export function MenuScreen({
	completions,
	mediumUnlocked,
	hardUnlocked,
	onSelectDifficulty,
}: MenuScreenProps) {
	return (
		<Container
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
			<Typography
				variant="h4"
				gutterBottom
				fontFamily='"Special Elite", cursive'
			>
				Sudoku Evolved
			</Typography>
			<Typography
				variant="body1"
				paragraph
				align="center"
				fontFamily='"Special Elite", cursive'
			>
				Discover the next evolution of Sudoku. Beat Easy to unlock Medium, beat
				Medium twice to unlock Hard.
			</Typography>

			<Box sx={{ width: "100%", maxWidth: 300, mt: 4 }}>
				<Typography variant="h6" gutterBottom align="center">
					Select Difficulty
				</Typography>

				<Button
					fullWidth
					variant="contained"
					size="large"
					sx={{ mb: 2, fontFamily: '"Special Elite", cursive' }}
					onClick={() => onSelectDifficulty("easy")}
				>
					Easy
					{completions.easy > 0 && (
						<Typography variant="caption" sx={{ ml: 1 }}>
							({completions.easy} {completions.easy === 1 ? "win" : "wins"})
						</Typography>
					)}
				</Button>

				<Button
					fullWidth
					variant={mediumUnlocked ? "contained" : "outlined"}
					size="large"
					sx={{ mb: 2, fontFamily: '"Special Elite", cursive' }}
					disabled={!mediumUnlocked}
					onClick={() => mediumUnlocked && onSelectDifficulty("medium")}
				>
					Medium
					{!mediumUnlocked && " (Locked)"}
					{mediumUnlocked && completions.medium > 0 && (
						<Typography variant="caption" sx={{ ml: 1 }}>
							({completions.medium}/2 wins)
						</Typography>
					)}
				</Button>

				<Button
					fullWidth
					variant={hardUnlocked ? "contained" : "outlined"}
					size="large"
					sx={{ fontFamily: '"Special Elite", cursive' }}
					disabled={!hardUnlocked}
					onClick={() => hardUnlocked && onSelectDifficulty("hard")}
				>
					Hard
					{!hardUnlocked && " (Locked)"}
				</Button>
			</Box>
		</Container>
	);
}
