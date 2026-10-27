"use client";

import { useState } from "react";

import Link from "next/link";

import Icon from "../Icon";
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
	return <Icon name={game.icon} />;
}

export default function Games() {
	const [query, setQuery] = useState("");
	const [group, setGroup] = useState<"all" | GameEntry["group"]>("all");
	const shown = GAMES.filter(
		(game) => (group === "all" || game.group === group) && (!query.trim() || game.name.includes(query.trim())),
	);
	return (
		<AppShell nav="games" title="گیمنت" headingExtra={<Balance />}>
			<section className="ng-catalog">
				<div className="ng-filterbar">
					<h3>
						<Icon name="gamepad-2" /> گیمنت بوردینو
					</h3>
					<label className="ng-search">
						<Icon name="search" />
						<input
							type="search"
							placeholder="جست‌وجوی بازی"
							aria-label="جست‌وجوی بازی"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
						/>
					</label>
				</div>
				<Chips
					label="دسته‌بندی بازی‌ها"
					value={group}
					onChange={setGroup}
					options={[
						["all", "همه"],
						["puzzle", "فکری"],
						["arcade", "آرکید"],
					]}
				/>
				<div className="ng-games">
					{shown.map((game) => (
						<Link key={game.id} href={game.href} className="ng-game" data-game={game.id} aria-label={`بازی ${game.name}`}>
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
				<p className="ng-empty" hidden={shown.length > 0}>
					بازی‌ای با این نام پیدا نشد.
				</p>
			</section>
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
