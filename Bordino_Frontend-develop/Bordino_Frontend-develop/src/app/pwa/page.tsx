"use client";

import { useEffect } from "react";

import { useRouter } from "next/navigation";

import { R } from "@/bd/ui";
import useAuthStore from "@/libs/stores/authStore";

/** /pwa (the installed app's start page): home («گیمنت» while the dashboard is hidden) when signed in, otherwise the phone page. */
export default function Page() {
	const { isLoggedIn } = useAuthStore();
	const { replace } = useRouter();
	useEffect(() => {
		replace(isLoggedIn ? R.home : "/pwa/register");
	}, [isLoggedIn, replace]);
	return null;
}
