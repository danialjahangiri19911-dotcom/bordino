import type { ReactNode } from "react";

import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import rtlPlugin from "stylis-plugin-rtl";

const cacheRtl = createCache({
	key: "muirtl",
	stylisPlugins: [rtlPlugin],
});

interface Props {
	children: ReactNode;
}

export default function Rtl({ children }: Readonly<Props>) {
	return <CacheProvider value={cacheRtl}>{children}</CacheProvider>;
}
