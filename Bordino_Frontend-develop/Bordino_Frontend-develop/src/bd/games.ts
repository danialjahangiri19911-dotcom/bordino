import type { IconName } from "./Icon";
import { R } from "./ui";

export interface GameEntry {
	id: "sudoku" | "game2048" | "crash" | "chicken";
	name: string;
	tag: string;
	blurb: string;
	icon: IconName;
	group: "puzzle" | "arcade";
	href: string;
}

/** The games this app really has (each opens its own engine). */
export const GAMES: GameEntry[] = [
	{ id: "sudoku", name: "سودوکو", tag: "تمرکز", blurb: "چالش اعداد و تمرکز", icon: "puzzle", group: "puzzle", href: R.sudoku },
	{ id: "game2048", name: "۲۰۴۸", tag: "اعداد", blurb: "ترکیب عددها و ساختن رکورد", icon: "grid-2x2", group: "puzzle", href: R.game2048 },
	{ id: "crash", name: "انفجار", tag: "آرکید", blurb: "ضریب بالا می‌رود؛ قبل از انفجار برداشت کن", icon: "rocket", group: "arcade", href: R.crash },
	{ id: "chicken", name: "مرغ فراری", tag: "آرکید", blurb: "از خیابان رد شو و ضریب را بالا ببر", icon: "bird", group: "arcade", href: R.chicken },
];
