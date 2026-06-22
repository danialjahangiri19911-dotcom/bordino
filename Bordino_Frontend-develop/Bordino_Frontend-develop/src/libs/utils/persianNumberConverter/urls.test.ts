import { persianNumberConverter } from ".";

describe("----- convert persian number -----", () => {
	it("if persian number", () => {
		const textWithPersianNum = "۱۴۲۳";
		expect(persianNumberConverter(textWithPersianNum)).toEqual("1423");
	});
});
