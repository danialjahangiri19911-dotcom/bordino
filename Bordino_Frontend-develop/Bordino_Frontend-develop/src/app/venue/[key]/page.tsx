import type { Metadata } from "next";

import VenueScreen from "@/bd/venue/VenueScreen";

// A venue's own screen: never listed by search engines.
export const metadata: Metadata = { title: "QR مأموریت | بردینو", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
	const { key } = await params;
	return <VenueScreen screenKey={key} />;
}
