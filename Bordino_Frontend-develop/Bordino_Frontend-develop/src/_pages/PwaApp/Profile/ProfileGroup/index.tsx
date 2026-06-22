import { Fragment, memo, useMemo } from "react";

import type { ProfileItemProps } from "./ProfileItem";
import ProfileItem from "./ProfileItem";
import Box from "@libs/components/atoms/Box";
import Divider from "@libs/components/atoms/Divider";
import styled from "@libs/styles/styled";

interface Props {
	items: ProfileItemProps[];
}

function ProfileGroup({ items }: Readonly<Props>) {
	const renderProfileGroupItems = useMemo(() => {
		return items.map((item, index, array) => (
			<Fragment key={item.title}>
				<ProfileItem {...item} />
				{index < array.length - 1 && <Divider />}
			</Fragment>
		));
	}, [items]);

	return <Wrapper>{renderProfileGroupItems}</Wrapper>;
}

export default memo(ProfileGroup);

const Wrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing(2),
	padding: theme.spacing(2, 1.5),
	backgroundColor: theme.palette.common.white,
	boxShadow: theme.shadows[2],
	borderRadius: theme.shape.borderRadius,
}));
