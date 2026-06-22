import base64ImageConverter from "./index";

describe("base64ImageConverter", () => {
	test("should return correct base64 string when path is provided", () => {
		const path = "someBase64string";
		const result = base64ImageConverter({ path });
		expect(result).toBe(`data:image/png;base64,${path}`);
	});

	test("should handle null path", () => {
		const result = base64ImageConverter({ path: null });
		expect(result).toBe("data:image/png;base64,null");
	});

	test("should handle undefined path", () => {
		const result = base64ImageConverter({});
		expect(result).toBe("data:image/png;base64,undefined");
	});

	test("should handle empty string path", () => {
		const result = base64ImageConverter({ path: "" });
		expect(result).toBe("data:image/png;base64,");
	});
});
