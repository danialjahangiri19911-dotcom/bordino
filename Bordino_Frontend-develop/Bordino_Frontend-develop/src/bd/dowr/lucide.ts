import { ICONS, type IconName } from "../icons";

/**
 * The design module draws its icons with Lucide's `createIcons()` (it writes `<i data-lucide="name">`
 * and calls `globalThis.lucide.createIcons`). This draws them from the app's own Lucide 1.17.0 set
 * instead of loading the 600 KB library. An icon the set does not have is left out (never an error).
 */
const SVG = "http://www.w3.org/2000/svg";

function draw(el: Element, attrs: Record<string, string | number>) {
	const name = el.getAttribute("data-lucide") as IconName | null;
	const node = name ? ICONS[name] : undefined;
	if (!node) {
		el.remove();
		return;
	}
	const svg = document.createElementNS(SVG, "svg");
	const base: Record<string, string | number> = {
		xmlns: SVG,
		width: 24,
		height: 24,
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		"stroke-width": 2,
		"stroke-linecap": "round",
		"stroke-linejoin": "round",
		...attrs,
	};
	for (const [k, v] of Object.entries(base)) svg.setAttribute(k, String(v));
	svg.setAttribute("class", `lucide lucide-${name} ${el.getAttribute("class") ?? ""}`.trim());
	for (const k of ["aria-hidden", "aria-label", "role"]) {
		const v = el.getAttribute(k);
		if (v !== null) svg.setAttribute(k, v);
	}
	for (const [tag, a] of node) {
		const child = document.createElementNS(SVG, tag);
		for (const [k, v] of Object.entries(a)) child.setAttribute(k, String(v));
		svg.appendChild(child);
	}
	el.replaceWith(svg);
}

export function installLucideShim() {
	const g = globalThis as unknown as { lucide?: { createIcons: (o?: { attrs?: Record<string, string | number> }) => void } };
	if (g.lucide) return;
	g.lucide = {
		createIcons(options) {
			document.querySelectorAll("i[data-lucide]").forEach((el) => draw(el, options?.attrs ?? {}));
		},
	};
}
