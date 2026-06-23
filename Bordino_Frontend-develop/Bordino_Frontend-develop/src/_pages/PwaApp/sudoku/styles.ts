import Paper from "@mui/material/Paper";
import { styled } from "@mui/material/styles";

import { ControlNumberColor } from "@/libs/games/sudoku/theme";

export const BASE_CELL_SIZE = 2.5; // rem (40px at 16px base)

export const StyledBoard = styled(Paper)(({ theme }) => ({
	width: `${BASE_CELL_SIZE * 9}rem`,
	marginTop: theme.spacing(0.5),
	boxShadow: "0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)",
	backgroundColor: "transparent",
	// No media queries – fixed mobile size
}));

export const Row = styled("div")({
	display: "flex",
	width: "100%",
	"&:not(:last-child)": { borderBottom: "1px solid black" },
	"&:nth-of-type(3n+3):not(:last-child)": {
		borderBottom: "2px solid black !important",
	},
});

export const CellButton = styled("button")({
	width: `${BASE_CELL_SIZE}rem`,
	height: `${BASE_CELL_SIZE}rem`,
	display: "flex",
	flexWrap: "wrap",
	alignItems: "center",
	justifyContent: "center",
	fontSize: "1.1rem",
	fontWeight: "bold",
	border: "none",
	padding: 0,
	background: "none",
	cursor: "pointer",
	transition: "background-color .3s ease-in-out",
	fontFamily: "inherit",
	"&:not(:last-child)": { borderRight: "1px solid black" },
	"&:nth-of-type(3n+3):not(:last-child)": { borderRight: "2px solid black" },
});

export const NoteGrid = styled("div")({
	width: "100%",
	height: "100%",
	display: "flex",
	flexWrap: "wrap",
	alignItems: "center",
	justifyContent: "center",
});

export const NoteNumber = styled("div")({
	fontSize: ".6rem",
	width: "33%",
	height: "33%",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	boxSizing: "border-box",
});

export const Header = styled("header")({
	display: "flex",
	width: "100%",
	justifyContent: "space-between",
	maxWidth: "500px",
	padding: "0 0.5rem",
	boxSizing: "border-box",
});

export const ExitButton = styled("div")({
	cursor: "pointer",
	marginTop: ".2rem",
	display: "inline-flex",
	justifyContent: "center",
	alignItems: "center",
	padding: ".2rem 0",
	"& svg": { height: "1rem", marginBottom: ".3rem" },
});

export const ActionsContainer = styled("div")({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	width: "100%",
	maxWidth: "400px",
	marginTop: ".5rem",
	padding: "0 .6rem",
});

export const Action = styled("div")({
	display: "flex",
	alignItems: "center",
	flexDirection: "column",
	cursor: "pointer",
	"& svg": { width: "2.5rem", marginBottom: ".2rem" },
});

export const RedoAction = styled(Action)({
	"& svg": { transform: "scaleX(-1)" },
});

export const NumberPadContainer = styled("div")({
	cursor: "pointer",
	display: "inline-flex",
	alignItems: "center",
	flexWrap: "wrap",
	justifyContent: "center",
	fontFamily: "inherit",
	transition: "filter .5s ease-in-out",
	width: "100%",
});

export const NumberButton = styled("div")<{ disabled?: boolean }>(
	({ disabled }) => ({
		display: "flex",
		position: "relative",
		justifyContent: "center",
		alignItems: "center",
		fontSize: "2rem",
		margin: ".1rem",
		width: "2.5rem",
		height: "2.5rem",
		color: ControlNumberColor,
		boxShadow: "0 1px 2px rgba(0,0,0,0.16), 0 1px 2px rgba(0,0,0,0.23)",
		borderRadius: "50%",
		cursor: disabled ? "not-allowed" : "pointer",
		opacity: disabled ? 0.5 : 1,
		"& > div": { marginTop: ".3rem" },
	}),
);

export const CircularPathD =
	"M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831";
export const CircularSvg = styled("svg")({
	display: "block",
	width: "100%",
	height: "100%",
	position: "absolute",
	top: 0,
	left: 0,
	transition: "filter .4s ease-in-out",
});
export const CircleBg = styled("path")({
	fill: "none",
	stroke: "#eee",
	strokeWidth: 3.8,
});
export const Circle = styled("path")({
	stroke: ControlNumberColor,
	transition: "stroke-dasharray .4s ease-in-out",
	fill: "none",
	strokeWidth: 2.8,
	strokeLinecap: "round",
});
