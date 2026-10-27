import { bankCodeOf, bankOfIban, searchBanks } from "./banks";

const bank = (id: string, name: string, code: string, is_active = true) => ({ id, name, code, icon: "", is_active });
const BANKS = [bank("1", "بانک ملت", "012"), bank("2", "بانک ملی ایران", "017"), bank("3", "مؤسسه اعتباری ملل", "075"), bank("4", "بانک سامان", "056", false), bank("5", "پست بانک ایران", "021")];

describe("bank search", () => {
	it("finds banks by Persian name without the «بانک» prefix", () => {
		expect(searchBanks(BANKS, "ملت").map((b) => b.id)).toEqual(["1"]);
		expect(searchBanks(BANKS, "ملل").map((b) => b.id)).toEqual(["3"]);
	});

	it("matches whatever keyboard typed it (Arabic ي/ك, half-spaces)", () => {
		expect(searchBanks(BANKS, "ملي").map((b) => b.id)).toEqual(["2"]);
		expect(searchBanks(BANKS, "پست‌بانک").map((b) => b.id)).toEqual(["5"]);
	});

	it("lists only active banks and says nothing matched with an empty list", () => {
		expect(searchBanks(BANKS, "").some((b) => b.id === "4")).toBe(false);
		expect(searchBanks(BANKS, "سامان")).toEqual([]);
		expect(searchBanks(BANKS, "zzz")).toEqual([]);
	});
});

describe("bank from a Sheba number", () => {
	it("reads the three-digit bank code after IRkk", () => {
		expect(bankCodeOf("IR120120000000001234567890")).toBe("012");
		expect(bankCodeOf("IR12012")).toBeNull();
	});

	it("names the bank it belongs to", () => {
		expect(bankOfIban(BANKS, "IR120170000000001234567890")?.name).toBe("بانک ملی ایران");
		expect(bankOfIban(BANKS, "IR129990000000001234567890")).toBeNull();
	});
});
