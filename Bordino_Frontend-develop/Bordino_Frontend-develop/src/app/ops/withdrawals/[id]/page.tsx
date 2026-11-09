import { WithdrawalPage } from "@/ops/pages/Money";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	return <WithdrawalPage id={id} />;
}
