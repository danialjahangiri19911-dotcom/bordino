import Link from "next/link";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export interface NavbarItemProps {
	children?: React.ReactNode;
	href: string;
}

const NavbarItem: React.FC<NavbarItemProps> = (props) => {
	return (
		<Link href={props.href} passHref>
			<Box
				sx={{
					display: "inline-block",
					textDecoration: "none",
					cursor: "pointer",
					position: "relative",
					"&:hover .underline": {
						background:
							"linear-gradient(90deg, #D4BDF0 0%, #E0A0F8 22.1%, #FB9299 36.36%, #E172B7 55.54%, #E77BDB 73.31%, #EC83FF 100%)",
					},
				}}
			>
				<Typography
					sx={{
						color: (theme) => theme.bdn?.grey.g900,
						fontWeight: 500,
						fontSize: 18,
					}}
				>
					{props.children}
				</Typography>

				<Box
					className="underline"
					sx={{
						position: "absolute",
						bottom: "-4px",
						height: "2px",
						width: "100%",
						background: "transparent",
						transition: "background 250ms ease",
					}}
				/>
			</Box>
		</Link>
	);
};

export default NavbarItem;
