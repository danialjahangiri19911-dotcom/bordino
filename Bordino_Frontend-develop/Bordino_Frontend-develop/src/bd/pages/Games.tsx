"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import Icon from "../Icon";
import RewardOffer from "../ads/RewardOffer";
import { usePlayableAdOffer } from "../ads/api";
import { GAMES, type GameEntry } from "../games";
import { AppShell, Balance, Chips } from "../ui";

function Cover({ game }: { game: GameEntry }) {
	if (game.id === "sudoku") {
		return (
			<div className="ng-mini-grid" aria-hidden="true">
				{["7", "", "2", "3", "8", "", "", "4", "1"].map((n, i) => (
					<span key={i}>{n}</span>
				))}
			</div>
		);
	}
	if (game.id === "game2048") {
		return (
			<div className="ng-blocks" aria-hidden="true">
				<b>4</b>
				<b>8</b>
			</div>
		);
	}
	if (game.logo) return <img className="ng-logo" src={game.logo} alt="" width={76} height={76} />;
	return <Icon name={game.icon} />;
}

export default function Games() {
	const [group, setGroup] = useState<"all" | GameEntry["group"]>("all");
	const router = useRouter();
	// The rewarded-video offer (server decides if one is available today, and for how much).
	const { offer } = usePlayableAdOffer();
	const [picked, setPicked] = useState<GameEntry | null>(null);
	const shown = GAMES.filter((game) => group === "all" || game.group === group);
	return (
		<AppShell nav="games" title="گیمنت" headingExtra={<Balance />}>
			<section className="ng-catalog">
				<div className="ng-filterbar">
					<h3>
						<Icon name="gamepad-2" /> گیمنت بردینو
					</h3>
				</div>
				<Chips
					label="دسته‌بندی بازی‌ها"
					value={group}
					onChange={setGroup}
					options={[
						["all", "همه"],
						["puzzle", "فکری"],
						["arcade", "آرکید"],
						["party", "دورهمی"],
					]}
				/>
				<div className="ng-games">
					{shown.map((game) => (
						<Link
							key={game.id}
							href={game.href}
							className="ng-game"
							data-game={game.id}
							aria-label={`بازی ${game.name}`}
							onClick={(event) => {
								// A plain tap with an offer available: the offer first, then the game.
								if (!offer?.available || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
								event.preventDefault();
								setPicked(game);
							}}
						>
							<div className="ng-cover">
								<Cover game={game} />
							</div>
							<div className="ng-game-name">
								<b>{game.name}</b>
								<small>{game.tag}</small>
							</div>
						</Link>
					))}
				</div>
			</section>
			{picked && offer ? (
				<RewardOffer
					offer={offer}
					gameName={picked.name}
					placement={picked.id}
					onCancel={() => setPicked(null)}
					onPlay={() => {
						setPicked(null);
						router.push(picked.href);
					}}
				/>
			) : null}
			<div className="ng-status">
				<Icon name="info" />
				<div>
					<b>قبل از شروع، راهنمای بازی را ببین.</b>
					<small>شرایط هر بازی با دکمهٔ اطلاعات در صفحهٔ همان بازی نمایش داده می‌شود.</small>
				</div>
			</div>
		</AppShell>
	);
}
