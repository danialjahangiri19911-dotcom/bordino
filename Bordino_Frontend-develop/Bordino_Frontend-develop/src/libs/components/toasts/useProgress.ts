import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
	open: boolean;
	duration?: number;
}

function useProgress({ open, duration = 5000 }: Props) {
	const [progress, setProgress] = useState(0);
	const intervalRef = useRef<NodeJS.Timeout | null>(null);

	const clearProgressInterval = useCallback(() => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
	}, []);

	useEffect(() => {
		if (!open) {
			clearProgressInterval();
			return;
		}

		setProgress(0);
		const intervalDuration = 100;
		const progressIncrement = 100 / (duration / intervalDuration);

		intervalRef.current = setInterval(() => {
			setProgress((oldProgress) => {
				const newProgress = Math.min(oldProgress + progressIncrement, 100);
				if (newProgress === 100) {
					clearProgressInterval();
				}
				return newProgress;
			});
		}, intervalDuration);

		return clearProgressInterval;
	}, [open, duration, clearProgressInterval]);

	return progress;
}

export default useProgress;
