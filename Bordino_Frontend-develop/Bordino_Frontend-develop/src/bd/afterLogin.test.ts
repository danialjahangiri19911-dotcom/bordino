import { rememberDestination, takeDestination } from "./afterLogin";

describe("back to the page after the SMS code", () => {
	beforeEach(() => localStorage.clear());

	it("returns the remembered app page once (and the same one for a moment after)", () => {
		rememberDestination("/pwa/gm/new?template=birthday");
		expect(takeDestination()).toBe("/pwa/gm/new?template=birthday");
		expect(takeDestination()).toBe("/pwa/gm/new?template=birthday"); // a second redirect a moment later
		expect(localStorage.getItem("bd-after-login")).toBeNull();
	});

	it("never remembers the sign-in pages or pages outside the app", () => {
		jest.useFakeTimers();
		jest.advanceTimersByTime(10_000);
		for (const p of ["/pwa/register", "/pwa/otp", "/pwa/onboarding", "/", "https://evil.example/pwa/x"]) rememberDestination(p);
		expect(takeDestination()).toBeNull();
		jest.useRealTimers();
	});
});
