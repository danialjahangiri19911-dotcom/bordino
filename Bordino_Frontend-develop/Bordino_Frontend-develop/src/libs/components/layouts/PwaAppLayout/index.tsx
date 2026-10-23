"use client";

import { memo, useEffect, useMemo } from "react";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Box, { type BoxProps } from "@libs/components/atoms/Box";
import styled from "@libs/styles/styled";

import { HeaderWrapper } from "@/_pages/PwaApp/Wallet";
import { FEMALE, MALE } from "@/constants/imagePaths";
import { PROFILE, REGISTER, WHEEL } from "@/constants/routes";
import useAuthStore from "@/libs/stores/authStore";
import useUserStore from "@/libs/stores/userStore";

/**
 * @component
 * @param props - component props
 * @param rightAction - custom component placed right side the header
 */
function PwaAppPageLayout({
	children,
	rightAction,
	hasHeader = true,
	contentWrapperProps,
	...restProps
}: Readonly<BoxProps> & {
	rightAction?: React.ReactNode;
	hasHeader?: boolean;
	contentWrapperProps?: BoxProps;
}) {
	const { isLoggedIn } = useAuthStore();
	const { push } = useRouter();
	const { user } = useUserStore();

	useEffect(() => {
		if (!isLoggedIn) {
			push(REGISTER.path);
		}
	}, [isLoggedIn, push]);

	const avatarSrc = useMemo(() => {
		if (user?.image_url) return user.image_url;
		if (user?.gender === "M") return MALE;
		if (user?.gender === "F") return FEMALE;
		return MALE;
	}, [user?.image_url, user?.gender]);

	return (
		<Wrapper {...restProps}>
			{hasHeader && (
				<Box
					position="fixed"
					top={0}
					left="50%"
					width="100%"
					maxWidth={600}
					zIndex={4}
					display="flex"
					justifyContent="center"
					bgcolor="background.paper"
					sx={{ transform: "translateX(-50%)" }}
				>
					<HeaderWrapper
						sx={{
							justifyContent: rightAction ? "space-between" : "flex-end",
							alignItems: "center",
							height: 56,
							px: 2,
							maxWidth: 600,
						}}
					>
						{rightAction}

						<Box display="flex" alignItems="center" gap={1.5}>
							{/* 44×44 touch target around the 28 px icon. */}
							<Link
								href={WHEEL.path}
								aria-label="چرخونه شانسی"
								style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44 }}
							>
								<Image
									width={28}
									height={28}
									alt=""
									src="/media/App/wheel-icon.svg"
								/>
							</Link>

							<Link href={PROFILE.path}>
								<Image
									width={32}
									height={32}
									alt="profile"
									src={avatarSrc}
								/>
							</Link>
						</Box>
					</HeaderWrapper>
				</Box>
			)}
			<Box pt={hasHeader ? 10 : 0} {...contentWrapperProps}>
				{" "}
				{children}
			</Box>
		</Wrapper>
	);
}

const Wrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing(4),
	marginInline: theme.spacing(2),
	position: "relative",
}));

export default memo(PwaAppPageLayout);
