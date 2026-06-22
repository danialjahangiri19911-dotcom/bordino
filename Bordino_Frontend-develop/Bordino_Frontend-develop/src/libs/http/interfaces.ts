import type { Options, Res } from "./query";
import type { RequestError } from "./requester";

export interface ResponseApiData<Data> {
	error: string[];
	is_successful: boolean;
	result: Data;
	status_code: number;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ExtendableOptions<D, E = RequestError | null> extends Omit<
	Options<Res<D>, E>,
	"url"
> {}
