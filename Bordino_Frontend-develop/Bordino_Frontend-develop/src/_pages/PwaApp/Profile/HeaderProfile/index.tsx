import type { ChangeEvent } from "react";
import { memo, useCallback, useMemo, useState } from "react";

import Avatar from "@libs/components/atoms/Avatar";
import Box from "@libs/components/atoms/Box";
import Typography from "@libs/components/atoms/Typography";
import styled from "@libs/styles/styled";
import { useQueryClient } from "@tanstack/react-query";

import { CUSTOMER_URLS } from "@/api/urls";
import { FEMALE, MALE } from "@/constants/imagePaths";
import Button from "@/libs/components/atoms/Button";
import type { ResponseApiData } from "@/libs/http/interfaces";
import useMutate from "@/libs/http/useMutate";
import useUserStore from "@/libs/stores/userStore";

type ProfileImageResponse = ResponseApiData<{ image_url: string | null }>;

interface Props {
	profileImage: string;
	name: string;
	phoneNumber?: string | number;
	gender: "F" | "M";
}

function HeaderProfile({
	profileImage,
	name,
	phoneNumber,
	gender,
}: Readonly<Props>) {
	const [image, setImage] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const queryClient = useQueryClient();
	const setUser = useUserStore((state) => state.setUser);

	const requestOnSuccess = useCallback(
		(data: ProfileImageResponse) => {
			// عکسِ جدید را در استور بنشان تا آواتار بلافاصله جایگزین شود
			const newImageUrl = data?.result?.image_url;
			if (newImageUrl) {
				setUser({ image_url: newImageUrl });
			}
			setImage(null);
			setPreviewUrl(null);
			queryClient.invalidateQueries();
		},
		[queryClient, setUser],
	);

	const handleImageChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0];
			if (file) {
				setImage(file);
				const reader = new FileReader();
				reader.onloadend = () => {
					setPreviewUrl(reader.result as string);
				};
				reader.readAsDataURL(file);
			}
		},
		[],
	);

	const { isSending, submitHandler } = useMutate<ProfileImageResponse, FormData>({
		url: CUSTOMER_URLS.PROFILE_IMAGE,
		method: "PATCH",
		onSuccess: requestOnSuccess,
	});

	const onSubmit = useCallback(() => {
		if (image) {
			const formData = new FormData();
			formData.append("image", image);
			// preview تا زمانِ موفقیت می‌ماند؛ پاک‌سازی در onSuccess انجام می‌شود
			submitHandler(formData);
		}
	}, [image, submitHandler]);

	const imageSrc = useMemo(() => {
		if (previewUrl) return previewUrl;
		if (profileImage) return profileImage;
		if (gender === "M") return MALE;
		return FEMALE;
	}, [profileImage, gender, previewUrl]);

	return (
		<Wrapper>
			<Avatar sx={{ width: 64, height: 64 }} src={imageSrc} />
			<Typography variant="16-medium">{name}</Typography>
			{phoneNumber && (
				<Typography variant="12-medium">0{phoneNumber}</Typography>
			)}
			<Button
				component="label"
				role={undefined}
				variant="contained"
				disabled={isSending}
				tabIndex={-1}
			>
				آپلود عکس
				<VisuallyHiddenInput
					type="file"
					onChange={handleImageChange}
					accept="image/*"
				/>
			</Button>
			{previewUrl && (
				<Button variant="contained" onClick={onSubmit} disabled={isSending}>
					{isSending ? "در حال آپلود..." : "تایید و آپلود"}
				</Button>
			)}
		</Wrapper>
	);
}

export default memo(HeaderProfile);

const Wrapper = styled(Box)(({ theme }) => ({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing(1),
	justifyContent: "center",
	alignItems: "center",
}));

const VisuallyHiddenInput = styled("input")({
	clip: "rect(0 0 0 0)",
	clipPath: "inset(50%)",
	height: 1,
	overflow: "hidden",
	position: "absolute",
	bottom: 0,
	left: 0,
	whiteSpace: "nowrap",
	width: 1,
});
