import { priceLines, tagCost, withCost } from "./gamePrices";
import { GAMES } from "./games";

const game = (id: string) => GAMES.find((g) => g.id === id)!;

describe("game card prices", () => {
	it("says what each kind of game costs and pays, from the server's numbers", () => {
		expect(priceLines(game("sudoku"), { fee_min: 2000, fee_max: 2000, reward_min: 500, reward_max: 1200 })).toEqual({ cost: "ورودی ۲٬۰۰۰ سکه", pays: "پاداش حل: ۵۰۰ تا ۱٬۲۰۰ سکه" });
		expect(priceLines(game("game2048"), { fee_min: 2000, fee_max: 2000 })).toEqual({ cost: "ورودی ۲٬۰۰۰ سکه", pays: "امتیازش سکه نمی‌شود" });
		expect(priceLines(game("crash"), { min_bet: 1000, max_bet: 50000 })).toEqual({ cost: "شرط از ۱٬۰۰۰ سکه", pays: "برد: شرط × ضریب" });
		expect(priceLines(game("spy"), { fee_min: 0, fee_max: 0 })).toEqual({ cost: "ورود رایگان", pays: "بدون پاداش سکه" });
		expect(priceLines(game("hafez"), undefined)).toEqual({ cost: "رایگان", pays: "بدون سکه" });
		expect(priceLines(game("dowr"), undefined)).toBeNull(); // not known yet: nothing guessed
	});

	it("the start button repeats the exact cost", () => {
		expect(withCost("شروع بازی", 5000)).toBe("شروع بازی · ۵٬۰۰۰ سکه");
		expect(withCost("شروع بازی", 0)).toBe("شروع بازی");
		const b = document.createElement("button");
		b.textContent = "شروع";
		tagCost(b, 5000);
		tagCost(b, 5000);
		expect(b.textContent).toBe("شروع، ۵٬۰۰۰ سکه");
		tagCost(b, 0);
		expect(b.textContent).toBe("شروع");
	});
});
