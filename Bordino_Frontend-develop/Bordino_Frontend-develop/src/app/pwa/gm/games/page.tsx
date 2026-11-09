import { GamesList } from "@/bd/gm/pages";

export default async function Page({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
	const { filter } = await searchParams;
	return <GamesList initial={filter} />;
}
