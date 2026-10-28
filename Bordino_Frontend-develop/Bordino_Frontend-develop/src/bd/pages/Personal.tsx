"use client";

import { useEffect, useState } from "react";

import JalaliDateField from "../JalaliDateField";
import { AppShell, CopyButton, Facts, LoadState, Notice, Panel, useProfileSync } from "../ui";
import { useQueryClient } from "@tanstack/react-query";

import { gameErrorMessage } from "@/api/games/request";
import { CUSTOMER_URLS } from "@/api/urls";
import useMutate from "@/libs/http/useMutate";

export function usernameProblem(name: string): string | null {
	if (!name) return "نام کاربری را بنویس.";
	if (name.length < 3) return "نام کاربری باید حداقل ۳ کاراکتر باشد.";
	if (name.length > 20) return "نام کاربری نمی‌تواند بیشتر از ۲۰ کاراکتر باشد.";
	if (!/^[a-zA-Z]/.test(name)) return "نام کاربری باید با یک حرف انگلیسی شروع شود.";
	if (!/^[a-zA-Z0-9_]+$/.test(name)) return "فقط حروف انگلیسی، عدد و زیرخط (_) مجاز است.";
	return null;
}

export default function Personal() {
	const { profile, isLoading, error, refetch } = useProfileSync();
	const queryClient = useQueryClient();
	const [username, setUsername] = useState("");
	const [birthdate, setBirthdate] = useState("");
	const [gender, setGender] = useState<"" | "M" | "F">("");
	const [tried, setTried] = useState(false);
	const [saved, setSaved] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);

	useEffect(() => {
		if (!profile) return;
		setUsername(profile.username ?? "");
		setBirthdate(profile.birthdate ?? "");
		setGender(profile.gender === "M" || profile.gender === "F" ? profile.gender : "");
	}, [profile]);

	const { submitHandler, isSending } = useMutate({
		url: `${CUSTOMER_URLS.PROFILE}/`,
		method: "PATCH",
		onSuccess: () => {
			setSaved(true);
			setServerError(null);
			queryClient.invalidateQueries();
		},
		onError: (e) => setServerError(gameErrorMessage(e)),
	});

	// Only a name the player changes is checked here: one from the older app (e.g. «ali.reza») is
	// valid on the server and must not block saving the other fields.
	const nameChanged = username.trim() !== (profile?.username ?? "").trim();
	const nameError = nameChanged || !username.trim() ? usernameProblem(username.trim()) : null;
	const problem = nameError ?? (!birthdate ? "تاریخ تولد را کامل انتخاب کن." : !gender ? "جنسیت را انتخاب کن." : null);

	return (
		<AppShell nav="profile" title="اطلاعات شخصی">
			{!profile ? (
				<LoadState loading={isLoading} error={error} onRetry={refetch} />
			) : (
				<div className="rt-two">
					<Panel title="اطلاعات شخصی">
						<form
							noValidate
							onSubmit={(event) => {
								event.preventDefault();
								setTried(true);
								setSaved(false);
								if (problem) return;
								submitHandler({ ...(nameChanged ? { username: username.trim() } : {}), birthdate, gender });
							}}
						>
							<div className="rt-form-grid">
								<label className="rt-field">
									<span>نام کاربری</span>
									<input
										type="text"
										dir="ltr"
										autoComplete="username"
										value={username}
										aria-invalid={tried && !!nameError}
										onChange={(event) => {
											setUsername(event.target.value);
											setSaved(false);
										}}
									/>
									{tried && nameError ? <p className="bd-field-error">{nameError}</p> : null}
								</label>
								<JalaliDateField
									label="تاریخ تولد"
									value={birthdate}
									onChange={(v) => {
										setBirthdate(v);
										setSaved(false);
									}}
									error={tried && !birthdate ? "تاریخ تولد را کامل انتخاب کن." : null}
								/>
								<fieldset className="rt-field">
									<legend>جنسیت</legend>
									{(
										[
											["M", "مرد"],
											["F", "زن"],
										] as const
									).map(([value, label]) => (
										<label key={value}>
											<input
												type="radio"
												name="gender"
												checked={gender === value}
												onChange={() => {
													setGender(value);
													setSaved(false);
												}}
											/>{" "}
											{label}
										</label>
									))}
									{tried && !gender ? <p className="bd-field-error">جنسیت را انتخاب کن.</p> : null}
								</fieldset>
							</div>
							{serverError ? <Notice>{serverError}</Notice> : null}
							{saved ? <Notice tone="ok">تغییرات ذخیره شد.</Notice> : null}
							<div className="bd-actions">
								<button type="submit" className="bd-action" disabled={isSending}>
									{isSending ? "در حال ذخیره…" : "ذخیرهٔ تغییرات"}
								</button>
							</div>
						</form>
					</Panel>
					<Panel title="اطلاعات حساب">
						<Facts
							items={[
								["شمارهٔ موبایل", <bdi key="p" dir="ltr">0{profile.phone_number}</bdi>],
								...(profile.referral_code
									? ([
											[
												"کد معرف تو",
												<span key="r" className="bd-code">
													<bdi dir="ltr">{profile.referral_code}</bdi>
													<CopyButton text={profile.referral_code} label="کپی کد معرف" />
												</span>,
											],
										] as [string, JSX.Element][])
									: []),
							]}
						/>
						<small className="bd-muted">شمارهٔ موبایل همان شناسهٔ ورود توست و از اینجا تغییر نمی‌کند.</small>
					</Panel>
				</div>
			)}
		</AppShell>
	);
}
