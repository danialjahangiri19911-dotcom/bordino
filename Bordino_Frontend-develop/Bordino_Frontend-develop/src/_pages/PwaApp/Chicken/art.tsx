/** Hand-drawn SVGs for the chicken game: no emoji, so every phone draws the same thing. */

export function ChickenSvg({ size = 48 }: { size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
			<ellipse cx="32" cy="58" rx="14" ry="3" fill="rgba(0,0,0,0.3)" />
			<path d="M26 50 l-3 7 M38 50 l3 7" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
			<ellipse cx="32" cy="38" rx="17" ry="15" fill="#ffffff" />
			<path d="M17 36 q-7 -2 -5 -10 q5 3 8 6" fill="#f1f5f9" />
			<circle cx="38" cy="22" r="11" fill="#ffffff" />
			<path d="M33 12 q2 -6 5 -1 q2 -6 5 0 q3 -4 3 3 z" fill="#ef4444" />
			<path d="M48 22 l8 3 l-8 3 z" fill="#f59e0b" />
			<path d="M45 29 q2 5 -2 6 q-1 -3 0 -6 z" fill="#ef4444" />
			<circle cx="41" cy="20" r="2.2" fill="#0f172a" />
			<path d="M26 40 q6 6 12 0" stroke="#e2e8f0" strokeWidth="2" fill="none" />
		</svg>
	);
}

export function RoastSvg({ size = 48 }: { size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
			<ellipse cx="32" cy="57" rx="16" ry="3" fill="rgba(0,0,0,0.3)" />
			<path d="M14 40 q0 -18 18 -18 q18 0 18 18 q0 12 -18 12 q-18 0 -18 -12 z" fill="#b45309" />
			<path d="M20 36 q4 -9 14 -9" stroke="#f59e0b" strokeWidth="3" fill="none" strokeLinecap="round" />
			<rect x="44" y="18" width="5" height="14" rx="2" transform="rotate(35 46 25)" fill="#fef3c7" />
			<circle cx="50" cy="15" r="4" fill="#fef3c7" />
			<circle cx="54" cy="18" r="4" fill="#fef3c7" />
			<path d="M24 8 q3 4 0 8 M32 5 q3 4 0 8 M40 8 q3 4 0 8" stroke="#94a3b8" strokeWidth="2" fill="none" strokeLinecap="round" />
		</svg>
	);
}

export function CarSvg({ color, width = 44 }: { color: string; width?: number }) {
	return (
		<svg width={width} height={width * 1.7} viewBox="0 0 40 68" aria-hidden>
			<rect x="3" y="2" width="34" height="64" rx="9" fill={color} />
			<rect x="7" y="12" width="26" height="12" rx="3" fill="#bfdbfe" opacity="0.9" />
			<rect x="7" y="44" width="26" height="9" rx="3" fill="#bfdbfe" opacity="0.7" />
			<rect x="8" y="27" width="24" height="14" rx="2" fill="rgba(0,0,0,0.15)" />
			<rect x="6" y="62" width="7" height="3" rx="1" fill="#fde68a" />
			<rect x="27" y="62" width="7" height="3" rx="1" fill="#fde68a" />
		</svg>
	);
}

export function BarrierSvg() {
	return (
		<svg width="56" height="14" viewBox="0 0 56 14" aria-hidden>
			<rect x="0" y="2" width="56" height="10" rx="2" fill="#facc15" />
			<path d="M6 2 l8 10 M20 2 l8 10 M34 2 l8 10 M48 2 l6 8" stroke="#111827" strokeWidth="4" />
		</svg>
	);
}

export function FlagSvg() {
	return (
		<svg width="34" height="44" viewBox="0 0 34 44" aria-hidden>
			<rect x="3" y="2" width="3" height="40" fill="#e2e8f0" />
			<path d="M6 4 h24 v16 h-24 z" fill="#ffffff" />
			<path d="M6 4 h6 v4 h-6 z M18 4 h6 v4 h-6 z M12 8 h6 v4 h-6 z M24 8 h6 v4 h-6 z M6 12 h6 v4 h-6 z M18 12 h6 v4 h-6 z M12 16 h6 v4 h-6 z M24 16 h6 v4 h-6 z" fill="#0f172a" />
		</svg>
	);
}
