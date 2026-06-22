import { useEffect, useMemo } from "react";

import Avatar from "@libs/components/atoms/Avatar";
import Box from "@libs/components/atoms/Box";
import styled from "@libs/styles/styled";

import useGetCustomerProfile from "@/api/customer/hooks/useGetCustomerProfile";
import useGetPointsSummary from "@/api/wallet/hooks/useGetPointsSummary";
import { FEMALE, MALE } from "@/constants/imagePaths";
import ScoreIconMessage from "@/libs/components/IconMessage/ScoreIconMessage";
import useUserStore from "@/libs/stores/userStore";

export default function Navbar() {
	const { setUser } = useUserStore();

	const { data } = useGetCustomerProfile();
	const { data: pointsSummary } = useGetPointsSummary();

	// const {tokenWalletData} = useExtractWallets()

	useEffect(() => {
		if (data?.result) {
			setUser({
				id: data.result.id,
				username: data.result.username || "",
				gender: data.result.gender || "",
				birthdate: data.result.birthdate || "",
				phoneNumber: data.result.phone_number || "",
				image_url: data.result.image_url || "",
			});
		}
	}, [data?.result, setUser]);

	const imageSrc = useMemo(() => {
		if (data?.result.image_url) return data?.result.image_url;
		if (data?.result.gender === "M") return MALE;
		return FEMALE;
	}, [data?.result.image_url, data?.result.gender]);

	// if (!data?.result || !tokenWalletData) return null

	return (
		<AppBar>
			<AppBarItemWrapper display="flex" alignItems="center" gap={1}>
				{!!pointsSummary?.result?.token_wallet_accounts[0]?.amount && (
					<ScoreIconMessage
						score={pointsSummary?.result?.token_wallet_accounts[0].amount ?? 0}
					/>
				)}

				{/* <RemainingDayIconMessage
          remainingDay={data?.result.consecutive_active_days as number}
        /> */}
			</AppBarItemWrapper>
			<AppBarItemWrapper display="flex" alignItems="center" gap={1}>
				<Avatar sx={{ width: 32, height: 32 }} src={imageSrc} />
			</AppBarItemWrapper>
		</AppBar>
	);
}

const AppBar = styled(Box)(({ theme }) => ({
	display: "flex",
	justifyContent: "space-between",
	padding: theme.spacing(2, 1),
}));

const AppBarItemWrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing(1),
}));
