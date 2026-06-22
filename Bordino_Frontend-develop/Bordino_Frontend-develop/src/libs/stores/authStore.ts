import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface AuthState {
	isLoggedIn: boolean;
	accessToken: string | null;
	refreshToken: string | null;
	userAlreadyExist: boolean;
	login: (accessToken: string, refreshToken: string) => void;
	logout: () => void;
	setAlreadyExist: (userAlreadyExist: boolean) => void;
}

const useAuthStore = create<AuthState>()(
	persist(
		(set) => ({
			isLoggedIn: false,
			accessToken: null,
			refreshToken: null,
			userAlreadyExist: false,
			login: (accessToken, refreshToken) => {
				set({ isLoggedIn: true, accessToken, refreshToken });
			},
			logout: () => {
				set({
					isLoggedIn: false,
					accessToken: null,
					refreshToken: null,
					userAlreadyExist: false,
				});
				if (typeof window !== "undefined") {
					window.location.replace("/");
				}
			},
			setAlreadyExist: (userAlreadyExist) => {
				set({ userAlreadyExist });
			},
		}),
		{
			name: "auth-storage",
			storage: createJSONStorage(() => localStorage),
			partialize: (state) => ({
				isLoggedIn: state.isLoggedIn,
				accessToken: state.accessToken,
				refreshToken: state.refreshToken,
				userAlreadyExist: state.userAlreadyExist,
			}),
		},
	),
);

export default useAuthStore;
