"use client";

import { useEffect } from "react";

import { useRouter } from "next/navigation";

import useAuthStore from "@/libs/stores/authStore";

/** /pwa (the installed app's start page): home when signed in, otherwise the phone page. */
export default function Page() {
	const { isLoggedIn } = useAuthStore();
	const { replace } = useRouter();
	useEffect(() => {
		replace(isLoggedIn ? "/pwa/main" : "/pwa/register");
	}, [isLoggedIn, replace]);
	return null;
}
