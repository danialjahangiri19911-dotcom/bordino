import EarnQr from "@/bd/pages/EarnQr";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
	const { token } = await params;
	let code = token;
	try {
		code = decodeURIComponent(token);
	} catch {
		// A broken address: the server answers that the code is not valid.
	}
	return <EarnQr token={code} />;
}
