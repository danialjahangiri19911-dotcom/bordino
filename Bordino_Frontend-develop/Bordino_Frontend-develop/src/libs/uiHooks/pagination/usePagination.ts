"use client";

import { useState } from "react";

export interface PaginationProps {
	defaultPage?: number;
	defaultPageSize?: number;
}

export interface UsePaginationReturn {
	page: number;
	pageSize: number;
	pageHandler: (v: number) => void;
	pageSizeHandler: (v: number) => void;
}

export default function usePagination(
	props: PaginationProps = {},
): UsePaginationReturn {
	const { defaultPageSize = 10, defaultPage = 1 } = props;

	const [page, setPage] = useState<number>(defaultPage);
	const [pageSize, setPageSize] = useState<number>(defaultPageSize);

	const pageHandler = (newPage: number) => {
		setPage(newPage);
	};

	const pageSizeHandler = (newSize: number) => {
		setPageSize(newSize);
	};

	return { page, pageSize, pageHandler, pageSizeHandler };
}
