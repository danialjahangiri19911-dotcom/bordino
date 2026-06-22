import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface User {
	id: string;
	username: string;
	gender: "F" | "M";
	birthdate: string;
	phoneNumber: string;
	image_url: string;
	registrationStep: string;
}

interface UserState {
	user: User | null;
	setUser: (user: Partial<User>) => void;
	clearUser: () => void;
}

const useUserStore = create<UserState>()(
	persist(
		(set) => ({
			user: null,

			setUser: (newValues) =>
				set((state) => ({
					user: state.user
						? { ...state.user, ...newValues }
						: (newValues as User),
				})),

			clearUser: () => set({ user: null }),
		}),
		{
			name: "user-storage",
			storage: createJSONStorage(() => localStorage),
		},
	),
);

export default useUserStore;
