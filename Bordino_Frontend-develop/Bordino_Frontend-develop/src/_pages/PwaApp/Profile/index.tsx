"use client";

import HeaderProfile from "./HeaderProfile";
import ProfileGroup from "./ProfileGroup";
import {
	ACCOUNT_SETTINGS_ITEMS,
	APP_SETTINGS_ITEMS,
	SCORES_GIFT_ITEMS,
} from "./constants";

import TitleComponent from "@/libs/components/TitleComponent";
import PwaAppLayout from "@/libs/components/layouts/PwaAppLayout";
import useUserStore from "@/libs/stores/userStore";

export default function Profile() {
	const { user } = useUserStore();

	if (!user) return null;

	return (
		<PwaAppLayout sx={{ gap: 3 }}>
			<HeaderProfile
				profileImage={user.image_url}
				gender={user.gender}
				name={user.username}
				phoneNumber={user.phoneNumber}
			/>
			<TitleComponent title="تنظیمات حساب">
				<ProfileGroup items={ACCOUNT_SETTINGS_ITEMS} />
			</TitleComponent>
			<TitleComponent title="تنظیمات برنامه">
				<ProfileGroup items={APP_SETTINGS_ITEMS} />
			</TitleComponent>
			<TitleComponent title="امتیازات و جوایز">
				<ProfileGroup items={SCORES_GIFT_ITEMS} />
			</TitleComponent>{" "}
			<TitleComponent title="امتیازات و جوایز">
				<ProfileGroup items={SCORES_GIFT_ITEMS} />
			</TitleComponent>{" "}
			<TitleComponent title="امتیازات و جوایز">
				<ProfileGroup items={SCORES_GIFT_ITEMS} />
			</TitleComponent>{" "}
			<TitleComponent title="امتیازات و جوایز">
				<ProfileGroup items={SCORES_GIFT_ITEMS} />
			</TitleComponent>
		</PwaAppLayout>
	);
}
