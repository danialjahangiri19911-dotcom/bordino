import { create } from "zustand";

interface ShowToastParams {
	message: string;
	onClose?: () => void;
}

interface ToastState {
	isOpen: boolean;
	message: string;
	onClose?: () => void;
	setOpen: (params: ShowToastParams) => void;
	setClose: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
	isOpen: false,
	message: "",
	onClose: undefined,
	setOpen: ({ message, onClose }: ShowToastParams) =>
		set({ isOpen: true, message, onClose }),

	setClose: () =>
		set((state) => {
			if (state.onClose) {
				state.onClose();
			}
			return {
				isOpen: false,
				onClose: undefined,
			};
		}),
}));
