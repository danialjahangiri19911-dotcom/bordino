import Editor from "@/bd/gm/Editor";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	return <Editor id={id} />;
}
