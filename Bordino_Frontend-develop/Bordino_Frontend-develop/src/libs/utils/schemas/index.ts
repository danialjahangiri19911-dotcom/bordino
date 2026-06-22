import * as yup from "yup";

export const requiredTrueBool = yup
	.bool()
	.oneOf([true], "لطفا این گزینه را انتخاب کنید");

/* When a value other than true or false is sent from the backend,
we need to use this validation for boolean fields. */
export const requiredBool = yup.bool().required("این فیلد اجباری میباشد");

export const requiredString = yup.string().required("این فیلد اجباری میباشد");

export const requiredNumber = yup
	.number()
	.transform((value, inputValue) => {
		return inputValue === "" ? undefined : value;
	})
	.required("این فیلد اجباری میباشد.")
	.typeError("لطفا فقط از اعداد انگلیسی استفاده کنید");

export const nullableNumber = yup
	.number()
	.transform((v) => (isNaN(v) ? null : v))
	.nullable();

export const nullableString = yup.string().nullable();

export const nullableRequiredString = nullableString.required(
	"این فیلد اجباری می‌باشد.",
);

export const nullableRequiredNumber = nullableNumber.required(
	"این فیلد اجباری می‌باشد.",
);
