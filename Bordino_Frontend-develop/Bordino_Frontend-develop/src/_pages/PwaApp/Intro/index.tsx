"use client";

import { useEffect } from "react";

import { useRouter } from "next/navigation";

import { MAIN_APP, REGISTER } from "@/constants/routes";
import useAuthStore from "@/libs/stores/authStore";

export default function Intro() {
	const { push } = useRouter();

	const { isLoggedIn } = useAuthStore();

	useEffect(() => {
		if (isLoggedIn) {
			push(MAIN_APP.path);
		} else {
			push(REGISTER.path);
		}
	}, [isLoggedIn, push]);

	return null;
}
