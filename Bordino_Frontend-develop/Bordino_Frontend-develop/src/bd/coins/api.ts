import { call } from "@/api/games/request";
import type { ResponseApiData } from "@/libs/http/interfaces";
import useQuery from "@/libs/http/query";

/** Coins for money: the server's /api/v1/coins/… (packages, a purchase through Zibal, its confirmation). */
const COINS = "coins/";

export interface CoinPackage {
	id: string;
	coins: number;
	/** What is paid (toman). */
	price_toman: number;
	/** Before the discount; null when there is none. */
	original_price_toman: number | null;
	discount_percent: number;
	discount_toman: number;
	badge: string;
}

export interface CoinShop {
	packages: CoinPackage[];
	/** Buying is switched on (COIN_ZIBAL_MODE is not "off"). */
	open: boolean;
	mode: "off" | "sandbox" | "test" | "live";
	balance: number;
}

export interface CoinPurchase {
	track_id: string;
	status: "pending" | "paid" | "failed" | "cancelled";
	coins: number;
	amount_toman: number;
	original_toman: number | null;
	ref_number: string;
	mode: string;
	/** The coins balance after this answer (null when unknown). */
	balance: number | null;
}

export const useCoinShop = () => useQuery<ResponseApiData<CoinShop>>({ url: `${COINS}packages/`, headers: true });

/** Starts the payment for a package: where to pay it (Zibal, or Bordino's sandbox page). */
export const buyPackage = (packageId: string) => call<CoinPurchase & { payment_url: string }>("post", `${COINS}purchases/`, { package_id: packageId });

/** Back from the gateway: the server asks Zibal and credits the coins once. */
export const verifyPurchase = (trackId: string, success: boolean) =>
	call<CoinPurchase>("post", `${COINS}purchases/verify/`, { trackId, success: success ? "1" : "0" });
