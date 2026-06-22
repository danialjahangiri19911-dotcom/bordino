import requester from "./requester";

export const defaultFetcher = async <T>(url: string): Promise<T> => {
	try {
		const response = await requester.get<T>(url);
		return response.data;
	} catch (err) {
		throw new Error(`Failed to fetch data from the server: ${err}`);
	}
};
