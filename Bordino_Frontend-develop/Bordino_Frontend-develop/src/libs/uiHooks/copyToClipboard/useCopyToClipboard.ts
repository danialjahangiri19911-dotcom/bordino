import { useCallback, useState } from "react";

export default function useCopyToClipboard() {
	const [success, setSuccess] = useState(false);
	const [error, setError] = useState<boolean>(false);

	const handleSuccessClose = useCallback(() => {
		setSuccess(false);
	}, []);
	const handleErrorClose = useCallback(() => {
		setError(false);
	}, []);

	const copyToClipboard = useCallback((text: string) => {
		navigator.clipboard
			.writeText(text)
			.then(() => {
				setSuccess(true);
				setError(false);
			})
			.catch((err) => {
				setError(err);
				setSuccess(false);
			});
	}, []);

	return {
		copyToClipboard,
		success,
		error,
		handleSuccessClose,
		handleErrorClose,
	};
}
