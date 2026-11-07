"use client";

import { useEffect, useRef, useState } from "react";

import Icon from "../Icon";
import { useBackHandler } from "../back";

interface Detector {
	detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
type DetectorClass = { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> };

const detectorClass = () =>
	typeof window !== "undefined" ? ((window as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector ?? null) : null;

/** Whether this browser can read a QR from the camera here (Chrome on Android can; others: the phone's camera app). */
export async function canScanQr(): Promise<boolean> {
	const Detector = detectorClass();
	if (!Detector || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return false;
	try {
		return !Detector.getSupportedFormats || (await Detector.getSupportedFormats()).includes("qr_code");
	} catch {
		return false;
	}
}

/**
 * The camera, full screen, until a QR is read: `onCode` gets its text. Closed by its button or Back.
 * The camera is let go as soon as this closes.
 */
export default function QrScanner({ onCode, onClose }: { onCode: (text: string) => void; onClose: () => void }) {
	const video = useRef<HTMLVideoElement>(null);
	const [problem, setProblem] = useState<string | null>(null);
	const found = useRef(onCode);
	found.current = onCode;
	useBackHandler(true, onClose);

	useEffect(() => {
		let stream: MediaStream | null = null;
		let timer = 0;
		let stopped = false;
		const Detector = detectorClass();
		if (!Detector) {
			setProblem("این مرورگر QR نمی‌خواند؛ با دوربین گوشی اسکن کن.");
			return;
		}
		const detector = new Detector({ formats: ["qr_code"] });
		const look = async () => {
			if (stopped || !video.current) return;
			try {
				if (video.current.readyState >= 2) {
					const codes = await detector.detect(video.current);
					const text = codes.find((c) => c.rawValue)?.rawValue;
					if (text && !stopped) {
						stopped = true;
						found.current(text);
						return;
					}
				}
			} catch {
				// A frame that could not be read: the next one.
			}
			timer = window.setTimeout(() => void look(), 250);
		};
		navigator.mediaDevices
			.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
			.then((s) => {
				if (stopped) {
					s.getTracks().forEach((t) => t.stop());
					return;
				}
				stream = s;
				if (video.current) {
					video.current.srcObject = s;
					void video.current.play().catch(() => undefined);
				}
				void look();
			})
			.catch((e: unknown) =>
				setProblem(
					e instanceof DOMException && e.name === "NotAllowedError"
						? "اجازهٔ دوربین داده نشد؛ از تنظیمات اجازه بده، یا QR را با دوربین گوشی اسکن کن."
						: "دوربین باز نشد؛ QR را با دوربین گوشی اسکن کن.",
				),
			);
		return () => {
			stopped = true;
			window.clearTimeout(timer);
			stream?.getTracks().forEach((t) => t.stop());
		};
	}, []);

	return (
		<div className="my-scan" role="dialog" aria-modal="true" aria-label="اسکن QR محل">
			<video ref={video} muted playsInline aria-hidden="true" />
			<div className="my-scan-frame" aria-hidden="true" />
			<p className="my-scan-text" role="status">
				{problem ?? "QR محل را داخل کادر بگیر."}
			</p>
			<button type="button" className="bd-secondary my-scan-close" onClick={onClose}>
				<Icon name="x" /> بستن
			</button>
		</div>
	);
}
