import { redirect } from "next/navigation";

// The result now shows on the Hafez page itself.
export default function Page() {
	redirect("/pwa/hafez");
}
