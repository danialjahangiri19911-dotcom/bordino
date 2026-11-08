"use client";

import { useEffect, useRef } from "react";

import "leaflet/dist/leaflet.css";

type Leaflet = typeof import("leaflet");

/** Tehran, when no point is set yet. */
const START: [number, number] = [35.6997, 51.338];

/**
 * A map to choose a stage's place: tap to put the pin, or drag it. The circle shows the radius the
 * player must be within. OpenStreetMap tiles; Leaflet is loaded only when a map is shown.
 */
export default function MapPicker({
	lat,
	lng,
	radius,
	disabled,
	onPick,
}: {
	lat: number | null;
	lng: number | null;
	radius: number;
	disabled: boolean;
	onPick: (lat: number, lng: number) => void;
}) {
	const box = useRef<HTMLDivElement>(null);
	const map = useRef<import("leaflet").Map | null>(null);
	const pin = useRef<import("leaflet").Marker | null>(null);
	const ring = useRef<import("leaflet").Circle | null>(null);
	const L = useRef<Leaflet | null>(null);
	const pick = useRef(onPick);
	pick.current = onPick;
	const off = useRef(disabled);
	off.current = disabled;

	const round = (n: number) => Math.round(n * 1e6) / 1e6;

	// The pin and the circle follow the stage's point (typed, picked or from «موقعیت فعلی من»).
	const place = (la: number, ln: number, r: number, pan: boolean) => {
		const leaflet = L.current;
		if (!leaflet || !map.current) return;
		if (!pin.current) {
			const icon = leaflet.divIcon({ className: "gm-map-pin", html: "<span></span>", iconSize: [28, 28], iconAnchor: [14, 28] });
			pin.current = leaflet.marker([la, ln], { icon, draggable: !off.current, keyboard: false }).addTo(map.current);
			pin.current.on("dragend", () => {
				const p = pin.current!.getLatLng();
				pick.current(round(p.lat), round(p.lng));
			});
			ring.current = leaflet.circle([la, ln], { radius: r, color: "#d64142", weight: 2, fillOpacity: 0.12 }).addTo(map.current);
		} else {
			pin.current.setLatLng([la, ln]);
			ring.current?.setLatLng([la, ln]).setRadius(r);
		}
		if (pan) map.current.setView([la, ln], Math.max(map.current.getZoom(), 16));
	};

	useEffect(() => {
		let gone = false;
		void import("leaflet").then((leaflet) => {
			if (gone || !box.current || map.current) return;
			L.current = leaflet;
			const has = lat !== null && lng !== null;
			// Canvas, not SVG: the app sizes every svg inside .bd-product (bd.css), which would shrink the circle.
			map.current = leaflet.map(box.current, { center: has ? [lat!, lng!] : START, zoom: has ? 16 : 12, attributionControl: true, preferCanvas: true });
			leaflet
				.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" })
				.addTo(map.current);
			map.current.on("click", (e: import("leaflet").LeafletMouseEvent) => {
				if (off.current) return;
				pick.current(round(e.latlng.lat), round(e.latlng.lng));
			});
			if (has) place(lat!, lng!, radius, false);
		});
		return () => {
			gone = true;
			map.current?.remove();
			map.current = null;
			pin.current = null;
			ring.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (lat !== null && lng !== null) place(lat, lng, radius, true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [lat, lng]);
	useEffect(() => {
		ring.current?.setRadius(radius);
	}, [radius]);
	useEffect(() => {
		if (!pin.current) return;
		if (disabled) pin.current.dragging?.disable();
		else pin.current.dragging?.enable();
	}, [disabled]);

	return <div ref={box} className="gm-map" dir="ltr" role="application" aria-label="نقشه: برای انتخاب محل، روی نقشه بزن یا نشانگر را بکش" />;
}
