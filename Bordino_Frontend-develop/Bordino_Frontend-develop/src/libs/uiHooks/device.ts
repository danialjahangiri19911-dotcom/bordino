"use client";

import { useEffect } from "react";

import { useTheme } from "@mui/material/styles";
import useMuiMediaQuery from "@mui/material/useMediaQuery";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface DeviceState {
	deviceSize?: DeviceSize;
	setDeviceSize: (s: DeviceSize) => void;
}

const useDeviceStore = create<DeviceState>()(
	devtools(
		(set) => ({
			setDeviceSize: (deviceSize) => set((state) => ({ ...state, deviceSize })),
		}),
		{ name: "device-store" },
	),
);

export type DeviceSize = "xs" | "sm" | "md" | "lg" | "xl";

export const useMediaQuery = useMuiMediaQuery;

export function useCheckSizeDown(size: DeviceSize): boolean {
	const theme = useTheme();
	return useMediaQuery(theme.breakpoints.down(size));
}

export function useDevice() {
	const isMobile = useCheckSizeDown("sm");
	const isTablet = useCheckSizeDown("md");
	const isDesktop = useCheckSizeDown("lg");
	const isLargeDesktop = useCheckSizeDown("xl");

	return { isDesktop, isMobile, isTablet, isLargeDesktop };
}

export function useSetDeviceSize() {
	const theme = useTheme();
	const downSm = useMediaQuery(theme.breakpoints.down("sm"));
	const downMd = useMediaQuery(theme.breakpoints.down("md"));
	const downLg = useMediaQuery(theme.breakpoints.down("lg"));
	const downXl = useMediaQuery(theme.breakpoints.down("xl"));

	const setDeviceSize = useDeviceStore((state) => state.setDeviceSize);

	useEffect(() => {
		let deviceSize: DeviceSize;
		if (downSm) deviceSize = "xs";
		else if (downMd) deviceSize = "sm";
		else if (downLg) deviceSize = "md";
		else if (downXl) deviceSize = "lg";
		else deviceSize = "xl";
		setDeviceSize(deviceSize);
	}, [setDeviceSize, downSm, downMd, downLg, downXl]);
}

export const useDeviceSize = (): DeviceSize => {
	useSetDeviceSize();
	return useDeviceStore((state) => state.deviceSize) ?? "lg";
};
