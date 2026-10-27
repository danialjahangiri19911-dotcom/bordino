import type { Bank } from "@/api/wallet/types/getBanksType";

/** Persian text as typed on any keyboard: Arabic ي/ك, half-spaces, «بانک»/«مؤسسه» prefixes don't matter. */
export function bankSearchKey(text: string) {
	return text
		.replace(/[يى]/g, "ی")
		.replace(/ك/g, "ک")
		.replace(/[ؤ]/g, "و")
		.replace(/[‌‏\s-]+/g, "")
		.replace(/^(بانک|مؤسسهاعتباری|موسسهاعتباری|موسسه)/, "")
		.toLowerCase();
}

/** Active banks matching `query` (the whole list for an empty one), in Persian alphabetical order. */
export function searchBanks(banks: Bank[], query: string) {
	const key = bankSearchKey(query);
	return banks
		.filter((b) => b.is_active && (!key || bankSearchKey(b.name).includes(key)))
		.sort((a, b) => bankSearchKey(a.name).localeCompare(bankSearchKey(b.name), "fa"));
}

/** The three-digit bank code inside an Iranian Sheba number (IRkk BBB…), as the server reads it. */
export function bankCodeOf(iban: string) {
	return /^IR\d{24}$/.test(iban) ? iban.slice(4, 7) : null;
}

/** The bank a Sheba number belongs to, when it is one of `banks`. */
export function bankOfIban(banks: Bank[], iban: string) {
	const code = bankCodeOf(iban);
	return code ? banks.find((b) => b.is_active && b.code === code) ?? null : null;
}
