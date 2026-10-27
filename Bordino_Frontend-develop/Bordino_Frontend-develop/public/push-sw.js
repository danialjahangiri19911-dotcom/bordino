// Loaded by /sw.js (next.config.mjs importScripts): shows Web Push notifications sent by
// the server (apps/notifications) and opens the app on a tap.
self.addEventListener("push", (event) => {
	let data = {};
	try {
		data = event.data ? event.data.json() : {};
	} catch {
		data = { title: "بردینو", body: event.data ? event.data.text() : "" };
	}
	event.waitUntil(
		self.registration.showNotification(data.title || "بردینو", {
			body: data.body || "",
			tag: data.tag || undefined,
			icon: "/bd/icons/icon-192.png",
			badge: "/bd/icons/icon-192.png",
			dir: "rtl",
			lang: "fa",
			data: { url: data.url || "/pwa/main" },
		}),
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const url = new URL(event.notification.data?.url || "/pwa/main", self.location.origin).href;
	event.waitUntil(
		self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
			const open = windows.find((w) => w.url.startsWith(self.location.origin));
			if (open) {
				open.focus();
				return open.navigate(url);
			}
			return self.clients.openWindow(url);
		}),
	);
});
