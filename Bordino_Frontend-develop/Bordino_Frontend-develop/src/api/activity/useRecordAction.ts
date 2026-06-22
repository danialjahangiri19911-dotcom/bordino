import { ACTIVITY_URLS } from "@/api/urls";
import useMutate from "@/libs/http/useMutate";

export type RecordActionBody = {
	section: string;
	action_type: string;
	metadata?: Record<string, any>;
	description?: string;
};

export type RecordActionResponse = {
	message: string;
	activity_transaction_id: string;
	score_awarded: number;
	already_exists: boolean;
};

export default function useRecordAction() {
	return useMutate<RecordActionResponse, RecordActionBody>({
		url: ACTIVITY_URLS.RECORD_ACTION,
		method: "POST",
		hasHeader: true,
	});
}
