import { useCallback, useEffect, useMemo, useState } from "react";

const START_MINUTE = 1;
const FULL_SECONDS = START_MINUTE * 60;

const formatTime = (time: number) => {
	const minutes = String(Math.floor(time / 60)).padStart(2, "0");
	const seconds = String(Math.floor(time % 60)).padStart(2, "0");
	return `${minutes}:${seconds}`;
};

export default function useCounter(initialSeconds: number = FULL_SECONDS) {
	const [counter, setCounter] = useState(initialSeconds);

	useEffect(() => {
		const interval = setInterval(() => {
			setCounter((prevCounter) => (prevCounter > 0 ? prevCounter - 1 : 0));
		}, 1000);
		return () => clearInterval(interval);
	}, []);

	const resetCounter = useCallback(() => {
		setCounter(FULL_SECONDS);
	}, []);

	// شروع شمارش از یک مقدار مشخص (مثلاً زمان باقی‌مانده‌ی واقعی).
	const startFrom = useCallback((seconds: number) => {
		setCounter(Math.max(0, Math.floor(seconds)));
	}, []);

	const time = useMemo(() => formatTime(counter), [counter]);

	return { time, counter, resetCounter, startFrom };
}
