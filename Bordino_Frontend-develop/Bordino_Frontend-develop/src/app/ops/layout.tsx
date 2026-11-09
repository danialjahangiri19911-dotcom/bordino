import type { Metadata, Viewport } from "next";

/** «بردینو ادمین»: its own installable app (its own manifest id, name and icon). */
export const metadata: Metadata = {
	title: "بردینو ادمین",
	manifest: "/ops.webmanifest",
	icons: { apple: "/bd/icons/ops-apple-touch-icon.png" },
	appleWebApp: { capable: true, title: "بردینو ادمین", statusBarStyle: "black" },
	robots: { index: false, follow: false },
};

export const viewport: Viewport = {
	themeColor: "#25252b",
};

export default function OpsLayout({ children }: { children: React.ReactNode }) {
	return children;
}
