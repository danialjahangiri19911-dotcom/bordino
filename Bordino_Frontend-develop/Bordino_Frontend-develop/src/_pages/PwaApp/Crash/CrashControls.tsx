"use client";

import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import InputBase from "@mui/material/InputBase";
import Typography from "@mui/material/Typography";

import { CRASH_COLORS, formatPoints } from "./utils";
import { persianNumberConverter } from "@/libs/utils/persianNumberConverter";

export type CrashMode = "manual" | "auto";
export type AutoAdjust = { mode: "reset" | "increase"; percent: string };

export interface AutoSettings {
	count: string;
	onWin: AutoAdjust;
	onLoss: AutoAdjust;
	stopProfit: string;
	stopLoss: string;
}

export interface MainAction {
	label: string;
	disabled: boolean;
	onClick: () => void;
}

interface Props {
	mode: CrashMode;
	onModeChange: (mode: CrashMode) => void;
	locked: boolean;
	bet: string;
	onBetChange: (value: string) => void;
	onHalf: () => void;
	onDouble: () => void;
	cashoutAt: string;
	onCashoutAtChange: (value: string) => void;
	onCashoutStep: (delta: number) => void;
	profit: number;
	balance: number;
	auto: AutoSettings;
	onAutoChange: (auto: AutoSettings) => void;
	action: MainAction;
	hint: string | null;
}

/** Digits only (Persian digits are converted), plus an optional decimal point. */
export function cleanNumber(raw: string, decimals: boolean) {
	const latin = persianNumberConverter(raw).replace(/[٫,]/g, ".");
	const kept = latin.replace(decimals ? /[^\d.]/g : /\D/g, "");
	if (!decimals) return kept;
	const [whole, ...rest] = kept.split(".");
	return rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
}

export function Label({ children }: { children: React.ReactNode }) {
	return (
		<Typography sx={{ fontSize: 12, fontWeight: 600, color: CRASH_COLORS.muted, mb: 0.5 }}>
			{children}
		</Typography>
	);
}

export function Field({
	value,
	onChange,
	disabled,
	decimals = false,
	suffix,
	children,
	label,
}: {
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
	decimals?: boolean;
	suffix?: string;
	children?: React.ReactNode;
	label: string;
}) {
	return (
		<Box
			sx={{
				display: "flex",
				alignItems: "stretch",
				bgcolor: CRASH_COLORS.border,
				borderRadius: 1,
				p: "2px",
				gap: "2px",
				opacity: disabled ? 0.6 : 1,
				minWidth: 0,
			}}
		>
			<InputBase
				value={value}
				disabled={disabled}
				onChange={(e) => onChange(cleanNumber(e.target.value, decimals))}
				inputProps={{ inputMode: decimals ? "decimal" : "numeric", "aria-label": label, dir: "ltr" }}
				endAdornment={
					suffix ? (
						<Typography sx={{ color: CRASH_COLORS.muted, fontSize: 13, pr: 0.75 }}>{suffix}</Typography>
					) : undefined
				}
				sx={{
					flex: 1,
					minWidth: 0,
					bgcolor: CRASH_COLORS.page,
					borderRadius: 0.75,
					color: CRASH_COLORS.text,
					fontWeight: 600,
					fontSize: 15,
					pl: 1,
					height: 38,
					"& input": { textAlign: "left", p: 0 },
					"&.Mui-disabled input": { WebkitTextFillColor: CRASH_COLORS.text },
				}}
			/>
			{children}
		</Box>
	);
}

export function SideButton({
	children,
	onClick,
	disabled,
	label,
}: {
	children: React.ReactNode;
	onClick: () => void;
	disabled?: boolean;
	label: string;
}) {
	return (
		<ButtonBase
			onClick={onClick}
			disabled={disabled}
			aria-label={label}
			sx={{
				minWidth: 32,
				px: 0.5,
				borderRadius: 0.75,
				color: CRASH_COLORS.text,
				fontWeight: 700,
				fontSize: 14,
				"&:hover": { bgcolor: "#557086" },
			}}
		>
			{children}
		</ButtonBase>
	);
}

export function Segmented<T extends string>({
	value,
	options,
	onChange,
	disabled,
	height = 32,
}: {
	value: T;
	options: { value: T; label: string }[];
	onChange: (value: T) => void;
	disabled?: boolean;
	height?: number;
}) {
	return (
		<Box
			role="tablist"
			sx={{ display: "flex", bgcolor: CRASH_COLORS.page, borderRadius: 99, p: "3px", gap: "3px" }}
		>
			{options.map((option) => (
				<ButtonBase
					key={option.value}
					role="tab"
					aria-selected={value === option.value}
					disabled={disabled}
					onClick={() => onChange(option.value)}
					sx={{
						flex: 1,
						height,
						px: 1,
						borderRadius: 99,
						fontWeight: 700,
						fontSize: 13,
						color: CRASH_COLORS.text,
						bgcolor: value === option.value ? CRASH_COLORS.border : "transparent",
						opacity: disabled && value !== option.value ? 0.5 : 1,
					}}
				>
					{option.label}
				</ButtonBase>
			))}
		</Box>
	);
}

/** One line: «در صورت برد  [ریست|افزایش]  [ ٪ ]». */
function AdjustRow({
	title,
	value,
	onChange,
	disabled,
}: {
	title: string;
	value: AutoAdjust;
	onChange: (value: AutoAdjust) => void;
	disabled: boolean;
}) {
	return (
		<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
			<Typography sx={{ fontSize: 12, fontWeight: 600, color: CRASH_COLORS.muted, width: 64, flexShrink: 0 }}>
				{title}
			</Typography>
			<Box sx={{ width: 128, flexShrink: 0 }}>
				<Segmented
					value={value.mode}
					disabled={disabled}
					height={30}
					onChange={(mode) => onChange({ ...value, mode })}
					options={[
						{ value: "reset", label: "ریست" },
						{ value: "increase", label: "افزایش" },
					]}
				/>
			</Box>
			<Box sx={{ flex: 1, minWidth: 0 }}>
				<Field
					label={`${title} درصد`}
					value={value.percent}
					decimals
					suffix="٪"
					disabled={disabled || value.mode === "reset"}
					onChange={(percent) => onChange({ ...value, percent })}
				/>
			</Box>
		</Box>
	);
}

export default function CrashControls(props: Props) {
	const { mode, locked, auto, onAutoChange, action } = props;

	return (
		<Box
			sx={{
				bgcolor: CRASH_COLORS.raised,
				borderRadius: 2,
				p: 1.25,
				display: "flex",
				flexDirection: "column",
				gap: 1.25,
			}}
		>
			{/* The main action first, so it is on screen without scrolling. */}
			<ButtonBase
				onClick={action.onClick}
				disabled={action.disabled}
				sx={{
					height: 50,
					borderRadius: 1.5,
					bgcolor: CRASH_COLORS.green,
					color: CRASH_COLORS.greenText,
					fontWeight: 800,
					fontSize: 17,
					boxShadow: "0 4px 12px rgba(0,231,1,0.2)",
					"&.Mui-disabled": { opacity: 0.55 },
					"&:hover": { bgcolor: "#1fff20" },
				}}
			>
				{action.label}
			</ButtonBase>
			{props.hint && (
				<Typography role="alert" sx={{ color: CRASH_COLORS.red, fontSize: 12, textAlign: "center", mt: -0.5 }}>
					{props.hint}
				</Typography>
			)}

			<Segmented
				value={mode}
				disabled={locked}
				onChange={props.onModeChange}
				options={[
					{ value: "manual", label: "دستی" },
					{ value: "auto", label: "خودکار" },
				]}
			/>

			<Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
				<Box sx={{ minWidth: 0 }}>
					<Label>مبلغ شرط</Label>
					<Field label="مبلغ شرط" value={props.bet} onChange={props.onBetChange} disabled={locked}>
						<SideButton label="نصف" onClick={props.onHalf} disabled={locked}>
							½
						</SideButton>
						<SideButton label="دو برابر" onClick={props.onDouble} disabled={locked}>
							۲×
						</SideButton>
					</Field>
				</Box>
				<Box sx={{ minWidth: 0 }}>
					<Label>برداشت در</Label>
					<Field
						label="برداشت خودکار در ضریب"
						value={props.cashoutAt}
						onChange={props.onCashoutAtChange}
						decimals
						suffix="×"
						disabled={locked}
					>
						<SideButton label="کم کردن ضریب" onClick={() => props.onCashoutStep(-1)} disabled={locked}>
							−
						</SideButton>
						<SideButton label="زیاد کردن ضریب" onClick={() => props.onCashoutStep(1)} disabled={locked}>
							+
						</SideButton>
					</Field>
				</Box>
			</Box>

			{mode === "auto" && (
				<>
					<Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1 }}>
						<Box sx={{ minWidth: 0 }}>
							<Label>تعداد (۰=∞)</Label>
							<Field
								label="تعداد شرط"
								value={auto.count}
								disabled={locked}
								onChange={(count) => onAutoChange({ ...auto, count })}
							/>
						</Box>
						<Box sx={{ minWidth: 0 }}>
							<Label>توقف با سود</Label>
							<Field
								label="توقف با سود"
								value={auto.stopProfit}
								disabled={locked}
								onChange={(stopProfit) => onAutoChange({ ...auto, stopProfit })}
							/>
						</Box>
						<Box sx={{ minWidth: 0 }}>
							<Label>توقف با ضرر</Label>
							<Field
								label="توقف با ضرر"
								value={auto.stopLoss}
								disabled={locked}
								onChange={(stopLoss) => onAutoChange({ ...auto, stopLoss })}
							/>
						</Box>
					</Box>
					<AdjustRow
						title="در صورت برد"
						value={auto.onWin}
						disabled={locked}
						onChange={(onWin) => onAutoChange({ ...auto, onWin })}
					/>
					<AdjustRow
						title="در صورت باخت"
						value={auto.onLoss}
						disabled={locked}
						onChange={(onLoss) => onAutoChange({ ...auto, onLoss })}
					/>
				</>
			)}

			<Box sx={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: CRASH_COLORS.muted }}>
				<Typography component="span" sx={{ fontSize: 12 }}>
					سود در صورت برد:{" "}
					<Box component="b" sx={{ color: CRASH_COLORS.green }}>
						+{formatPoints(props.profit)}
					</Box>
				</Typography>
				<Typography component="span" sx={{ fontSize: 12 }}>
					موجودی: <Box component="b" sx={{ color: CRASH_COLORS.text }}>{formatPoints(props.balance)}</Box> امتیاز
				</Typography>
			</Box>
		</Box>
	);
}
