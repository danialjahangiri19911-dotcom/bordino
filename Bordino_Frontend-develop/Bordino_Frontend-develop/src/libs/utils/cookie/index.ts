export function deleteAllCookies() {
	const cookies = document.cookie.split("; ");
	const domain = window.location.hostname;

	cookies.forEach((cookie) => {
		const name = cookie.split("=")[0];
		const expires = "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";

		// Delete from current domain
		document.cookie = name + expires;

		// Delete from current domain with `www` subdomain (if applicable)
		document.cookie = name + expires + ";domain=" + domain;

		// Delete from base domain (with leading dot, if applicable)
		if (domain.startsWith("www.")) {
			const baseDomain = domain.slice(4); // Removes 'www.'
			document.cookie = name + expires + ";domain=." + baseDomain;
		}
	});
}
