import { useCallback } from "react";

interface Props {
	seconds: number;
}

export default function useShowRemainingTime({ seconds }: Props) {
	const formatTime = useCallback((seconds: number) => {
		const روز = Math.floor(seconds / (24 * 3600));
		const ساعت = Math.floor((seconds % (24 * 3600)) / 3600);
		const دقیقه = Math.floor((seconds % 3600) / 60);
		const ثانیه = seconds % 60;

		return { روز, ساعت, دقیقه, ثانیه };
	}, []);

	return formatTime(seconds);
}
