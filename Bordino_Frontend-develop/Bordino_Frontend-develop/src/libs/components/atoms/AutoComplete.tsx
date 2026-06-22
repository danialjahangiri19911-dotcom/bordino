import MuiAutocomplete, {
	type AutocompleteProps as MuiAutocompleteProps,
	type AutocompleteRenderGetTagProps as MuiAutocompleteRenderGetTagProps,
	createFilterOptions as MuiCreateFilterOptions,
} from "@mui/material/Autocomplete";
import { type FilterOptionsState as MuiFilterOptionsState } from "@mui/material/useAutocomplete";

export default MuiAutocomplete;
export type AutocompleteRenderGetTagProps = MuiAutocompleteRenderGetTagProps;
export type FilterOptionsState<Value> = MuiFilterOptionsState<Value>;
export const createFilterOptions = MuiCreateFilterOptions;
export type AutocompleteProps<
	Value,
	Multiple extends boolean | undefined,
	DisableClearable extends boolean | undefined,
	FreeSolo extends boolean | undefined,
> = MuiAutocompleteProps<Value, Multiple, DisableClearable, FreeSolo>;
