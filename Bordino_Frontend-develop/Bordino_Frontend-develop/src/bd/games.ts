import type { IconName } from "./Icon";
import { R } from "./ui";

export interface GameEntry {
	id: "sudoku" | "game2048" | "crash" | "chicken" | "pantomime" | "dowr" | "spy" | "hafez" | "tarot";
	name: string;
	tag: string;
	blurb: string;
	icon: IconName;
	/** The game's own logo (public/bd/games), drawn for it; else the icon is shown. */
	logo?: string;
	group: "puzzle" | "arcade" | "party" | "fal";
	href: string;
	/** What playing does to the coins (the card says it before the game opens): «coins» pays coins for
	 * a win, «score» keeps only the game's own score, «bet» wins bet × multiplier, «none» pays nothing,
	 * «free» costs and pays nothing. */
	pays: "coins" | "score" | "bet" | "none" | "free";
	/** The server's name for its price (wallet/games/prices/), when it has one. */
	price?: "sudoku" | "game_2048" | "pantomime" | "dowr" | "spy" | "crash" | "chicken";
}

/** The games this app really has (each opens its own engine). */
export const GAMES: GameEntry[] = [
	{ id: "sudoku", name: "سودوکو", tag: "تمرکز", blurb: "چالش اعداد و تمرکز", icon: "puzzle", group: "puzzle", href: R.sudoku, pays: "coins", price: "sudoku" },
	{ id: "game2048", name: "۲۰۴۸", tag: "اعداد", blurb: "ترکیب عددها و ساختن رکورد", icon: "grid-2x2", group: "puzzle", href: R.game2048, pays: "score", price: "game_2048" },
	{ id: "crash", name: "انفجار", tag: "آرکید", blurb: "ضریب بالا می‌رود؛ قبل از انفجار برداشت کن", icon: "rocket", logo: "/bd/games/crash-logo.svg", group: "arcade", href: R.crash, pays: "bet", price: "crash" },
	{ id: "chicken", name: "مرغ فراری", tag: "آرکید", blurb: "از خیابان رد شو و ضریب را بالا ببر", icon: "bird", logo: "/bd/games/chicken-logo.svg", group: "arcade", href: R.chicken, pays: "bet", price: "chicken" },
	{ id: "pantomime", name: "پانتومیم", tag: "دورهمی", blurb: "بازی گروهی با یک گوشی؛ فقط با حرکت", icon: "drama", group: "party", href: R.pantomime, pays: "none", price: "pantomime" },
	{ id: "dowr", name: "دُور", tag: "دورهمی", blurb: "حدس کلمه با توضیح؛ تیم‌های دونفره، یک گوشی", icon: "messages-square", group: "party", href: R.dowr, pays: "none", price: "dowr" },
	{ id: "spy", name: "جاسوس", tag: "دورهمی", blurb: "یک کلمه، چند نگاه مشکوک؛ جاسوس را پیدا کنید", icon: "scan-face", group: "party", href: R.spy, pays: "none", price: "spy" },
	// «فال» (2026-11-26: on the hidden home page before): free, nothing charged or paid.
	{ id: "hafez", name: "فال حافظ", tag: "فال", blurb: "نیت کن و غزلت را بخوان", icon: "book-open", group: "fal", href: R.hafez, pays: "free" },
	{ id: "tarot", name: "فال تاروت", tag: "فال", blurb: "کارت‌ها را بکش و تعبیرش را ببین", icon: "sparkles", group: "fal", href: R.tarot, pays: "free" },
];
