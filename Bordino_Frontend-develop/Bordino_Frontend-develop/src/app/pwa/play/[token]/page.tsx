import Play from "@/bd/pages/Play";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
	const { token } = await params;
	return <Play token={token} />;
}
