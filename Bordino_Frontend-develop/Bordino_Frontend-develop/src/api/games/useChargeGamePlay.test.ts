import useChargeGamePlay from "./useChargeGamePlay";

import { withRequestId } from "@/libs/http/requestId";
import useAuthStore from "@/libs/stores/authStore";

const posts: Record<string, unknown>[] = [];
jest.mock("@tanstack/react-query", () => ({
	useMutation: (o: { mutationFn: (p: unknown) => Promise<unknown> }) => ({ mutateAsync: o.mutationFn, isPending: false, error: null }),
}));
jest.mock("@/libs/http/query", () => ({ withAuth: (send: (token: string) => unknown) => send("t") }));
jest.mock("@/libs/http/requester", () => ({
	__esModule: true,
	default: { post: async (_url: string, body: Record<string, unknown>) => (posts.push(body), { data: { result: { cost: 5 } } }) },
}));

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");

describe("sudoku continuation charge", () => {
	beforeEach(() => {
		localStorage.clear();
		posts.length = 0;
		const jwt = `${b64({ alg: "HS256" })}.${b64({ user_id: "u", exp: 9999999999 })}.s`;
		useAuthStore.setState({ isLoggedIn: true, accessToken: jwt, refreshToken: jwt });
	});

	it("is charged at its level", async () => {
		await useChargeGamePlay().chargeAsync({ game_name: "sudoku", difficulty: "hard" });
		expect(posts[0]).toMatchObject({ game_name: "sudoku", difficulty: "hard" });
	});

	it("a charge left waiting by the older version is sent again as it was, with its id", async () => {
		let waiting = "";
		await expect(withRequestId("charge:sudoku", async (id) => ((waiting = id), Promise.reject(new Error("network"))))).rejects.toThrow();
		await useChargeGamePlay().chargeAsync({ game_name: "sudoku", difficulty: "easy" });
		expect(posts[0]).toEqual({ game_name: "sudoku", request_id: waiting });
		await useChargeGamePlay().chargeAsync({ game_name: "sudoku", difficulty: "easy" });
		expect(posts[1]).toMatchObject({ difficulty: "easy" }); // answered: back to the level's own
		expect(posts[1].request_id).not.toBe(waiting);
	});
});
