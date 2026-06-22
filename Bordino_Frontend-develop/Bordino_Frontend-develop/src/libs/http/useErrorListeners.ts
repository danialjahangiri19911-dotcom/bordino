import { useCallback } from "react";

type ErrorCallback = (message: string | null) => void;

let errorListeners: ErrorCallback[] = [];

export const onError = (callback: ErrorCallback) => {
	errorListeners.push(callback);
};

export const offError = (callback: ErrorCallback) => {
	errorListeners = errorListeners.filter((cb) => cb !== callback);
};

export const emitError = (message: string | null) => {
	errorListeners.forEach((callback) => callback(message));
};

export const useErrorListeners = () => {
	const subscribe = useCallback((callback: ErrorCallback) => {
		onError(callback);
		return () => offError(callback);
	}, []);

	const emit = useCallback((message: string | null) => {
		emitError(message);
	}, []);

	return { subscribe, emit };
};
