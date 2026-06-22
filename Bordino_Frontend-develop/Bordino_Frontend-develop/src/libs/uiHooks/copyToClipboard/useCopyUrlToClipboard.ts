import { useCallback, useEffect, useState } from "react";

import useCopyToClipboard from "./useCopyToClipboard";

export default function useCopyUrlToClipboard() {
	const [url, setUrl] = useState("");

	useEffect(() => {
		if (typeof window !== "undefined") {
			setUrl(window.location.href);
		}
	}, []);

	const {
		copyToClipboard,
		success,
		handleSuccessClose,
		error,
		handleErrorClose,
	} = useCopyToClipboard();

	const handleCopyToClipBoard = useCallback(() => {
		copyToClipboard(url);
	}, [copyToClipboard, url]);

	return {
		handleCopyToClipBoard,
		success,
		handleSuccessClose,
		error,
		handleErrorClose,
		url,
	};
}
