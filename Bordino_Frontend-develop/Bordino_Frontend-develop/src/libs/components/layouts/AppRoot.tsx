"use client";

import type { ReactNode } from "react";

import Layout from "@/libs/components/layouts/Layout";
import QueryProvider from "@libs/http/Provider";

/**
 * The client root under <body> (2026-11-28): the query provider and the app layout as ONE client
 * component. Before, the server root layout rendered <QueryProvider><Layout>…</Layout></QueryProvider>:
 * Layout reached the client as the children of another client component, and every navigation
 * re-sent it as a new lazy component type — so React threw the whole app away and rebuilt it on each
 * tap (the boot logo, the header, the navigation, every provider). Rendered from here, Layout's type is
 * this module's own and never changes; only the pages under it change.
 */
export default function AppRoot({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<QueryProvider>
			<Layout>{children}</Layout>
		</QueryProvider>
	);
}
