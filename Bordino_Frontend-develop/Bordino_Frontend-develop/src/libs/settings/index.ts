export const isDevelop = process.env.NODE_ENV === "development";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
let fakeAPIAddress = process.env.NEXT_PUBLIC_FAKE_API_ADDRESS;
const fakeAPIHost = fakeAPIAddress?.split(":")[0];
const fakeAPIPort = Number(fakeAPIAddress?.split(":")[1]);
fakeAPIAddress = `http://${fakeAPIHost}:${fakeAPIPort}`;

const settings = {
	fakeAPIAddress,
	fakeAPIHost,
	fakeAPIPort,
	isDevelop,
	apiBaseUrl,
};

export default settings;
