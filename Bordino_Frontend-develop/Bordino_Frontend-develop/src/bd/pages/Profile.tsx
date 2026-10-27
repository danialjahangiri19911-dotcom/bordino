"use client";

import { type ChangeEvent, useState } from "react";

import Link from "next/link";

import AvatarCropper from "../AvatarCropper";
import Icon from "../Icon";
import { AppShell, LoadState, Notice, ProfileRow, R, useProfileSync } from "../ui";
import { useQueryClient } from "@tanstack/react-query";

import { gameErrorMessage } from "@/api/games/request";
import { CUSTOMER_URLS } from "@/api/urls";
import type { ResponseApiData } from "@/libs/http/interfaces";
import signOut from "@/libs/http/signOut";
import useMutate from "@/libs/http/useMutate";
import useUserStore from "@/libs/stores/userStore";

type ImageAnswer = ResponseApiData<{ image_url: string | null }>;

// A phone photo can be large: it is reduced to a 512 px square in the browser before upload.
const MAX_IMAGE = 25 * 1024 * 1024;

function AvatarPicker({ image }: { image?: string | null }) {
	const queryClient = useQueryClient();
	const setUser = useUserStore((s) => s.setUser);
	const [preview, setPreview] = useState<string | null>(null);
	const [chosen, setChosen] = useState<File | null>(null);
	const [confirmRemove, setConfirmRemove] = useState(false);
	const [problem, setProblem] = useState<string | null>(null);
	const upload = useMutate<ImageAnswer, FormData>({
		url: CUSTOMER_URLS.PROFILE_IMAGE,
		method: "PATCH",
		onSuccess: (data) => {
			if (data?.result?.image_url) setUser({ image_url: data.result.image_url });
			setPreview(null);
			queryClient.invalidateQueries();
		},
		onError: (e) => {
			setPreview(null);
			setProblem(gameErrorMessage(e));
		},
	});
	const remove = useMutate<ImageAnswer, undefined>({
		url: CUSTOMER_URLS.PROFILE_IMAGE,
		method: "DELETE",
		onSuccess: () => {
			setUser({ image_url: "" });
			setConfirmRemove(false);
			queryClient.invalidateQueries();
		},
		onError: (e) => setProblem(gameErrorMessage(e)),
	});
	const busy = upload.isSending || remove.isSending;
	const choose = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		setProblem(null);
		setConfirmRemove(false);
		if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return setProblem("فقط عکس PNG، JPG یا WebP.");
		if (file.size > MAX_IMAGE) return setProblem("حجم عکس باید کمتر از ۲۵ مگابایت باشد.");
		setChosen(file);
	};
	const framed = (picture: Blob) => {
		setChosen(null);
		setPreview(URL.createObjectURL(picture));
		const form = new FormData();
		form.append("image", picture, "avatar.jpg");
		upload.submitHandler(form);
	};
	const src = preview ?? image;
	return (
		<>
			<div className="bd-avatar-block">
				<label className="rt-profile-avatar bd-avatar-picker" aria-label="تغییر عکس پروفایل" aria-busy={busy}>
					{src ? <img src={src} alt="" /> : <Icon name="user-round" />}
					<span className="bd-avatar-badge" aria-hidden="true">
						<Icon name="camera" />
					</span>
					<input type="file" className="bd-visually-hidden" accept="image/png,image/jpeg,image/webp" onChange={choose} disabled={busy} />
				</label>
				{image && !preview ? (
					confirmRemove ? (
						<span className="bd-avatar-remove" role="group" aria-label="حذف عکس پروفایل">
							<span>حذف شود؟</span>
							<button type="button" className="bd-text-btn" disabled={busy} onClick={() => remove.mutateWithoutPayload()}>
								{remove.isSending ? "در حال حذف…" : "بله، حذف کن"}
							</button>
							<button type="button" className="bd-text-btn" disabled={busy} onClick={() => setConfirmRemove(false)}>
								نه
							</button>
						</span>
					) : (
						<button type="button" className="bd-text-btn bd-avatar-remove" disabled={busy} onClick={() => setConfirmRemove(true)}>
							<Icon name="trash-2" /> حذف عکس
						</button>
					)
				) : null}
			</div>
			{problem ? <Notice>{problem}</Notice> : null}
			{chosen ? <AvatarCropper file={chosen} onCancel={() => setChosen(null)} onDone={framed} /> : null}
		</>
	);
}

export default function Profile() {
	const { profile, isLoading, error, refetch } = useProfileSync();
	const [leaving, setLeaving] = useState(false);
	return (
		<AppShell nav="profile" title="پروفایل">
			{!profile ? (
				<LoadState loading={isLoading} error={error} onRetry={refetch} />
			) : (
				<div className="rt-profile-hero">
					<AvatarPicker image={profile.image_url} />
					<div>
						<h2>{profile.username || "کاربر بوردینو"}</h2>
						<p dir="ltr" className="bd-phone">
							0{profile.phone_number}
						</p>
					</div>
					<Link className="bd-secondary" href={R.personal}>
						ویرایش اطلاعات
					</Link>
				</div>
			)}
			<div className="rt-two">
				<section className="bd-panel rt-panel">
					<h3>حساب کاربری</h3>
					<ProfileRow href={R.personal} icon="user-round" title="اطلاعات شخصی" text="نام کاربری، تاریخ تولد و جنسیت" />
					<ProfileRow href={R.security} icon="shield-check" title="ورود و امنیت" text="روش ورود و خروج از حساب" />
				</section>
				<section className="bd-panel rt-panel">
					<h3>تنظیمات برنامه</h3>
					<ProfileRow href={R.notifications} icon="bell" title="مدیریت اعلانات" text="اعلان‌های برنامه" />
					<ProfileRow href={R.appearance} icon="moon" title="ظاهر برنامه" text="روشن، تیره یا هماهنگ با دستگاه" />
				</section>
				<section className="bd-panel rt-panel">
					<h3>امتیازها و جوایز</h3>
					<ProfileRow href={R.prizes} icon="gift" title="تاریخچهٔ جوایز" text="جایزه‌های گردونه و قرعه‌کشی" />
					<ProfileRow href={R.achievements} icon="medal" title="دستاوردها" text="روزهای همراهی و مسیر پیشرفت" />
				</section>
				<section className="bd-panel rt-panel">
					<h3>راهنما</h3>
					<ProfileRow href={R.rules} icon="file-text" title="شرایط و قوانین" text="قوانین استفاده از بوردینو" />
					<ProfileRow href={R.lotteryGuide} icon="ticket" title="راهنمای قرعه‌کشی" text="مراحل و جایزهٔ هر بلیت" />
					<button
						className="bd-text-btn"
						type="button"
						disabled={leaving}
						onClick={() => {
							setLeaving(true);
							signOut();
						}}
					>
						{leaving ? "در حال خروج…" : "خروج از حساب"}
					</button>
				</section>
			</div>
		</AppShell>
	);
}
