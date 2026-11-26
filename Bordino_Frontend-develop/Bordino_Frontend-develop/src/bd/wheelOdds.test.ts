import { chanceText, emptyChance, slicesFor } from "./wheelMath";
import type { WheelPrize } from "@/api/lottery/types/getWheelType";

const prize = (id: string, type: WheelPrize["prize_type"], probability: number, amount = 0) =>
	({ id, prize_type: type, probability, prize_amount: String(amount), name: id }) as unknown as WheelPrize;

describe("the wheel's chance of nothing", () => {
	it("is the share the «پوچ» slices take, at their real chances", () => {
		const slices = slicesFor([prize("a", "recharge", 30, 500), prize("b", "cash", 10, 1000), prize("e", "empty", 0)], 1);
		expect(Math.round(emptyChance(slices))).toBe(60);
		expect(chanceText(emptyChance(slices))).toBe("۶۰٪");
	});

	it("reads small and zero chances honestly", () => {
		expect(chanceText(0)).toBe("۰٪");
		expect(chanceText(0.4)).toBe("کمتر از ۱٪");
		expect(chanceText(12.6)).toBe("۱۳٪");
		expect(emptyChance(slicesFor([prize("a", "recharge", 100, 5)], 1))).toBe(0);
	});
});
