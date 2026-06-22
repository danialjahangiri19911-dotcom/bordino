"use client";

import { createTheme } from "@mui/material/styles";

export const backGroundBlue = "#1976D2"; // original button color
export const LightBlue100 = "#B3E5FC";
export const LightBlue200 = "#81D4FA";
export const LightBlue300 = "#4FC3F7";
export const DeepOrange200 = "#FFAB91";
export const DeepOrange600 = "#F4511E";
export const ControlNumberColor = "#303F9F"; // Indigo700

const theme = createTheme({
	palette: {
		primary: {
			main: backGroundBlue,
		},
		secondary: {
			main: ControlNumberColor,
		},
	},
});

export default theme;
