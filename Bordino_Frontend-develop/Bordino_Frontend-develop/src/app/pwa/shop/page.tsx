import { redirect } from "next/navigation";

// There is no shop yet: send anyone who arrives here (old link, typed address) to the home page.
export default function ShopPage() {
	redirect("/pwa/main");
}
