import type {
	OverridableComponent as MuiOverridableComponent,
	OverridableTypeMap,
} from "@mui/material/OverridableComponent";

export type OverridableComponent<T extends OverridableTypeMap> =
	MuiOverridableComponent<T>;
