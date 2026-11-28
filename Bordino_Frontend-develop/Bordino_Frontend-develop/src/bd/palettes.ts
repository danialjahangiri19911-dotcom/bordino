/**
 * The approved colour palettes (2026-11-27): one place for the three styles × light/dark. The live UI's
 * tokens are generated from these (PALETTE_CSS, in the root layout) and «ظاهر برنامه» draws its
 * previews from the same objects — change a colour here and both follow.
 *
 * Role → token: page --bd-bg · card --bd-surface · text --bd-fg · muted --bd-muted · primary
 * --bd-accent · onPrimary --bd-on · selected --bd-tint · selectedText --bd-accent-ink · positive
 * --bd-positive · negative --bd-negative (debits and errors) · focus --bd-focus.
 * (No "use client": the server layout reads it as well.)
 */
export type Style = "neu" | "brutal" | "neon";
export type Scheme = "light" | "dark";

export interface Palette {
	page: string;
	card: string;
	text: string;
	muted: string;
	primary: string;
	onPrimary: string;
	selected: string;
	selectedText: string;
	positive: string;
	negative: string;
	focus: string;
}

const p = (...c: string[]): Palette => {
	const [page, card, text, muted, primary, onPrimary, selected, selectedText, positive, negative, focus] = c;
	return { page, card, text, muted, primary, onPrimary, selected, selectedText, positive, negative, focus };
};

export const PALETTES: Record<Style, Record<Scheme, Palette>> = {
	neu: {
		light: p("#ECEEF2", "#F9FAFC", "#25252B", "#555660", "#5A4BA7", "#FFFFFF", "#E4DFF6", "#493B83", "#236F46", "#9D3342", "#6657A8"),
		dark: p("#292E37", "#333944", "#F5F7FB", "#C2CAD7", "#C0B2FF", "#221D29", "#413A5B", "#DDD5FF", "#7FD6A3", "#FFB1B9", "#C0B2FF"),
	},
	brutal: {
		light: p("#FFF8EB", "#FFFDF5", "#29231E", "#62564F", "#C7393B", "#FFFFFF", "#F4C8BD", "#9B262E", "#236F46", "#9B262E", "#9B262E"),
		dark: p("#24211E", "#34302A", "#FFF7EB", "#D0C5B8", "#FF9995", "#291B1A", "#59322D", "#FFBCB7", "#7FD6A3", "#FFB6AD", "#FFD05C"),
	},
	neon: {
		light: p("#F3F2FC", "#FFFFFF", "#211C37", "#58556D", "#6340B5", "#FFFFFF", "#EAE2FF", "#543294", "#14705F", "#A33155", "#6743BB"),
		dark: p("#0E1020", "#191C30", "#FCFDFF", "#C4CCE4", "#64F4DD", "#082B26", "#302143", "#D6B9FF", "#7FE6AD", "#FFAACB", "#B781FF"),
	},
};

/**
 * «سفارشی» (2026-11-28, the owner's choice from a design reel): a third look per theme beside light and
 * dark — Neumorphism for «اسمورفی», Brutalism for «ماجراجویانه», Liquid Glass for «نئونی». Each sits on a
 * light or dark base (CUSTOM_BASE: the scheme the rest of the CSS draws with). Hues from the reel's
 * frames; shades nudged only where a pair fell under WCAG AA (≥ 4.5:1 text, ≥ 3:1 focus).
 */
export const CUSTOM: Record<Style, Palette> = {
	neu: p("#E3E7ED", "#F1F3F7", "#1F2430", "#525A69", "#335AB2", "#FFFFFF", "#D3DEF6", "#284A93", "#256C30", "#A3343C", "#335AB2"),
	brutal: p("#EEEEEE", "#FFFFFF", "#070606", "#4A4747", "#7330DD", "#FFFFFF", "#D0F700", "#070606", "#1E7334", "#B3261E", "#7330DD"),
	neon: p("#112779", "#25338C", "#F3F0FF", "#CDD0F5", "#B9BCF8", "#0E1B5E", "#4249AB", "#FFFFFF", "#8FE6B6", "#FFB4C9", "#E3CCFF"),
};
export const CUSTOM_BASE: Record<Style, Scheme> = { neu: "light", brutal: "light", neon: "dark" };

/** The palette on screen for a style, a scheme and whether «سفارشی» is chosen. */
export const paletteFor = (style: Style, scheme: Scheme, custom = false): Palette => (custom ? CUSTOM[style] : PALETTES[style][scheme]);

const TOKENS: [keyof Palette, string][] = [
	["page", "--bd-bg"],
	["card", "--bd-surface"],
	["text", "--bd-fg"],
	["muted", "--bd-muted"],
	["primary", "--bd-accent"],
	["onPrimary", "--bd-on"],
	["selected", "--bd-tint"],
	["selectedText", "--bd-accent-ink"],
	["positive", "--bd-positive"],
	["negative", "--bd-negative"],
	["focus", "--bd-focus"],
];

const CLASS: Record<Style, string> = { neu: "st-neu", brutal: "st-brutal", neon: "st-neon" };

/**
 * The tokens of every style and scheme, for <html data-bd-style data-bd-scheme>. The selector carries
 * both attributes, so it outranks the stylesheets' own per-style blocks (which keep only what is not a
 * palette role: shadows, borders, radii).
 */
export const PALETTE_CSS = (Object.keys(PALETTES) as Style[])
	.flatMap((style) =>
		(["light", "dark"] as Scheme[]).map((scheme) => {
			const pal = PALETTES[style][scheme];
			const vars = TOKENS.map(([role, token]) => `${token}:${pal[role]}`).join(";");
			return (
				`:root[data-bd-style="${style}"][data-bd-scheme="${scheme}"] #bordino-directions .bd-product.${CLASS[style]}{${vars};color-scheme:${scheme}}` +
				`html[data-bd-style="${style}"][data-bd-scheme="${scheme}"]{background:${pal.page}}`
			);
		}),
	)
	.concat(
		// «سفارشی»: one more attribute (data-bd-variant), so it outranks that style's light/dark tokens.
		(Object.keys(CUSTOM) as Style[]).map((style) => {
			const pal = CUSTOM[style];
			const vars = TOKENS.map(([role, token]) => `${token}:${pal[role]}`).join(";");
			return (
				`:root[data-bd-style="${style}"][data-bd-scheme][data-bd-variant="custom"] #bordino-directions .bd-product.${CLASS[style]}{${vars};color-scheme:${CUSTOM_BASE[style]}}` +
				`html[data-bd-style="${style}"][data-bd-scheme][data-bd-variant="custom"]{background:${pal.page}}`
			);
		}),
	)
	.join("\n");
