import { create } from "zustand";

interface UserState {
	userId: string | null;
	displayName: string;
	avatarColor: string;
	email: string | null;
	isLoading: boolean;
	isOnboarded: boolean;
	isAuthenticated: boolean;
	isGuest: boolean;
	setUser: (id: string, name: string, color: string) => void;
	setEmail: (email: string | null) => void;
	setLoading: (loading: boolean) => void;
	setOnboarded: (value: boolean) => void;
	setAuthenticated: (value: boolean) => void;
	setGuest: (value: boolean) => void;
	clear: () => void;
}

export const useUserStore = create<UserState>((set) => ({
	userId: null,
	displayName: "",
	avatarColor: "#33a86d",
	email: null,
	isLoading: true,
	isOnboarded: false,
	isAuthenticated: false,
	isGuest: false,
	setUser: (id, name, color) =>
		set({
			userId: id,
			displayName: name,
			avatarColor: color,
			isLoading: false,
		}),
	setEmail: (email) => set({ email }),
	setLoading: (loading) => set({ isLoading: loading }),
	setOnboarded: (value) => set({ isOnboarded: value }),
	setAuthenticated: (value) => set({ isAuthenticated: value }),
	setGuest: (value) => set({ isGuest: value }),
	clear: () =>
		set({
			userId: null,
			displayName: "",
			avatarColor: "#33a86d",
			email: null,
			isLoading: false,
			isOnboarded: false,
			isAuthenticated: false,
			isGuest: false,
		}),
}));
