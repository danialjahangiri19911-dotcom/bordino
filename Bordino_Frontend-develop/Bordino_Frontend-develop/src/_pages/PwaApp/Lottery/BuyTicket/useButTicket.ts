import { useCallback, useMemo, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import useExtractLotteries from "@/api/lottery/utils/useExtractLotteries";
import useExtractLotteryTickets from "@/api/lottery/utils/useExtractLotteryTickets";
import { LOTTERY as LOTTERY_URL } from "@/api/urls";
import { LOTTERY, TICKET_DETAIL, WALLET } from "@/constants/routes";
import type { ResponseApiData } from "@/libs/http/interfaces";
import type { RequestError } from "@/libs/http/requester";
import useMutate from "@/libs/http/useMutate";
import { addParamsToUrl, addSearchParamsToUrl } from "@/libs/utils/urls";

interface BuyTicketResponse {
	id: string;
}

function extractErrorMessage(error: RequestError): string | null {
	const errors = (error?.response?.data as { errors?: unknown } | undefined)
		?.errors;
	if (!errors) return null;
	if (typeof errors === "string") return errors;
	if (Array.isArray(errors)) return errors.join(" | ");
	if (typeof errors === "object") {
		return Object.values(errors as Record<string, unknown>)
			.map((value) => (Array.isArray(value) ? value.join(", ") : String(value)))
			.join(" | ");
	}
	return null;
}

export default function useButTicket() {
	const { push } = useRouter();
	const searchParams = useSearchParams();
	const { lotteryTickets } = useExtractLotteryTickets();

	// How many tickets the user chose to buy (from the exchange drawer) and how
	// many of them have already been completed in this purchase session. Each
	// ticket is created (and paid for) when its numbers are submitted.
	const count = Math.max(1, Number(searchParams.get("count")) || 1);
	const done = Math.max(0, Number(searchParams.get("done")) || 0);
	// The offer the player accepted (from the exchange drawer, carried ticket to ticket); without
	// one, the price shown on this page is the offer.
	const { activeLotteries } = useExtractLotteries();
	const offerLottery = searchParams.get("lottery") ?? activeLotteries?.id;
	const offerPriceParam = searchParams.get("price");
	const offerPrice =
		offerPriceParam !== null
			? Number(offerPriceParam)
			: activeLotteries
				? Number(activeLotteries.ticket_price)
				: undefined;
	const offerParams: Record<string, string> =
		offerLottery && offerPrice !== undefined
			? { lottery: offerLottery, price: String(offerPrice) }
			: {};

	const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
	const [selectedBalls, setSelectedBalls] = useState<number[]>([]);

	const handleCloseSnackbar = useCallback(() => {
		setSnackbarMessage(null);
	}, []);

	const handleBallClick = useCallback(
		(num: number) => {
			if (selectedBalls.includes(num)) {
				setSelectedBalls(selectedBalls.filter((n) => n !== num));
			} else if (selectedBalls.length < 6) {
				setSelectedBalls([...selectedBalls, num]);
			}
		},
		[selectedBalls],
	);

	const handleButTicketSuccess = useCallback(
		(data: ResponseApiData<BuyTicketResponse>) => {
			// Show the just-created ticket on its detail page, carrying the progress
			// so that page can offer "buy next" or "exit".
			push(
				addSearchParamsToUrl(
					addParamsToUrl(TICKET_DETAIL.path, { id: data.result.id }),
					{ count: String(count), done: String(done + 1), ...offerParams },
				),
			);
		},
		[count, done, push],
	);

	const handleButTicketError = useCallback((error: RequestError) => {
		setSnackbarMessage(
			extractErrorMessage(error) ?? "ثبت بلیط با خطا مواجه شد",
		);
	}, []);

	const { submitHandler, isSending } = useMutate<
		ResponseApiData<BuyTicketResponse>,
		{ numbers: number[]; lottery_id?: string; expected_price?: number }
	>({
		url: LOTTERY_URL.BUY_TICKET_NUMBERS,
		method: "PATCH",
		onSuccess: handleButTicketSuccess,
		onError: handleButTicketError,
	});

	// The accepted lottery and price go along: if either changed meanwhile, the server refuses
	// instead of charging for a different offer. No offer (no lottery running): nothing to send.
	const handleSubmit = useCallback(() => {
		if (!offerLottery || offerPrice === undefined) return;
		submitHandler({ numbers: selectedBalls, lottery_id: offerLottery, expected_price: offerPrice });
	}, [offerLottery, offerPrice, selectedBalls, submitHandler]);

	const handleBack = () => {
		push(WALLET.path);
	};

	const submitButtonText = useMemo(() => {
		if (count > 1) {
			return `ثبت بلیط بعدی ${done + 1}/${count}`;
		}
		return "ثبت بلیط";
	}, [count, done]);

	const handlePrevTicket = () => push(LOTTERY.path);
	return {
		snackbarMessage,
		handleCloseSnackbar,
		handleBallClick,
		handleSubmit,
		push,
		isSubmitting: isSending,
		setSelectedBalls,
		selectedBalls,
		handleBack,
		submitButtonText,
		lotteryTickets,
		handlePrevTicket,
		offerPrice,
		hasOffer: !!offerLottery && offerPrice !== undefined,
	};
}
