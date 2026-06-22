export type SearchParams = Record<string, string> | string[][];

export interface UrlParams {
	[key: string]: string | number;
}

export interface ClientParams {
	page?: number;
	pageSize?: number;
}

interface ApiParams {
	page?: number;
	size?: number;
}

export function addSearchParamsToUrl(url: string, params: SearchParams) {
	const urlSearchParams = new URLSearchParams(params);
	return `${url}?${urlSearchParams.toString()}`;
}

export function addParamsToUrl(url: string, params: UrlParams) {
	Object.entries(params).forEach(([key, value]) => {
		key = `:${key}`;
		url = url.replace(key, String(value));
	});
	return url;
}

export function addPaginationParams(params: ClientParams): ApiParams {
	return {
		page: params.page,
		size: params.pageSize,
	};
}
