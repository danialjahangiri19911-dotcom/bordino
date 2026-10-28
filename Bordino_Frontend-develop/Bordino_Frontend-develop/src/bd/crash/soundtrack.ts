/**
 * The crash game's music and effects from the Bordino-Crash-Game-Design package (createSoundtrack),
 * made with Web Audio: no sound files. Nothing plays before the player has touched the page (browsers
 * only allow sound after a tap), and every call is safe when Web Audio is missing.
 */
export interface Soundtrack {
	/** Call inside a tap: iPhone Safari only lets sound start from the gesture itself. */
	prime(): void;
	start(): void;
	stop(): void;
	effect(kind?: "cash" | "crash"): void;
	destroy(): void;
}

type Ctx = AudioContext;

export function createSoundtrack(): Soundtrack {
	let context: Ctx | null = null;
	let interval = 0;
	let next = 0;
	let step = 0;
	let playing = false;
	let disposed = false;
	const voices = new Set<OscillatorNode>();
	const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

	function unlock() {
		if (disposed) return false;
		try {
			const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
			if (!AC) return false;
			context ??= new AC();
			context.resume().catch(() => undefined);
			return true;
		} catch {
			return false;
		}
	}

	function note(midi: number, time: number, duration: number, volume: number, type: OscillatorType = "sine") {
		if (!context) return;
		const osc = context.createOscillator();
		const gain = context.createGain();
		osc.type = type;
		osc.frequency.setValueAtTime(frequency(midi), time);
		gain.gain.setValueAtTime(0, time);
		gain.gain.linearRampToValueAtTime(volume, time + 0.025);
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
	}

	function schedule() {
		if (!playing || !context) return;
		const chords = [
			[57, 60, 64],
			[53, 57, 60],
			[60, 64, 67],
			[55, 59, 62],
		];
		const melody = [0, 1, 2, 1, 0, 2, 1, -1, 2, 1, 0, 1, 2, 0, 1, -1];
		const beat = 0.3125;
		while (next < context.currentTime + 0.15) {
			const chord = chords[Math.floor(step / 16) % 4];
			const n = step % 16;
			const m = melody[n];
			if (m >= 0) note(chord[m] + 12, next, 0.24, 0.018, "sine");
			if (n % 4 === 0) note(chord[0] - 12, next, 0.7, 0.025, "triangle");
			if (n === 0) chord.forEach((v) => note(v, next, 4.6, 0.006, "sine"));
			step++;
			next += beat;
		}
	}

	function stop() {
		playing = false;
		window.clearInterval(interval);
		interval = 0;
		for (const osc of voices) {
			try {
				osc.stop();
			} catch {
				// already stopped
			}
			try {
				osc.disconnect();
			} catch {
				// already disconnected
			}
		}
		voices.clear();
	}

	return {
		prime() {
			unlock();
		},
		start() {
			if (disposed || playing || !unlock() || !context) return;
			playing = true;
			next = context.currentTime + 0.035;
			step = 0;
			schedule();
			interval = window.setInterval(schedule, 100);
		},
		stop,
		effect(kind = "cash") {
			if (!unlock() || !context) return;
			note(kind === "crash" ? 48 : 69, context.currentTime, 0.16, 0.035);
			note(kind === "crash" ? 36 : 76, context.currentTime + 0.065, 0.22, 0.03, kind === "crash" ? "triangle" : "sine");
		},
		destroy() {
			disposed = true;
			stop();
			context?.close().catch(() => undefined);
		},
	};
}
