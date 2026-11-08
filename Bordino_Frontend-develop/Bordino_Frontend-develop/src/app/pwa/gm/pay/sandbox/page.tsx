import { Suspense } from "react";

import { PaySandbox } from "@/bd/gm/Pay";

export default function Page() {
	return (
		<Suspense>
			<PaySandbox />
		</Suspense>
	);
}
