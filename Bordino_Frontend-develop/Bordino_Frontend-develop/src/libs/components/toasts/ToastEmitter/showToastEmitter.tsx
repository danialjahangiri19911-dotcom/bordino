import { toast } from "@libs/components/atoms/Toast";
import type { ToastEmitterProps } from "@libs/components/toasts/ToastEmitter/interfaces";

export default function ({ message, duration = 3000 }: ToastEmitterProps) {
	toast.error(message, {
		position: "top-center",
		autoClose: duration,
		hideProgressBar: false,
		closeOnClick: true,
		pauseOnHover: true,
		draggable: true,
		progress: undefined,
		theme: "colored",
		icon: false,
	});
}
