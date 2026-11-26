import { redirect } from "next/navigation";

import { HOME_VISIBLE } from "@/bd/features";
import Home from "@/bd/pages/Home";

/** The home dashboard; hidden for now (features.ts HOME_VISIBLE): an old link or a notice opens «گیمنت».
 * (The path is written out: the route table in bd/ui is a client module, unreadable on the server.) */
export default function Page() {
	if (!HOME_VISIBLE) redirect("/pwa/gameNet");
	return <Home />;
}
