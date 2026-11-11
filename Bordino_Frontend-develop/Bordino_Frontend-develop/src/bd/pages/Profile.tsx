"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";

import Link from "next/link";

import AvatarEditor from "../AvatarEditor";
import Icon from "../Icon";
import { useBackHandler } from "../back";
import { useGmProfile } from "../gm/api";
import { openPhoto, PhotoError } from "../photo";
import { AppShell, LoadState, ProfileRow, R, useProfileSync } from "../ui";
import { useQueryClient } from "@tanstack/react-query";

import { gameErrorMessage } from "@/api/games/request";
import { CUSTOMER_URLS } from "@/api/urls";
import type { ResponseApiData } from "@/libs/http/interfaces";
import signOut from "@/libs/http/signOut";
import useMutate from "@/libs/http/useMutate";
import useUserStore from "@/libs/stores/userStore";

type ImageAnswer = ResponseApiData<{ image_url: string | null }>;

/**
 * The profile photo, as in Telegram: a tap opens a menu (gallery, camera, remove), a chosen photo
 * opens full screen to frame it, and the avatar shows the new photo at once while it uploads.
 */
function AvatarPicker({ image }: { image?: string | null }) {
	const queryClient = useQueryClient();
	const setUser = useUserStore((s) => s.setUser);
	const [menu, setMenu] = useState(false);
	const [confirmRemove, setConfirmRemove] = useState(false);
	const [opening, setOpening] = useState(false);
	const [photo, setPhoto] = useState<HTMLCanvasElement | null>(null);
	const [preview, setPreview] = useState<string | null>(null);
	// The last framed picture, kept so a failed upload can be sent again without framing it again.
	const [lastPicture, setLastPicture] = useState<Blob | null>(null);
	const imageWhenSent = useRef<string | null | undefined>(undefined);
	const [problem, setProblem] = useState<string | null>(null);
	const gallery = useRef<HTMLInputElement>(null);
	const camera = useRef<HTMLInputElement>(null);
	const upload = useMutate<ImageAnswer, FormData>({
		url: CUSTOMER_URLS.PROFILE_IMAGE,
		method: "PATCH",
		onSuccess: (data) => {
			if (data?.result?.image_url) setUser({ image_url: data.result.image_url });
			setLastPicture(null);
			queryClient.invalidateQueries();
		},
		onError: (e) => {
			setPreview(null);
			setProblem(`عکس ذخیره نشد: ${gameErrorMessage(e)}`);
		},
	});
	const remove = useMutate<ImageAnswer, undefined>({
		url: CUSTOMER_URLS.PROFILE_IMAGE,
		method: "DELETE",
		onSuccess: () => {
			setUser({ image_url: "" });
			setPreview(null);
			setMenu(false);
			setConfirmRemove(false);
			queryClient.invalidateQueries();
		},
		onError: (e) => {
			setMenu(false);
			setConfirmRemove(false);
			setProblem(`عکس حذف نشد: ${gameErrorMessage(e)}`);
		},
	});
	const busy = upload.isSending || remove.isSending || opening;

	// The preview stays until the server's address for the new photo has loaded (no flash of the old one).
	useEffect(() => {
		if (!preview || upload.isSending || lastPicture) return;
		if (!image || image === imageWhenSent.current) return;
		const shown = new Image();
		shown.onload = () => setPreview(null);
		shown.src = image;
	}, [image, preview, upload.isSending, lastPicture]);
	useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

	// Android Back closes the menu (the editor handles its own).
	useBackHandler(menu, () => (confirmRemove ? setConfirmRemove(false) : setMenu(false)));

	useEffect(() => {
		if (!menu) return;
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [menu]);

	const send = (picture: Blob) => {
		setProblem(null);
		setLastPicture(picture);
		imageWhenSent.current = image;
		setPreview(URL.createObjectURL(picture));
		const form = new FormData();
		form.append("image", picture, "avatar.jpg");
		upload.submitHandler(form);
	};

	const choose = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		setMenu(false);
		if (!file) return;
		setProblem(null);
		setOpening(true);
		try {
			setPhoto(await openPhoto(file));
		} catch (e) {
			setProblem(e instanceof PhotoError ? e.message : "این فایل باز نشد؛ یک عکس دیگر انتخاب کن.");
		} finally {
			setOpening(false);
		}
	};

	const src = preview ?? image;
	return (
		<>
			<div className="bd-avatar-block">
				<button
					type="button"
					className="rt-profile-avatar bd-avatar-picker"
					aria-label={src ? "عکس پروفایل؛ تغییر یا حذف" : "گذاشتن عکس پروفایل"}
					aria-haspopup="menu"
					aria-expanded={menu}
					aria-busy={busy}
					onClick={() => {
						setConfirmRemove(false);
						setMenu(true);
					}}
				>
					{src ? <img src={src} alt="" /> : <Icon name="user-round" />}
					{busy ? (
						<span className="bd-avatar-progress" aria-hidden="true">
							<Icon name="loader-circle" className="bd-spin" />
						</span>
					) : null}
					<span className="bd-avatar-badge" aria-hidden="true">
						<Icon name="camera" />
					</span>
				</button>
				<span className="bd-avatar-status" role="status">
					{opening ? "در حال باز کردن عکس…" : upload.isSending ? "در حال ذخیرهٔ عکس…" : remove.isSending ? "در حال حذف عکس…" : ""}
				</span>
				{/* Any image type (HEIC named too: some file pickers file it under no image type); openPhoto decides. */}
				<input ref={gallery} type="file" accept="image/*,.heic,.heif,.avif" className="bd-visually-hidden" tabIndex={-1} aria-hidden="true" onChange={choose} />
				<input ref={camera} type="file" accept="image/*,.heic,.heif,.avif" capture="user" className="bd-visually-hidden" tabIndex={-1} aria-hidden="true" onChange={choose} />
			</div>
			{problem ? (
				<div className="bd-toast" role="alert">
					<span>{problem}</span>
					{lastPicture && !upload.isSending ? (
						<button type="button" className="bd-toast-action" onClick={() => send(lastPicture)}>
							تلاش دوباره
						</button>
					) : null}
					<button type="button" className="bd-toast-close" aria-label="بستن پیام" onClick={() => setProblem(null)}>
						<Icon name="x" />
					</button>
				</div>
			) : null}
			{menu ? (
				<div className="bd-sheet-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && setMenu(false)}>
					<div className="bd-sheet" role="menu" aria-label="عکس پروفایل">
						{confirmRemove ? (
							<>
								<p className="bd-sheet-title">عکس پروفایل حذف شود؟</p>
								<button type="button" role="menuitem" className="bd-sheet-item bd-sheet-danger" disabled={remove.isSending} onClick={() => remove.mutateWithoutPayload()}>
									<Icon name="trash-2" /> {remove.isSending ? "در حال حذف…" : "بله، حذف کن"}
								</button>
								<button type="button" role="menuitem" className="bd-sheet-item" autoFocus onClick={() => setConfirmRemove(false)}>
									<Icon name="arrow-left" /> نه، برگرد
								</button>
							</>
						) : (
							<>
								<p className="bd-sheet-title">عکس پروفایل</p>
								<button type="button" role="menuitem" className="bd-sheet-item" autoFocus onClick={() => {
										gallery.current?.click();
										setMenu(false);
									}}>
									<Icon name="image" /> انتخاب از گالری
								</button>
								<button type="button" role="menuitem" className="bd-sheet-item" onClick={() => {
										camera.current?.click();
										setMenu(false);
									}}>
									<Icon name="camera" /> گرفتن عکس
								</button>
								{image ? (
									<button type="button" role="menuitem" className="bd-sheet-item bd-sheet-danger" onClick={() => setConfirmRemove(true)}>
										<Icon name="trash-2" /> حذف عکس
									</button>
								) : null}
							</>
						)}
						<button type="button" role="menuitem" className="bd-sheet-item bd-sheet-cancel" onClick={() => setMenu(false)}>
							انصراف
						</button>
					</div>
				</div>
			) : null}
			{photo ? (
				<AvatarEditor
					photo={photo}
					onCancel={() => setPhoto(null)}
					onDone={(picture) => {
						setPhoto(null);
						send(picture);
					}}
				/>
			) : null}
		</>
	);
}

export default function Profile() {
	// «حالت برنامه» appears once Game Master is open to this account (Bordino opens it gradually).
	const gmOpen = !!useGmProfile().data?.result?.profile?.available;
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
						<h2>{profile.username || "کاربر بردینو"}</h2>
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
					<ProfileRow href={R.appearance} icon="moon" title="ظاهر برنامه" text="طرح، روشن یا تیره" />
					{gmOpen ? <ProfileRow href={R.appMode} icon="sparkles" title="حالت برنامه" text="بازیکن یا گیم مستر (ساخت بازی)" /> : null}
				</section>
				<section className="bd-panel rt-panel">
					<h3>سکه‌ها و جوایز</h3>
					<ProfileRow href={R.prizes} icon="gift" title="تاریخچهٔ جوایز" text="جایزه‌های گردونه و قرعه‌کشی" />
					<ProfileRow href={R.achievements} icon="medal" title="دستاوردها" text="روزهای همراهی و مسیر پیشرفت" />
				</section>
				<section className="bd-panel rt-panel">
					<h3>راهنما</h3>
					<ProfileRow href={R.rules} icon="file-text" title="شرایط و قوانین" text="قوانین استفاده از بردینو" />
					<ProfileRow href={`${R.lotteryGuide}?from=profile`} icon="ticket" title="راهنمای قرعه‌کشی" text="مراحل و جایزهٔ هر بلیت" />
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
