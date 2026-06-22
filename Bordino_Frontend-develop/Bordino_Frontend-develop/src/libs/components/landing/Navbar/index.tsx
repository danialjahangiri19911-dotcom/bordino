"use client";

import { useCallback, useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import NavbarItem from "./NavbarItem";
import ImageBox from "@libs/components/ImageBox";
import BaseAppBar from "@libs/components/atoms/AppBar";
import Box from "@libs/components/atoms/Box";
import Button from "@libs/components/atoms/Button";
import Toolbar from "@libs/components/atoms/Toolbar";
import Typography from "@libs/components/atoms/Typography";
import styled, { useTheme } from "@libs/styles/styled";
import MenuIcon from "@mui/icons-material/Menu";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Slide from "@mui/material/Slide";
import Stack from "@mui/material/Stack";
import useMediaQuery from "@mui/material/useMediaQuery";

import { LOGO_ADDRESS } from "@/constants/imagePaths";
import { APP_HOME, MAIN_APP } from "@/constants/routes";
import useAuthStore from "@/libs/stores/authStore";

const LandingButton = styled(Button)(() => ({
	borderRadius: 16,
}));

const navItems = [
	{
		href: "#",
		content: "ورود یا ثبت نام",
	},
	{
		href: "#",
		content: "سفارش تبلیغات",
	},
	{
		href: "#",
		content: "قوانین و مقررات",
	},
	{
		href: "#",
		content: "مقالات",
	},
];

export default function Navbar() {
	const { push } = useRouter();
	const { isLoggedIn } = useAuthStore();
	const redirectToApp = useCallback(() => {
		if (isLoggedIn) {
			push(MAIN_APP.path);
		} else push(APP_HOME.path);
	}, [isLoggedIn, push]);
	const [navbarIsOpen, setNavbarIsOpen] = useState(false);
	const theme = useTheme();
	const isLgSize = useMediaQuery(theme.breakpoints.up("lg"));
	const containerRef = useRef(null);

	const toggleNavbarOpen = () => {
		setNavbarIsOpen((prev) => !prev);
	};

	const handleNavbarClose = () => {
		setNavbarIsOpen(false);
	};

	return (
		<>
			<Box
				component="header"
				sx={{
					position: "fixed",
					top: 0,
					left: 0,
					zIndex: 1100,
					width: "100vw",
				}}
				ref={containerRef}
			>
				<AppBar as="nav">
					<Toolbar
						sx={{
							justifyContent: "space-between",
							paddingInline: { xs: "16px !important", lg: "80px !important" },
							width: "100%",
							position: "relative",
						}}
					>
						<Box display="flex" alignItems="center">
							<Box
								onClick={toggleNavbarOpen}
								role="button"
								sx={{
									cursor: "pointer",
								}}
							>
								<MenuIcon
									fontSize="large"
									sx={{
										fill: (theme) =>
											navbarIsOpen
												? theme.palette.primary.main
												: theme.bdn?.grey.g600,
									}}
								/>
							</Box>
							<ImageBox
								src={LOGO_ADDRESS}
								height={48}
								sx={{
									display: { lg: "none", xs: "block" },
									marginInlineStart: { xs: 1, lg: 0 },
								}}
							/>
						</Box>

						<LandingButton
							onClick={redirectToApp}
							sx={{
								position: "absolute",
								left: "50%",
								transform: "translateX(-50%)",
							}}
						>
							نصب اپلکیشن
						</LandingButton>

						<Box
							display={{ lg: "flex", xs: "none" }}
							gap={1.5}
							alignItems="center"
						>
							<ImageBox src={LOGO_ADDRESS} height={70} />
							<Typography variant="23-bold" color="primary">
								بردینو
							</Typography>
						</Box>
					</Toolbar>
				</AppBar>

				{/* desktop menu-expanded anchor */}
				<Slide in={isLgSize && navbarIsOpen} container={containerRef.current}>
					<Stack
						direction="row"
						sx={{
							display: { lg: "flex", xs: "none" },
							paddingInlineStart: "85px",
							columnGap: "32px",
							paddingTop: "50px",
							paddingBottom: "20px",
							borderRadius: "24px",
							backgroundColor: (theme) => theme.palette["primary-light"][200],
							position: "absolute",
							bottom: -65,
							width: "calc(100svw - 85px)",
							zIndex: 550,
							boxShadow: (theme) => theme.shadows[3],
						}}
					>
						{navItems.map((item) => (
							<NavbarItem href={item.href} key={item.content}>
								{item.content}
							</NavbarItem>
						))}
					</Stack>
				</Slide>

				{/* mobile drawer */}
				<Drawer
					anchor="left"
					open={!isLgSize && navbarIsOpen}
					onClose={handleNavbarClose}
				>
					<Box
						sx={{
							width: "250px",
						}}
						role="presentation"
						onClick={handleNavbarClose}
						onKeyDown={handleNavbarClose}
					>
						<Stack
							direction="row"
							justifyContent="space-between"
							paddingTop="16px"
							paddingInlineStart="16px"
							paddingBottom="8px"
						>
							<Box display="flex" gap={1} alignItems="center">
								<ImageBox src={LOGO_ADDRESS} height={42} />
								<Typography variant="24-bold" color="primary">
									بردینو
								</Typography>
							</Box>
						</Stack>
						<Divider />
						<List
							sx={{
								pt: "16px",
								display: "flex",
								flexDirection: "column",
								rowGap: "32px",
							}}
						>
							{navItems.map((item) => {
								return (
									<ListItem key={item.content} sx={{ p: 0 }}>
										<Link
											href={item.href}
											style={{
												width: "100%",
												textDecoration: "none",
											}}
										>
											<ListItemButton sx={{ p: 0, paddingInlineStart: "8px" }}>
												<ListItemText
													sx={{
														color: (theme) => theme.bdn?.grey.g900,
													}}
													primary={item.content}
												/>
											</ListItemButton>
										</Link>
									</ListItem>
								);
							})}
						</List>
					</Box>
				</Drawer>
			</Box>
		</>
	);
}

const AppBar = styled(BaseAppBar)(({ theme }) => ({
	[theme.breakpoints.up("xs")]: {
		height: 80,
	},
	[theme.breakpoints.up("lg")]: {
		height: 104,
	},

	borderBottomLeftRadius: "24px",
	borderBottomRightRadius: "24px",
	display: "flex",
	justifyContent: "center",
	backgroundColor: theme.palette["primary"][50],
	boxShadow: theme.shadows[3],
	position: "relative",
	zIndex: 600,
}));
