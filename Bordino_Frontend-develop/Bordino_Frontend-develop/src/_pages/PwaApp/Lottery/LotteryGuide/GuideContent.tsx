"use client";

import { GUIDE_PRIZE_TIERS, GUIDE_SECTIONS, IMAGE_BASE } from "./content";
import Box from "@libs/components/atoms/Box";
import Typography from "@libs/components/atoms/Typography";
import styled from "@libs/styles/styled";

// رنگ‌ها عیناً از فایل فیگما (node 1839-31016)
const PINK = "#E64056";
const BORDER = "#CBCBCB";
const TEXT_DARK = "#353535";
const TEXT_MUTED = "#5B5B5B";
const TABLE_HEADER_BG = "#EDEDED";
const CELL_TEXT = "#0C0C0C";
const PAGE_BG = "#F9F9F9";

// ردیف توپ‌های مطابق در جدول جوایز: همیشه ۶ توپ، که `matched`تای سمت راست سبز و
// بقیه خاکستری‌اند (مطابق فیگما). هم‌پوشانی یکنواخت ۶ پیکسلی و توپ راست روی بقیه.
const TOTAL_BALLS = 6;
function PrizeBalls({ matched }: Readonly<{ matched: number }>) {
	return (
		<Box display="flex" alignItems="center" justifyContent="center">
			{Array.from({ length: TOTAL_BALLS }).map((_, i) => (
				<Box
					key={i}
					component="img"
					src={`${IMAGE_BASE}${i < matched ? "ball-green.png" : "ball-grey.png"}`}
					alt=""
					sx={{
						width: 18,
						height: 18,
						marginInlineStart: i === 0 ? 0 : "-6px",
						zIndex: TOTAL_BALLS - i,
					}}
				/>
			))}
		</Box>
	);
}

export default function GuideContent() {
	return (
		<Wrapper>
			<Typography sx={titleSx}>راهنمای کامل قرعه‌کشی</Typography>

			{GUIDE_SECTIONS.map((section) => (
				<SectionCard key={section.title} sx={{ minHeight: 152 }}>
					<SectionHeader>
						<Typography sx={headerTextSx}>{section.title}</Typography>
					</SectionHeader>

					<SectionBody>
						<TextCol>
							{section.paragraphs.map((p, idx) => (
								<Typography
									key={idx}
									sx={{
										fontSize: 10,
										fontWeight: p.muted ? 400 : 500,
										lineHeight: "14px",
										color: p.muted ? TEXT_MUTED : TEXT_DARK,
										textAlign: "start",
										whiteSpace: "pre-line",
									}}
								>
									{p.text}
								</Typography>
							))}
						</TextCol>

						<Box
							component="img"
							src={`${IMAGE_BASE}${section.image}`}
							alt=""
							sx={{
								width: section.imageWidth,
								height: "auto",
								flexShrink: 0,
								alignSelf: "center",
							}}
						/>
					</SectionBody>
				</SectionCard>
			))}

			{/* بخش جدول جوایز */}
			<SectionCard>
				<SectionHeader>
					<Typography sx={headerTextSx}>تعیین برندگان و جوایز</Typography>
				</SectionHeader>
				<Box sx={{ display: "flex", flexDirection: "column", gap: "6px", padding: "12px" }}>
					<Typography
						sx={{
							fontSize: 10,
							fontWeight: 400,
							lineHeight: "14px",
							color: TEXT_DARK,
							textAlign: "start",
						}}
					>
						میزان جایزه هر بلیط، بر اساس تعداد توپ‌های سبز (توپ‌های مطابق) مشخص می‌شود.
					</Typography>
					<Typography
						sx={{
							fontSize: 10,
							fontWeight: 400,
							lineHeight: "14px",
							color: TEXT_MUTED,
							textAlign: "center",
						}}
					>
						سطوح و نحوه توزیع جوایز (Prize Tiers)
					</Typography>

					<Table>
						<TableHeadRow>
							<HeadCell>تعداد توپهای مطابق</HeadCell>
							<HeadCell>توضیح</HeadCell>
							<HeadCell>مبلغ جایزه</HeadCell>
						</TableHeadRow>
						{GUIDE_PRIZE_TIERS.map((tier) => (
							<TableRow key={tier.amount}>
								<Box sx={{ flex: 1, display: "flex", justifyContent: "center" }}>
									<PrizeBalls matched={tier.matched} />
								</Box>
								<BodyCell>{tier.desc}</BodyCell>
								<BodyCell>{tier.amount}</BodyCell>
							</TableRow>
						))}
					</Table>
				</Box>
			</SectionCard>

			{/* بخش قوانین مهم جوایز */}
			<SectionCard sx={{ minHeight: 152 }}>
				<SectionHeader>
					<Typography sx={headerTextSx}>قوانین مهم جوایز</Typography>
				</SectionHeader>
				<SectionBody>
					<TextCol>
						<Typography
							sx={{
								fontSize: 10,
								fontWeight: 500,
								lineHeight: "16px",
								color: TEXT_DARK,
								textAlign: "start",
								whiteSpace: "pre-line",
							}}
						>
							{
								"هر بلیط به صورت مستقل بررسی می‌شود\nاگر در یک سطح چند برنده وجود داشته باشد، جایزه آن سطح بین برندگان تقسیم می‌شود.\nجایزه بزرگ مربوط به ۶ توپ، طبق قوانین اعلام‌شده پرداخت خواهد شد.\nنتیجه قرعه‌کشی و وضعیت هر بلیط، به‌صورت شفاف در بخش قرعه‌کشی‌های برگزار شده، قابل مشاهده است."
							}
						</Typography>
					</TextCol>
					<Box
						component="img"
						src={`${IMAGE_BASE}rules.png`}
						alt=""
						sx={{ width: 84, height: "auto", flexShrink: 0, alignSelf: "center" }}
					/>
				</SectionBody>
			</SectionCard>

			{/* توضیح پایانی */}
			<Box sx={{ display: "flex", flexDirection: "column", gap: "4px", px: "4px" }}>
				<Typography
					sx={{
						fontSize: 12,
						fontWeight: 500,
						lineHeight: "16px",
						color: TEXT_DARK,
						textAlign: "start",
					}}
				>
					توضیح پایانی
				</Typography>
				<Typography
					sx={{
						fontSize: 10,
						fontWeight: 400,
						lineHeight: "16px",
						color: TEXT_MUTED,
						textAlign: "start",
					}}
				>
					شرکت در قرعه‌کشی به معنی پذیرش قوانین فوق است. سیستم قرعه‌کشی به صورت کاملاً
					تصادفی اجرا می‌شود و هیچ‌گونه دخالت انسانی در نتایج وجود ندارد.
				</Typography>
			</Box>
		</Wrapper>
	);
}

const titleSx = {
	fontSize: 12,
	fontWeight: 500,
	lineHeight: "16px",
	color: TEXT_DARK,
	textAlign: "center" as const,
};

const headerTextSx = {
	fontSize: 10,
	fontWeight: 700,
	lineHeight: "14px",
	color: "#fff",
	width: "100%",
	textAlign: "center" as const,
};

const Wrapper = styled(Box)({
	display: "flex",
	flexDirection: "column",
	gap: "16px",
	padding: "16px",
	backgroundColor: PAGE_BG,
});

const SectionCard = styled(Box)({
	border: `1px solid ${BORDER}`,
	borderRadius: "12px",
	overflow: "hidden",
	backgroundColor: PAGE_BG,
	display: "flex",
	flexDirection: "column",
});

const SectionHeader = styled(Box)({
	backgroundColor: PINK,
	padding: "4px 12px",
	display: "flex",
	alignItems: "center",
	minHeight: 20,
});

const SectionBody = styled(Box)({
	flex: 1,
	display: "flex",
	flexDirection: "row",
	alignItems: "center",
	gap: "12px",
	padding: "12px",
	minHeight: 0,
});

const TextCol = styled(Box)({
	flex: 1,
	minWidth: 0,
	display: "flex",
	flexDirection: "column",
	gap: "6px",
});

const Table = styled(Box)({
	border: `1px solid ${BORDER}`,
	borderRadius: "12px",
	overflow: "hidden",
	marginTop: "4px",
});

const TableHeadRow = styled(Box)({
	display: "flex",
	alignItems: "center",
	backgroundColor: TABLE_HEADER_BG,
	padding: "8px 12px",
});

const TableRow = styled(Box)({
	display: "flex",
	alignItems: "center",
	backgroundColor: "#fff",
	padding: "8px 12px",
	borderTop: `1px solid ${BORDER}`,
});

const HeadCell = styled(Typography)({
	flex: 1,
	fontSize: 10,
	fontWeight: 500,
	lineHeight: "14px",
	color: CELL_TEXT,
	textAlign: "center",
});

const BodyCell = styled(Typography)({
	flex: 1,
	fontSize: 10,
	fontWeight: 500,
	lineHeight: "14px",
	color: CELL_TEXT,
	textAlign: "center",
});
