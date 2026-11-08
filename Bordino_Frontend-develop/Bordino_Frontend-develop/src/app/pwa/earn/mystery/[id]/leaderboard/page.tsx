import MysteryBoard from "@/bd/pages/MysteryBoard";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	return <MysteryBoard id={id} />;
}
