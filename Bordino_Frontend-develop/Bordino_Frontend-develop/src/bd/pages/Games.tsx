"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import Icon from "../Icon";
import RewardOffer from "../ads/RewardOffer";
import { usePlayableAdOffer } from "../ads/api";
import { goBuyCoins } from "../entryFee";
import { fa } from "../format";
import { GAMES, type GameEntry } from "../games";
import { useMissions } from "../missions/api";
import type { MysteryCard, MysteryState } from "../missions/mystery";
import { AppShell, Balance, Chips, R } from "../ui";

import type { GameName } from "@/api/games/types";
import useGetPlayCost from "@/api/games/useGetPlayCost";

/** The games with an entry fee (the bet games take their bet instead). */
const FEE_GAME: Partial<Record<GameEntry["id"], GameName>> = { sudoku: "sudoku", game2048: "game_2048", pantomime: "pantomime", dowr: "dowr", spy: "spy" };

/** A «معمای شهری» card's line under its name: where it is, how far the player got, or why it is closed. */
function mysteryTag(m: MysteryCard) {
	const closed: Partial<Record<MysteryState, string>> = {
		done: "حل شد",
		upcoming: "به‌زودی",
		expired: "پایان‌یافته",
		full: "ظرفیت تکمیل",
		inactive: "غیرفعال",
		empty: "به‌زودی",
	};
	if (closed[m.state]) return closed[m.state];
	if (m.state === "in_progress") return `${fa(m.done)} از ${fa(m.steps)} مرحله`;
	return `${fa(m.steps)} مرحله · تا ${fa(m.points)} سکه`;
}

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

type Group = "all" | GameEntry["group"] | "city";

export default function Games() {
	const [group, setGroup] = useState<Group>("all");
	// «معمای شهری»: hunts at real places (the mystery list comes with the missions).
	const mysteries = useMissions().data?.result?.mysteries ?? [];
	const router = useRouter();
	// The rewarded-video offer (server decides if one is available today, and for how much).
	const { offer } = usePlayableAdOffer();
	const [picked, setPicked] = useState<GameEntry | null>(null);
	// The picked game's fee and the balance: not enough coins → «خرید سکه» in the offer.
	const feeGame = picked ? FEE_GAME[picked.id] : undefined;
	const cost = useGetPlayCost({ gameName: (feeGame ?? "") as GameName, enabled: !!feeGame });
	const price = cost.data?.result?.play_cost ?? 0;
	const short = !!feeGame && !!cost.data?.result && price > 0 && Number(cost.data.result.current_amount) < price;
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
						...(mysteries.length ? ([["city", "معمای شهری"]] as [Group, string][]) : []),
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
					{group === "all" || group === "city"
						? mysteries.map((m) => (
								<Link key={m.id} href={R.mystery(m.id)} className="ng-game" data-game="mystery" data-state={m.state} aria-label={`معمای شهری ${m.title}`}>
									<div className="ng-cover">
										{m.cover ? <img className="ng-mystery-cover" src={m.cover} alt="" loading="lazy" /> : <Icon name="map-pin" />}
									</div>
									<div className="ng-game-name">
										<b>{m.title}</b>
										<small>{mysteryTag(m)}</small>
									</div>
								</Link>
							))
						: null}
				</div>
			</section>
			{picked && offer ? (
				<RewardOffer
					offer={offer}
					gameName={picked.name}
					placement={picked.id}
					onCancel={() => setPicked(null)}
					onBuyCoins={
						short
							? () => {
									setPicked(null);
									goBuyCoins(router.push, picked.href);
								}
							: undefined
					}
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
