"use client";

import React from "react";

import Image from "next/image";
import { useRouter } from "next/navigation";

import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";

import { GAME_2048, SUDOKU } from "@/constants/routes";
import PointsChip from "@/libs/components/common/PointsChip";
import PwaAppPageLayout from "@/libs/components/layouts/PwaAppLayout";

interface GameItem {
	key: string;
	title: string;
	icon: string;
	path: string;
}

const GAMES: GameItem[] = [
	{
		key: "sudoku",
		title: "سودوکو",
		icon: "/media/App/games/sudoku-icon.png",
		path: SUDOKU.path,
	},
	{
		key: "2048",
		title: "۲۰۴۸",
		icon: "/media/App/games/game2048-icon.png",
		path: GAME_2048.path,
	},
];

export default function GameNetPage() {
	const { push } = useRouter();

	return (
		<PwaAppPageLayout
			rightAction={<PointsChip />}
		>
			<Box sx={{ px: 2, direction: "rtl" }}>
				<Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
					بازی‌ها
				</Typography>

				<Box
					sx={{
						display: "grid",
						gridTemplateColumns: "repeat(3, 1fr)",
						gap: 1.5,
					}}
				>
					{GAMES.map((game) => (
						<ButtonBase
							key={game.key}
							onClick={() => push(game.path)}
							sx={{
								flexDirection: "column",
								gap: 1,
								p: 1.5,
								borderRadius: 3,
								bgcolor: "background.paper",
								boxShadow: 2,
							}}
						>
							<Box
								sx={{
									width: "100%",
									aspectRatio: "1 / 1",
									borderRadius: 2,
									overflow: "hidden",
									position: "relative",
									bgcolor: "#F4F6F8",
								}}
							>
								<Image
									src={game.icon}
									alt={game.title}
									fill
									sizes="33vw"
									style={{ objectFit: "contain", padding: 6 }}
								/>
							</Box>
							<Typography variant="body2" fontWeight={700}>
								{game.title}
							</Typography>
						</ButtonBase>
					))}
				</Box>
			</Box>
		</PwaAppPageLayout>
	);
}
