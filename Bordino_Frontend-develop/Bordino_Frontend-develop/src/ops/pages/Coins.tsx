"use client";

import { type ChangeEvent, useState } from "react";

import Icon from "@/bd/Icon";
import { fa } from "@/bd/format";
import { EmptyState, LoadState, Notice, Panel } from "@/bd/ui";

import OpsShell from "../Shell";
import { dateText, errorText, ops, useOps, useRefresh } from "../client";

interface Pack {
	id: string;
	coins: number;
	price_toman: number;
	original_price_toman: number | null;
	discount_percent: number;
	badge: string;
	is_active: boolean;
	sort_order: number;
	sold: number;
}

interface Purchase {
	id: string;
	phone: string;
	coins: number;
	amount_toman: number;
	status: string;
	status_label: string;
	mode: string;
	ref_number: string;
	time: string;
}

type Draft = { coins: string; price_toman: string; original_price_toman: string; badge: string; sort_order: string; is_active: boolean };

const EMPTY: Draft = { coins: "", price_toman: "", original_price_toman: "", badge: "", sort_order: "0", is_active: true };
const draftOf = (p: Pack): Draft => ({
	coins: String(p.coins),
	price_toman: String(p.price_toman),
	original_price_toman: p.original_price_toman ? String(p.original_price_toman) : "",
	badge: p.badge,
	sort_order: String(p.sort_order),
	is_active: p.is_active,
});
/** Persian or Latin digits, as the server wants them (whole numbers). */
const digits = (s: string) => s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[^0-9]/g, "");

function PackForm({ initial, onSave, onCancel, saving }: { initial: Draft; onSave: (d: Draft) => void; onCancel?: () => void; saving: boolean }) {
	const [d, setD] = useState(initial);
	const set = (k: keyof Draft) => (e: ChangeEvent<HTMLInputElement>) => setD({ ...d, [k]: k === "badge" ? e.target.value : digits(e.target.value) });
	const price = Number(d.price_toman || 0);
	const original = Number(d.original_price_toman || 0);
	const off = original > price && price > 0 ? Math.round(((original - price) * 100) / original) : 0;
	return (
		<form
			className="ops-form"
			onSubmit={(e) => {
				e.preventDefault();
				onSave(d);
			}}
		>
			<div className="rt-two">
				<label className="rt-field gm-field">
					<span>تعداد سکه</span>
					<input inputMode="numeric" required value={d.coins} onChange={set("coins")} />
				</label>
				<label className="rt-field gm-field">
					<span>قیمت (تومان، مبلغ پرداختی)</span>
					<input inputMode="numeric" required value={d.price_toman} onChange={set("price_toman")} />
				</label>
				<label className="rt-field gm-field">
					<span>قیمت قبل از تخفیف (تومان، اختیاری)</span>
					<input inputMode="numeric" value={d.original_price_toman} onChange={set("original_price_toman")} />
				</label>
				<label className="rt-field gm-field">
					<span>برچسب (اختیاری، مثلاً «پرفروش»)</span>
					<input maxLength={30} value={d.badge} onChange={set("badge")} />
				</label>
				<label className="rt-field gm-field">
					<span>ترتیب نمایش (کوچک‌تر = اول)</span>
					<input inputMode="numeric" value={d.sort_order} onChange={set("sort_order")} />
				</label>
				<label className="ops-check">
					<input type="checkbox" checked={d.is_active} onChange={(e) => setD({ ...d, is_active: e.target.checked })} /> در فروشگاه نشان داده شود
				</label>
			</div>
			<small className="bd-muted">
				{off ? `تخفیف ${fa(off)}٪ نشان داده می‌شود.` : "بدون تخفیف."} {d.coins && price ? `هر سکه حدود ${fa(Math.round(price / Number(d.coins)))} تومان.` : ""}
			</small>
			<div className="bd-actions">
				<button type="submit" className="bd-action" disabled={saving}>
					{saving ? "در حال ذخیره…" : "ذخیره"}
				</button>
				{onCancel ? (
					<button type="button" className="bd-secondary" onClick={onCancel}>
						انصراف
					</button>
				) : null}
			</div>
		</form>
	);
}

/** «بسته‌های سکه»: what the coin shop sells (the settings role), and the latest purchases. */
export function CoinPackagesPage() {
	const q = useOps<{ packages: Pack[] }>("coins/packages/");
	const purchases = useOps<{ purchases: Purchase[] }>("coins/purchases/", 30_000);
	const refresh = useRefresh();
	const [editing, setEditing] = useState<string | null>(null);
	const [adding, setAdding] = useState(false);
	const [saving, setSaving] = useState(false);
	const [problem, setProblem] = useState<string | null>(null);
	const [done, setDone] = useState<string | null>(null);

	const save = async (d: Draft, id?: string) => {
		setSaving(true);
		setProblem(null);
		setDone(null);
		try {
			const body = {
				coins: d.coins,
				price_toman: d.price_toman,
				original_price_toman: d.original_price_toman || "",
				badge: d.badge.trim(),
				sort_order: d.sort_order || "0",
				is_active: d.is_active,
			};
			await ops(id ? `coins/packages/${id}/` : "coins/packages/", id ? "PUT" : "POST", body);
			setEditing(null);
			setAdding(false);
			setDone(id ? "بسته به‌روز شد." : "بستهٔ تازه اضافه شد.");
			refresh();
		} catch (e) {
			setProblem(errorText(e));
		} finally {
			setSaving(false);
		}
	};

	const list = q.data?.packages ?? [];
	return (
		<OpsShell nav="coins" title="بسته‌های سکه" need={["settings"]}>
			<p className="bd-muted">بسته‌هایی که در صفحهٔ «خرید سکه» فروخته می‌شوند. حالت درگاه (خاموش، آزمایشی، واقعی) در «تنظیمات › سکه و خرید سکه» است.</p>
			{problem ? <Notice>{problem}</Notice> : null}
			{done ? <Notice tone="ok">{done}</Notice> : null}
			<LoadState loading={q.isLoading} error={q.error} onRetry={q.refetch} />
			{q.data && !list.length ? <EmptyState icon="coins" title="هنوز بسته‌ای نیست" text="اولین بسته را اضافه کن." /> : null}
			<div className="ops-list">
				{list.map((p) => (
					<div key={p.id} className="bd-panel ops-row ops-row-col" data-inactive={!p.is_active}>
						{editing === p.id ? (
							<PackForm initial={draftOf(p)} saving={saving} onSave={(d) => void save(d, p.id)} onCancel={() => setEditing(null)} />
						) : (
							<div className="ops-row-head">
								<span className="ops-row-main">
									<b>
										{fa(p.coins)} سکه · {fa(p.price_toman)} تومان
										{p.discount_percent ? <small className="bd-muted"> (به‌جای {fa(p.original_price_toman ?? 0)}، {fa(p.discount_percent)}٪ تخفیف)</small> : null}
									</b>
									<small className="bd-muted">
										{p.is_active ? "در فروش" : "پنهان"}
										{p.badge ? ` · برچسب «${p.badge}»` : ""} · ترتیب {fa(p.sort_order)} · {fa(p.sold)} فروش موفق
									</small>
								</span>
								<span className="ops-row-side">
									<button type="button" className="bd-secondary" onClick={() => setEditing(p.id)}>
										<Icon name="pencil" /> ویرایش
									</button>
								</span>
							</div>
						)}
					</div>
				))}
			</div>
			{adding ? (
				<Panel title="بستهٔ تازه">
					<PackForm initial={EMPTY} saving={saving} onSave={(d) => void save(d)} onCancel={() => setAdding(false)} />
				</Panel>
			) : (
				<div className="bd-actions">
					<button type="button" className="bd-action" onClick={() => setAdding(true)}>
						<Icon name="plus" /> افزودن بسته
					</button>
				</div>
			)}
			<Panel title="آخرین خریدها">
				<LoadState loading={purchases.isLoading} error={purchases.error} onRetry={purchases.refetch} />
				{purchases.data && !purchases.data.purchases.length ? <EmptyState icon="coins" title="هنوز خریدی نشده" /> : null}
				<div className="ops-list">
					{(purchases.data?.purchases ?? []).map((r) => (
						<div key={r.id} className="ops-row ops-row-col">
							<span className="ops-row-main">
								<b>
									{fa(r.coins)} سکه · {fa(r.amount_toman)} تومان · {r.status_label}
									{r.mode === "sandbox" ? <small className="bd-muted"> (آزمایشی)</small> : null}
								</b>
								<small className="bd-muted">
									<bdi dir="ltr">{r.phone}</bdi> · {dateText(r.time)}
									{r.ref_number ? ` · پیگیری ${r.ref_number}` : ""}
								</small>
							</span>
						</div>
					))}
				</div>
			</Panel>
		</OpsShell>
	);
}
