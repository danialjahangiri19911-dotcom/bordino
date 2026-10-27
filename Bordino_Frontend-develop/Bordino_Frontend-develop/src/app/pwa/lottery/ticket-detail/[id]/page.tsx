import { Suspense } from "react";

import TicketDetail from "@/bd/pages/TicketDetail";

export default function Page() {
	return (
		<Suspense>
			<TicketDetail />
		</Suspense>
	);
}
