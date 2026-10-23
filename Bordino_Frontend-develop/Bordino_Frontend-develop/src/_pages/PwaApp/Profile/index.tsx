"use client";

import { useEffect } from "react";

import HeaderProfile from "./HeaderProfile";
import ProfileGroup from "./ProfileGroup";
import { ACCOUNT_SETTINGS_ITEMS } from "./constants";

import useGetCustomerProfile from "@/api/customer/hooks/useGetCustomerProfile";
import LoadState from "@/libs/components/common/LoadState";
import TitleComponent from "@/libs/components/TitleComponent";
import PwaAppLayout from "@/libs/components/layouts/PwaAppLayout";
import useUserStore from "@/libs/stores/userStore";

export default function Profile() {
	const { user, setUser } = useUserStore();
	// The saved user can be missing (site data cleared, another tab logged out): load it again from the
	// server instead of showing a blank page.
	const { data, isLoading, error, refetch } = useGetCustomerProfile({ enabled: !user });

	useEffect(() => {
		if (user || !data?.result) return;
		setUser({
			id: data.result.id,
			username: data.result.username ?? "",
			gender: data.result.gender ?? "",
			birthdate: data.result.birthdate ?? "",
			phoneNumber: data.result.phone_number ?? "",
			image_url: data.result.image_url ?? "",
			registrationStep: data.result.registration_step ?? "",
		});
	}, [user, data, setUser]);

	// The layout (with its login redirect) is always mounted; only the content waits for the user.
	if (!user) {
		return (
			<PwaAppLayout sx={{ gap: 3 }}>
				<LoadState
					loading={isLoading || !error}
					error={error}
					onRetry={() => refetch()}
					errorText="پروفایل بارگذاری نشد. اتصال را بررسی کن."
				/>
			</PwaAppLayout>
		);
	}

	return (
		<PwaAppLayout sx={{ gap: 3 }}>
			<HeaderProfile
				profileImage={user.image_url}
				gender={user.gender}
				name={user.username}
				phoneNumber={user.phoneNumber}
			/>
			<TitleComponent title="حساب">
				<ProfileGroup items={ACCOUNT_SETTINGS_ITEMS} />
			</TitleComponent>
		</PwaAppLayout>
	);
}
