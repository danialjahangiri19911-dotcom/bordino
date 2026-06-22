"use client";

import Image from "next/image";
import Link from "next/link";

import ArrowBackIosIcon from "@mui/icons-material/ArrowBackIos";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { styled } from "@mui/material/styles";

import { LOGO_ADDRESS } from "@/constants/imagePaths";
import { APP_HOME, MAIN_APP } from "@/constants/routes";
import ImageBox from "@/libs/components/ImageBox";
import LandingButton from "@/libs/components/atoms/LandingButton";
import useAuthStore from "@/libs/stores/authStore";

const BackgroundBlob = styled(Box)({
	borderRadius: "50%",
	position: "absolute",
	zIndex: -10,
});

export default function Home() {
	const { isLoggedIn } = useAuthStore();
	const redirectUrl = isLoggedIn ? MAIN_APP.path : APP_HOME.path;

	return (
		<Stack position="relative" width="100%" maxWidth="100svw">
			<Stack
				alignItems="center"
				width={{ xs: "auto", lg: "100%" }}
				paddingX={{ lg: "0px", xs: "16px" }}
				marginTop={{ lg: "100px", xs: "56px" }}
			>
				<Stack maxWidth={{ lg: "891px", xs: "none" }} alignItems="center">
					<Typography
						fontSize={{ lg: 20, xs: "14px" }}
						textAlign="center"
						fontWeight={500}
					>
						<Typography
							component="span"
							fontSize="inherit"
							color="primary.main"
							fontWeight={700}
						>
							بوردینو
						</Typography>
						&nbsp;پلتفرم سرگرمی–تسک محور است که به کاربران اجازه میدهد با انجام
						ماموریت ها امتیاز کسب کنند. این امتیازها را کاربر می‌تواند به بلیط
						قرعه کشی یا شانس چرخاندن گردونه تبدیل و جایزه دریافت کند.
					</Typography>
					<Link href={redirectUrl}>
						<LandingButton
							sx={{
								maxWidth: "fit-content",
								paddingY: "7.5px",
								paddingX: "38px",
								fontSize: 18,
								lineHeight: "25px",
								marginTop: "24px",
							}}
						>
							شروع کن
						</LandingButton>
					</Link>
					<Box
						sx={{
							position: "relative",
							width: { xs: "211px", lg: "282px" },
							height: { xs: "432px", lg: "577px" },
							marginTop: "32px",
						}}
					>
						<Image
							src="/media/home/hero-mobile.svg"
							alt="hero image"
							fill
							objectFit="contain"
						/>

						<BackgroundBlob
							sx={{
								backgroundColor: (theme) => theme.palette["primary-light"][800],
								width: "500px",
								height: "600px",
								filter: "blur(300px)",
								top: "-200px",
								left: "-500px",
							}}
						/>
						<BackgroundBlob
							sx={{
								backgroundColor: (theme) => theme.palette.blue[800],
								width: "300px",
								height: "400px",
								filter: "blur(300px)",
								top: "200px",
								right: "-100px",
							}}
						/>
					</Box>
				</Stack>
			</Stack>

			<Container
				maxWidth="lg"
				sx={{
					marginTop: "200px",
				}}
			>
				<Stack
					direction={{ xs: "column", lg: "row" }}
					justifyContent="space-between"
					alignItems={{ lg: null, xs: "center" }}
					gap={{ lg: null, xs: "36px" }}
				>
					<Stack gap="28px">
						<Typography
							sx={{
								backgroundColor: (theme) =>
									theme.palette["secondary-light"][200],
								borderRadius: "16px",
								paddingY: "4px",
								paddingX: "8px",
								color: (theme) => theme.palette.blue[900],
								maxWidth: "fit-content",
								fontSize: { lg: 16, xs: 12 },
							}}
						>
							در این قرعه کشی، همه برنده اند.
						</Typography>
						<Typography
							sx={{
								color: (theme) => theme.palette["primary-light"][900],
								fontWeight: 700,
								fontSize: { xs: 16, lg: "36px" },
							}}
						>
							قرعه کشی های خفن و واقعی.
						</Typography>
						<Typography
							sx={{
								color: (theme) => theme.bdn?.grey.g550,
								fontSize: { xs: 14, lg: "24px" },
								fontWeight: 500,
								maxWidth: { lg: "680px" },
							}}
						>
							در قرعه‌کشی‌های ما، شانس برنده شدن به شما نزدیک‌تر از همیشه است!
							کافی است یکی از شش توپ را به درستی از میان اعداد 1 تا 40 انتخاب
							کنید تا برنده شوید.
						</Typography>
					</Stack>

					<Box
						sx={{
							position: "relative",
							width: "100%",
							maxWidth: "362px",
							aspectRatio: "271 / 434",
						}}
					>
						<Image
							src="/media/home/landing-mobile-1.svg"
							alt="mobile landing image"
							fill
							objectFit="contain"
						/>
					</Box>
				</Stack>

				<Stack
					direction={{ xs: "column", lg: "row-reverse" }}
					justifyContent="space-between"
					marginTop="166px"
					position="relative"
					alignItems={{ lg: null, xs: "center" }}
					gap={{ lg: null, xs: "36px" }}
				>
					<BackgroundBlob
						sx={{
							backgroundColor: (theme) => theme.palette["primary-light"][200],
							width: "100%",
							height: "100%",
							filter: "blur(300px)",
							// top: '-200px',
							// left: '-500px',
							borderRadius: "0",
						}}
					/>
					<Stack gap="28px">
						<Typography
							sx={{
								backgroundColor: (theme) => theme.palette["primary-light"][200],
								borderRadius: "16px",
								paddingY: "4px",
								paddingX: "8px",
								color: (theme) => theme.palette.primary.main,
								maxWidth: "fit-content",
								fontSize: { lg: 16, xs: 12 },
							}}
						>
							بازی های هیجان انگیز
						</Typography>
						<Typography
							sx={{
								color: (theme) => theme.palette.blue[900],
								fontWeight: 700,
								fontSize: { xs: 16, lg: "36px" },
							}}
						>
							بازی کنید و برنده شوید.
						</Typography>
						<Typography
							sx={{
								color: (theme) => theme.bdn?.grey.g550,
								fontSize: { xs: 14, lg: "24px" },
								fontWeight: 500,
								maxWidth: { lg: "680px" },
							}}
						>
							با بازی‌های ساده و سرگرم‌کننده مثل پازل و سودوکو هم لذت ببرید و هم
							امتیاز جمع کنید! این امتیازها را می‌توانید به جوایز هیجان‌انگیز
							تبدیل کنید.
						</Typography>
					</Stack>

					<Box
						sx={{
							position: "relative",
							aspectRatio: "271 / 434",
							width: "100%",
							maxWidth: "362px",
						}}
					>
						<Image
							src="/media/home/landing-mobile-2.svg"
							alt="mobile landing image"
							fill
							objectFit="contain"
						/>
					</Box>
				</Stack>

				<Stack
					direction={{ xs: "column", lg: "row" }}
					justifyContent="space-between"
					marginTop="138px"
					alignItems={{ lg: null, xs: "center" }}
					gap={{ lg: null, xs: "36px" }}
				>
					<Stack gap="28px">
						<Typography
							sx={{
								backgroundColor: (theme) =>
									theme.palette["secondary-light"][200],
								borderRadius: "16px",
								paddingY: "4px",
								paddingX: "8px",
								color: (theme) => theme.palette.blue[900],
								maxWidth: "fit-content",
								fontSize: { lg: 16, xs: 12 },
							}}
						>
							چالش‌های جذاب و خاص
						</Typography>
						<Typography
							sx={{
								color: (theme) => theme.palette["primary-light"][900],
								fontWeight: 700,
								fontSize: { xs: 16, lg: "36px" },
							}}
						>
							هر روز چالش هارو انجام بده و امتیاز بگیر.
						</Typography>
						<Typography
							sx={{
								color: (theme) => theme.bdn?.grey.g550,
								fontSize: { xs: 14, lg: "24px" },
								fontWeight: 500,
								maxWidth: { lg: "680px" },
							}}
						>
							هر روز با چالش‌های جذاب مثل انجام یک بازی خاص یا تماشای ویدیوی
							کوتاه، امتیاز جمع کنید. این چالش‌ها ساده و سرگرم‌کننده هستند و
							راهی آسان برای کسب جوایز جذاب در اختیار شما می‌گذارند!
						</Typography>
					</Stack>

					<Box
						sx={{
							position: "relative",
							width: "100%",
							maxWidth: "362px",
							aspectRatio: "271 / 434",
						}}
					>
						<Image
							src="/media/home/landing-mobile-3.svg"
							alt="mobile landing image"
							fill
							objectFit="contain"
						/>
					</Box>
				</Stack>
			</Container>

			<Stack
				sx={{
					backgroundColor: (theme) => theme.palette.secondary.main,
					width: "100%",
					paddingTop: "32px",
					paddingBottom: "40px",
					alignItems: "center",
					color: (theme) => theme.bdn?.grey.g25,
					fontSize: { lg: 24, xs: 16 },
					position: "relative",
				}}
				gap="12px"
			>
				<Box
					sx={{
						position: "absolute",
						width: "361px",
						height: "90%",
						right: 0,
						top: -30,
						overflow: "hidden",
						display: { lg: "block", xs: "none" },
					}}
				>
					<Image
						src="/media/home/landing-chevron-up.svg"
						alt="chevron up"
						fill
						objectFit="contain"
						unoptimized
					/>
				</Box>

				<Typography
					sx={{
						fontWeight: 700,
						fontSize: "inherit",
					}}
				>
					بازی کن، امتیاز بگیر، برنده شو
				</Typography>
				<Typography
					sx={{
						fontSize: "inherit",
						textAlign: "center",
					}}
				>
					هر روز چالش‌های جدید، جایزه‌های واقعی و کلی هیجان منتظرته.
				</Typography>
				<LandingButton
					endIcon={
						<ArrowBackIosIcon
							sx={{
								width: { xs: "16px", lg: "30px" },
								height: { xs: "16px", lg: "30px" },
							}}
						/>
					}
					sx={{
						marginTop: "12px",
						maxWidth: "fit-content",
						fontSize: "inherit",
					}}
				>
					نصب اپلکیشن
				</LandingButton>
			</Stack>

			<Stack
				component="footer"
				direction={{ xs: "column", lg: "row" }}
				sx={{
					marginTop: "56px",
					backgroundColor: (theme) => theme.palette.secondary[50],
					height: { xs: "auto", lg: "181px" },
					alignItems: { xs: "center", lg: "start" },
					paddingTop: "46px",
					paddingBottom: { lg: null, xs: "46px" },
					justifyContent: "center",
				}}
				gap={{ xs: "32px", lg: "55px" }}
			>
				<Stack gap={1}>
					<Stack direction="row" justifyContent="space-between">
						<Box display="flex" gap={1} alignItems="center">
							<ImageBox src={LOGO_ADDRESS} height={42} />
							<Typography variant="24-bold" color="primary">
								بردینو
							</Typography>
						</Box>
						<Box
							sx={{
								display: { lg: "block", xs: "none" },
							}}
						>
							<Link href={redirectUrl}>
								<LandingButton>شروع کن</LandingButton>
							</Link>
						</Box>
					</Stack>
					<Typography
						sx={{
							fontSize: { xs: 14, lg: 16 },
						}}
						maxWidth="330px"
					>
						متن نمونه، مثال، معرفی و نمایش برای قرار دادن در قسمت هیرو پیج
						لندینگ
					</Typography>
					<Box
						sx={{
							display: { xs: "flex", lg: "none" },
							justifyContent: "end",
						}}
					>
						<Link href={redirectUrl}>
							<LandingButton>شروع کن</LandingButton>
						</Link>
					</Box>
				</Stack>
				<Stack>
					<Typography
						sx={{
							fontSize: { xs: 14, lg: 16 },
							fontWeight: 500,
						}}
					>
						ارتباط با ما:
					</Typography>
					<Typography
						marginTop={{ xs: "8px", lg: "20px" }}
						sx={{
							fontSize: { xs: 14, lg: 16 },
							fontWeight: 500,
						}}
					>
						ما را در شبکه های اجتماعی دنبال کنید:
					</Typography>
					<Stack
						direction="row-reverse"
						sx={{
							paddingX: "55px",
							gap: "16px",
							marginTop: "4px",
						}}
					>
						<Image
							src="/media/home/facebook.svg"
							height={40}
							width={40}
							alt="facebook"
						/>
						<Image
							src="/media/home/linkedin.svg"
							height={40}
							width={40}
							alt="linkedin"
						/>
						<Image
							src="/media/home/instagram.svg"
							height={40}
							width={40}
							alt="instagram"
						/>
						<Image
							src="/media/home/twitter.svg"
							height={40}
							width={40}
							alt="twitter"
						/>
					</Stack>
				</Stack>
			</Stack>
		</Stack>
	);
}
