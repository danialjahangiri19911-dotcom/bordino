import { useCallback, useEffect, useState } from "react";

import useStep1Form from "./form/useForm";
import type { GENDER } from "./interfaces";

export default function useStep1() {
	const form = useStep1Form();

	const [selectedGender, setSelectedGender] = useState<GENDER>("");

	const gender = form.getValues("gender") as GENDER;

	useEffect(() => {
		if (gender) {
			setSelectedGender(gender);
		}
	}, [form, gender]);

	const onMaleClick = useCallback(() => {
		setSelectedGender("M");
		form.setValue("gender", "M");
	}, [form]);

	const onFemaleClick = useCallback(() => {
		setSelectedGender("F");
		form.setValue("gender", "F");
	}, [form]);

	return { selectedGender, onMaleClick, onFemaleClick, form };
}
