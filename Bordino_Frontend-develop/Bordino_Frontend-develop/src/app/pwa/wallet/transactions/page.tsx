import { Suspense } from "react";

import Transactions from "@/bd/pages/Transactions";

export default function Page() {
	return (
		<Suspense>
			<Transactions />
		</Suspense>
	);
}
