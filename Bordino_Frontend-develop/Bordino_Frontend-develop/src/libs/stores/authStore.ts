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

/** The user a JWT belongs to (its payload's user_id), or null. */
export function tokenUser(token: string | null): unknown {
	try {
		const payload = token?.split(".")[1];
		if (!payload) return null;
		return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))).user_id ?? null;
	} catch {
		return null;
	}
}

/** The logged-in user's id ("" when nobody is): the owner of per-device game saves. */
export function currentUserId(): string {
	const id = tokenUser(useAuthStore.getState().accessToken);
	return id === null || id === undefined ? "" : String(id);
}

// Every tab shares one session: when another tab refreshes the tokens (they rotate, so this tab's
// copy stops working), logs out or logs in as someone else, take its copy. A tab that was logged
// in and no longer is leaves the app like a logout here would; a tab whose user changed reloads,
// so nothing of the previous user's data stays on screen.
if (typeof window !== "undefined") {
	window.addEventListener("storage", (event) => {
		if (event.key !== "auth-storage") return;
		const before = useAuthStore.getState();
		Promise.resolve(useAuthStore.persist.rehydrate()).then(() => {
			const after = useAuthStore.getState();
			if (!before.isLoggedIn) return;
			if (!after.isLoggedIn) {
				window.location.replace("/");
			} else if (tokenUser(after.accessToken) !== tokenUser(before.accessToken)) {
				window.location.reload();
			}
		});
	});
}

export default useAuthStore;
