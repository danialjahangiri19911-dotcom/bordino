"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import Icon from "../Icon";
import RewardOffer from "../ads/RewardOffer";
import { usePlayableAdOffer } from "../ads/api";
import { goBuyCoins } from "../entryFee";
import { fa } from "../format";
import { priceLines, useGamePrices } from "../gamePrices";
import { sortByUse, useGameUse } from "../gameUse";
import { GAMES, type GameEntry } from "../games";
import { useMissions } from "../missions/api";
import type { MysteryCard, MysteryState } from "../missions/mystery";
import { AppShell, Balance, Chips, R } from "../ui";

import type { GameName } from "@/api/games/types";
import useGetPlayCost from "@/api/games/useGetPlayCost";

/** Every game's entry as the server prices it: a fee, or (Crash, Chicken) the smallest bet. */
const FEE_GAME: Partial<Record<GameEntry["id"], GameName>> = {
	sudoku: "sudoku",
	game2048: "game_2048",
	pantomime: "pantomime",
	dowr: "dowr",
	spy: "spy",
	crash: "crash",
	chicken: "chicken",
};

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

/** What a screen reader says for a card: the game, then its cost and what it pays. */
const cardLabel = (game: GameEntry, lines: { cost: string; pays: string } | null) =>
	lines ? `${game.pays === "free" ? "" : "بازی "}${game.name}، ${lines.cost}، ${lines.pays}` : `بازی ${game.name}`;

/** Under a card's name: the cost (a coin chip) and what playing does to the coins. */
function PriceLines({ lines }: { lines: { cost: string; pays: string } | null }) {
	if (!lines) return <div className="ng-game-price" aria-hidden="true" />;
	return (
		<div className="ng-game-price">
			<span className="ng-cost">
				<Icon name="coins" /> {lines.cost}
			</span>
			<small>{lines.pays}</small>
		</div>
	);
}

/** The catalog as the player left it (category and scroll), for this visit of the app (product review
 * 2026-11-26: coming back from a game opens the list where it was, not at the top of «همه»). */
const VIEW_KEY = "bd-games-view";
function savedView(): { group: Group; y: number } | null {
	try {
		const v = JSON.parse(sessionStorage.getItem(VIEW_KEY) ?? "null") as { group?: unknown; y?: unknown } | null;
		if (!v || typeof v.group !== "string" || typeof v.y !== "number") return null;
		return { group: v.group as Group, y: v.y };
	} catch {
		return null;
	}
}
function saveView(group: Group) {
	try {
		sessionStorage.setItem(VIEW_KEY, JSON.stringify({ group, y: Math.round(window.scrollY) }));
	} catch {
		// storage blocked: the list opens at the top
	}
}

export default function Games() {
	// (read after the first render: the server's render cannot see this device's storage)
	const [group, setGroupState] = useState<Group>("all");
	const groupRef = useRef<Group>("all");
	const setGroup = (g: Group) => {
		groupRef.current = g;
		setGroupState(g);
		saveView(g);
	};
	// «معمای شهری»: hunts at real places (the mystery list comes with the missions).
	const mysteries = useMissions().data?.result?.mysteries ?? [];
	const router = useRouter();
	// The rewarded-video offer (server decides if one is available today, and for how much).
	const { offer } = usePlayableAdOffer();
	const [picked, setPicked] = useState<GameEntry | null>(null);
	// The picked game's fee and the balance: not enough coins → «خرید سکه» in the offer.
	const feeGame = picked ? FEE_GAME[picked.id] : undefined;
	const cost = useGetPlayCost({ gameName: (feeGame ?? "") as GameName, enabled: !!feeGame });
	const refetchCost = cost.refetch;
	// The balance as it is now, each time a game is picked (not one read a while ago).
	useEffect(() => {
		if (feeGame) void refetchCost();
	}, [feeGame, picked, refetchCost]);
	const known = cost.data?.result;
	const fee = known?.play_cost ?? 0;
	const minBet = known?.min_bet ?? 0;
	const need = fee > 0 ? fee : minBet;
	const have = known ? Number(known.current_amount) : null;
	const short = !!feeGame && have !== null && need > 0 && have < need;
	const entry = feeGame && known ? { cost: need, kind: fee > 0 ? ("fee" as const) : ("bet" as const), balance: have } : null;
	// The games this player opens most come first (counted on this device: gameUse.ts).
	const use = useGameUse();
	// What each game costs and pays, from the server (shown on the cards before a game opens).
	const prices = useGamePrices().data?.result?.games;
	const shown = (use ? sortByUse(GAMES, use) : GAMES).filter((game) => group === "all" || game.group === group);
	// Back to where the player was: the category at once, the scroll once the order has settled.
	const restored = useRef(false);
	const restoring = useRef(false);
	useEffect(() => {
		const v = savedView();
		if (v && v.group !== "all") {
			groupRef.current = v.group;
			setGroupState(v.group);
		}
	}, []);
	useEffect(() => {
		if (restored.current || use === null) return;
		restored.current = true;
		const v = savedView();
		if (!v || v.y <= 0) return;
		// The page grows as covers and prices arrive: scroll again until it reaches the place (≤ 2 s).
		restoring.current = true;
		let tries = 0;
		const tick = () => {
			window.scrollTo(0, v.y);
			if (Math.abs(window.scrollY - v.y) > 2 && tries++ < 20) window.setTimeout(tick, 100);
			else restoring.current = false;
		};
		requestAnimationFrame(tick);
	}, [use]);
	// Kept as the player scrolls and when the page is left (for a game, the coin shop, Back).
	useEffect(() => {
		let t = 0;
		const onScroll = () => {
			if (restoring.current) return; // (its own scrolling while restoring is not the player's)
			window.clearTimeout(t);
			t = window.setTimeout(() => saveView(groupRef.current), 150);
		};
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			window.removeEventListener("scroll", onScroll);
			window.clearTimeout(t);
		};
	}, []);
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
						["fal", "فال"],
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
							aria-label={cardLabel(game, priceLines(game, game.price ? prices?.[game.price] : undefined))}
							onClick={(event) => {
								saveView(groupRef.current);
								// A plain tap with an offer available: the offer first, then the game.
								if (!offer?.available || game.pays === "free" || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
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
							<PriceLines lines={priceLines(game, game.price ? prices?.[game.price] : undefined)} />
						</Link>
					))}
					{group === "all" || group === "city"
						? mysteries.map((m) => (
								<Link key={m.id} href={R.mystery(m.id)} onClick={() => saveView(groupRef.current)} className="ng-game" data-game="mystery" data-state={m.state} aria-label={`معمای شهری ${m.title}`}>
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
					entry={entry}
					checking={!!feeGame && !known}
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
