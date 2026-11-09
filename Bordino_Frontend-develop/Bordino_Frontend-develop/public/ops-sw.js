// «بردینو ادمین»'s service worker (scope /ops/): it makes the admin app installable as its own app.
// Nothing is cached: admin data is always fetched fresh from the server.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
	// pass through (the browser handles every request as usual)
});
