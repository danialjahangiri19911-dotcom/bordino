"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import Icon from "./Icon";
import { useBackHandler } from "./back";
import { searchBanks } from "./banks";

import type { Bank } from "@/api/wallet/types/getBanksType";

interface Props {
	banks: Bank[];
	value: string;
	onChange: (bankId: string) => void;
	loading?: boolean;
}

/** The bank's logo when the admin uploaded one, else its first letter on the brand tint. */
export function BankMark({ bank }: { bank: Bank }) {
	if (bank.icon) return <img className="bd-bank-mark" src={bank.icon} alt="" width={28} height={28} />;
	const letter = bank.name.replace(/^(بانک|مؤسسه اعتباری)\s*/, "").trim().charAt(0) || bank.name.charAt(0);
	return (
		<span className="bd-bank-mark" aria-hidden="true">
			{letter}
		</span>
	);
}

/** «بانک»: a searchable list (combobox) of the banks the server accepts. */
export default function BankPicker({ banks, value, onChange, loading }: Readonly<Props>) {
	const id = useId();
	const chosen = banks.find((b) => b.id === value) ?? null;
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(0);
	const box = useRef<HTMLDivElement>(null);
	const list = useRef<HTMLUListElement>(null);
	const found = useMemo(() => searchBanks(banks, query), [banks, query]);

	useEffect(() => {
		if (!open) return;
		const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
		document.addEventListener("pointerdown", away);
		return () => document.removeEventListener("pointerdown", away);
	}, [open]);
	useEffect(() => setActive(0), [query]);
	useBackHandler(open, () => setOpen(false));
	useEffect(() => {
		list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
	}, [active]);

	const pick = (b: Bank) => {
		onChange(b.id);
		setQuery("");
		setOpen(false);
	};

	return (
		<div className="rt-field bd-bank-picker" ref={box}>
			<label htmlFor={`${id}-input`}>بانک</label>
			<div className="bd-bank-input">
				{chosen && !open ? <BankMark bank={chosen} /> : <Icon name="search" />}
				<input
					id={`${id}-input`}
					type="text"
					role="combobox"
					aria-expanded={open}
					aria-controls={`${id}-list`}
					aria-autocomplete="list"
					aria-activedescendant={open && found[active] ? `${id}-opt-${active}` : undefined}
					autoComplete="off"
					disabled={loading}
					placeholder={loading ? "در حال بارگذاری بانک‌ها…" : chosen ? "" : "نام بانک را جست‌وجو کن"}
					value={open ? query : chosen?.name ?? ""}
					onFocus={() => setOpen(true)}
					onClick={() => setOpen(true)}
					onChange={(e) => {
						setQuery(e.target.value);
						setOpen(true);
					}}
					onKeyDown={(e) => {
						if (e.key === "ArrowDown") {
							e.preventDefault();
							setOpen(true);
							setActive((a) => Math.min(found.length - 1, a + 1));
						} else if (e.key === "ArrowUp") {
							e.preventDefault();
							setActive((a) => Math.max(0, a - 1));
						} else if (e.key === "Enter" && open) {
							e.preventDefault();
							if (found[active]) pick(found[active]);
						} else if (e.key === "Escape") {
							setOpen(false);
						}
					}}
				/>
				<Icon name="chevron-left" className="bd-bank-caret" />
			</div>
			{open ? (
				<ul className="bd-bank-list" id={`${id}-list`} role="listbox" ref={list} aria-label="بانک‌ها">
					{found.length ? (
						found.map((b, i) => (
							<li
								key={b.id}
								id={`${id}-opt-${i}`}
								data-i={i}
								role="option"
								aria-selected={b.id === value}
								className={i === active ? "is-active" : undefined}
								onPointerDown={(e) => e.preventDefault()}
								onClick={() => pick(b)}
								onPointerEnter={() => setActive(i)}
							>
								<BankMark bank={b} />
								<span>{b.name}</span>
								{b.id === value ? <Icon name="check" /> : null}
							</li>
						))
					) : (
						<li className="bd-bank-empty" role="presentation">
							{banks.length ? `بانکی با «${query}» پیدا نشد.` : "فهرست بانک‌ها خالی است؛ کمی بعد دوباره امتحان کن."}
						</li>
					)}
				</ul>
			) : null}
		</div>
	);
}
