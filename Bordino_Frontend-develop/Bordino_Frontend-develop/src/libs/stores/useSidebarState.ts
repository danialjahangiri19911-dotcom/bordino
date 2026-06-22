import { create } from "zustand";

interface DrawerStore {
	isOpen: boolean;
	open: () => void;
	close: () => void;
	toggle: () => void;
}

export const useSidebarState = create<DrawerStore>((set) => ({
	isOpen: true,
	open: () => set({ isOpen: true }),
	close: () => set({ isOpen: false }),
	toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));
