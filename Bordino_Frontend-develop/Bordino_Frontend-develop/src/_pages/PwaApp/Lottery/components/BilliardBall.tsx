import Box, { type BoxProps } from "@/libs/components/atoms/Box";
import Typography from "@/libs/components/atoms/Typography";

// توپ‌های سه‌بعدیِ بیلیاردی مطابق فیگما (node 538-17515):
// منطبق با عددِ برنده → سبز، در غیر این صورت → خاکستری. عدد در دایرهٔ سفیدِ مرکزی.
const BALL_GREEN = "/media/App/lottery/guide/ball-green.png";
const BALL_GREY = "/media/App/lottery/guide/ball-grey.png";

interface Props {
	num: number;
	/** آیا این عدد با شماره‌های برنده منطبق است؟ (توپِ سبز) */
	matched?: boolean;
	/** قطرِ توپ بر حسب پیکسل (مطابق فیگما = ۴۰) */
	size?: number;
	sx?: BoxProps["sx"];
}

export default function BilliardBall({
	num,
	matched = false,
	size = 40,
	sx,
}: Readonly<Props>) {
	return (
		<Box
			position="relative"
			width={size}
			height={size}
			flexShrink={0}
			sx={sx}
		>
			<Box
				component="img"
				src={matched ? BALL_GREEN : BALL_GREY}
				alt=""
				width={size}
				height={size}
				sx={{ display: "block" }}
			/>
			<Typography
				sx={{
					position: "absolute",
					top: "50%",
					left: "50%",
					transform: "translate(-50%, -50%)",
					fontSize: Math.round(size * 0.3),
					fontWeight: 700,
					lineHeight: 1,
					color: "#222",
				}}
			>
				{num}
			</Typography>
		</Box>
	);
}
