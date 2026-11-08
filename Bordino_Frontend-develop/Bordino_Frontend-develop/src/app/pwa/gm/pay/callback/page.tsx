import { Suspense } from "react";

import { PayCallback } from "@/bd/gm/Pay";

export default function Page() {
	return (
		<Suspense>
			<PayCallback />
		</Suspense>
	);
}
