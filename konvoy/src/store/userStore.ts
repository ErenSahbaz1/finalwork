import { create } from "zustand";

interface UserState {
	userId: string | null;
	displayName: string;
	avatarColor: string;
	isLoading: boolean;
	isOnboarded: boolean;
	setUser: (id: string, name: string, color: string) => void;
	setLoading: (loading: boolean) => void;
	setOnboarded: (value: boolean) => void;
	clear: () => void;
}

export const useUserStore = create<UserState>((set) => ({
	userId: null,
	displayName: "",
	avatarColor: "#33a86d",
	isLoading: true,
	isOnboarded: false,
	setUser: (id, name, color) =>
		set({
			userId: id,
			displayName: name,
			avatarColor: color,
			isLoading: false,
		}),
	setLoading: (loading) => set({ isLoading: loading }),
	setOnboarded: (value) => set({ isOnboarded: value }),
	clear: () =>
		set({
			userId: null,
			displayName: "",
			avatarColor: "#33a86d",
			isLoading: false,
			isOnboarded: false,
		}),
}));
