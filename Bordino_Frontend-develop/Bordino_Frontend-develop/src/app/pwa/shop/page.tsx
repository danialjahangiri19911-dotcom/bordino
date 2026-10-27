import { redirect } from "next/navigation";

// There is no shop: an old link lands on the home page.
export default function Page() {
	redirect("/pwa/main");
}
