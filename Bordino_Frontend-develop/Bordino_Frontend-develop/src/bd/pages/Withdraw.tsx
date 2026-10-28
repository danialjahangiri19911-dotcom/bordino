"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import BankPicker from "../BankPicker";
import Icon from "../Icon";
import { bankOfIban } from "../banks";
import { fa } from "../format";
import { AppShell, Facts, LoadState, Notice, Panel, R } from "../ui";
import { useCashAccount } from "./Wallet";
import { useQueryClient } from "@tanstack/react-query";

import { gameErrorMessage } from "@/api/games/request";
import { WALLET } from "@/api/urls";
import useGetBankAccounts from "@/api/wallet/hooks/useGetBankAccounts";
import useGetBanks from "@/api/wallet/hooks/useGetBanks";
import type { BankAccount } from "@/api/wallet/types/getBankAccountsType";
import { isValidIban, normalizeIban } from "@/libs/components/Drawer/AddBankAccountDrawer/validations";
import useMutate from "@/libs/http/useMutate";
import { parseAmount } from "@/libs/utils/persianNumberConverter";

const STATUS: Record<string, string> = { approved: "تأیید شده", pending: "در انتظار تأیید", rejected: "رد شده" };

function newRequestId() {
	// randomUUID needs a secure context; the plain-http address falls back to time + random.
	return typeof crypto !== "undefined" && crypto.randomUUID
		? crypto.randomUUID()
		: `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function AddAccount({ onAdded }: { onAdded: () => void }) {
	const { data: banks, isLoading, error, refetch } = useGetBanks();
	const [bank, setBank] = useState("");
	const [iban, setIban] = useState("");
	const [holder, setHolder] = useState("");
	const [shown, setShown] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const { submitHandler, isSending } = useMutate({
		url: WALLET.CREATE_BANK_ACCOUNT,
		onSuccess: () => {
			setBank("");
			setIban("");
			setHolder("");
			setShown(false);
			onAdded();
		},
		onError: (e) => setServerError(gameErrorMessage(e)),
	});
	const normalized = normalizeIban(iban);
	const list = banks?.result?.results ?? [];
	const ibanBank = isValidIban(normalized) ? bankOfIban(list, normalized) : null;
	const chosen = list.find((b) => b.id === bank);
	// A complete Sheba number names its bank: pick it for the player when nothing else is chosen.
	useEffect(() => {
		if (ibanBank && !bank) setBank(ibanBank.id);
	}, [ibanBank, bank]);
	const ibanError = !iban.trim()
		? "شماره شبا را وارد کن."
		: !/^IR\d{24}$/.test(normalized)
			? "شماره شبا باید IR و ۲۴ رقم باشد."
			: !isValidIban(normalized)
				? "شماره شبا معتبر نیست؛ دوباره بررسی کن."
				: ibanBank && chosen?.code && ibanBank.id !== chosen.id
					? `این شماره شبا مال «${ibanBank.name}» است، نه «${chosen.name}».`
					: null;
	const error1 = !bank ? "بانک را انتخاب کن." : ibanError ?? (holder.trim().length < 2 ? "نام صاحب حساب را کامل بنویس." : null);
	return (
		<form
			className="bd-add-account"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				setShown(true);
				setServerError(null);
				if (error1) return;
				submitHandler({ iban: normalized, bank, account_holder: holder.trim() });
			}}
		>
			<h3>افزودن حساب بانکی</h3>
			{error ? (
				<LoadState error={error} onRetry={refetch} errorText="فهرست بانک‌ها بارگذاری نشد." />
			) : (
				<>
					<BankPicker banks={list} value={bank} onChange={setBank} loading={isLoading} />
					<label className="rt-field">
						<span>شماره شبا</span>
						<input type="text" dir="ltr" inputMode="text" autoComplete="off" placeholder="IR …" value={iban} onChange={(event) => setIban(event.target.value)} />
						{ibanBank ? (
							<small className="bd-muted">
								<Icon name="landmark" size={13} /> این شبا مال «{ibanBank.name}» است.
								{chosen && chosen.id !== ibanBank.id ? (
									<>
										{" "}
										<button type="button" className="bd-text-btn" onClick={() => setBank(ibanBank.id)}>
											انتخاب همین بانک
										</button>
									</>
								) : null}
							</small>
						) : null}
					</label>
					<label className="rt-field">
						<span>نام صاحب حساب</span>
						<input type="text" autoComplete="name" value={holder} onChange={(event) => setHolder(event.target.value)} />
					</label>
					{shown && error1 ? <Notice>{error1}</Notice> : null}
					{serverError ? <Notice>{serverError}</Notice> : null}
					<p className="bd-muted">حساب پس از تأیید برای برداشت قابل انتخاب است.</p>
					<div className="bd-actions">
						<button type="submit" className="bd-secondary" disabled={isSending}>
							{isSending ? "در حال ثبت…" : "ثبت حساب"}
						</button>
					</div>
				</>
			)}
		</form>
	);
}

export default function Withdraw() {
	const cash = useCashAccount();
	const accounts = useGetBankAccounts();
	const queryClient = useQueryClient();
	const [amountText, setAmountText] = useState("");
	const [accountId, setAccountId] = useState("");
	const [step, setStep] = useState<"form" | "review" | "done">("form");
	const [requestId, setRequestId] = useState(newRequestId);
	const [serverError, setServerError] = useState<string | null>(null);
	const [uncertain, setUncertain] = useState(false);

	const balance = cash.balance ?? 0;
	const amount = parseAmount(amountText);
	const all: BankAccount[] = accounts.data?.result?.results ?? [];
	const approved = all.filter((a) => a.status === "approved");
	const chosen = approved.find((a) => a.id === accountId);

	const problem =
		cash.balance !== null && balance <= 0
			? "موجودی قابل برداشتی نداری."
			: !amountText.trim()
				? "مبلغ برداشت را وارد کن."
				: !Number.isFinite(amount) || amount <= 0
					? "مبلغ باید یک عدد صحیح مثبت باشد."
					: amount > balance
						? `مبلغ نمی‌تواند بیشتر از ${fa(balance)} تومان باشد.`
						: !chosen
							? "حساب مقصد (تأییدشده) را انتخاب کن."
							: null;

	const { submitHandler, isSending } = useMutate({
		url: WALLET.WITHDRAW_CURRENCY,
		onSuccess: () => {
			setStep("done");
			setServerError(null);
			setUncertain(false);
			setRequestId(newRequestId());
			queryClient.invalidateQueries();
		},
		// The same request id goes with a retry: if the first one did reach the server, the server
		// answers with that withdrawal instead of making a second one.
		onError: (e) => {
			setServerError(gameErrorMessage(e));
			// No answer, or a server error: the withdrawal may have been made. Its id must stay, so
			// whatever is sent next is recognised as the same request (or refused as a conflict).
			const status = (e as { response?: { status?: number } })?.response?.status;
			setUncertain(!status || status >= 500 || status === 409);
			cash.refetch();
		},
	});

	const locked = step !== "form" || isSending;

	return (
		<AppShell nav="wallet" title="برداشت موجودی">
			<div className="rt-two">
				<Panel title="درخواست برداشت">
					{cash.balance === null ? (
						<LoadState loading={cash.isLoading} error={cash.error} onRetry={cash.refetch} />
					) : (
						<form
							noValidate
							onSubmit={(event) => {
								event.preventDefault();
								if (!problem) setStep("review");
							}}
						>
							<p>موجودی قابل برداشت: {fa(balance)} تومان</p>
							<label className="rt-field">
								<span>مبلغ برداشت (تومان)</span>
								<input
									type="text"
									inputMode="numeric"
									dir="ltr"
									placeholder="مبلغ به تومان"
									value={amountText}
									disabled={locked}
									onChange={(event) => setAmountText(event.target.value)}
								/>
							</label>
							{balance > 0 && !locked ? (
								<button type="button" className="bd-text-btn" onClick={() => setAmountText(String(balance))}>
									برداشت کل موجودی
								</button>
							) : null}
							<label className="rt-field">
								<span>حساب مقصد (شبا)</span>
								<select value={accountId} disabled={locked || accounts.isLoading} onChange={(event) => setAccountId(event.target.value)}>
									<option value="">{accounts.isLoading ? "در حال بارگذاری…" : approved.length ? "انتخاب حساب" : "حساب تأییدشده‌ای نداری"}</option>
									{approved.map((a) => (
										<option key={a.id} value={a.id}>
											{a.bank.name} · {a.iban}
										</option>
									))}
								</select>
							</label>
							{accounts.error ? <LoadState error={accounts.error} onRetry={accounts.refetch} errorText="حساب‌های بانکی بارگذاری نشد." /> : null}
							{step === "form" && problem && (amountText || accountId) ? <Notice>{problem}</Notice> : null}
							{step === "form" ? (
								<button className="bd-action" type="submit" disabled={!!problem}>
									بررسی درخواست
								</button>
							) : null}
						</form>
					)}
				</Panel>
				<Panel title="خلاصهٔ درخواست">
					<Facts
						items={[
							["مبلغ", step === "form" || !Number.isFinite(amount) ? "—" : `${fa(amount)} تومان`],
							["مقصد", step === "form" || !chosen ? "—" : `${chosen.bank.name} · ${chosen.iban}`],
							["وضعیت", step === "done" ? "ثبت شد؛ در انتظار پرداخت" : step === "review" ? "آمادهٔ ثبت" : "ثبت نشده"],
						]}
					/>
					{serverError ? <Notice>{serverError}</Notice> : null}
					{step === "review" ? (
						<div className="bd-actions">
							<button
								type="button"
								className="bd-action"
								disabled={isSending}
								onClick={() => submitHandler({ amount, bank_account_id: accountId, request_id: requestId })}
							>
								{isSending ? "در حال ثبت…" : serverError ? "تلاش دوباره" : "تأیید و ثبت برداشت"}
							</button>
							<button
								type="button"
								className="bd-secondary"
								disabled={isSending}
								onClick={() => {
									setStep("form");
									setServerError(null);
									// A new id only when the server clearly refused the last one.
									if (!uncertain) setRequestId(newRequestId());
								}}
							>
								ویرایش
							</button>
						</div>
					) : null}
					{step === "done" ? (
						<>
							<Notice tone="ok">درخواست برداشت ثبت شد. وضعیت آن را در تراکنش‌های نقدی ببین.</Notice>
							<div className="bd-actions">
								<Link className="bd-secondary" href={`${R.transactions}?kind=currency`}>
									تراکنش‌های نقدی
								</Link>
								<button
									type="button"
									className="bd-text-btn"
									onClick={() => {
										setStep("form");
										setAmountText("");
									}}
								>
									برداشت دیگر
								</button>
							</div>
						</>
					) : null}
					{step === "form" ? <small className="bd-muted">پیش از ثبت، مبلغ و مقصد را اینجا بازبینی می‌کنی.</small> : null}
				</Panel>
			</div>
			<div className="rt-two rt-gap-top">
				<Panel title="حساب‌های بانکی من">
					{accounts.isLoading ? (
						<LoadState loading />
					) : all.length ? (
						<div className="bd-rows">
							{all.map((a) => (
								<div className="bd-row" key={a.id}>
									<span className="bd-mission-icon">{a.bank.icon ? <img src={a.bank.icon} alt="" width={20} height={20} /> : <Icon name="landmark" />}</span>
									<span>
										<b>{a.bank.name}</b>
										<small dir="ltr">{a.iban}</small>
									</span>
									<span className="bd-tag">{STATUS[a.status] ?? a.status}</span>
								</div>
							))}
						</div>
					) : (
						<p className="bd-muted">هنوز حسابی ثبت نکرده‌ای.</p>
					)}
				</Panel>
				<Panel>
					<AddAccount
						onAdded={() => {
							accounts.refetch();
						}}
					/>
				</Panel>
			</div>
		</AppShell>
	);
}
