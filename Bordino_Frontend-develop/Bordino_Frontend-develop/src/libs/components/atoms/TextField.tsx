import TextField, {
	type TextFieldProps as MuiTextFieldProps,
} from "@mui/material/TextField";

export type TextFieldProps = MuiTextFieldProps;
export default function TextFieldAtom(props: MuiTextFieldProps) {
	return <TextField fullWidth {...props} />;
}
