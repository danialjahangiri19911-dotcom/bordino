import { deleteAllCookies } from "./index";

// Tests for deleteAllCookies
describe("deleteAllCookies", () => {
	beforeEach(() => {
		// Set some cookies
		document.cookie = "cookie1=value1; path=/";
		document.cookie = "cookie2=value2; path=/";
		document.cookie = "cookie3=value3; path=/";
	});

	afterEach(() => {
		// Clean up any remaining cookies
		deleteAllCookies();
	});

	test("should delete all cookies", () => {
		// Verify cookies are set
		expect(document.cookie).toContain("cookie1=value1");
		expect(document.cookie).toContain("cookie2=value2");
		expect(document.cookie).toContain("cookie3=value3");

		// Delete all cookies
		deleteAllCookies();

		// Verify all cookies are deleted
		expect(document.cookie).toBe("");
	});
});
