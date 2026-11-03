/**
 * The design's music and effects (pantomime.js `sound()`), made with Web Audio: no files. Off until
 * the player turns it on (a tap is what lets a browser start audio).
 */
export type Effect = "correct" | "pass" | "end" | "tick";

export interface PantomimeSound {
	enable(on: boolean): Promise<boolean>;
	music(on: boolean): void;
	effect(kind: Effect): void;
	destroy(): void;
}

export function createSound(): PantomimeSound {
	let ctx: AudioContext | null = null;
	let on = false;
	let timer: number | null = null;
	let step = 0;
	const later: number[] = [];

	function tone(freq: number, len = 0.1, type: OscillatorType = "sine", gain = 0.045) {
		if (!on || !ctx) return;
		const t = ctx.currentTime;
		const o = ctx.createOscillator();
		const a = ctx.createGain();
		o.type = type;
		o.frequency.value = freq;
		a.gain.setValueAtTime(0, t);
		a.gain.linearRampToValueAtTime(gain, t + 0.015);
		a.gain.exponentialRampToValueAtTime(0.0001, t + len);
		o.connect(a);
		a.connect(ctx.destination);
		o.start(t);
		o.stop(t + len + 0.02);
	}
	const after = (ms: number, fn: () => void) => later.push(window.setTimeout(fn, ms));
	function stop() {
		if (timer !== null) window.clearInterval(timer);
		timer = null;
		if (ctx && ctx.state === "running") ctx.suspend().catch(() => undefined);
	}

	return {
		async enable(value) {
			on = value;
			if (!value) {
				stop();
				return false;
			}
			try {
				const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
				ctx = ctx ?? new Ctor();
				await ctx.resume();
				return true;
			} catch {
				on = false;
				return false;
			}
		},
		music(value) {
			if (timer !== null) window.clearInterval(timer);
			timer = null;
			if (!value) {
				stop();
				return;
			}
			if (on && ctx) {
				ctx.resume().catch(() => undefined);
				timer = window.setInterval(() => {
					tone([261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23][step++ % 8], 0.28, "sine", 0.012);
				}, 460);
			}
		},
		effect(kind) {
			if (kind === "correct") {
				tone(659, 0.14);
				after(100, () => tone(880, 0.18));
			} else if (kind === "pass") tone(220, 0.12);
			else if (kind === "end") {
				tone(523, 0.28);
				after(150, () => tone(784, 0.4));
			} else tone(440, 0.07, "sine", 0.022);
		},
		destroy() {
			on = false;
			stop();
			later.splice(0).forEach((t) => window.clearTimeout(t));
			if (ctx) ctx.close().catch(() => undefined);
			ctx = null;
		},
	};
}
