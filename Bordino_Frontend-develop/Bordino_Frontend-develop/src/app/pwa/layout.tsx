import type { ReactNode } from "react";

import { AppFrame } from "@/bd/ui";

/** Every /pwa page sits in one frame: the signed-in header and navigation are drawn once (bd/ui AppFrame). */
export default function PwaLayout({ children }: { children: ReactNode }) {
	return <AppFrame>{children}</AppFrame>;
}
