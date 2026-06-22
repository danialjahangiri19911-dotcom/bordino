import {
	addPaginationParams,
	addParamsToUrl,
	addSearchParamsToUrl,
} from "./index";

describe("----- addSearchParamsToUrl -----", () => {
	it("sets params to path successfully", () => {
		const url = "/some/url/path";
		expect(addSearchParamsToUrl(url, { id: "uid-u", city: "tehran" })).toEqual(
			"/some/url/path?id=uid-u&city=tehran",
		);
	});

	it('sets params to path that endswith "/" successfully', () => {
		const url = "/some/url/path/";
		expect(addSearchParamsToUrl(url, { id: "uid-u", city: "tehran" })).toEqual(
			"/some/url/path/?id=uid-u&city=tehran",
		);
	});

	it("sets params to url successfully", () => {
		const url = "https://someurl.ir/some/url/path";
		expect(addSearchParamsToUrl(url, { id: "uid-u", city: "tehran" })).toEqual(
			"https://someurl.ir/some/url/path?id=uid-u&city=tehran",
		);
	});
	it("sets repetitive keys to url successfully", () => {
		const url = "https://someurl.ir/some/url/path";
		expect(
			addSearchParamsToUrl(url, [
				["id", "1"],
				["id", "2"],
				["name", "name1"],
			]),
		).toEqual("https://someurl.ir/some/url/path?id=1&id=2&name=name1");
	});
});

describe("----- addParamsToUrl -----", () => {
	it("add number param", () => {
		const url = "some/:id/some-path/:company";
		const params = { id: 213, company: "company1" };
		expect(addParamsToUrl(url, params)).toEqual("some/213/some-path/company1");
	});

	it("add number param", () => {
		const url = "https://some-domain.ir/some/:id/some-path/:company";
		const params = { id: 213, company: "company1" };
		expect(addParamsToUrl(url, params)).toEqual(
			"https://some-domain.ir/some/213/some-path/company1",
		);
	});
});

describe("-----addPaginationParams------", () => {
	it("return exact params", () => {
		const params = { page: 1, pageSize: 20 };
		expect(addPaginationParams(params)).toEqual({ page: 1, size: 20 });
	});
});
