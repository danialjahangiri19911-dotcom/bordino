"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { UsePaginationReturn } from "./usePagination";

export interface UrlPaginationProps {
	pageKey?: string;
	pageSizeKey?: string;
	defaultPage?: number;
	defaultPageSize?: number;
}

export default function useUrlPagination(
	props: UrlPaginationProps = {},
): UsePaginationReturn {
	const {
		pageSizeKey = "page-size",
		pageKey = "page",
		defaultPage = 1,
		defaultPageSize = 10,
	} = props;

	const router = useRouter();
	const pathname = usePathname();

	const searchParams = useSearchParams();
	const page = Number(searchParams.get(pageKey) ?? defaultPage);
	const pageSize = Number(searchParams.get(pageSizeKey) ?? defaultPageSize);

	const genSearchParams = () => new URLSearchParams(searchParams.toString());

	const applySearchParams = (searchParams: URLSearchParams) => {
		const path = `${pathname}?${searchParams.toString()}`;
		router.push(path);
	};

	const pageHandler = (newPage: number) => {
		const searchParams = genSearchParams();
		searchParams.set(pageKey, String(newPage));
		applySearchParams(searchParams);
	};

	const pageSizeHandler = (newSize: number) => {
		const searchParams = genSearchParams();
		searchParams.set(pageKey, String(defaultPage));
		searchParams.set(pageSizeKey, String(newSize));
		applySearchParams(searchParams);
	};

	return { page, pageSize, pageHandler, pageSizeHandler };
}
