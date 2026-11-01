/**
 * The wheel's music and effects, made with Web Audio (no sound files), as in the
 * Bordino-Wheel-Game-Design package: a quiet loop while playing, a tick per slice, a win chime and a
 * low note for an empty slice. Nothing plays before the player has touched the page.
 */
export interface Soundtrack {
	start(): void;
	stop(): void;
	effect(kind: "tick" | "win" | "lose"): void;
	destroy(): void;
}

type AudioCtor = typeof AudioContext;

export function createSoundtrack(): Soundtrack {
	let context: AudioContext | null = null;
	let interval = 0;
	let next = 0;
	let step = 0;
	let playing = false;
	let disposed = false;
	const voices = new Set<OscillatorNode>();

	const unlock = () => {
		if (disposed || typeof window === "undefined") return false;
		try {
			const Ctor = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext) as AudioCtor;
			context ??= new Ctor();
			context.resume().catch(() => undefined);
			return true;
		} catch {
			return false;
		}
	};

	const note = (midi: number, time: number, duration: number, volume: number, type: OscillatorType = "sine") => {
		if (!context) return;
		const osc = context.createOscillator();
		const gain = context.createGain();
		osc.type = type;
		osc.frequency.setValueAtTime(440 * 2 ** ((midi - 69) / 12), time);
		gain.gain.setValueAtTime(0, time);
		gain.gain.linearRampToValueAtTime(volume, time + 0.02);
		gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
		osc.connect(gain);
		gain.connect(context.destination);
		voices.add(osc);
		osc.onended = () => {
			voices.delete(osc);
			osc.disconnect();
			gain.disconnect();
		};
		osc.start(time);
		osc.stop(time + duration + 0.03);
	};

	const CHORDS = [
		[57, 60, 64],
		[53, 57, 60],
		[60, 64, 67],
		[55, 59, 62],
	];
	const MELODY = [0, 1, 2, 1, 0, 2, 1, -1, 2, 1, 0, 1, 2, 0, 1, -1];

	const schedule = () => {
		if (!playing || !context) return;
		while (next < context.currentTime + 0.15) {
			const chord = CHORDS[Math.floor(step / 16) % 4];
			const n = step % 16;
			const m = MELODY[n];
			if (m >= 0) note(chord[m] + 12, next, 0.24, 0.018);
			if (n % 4 === 0) note(chord[0] - 12, next, 0.7, 0.025, "triangle");
			if (n === 0) chord.forEach((v) => note(v, next, 4.6, 0.006));
			step++;
			next += 0.3125;
		}
	};

	const stop = () => {
		playing = false;
		window.clearInterval(interval);
		interval = 0;
		voices.forEach((osc) => {
			try {
				osc.stop();
				osc.disconnect();
			} catch {
				// already stopped
			}
		});
		voices.clear();
	};

	return {
		start() {
			if (disposed || playing || !unlock() || !context) return;
			playing = true;
			next = context.currentTime + 0.035;
			step = 0;
			schedule();
			interval = window.setInterval(schedule, 100);
		},
		stop,
		effect(kind) {
			if (!unlock() || !context) return;
			const t = context.currentTime;
			if (kind === "tick") note(86, t, 0.045, 0.025, "triangle");
			else if (kind === "lose") note(48, t, 0.3, 0.035);
			else [72, 76, 79, 84].forEach((n, i) => note(n, t + i * 0.09, 0.32, 0.032));
		},
		destroy() {
			disposed = true;
			stop();
			context?.close().catch(() => undefined);
		},
	};
}
