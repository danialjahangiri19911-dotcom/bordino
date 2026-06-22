import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// برابر OTP_TTL بک‌اند (ثانیه) — مدت اعتبار OTP و کول‌داون ارسال مجدد.
export const OTP_TTL_SECONDS = 60;

interface Props {
	phone_number: string;
	// زمان آخرین ارسال OTP برای هر شماره (ms). برای محاسبه‌ی زمان باقی‌مانده‌ی شمارش معکوس.
	otpSentAt: Record<string, number>;
	setPhoneNumber: (phone_number: string) => void;
	// بعد از ارسالِ موفقِ OTP صدا زده می‌شود تا زمان ارسال ثبت شود.
	markOtpSent: (phone_number: string) => void;
	// ثانیه‌های باقی‌مانده تا امکان ارسال مجدد؛ اگر سابقه‌ای نباشد، مقدار کامل (ttl).
	getOtpRemaining: (phone_number: string, ttlSeconds?: number) => number;
}

export const useRegisterPhoneNumberStore = create<Props>()(
	persist(
		(set, get) => ({
			phone_number: "",
			otpSentAt: {},
			setPhoneNumber: (phone_number: string) => set({ phone_number }),
			markOtpSent: (phone_number: string) =>
				set((state) => ({
					otpSentAt: { ...state.otpSentAt, [phone_number]: Date.now() },
				})),
			getOtpRemaining: (phone_number: string, ttlSeconds = OTP_TTL_SECONDS) => {
				const sentAt = get().otpSentAt[phone_number];
				if (!sentAt) return ttlSeconds;
				const elapsed = Math.floor((Date.now() - sentAt) / 1000);
				return Math.max(0, ttlSeconds - elapsed);
			},
		}),
		{
			name: "bordino-otp-sent-at",
			storage: createJSONStorage(() => localStorage),
			// فقط زمان‌های ارسال persist می‌شوند؛ phone_number فقط در همان نشست لازم است.
			partialize: (state) => ({ otpSentAt: state.otpSentAt }),
		},
	),
);
