import EarnQr from "@/bd/pages/EarnQr";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
	const { token } = await params;
	return <EarnQr token={decodeURIComponent(token)} />;
}
