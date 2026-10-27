"use client";

import { useEffect, useRef, useState } from "react";

import Icon from "./Icon";

interface InstallEvent extends Event {
	prompt: () => Promise<void>;
}

/** «نصب اپلیکیشن» when the browser offers to install the PWA (Chrome's beforeinstallprompt). */
export default function InstallPrompt() {
	const deferred = useRef<InstallEvent | null>(null);
	const [show, setShow] = useState(false);

	useEffect(() => {
		if (process.env.NODE_ENV === "development") return;
		const onPrompt = (event: Event) => {
			event.preventDefault();
			deferred.current = event as InstallEvent;
			setShow(true);
		};
		window.addEventListener("beforeinstallprompt", onPrompt);
		return () => window.removeEventListener("beforeinstallprompt", onPrompt);
	}, []);

	if (!show) return null;
	return (
		<div className="bd-product st-brutal bd-install" role="dialog" aria-label="نصب اپلیکیشن">
			<span>بوردینو را روی گوشی نصب کن.</span>
			<button
				type="button"
				className="bd-action"
				onClick={() => {
					deferred.current?.prompt();
					setShow(false);
				}}
			>
				نصب اپلیکیشن
			</button>
			<button type="button" className="bd-install-close" aria-label="بستن" onClick={() => setShow(false)}>
				<Icon name="x" />
			</button>
		</div>
	);
}
