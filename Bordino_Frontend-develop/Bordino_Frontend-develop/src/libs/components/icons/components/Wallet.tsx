import { IconWrapper } from "@libs/components/icons/SvgWrapper";
import type { BaseSvgInterfaces } from "@libs/components/icons/interfaces";

export default function WalletIcon(props: Readonly<BaseSvgInterfaces>) {
	return (
		<IconWrapper {...props}>
			<svg
				width="21"
				height="20"
				viewBox="0 0 21 20"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M11.0833 7.5H6.08325"
					strokeWidth="1.2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<path
					d="M18.5833 9.14159V10.8583C18.5833 11.3166 18.2167 11.6916 17.75 11.7083H16.1167C15.2167 11.7083 14.3917 11.0499 14.3167 10.1499C14.2667 9.62494 14.4667 9.13327 14.8167 8.79161C15.125 8.47494 15.55 8.29163 16.0167 8.29163H17.75C18.2167 8.30829 18.5833 8.68326 18.5833 9.14159Z"
					strokeWidth="1.2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<path
					d="M14.8167 8.79162C14.4667 9.13328 14.2668 9.62495 14.3168 10.15C14.3918 11.05 15.2167 11.7083 16.1167 11.7083H17.7501V12.9166C17.7501 15.4166 16.0834 17.0833 13.5834 17.0833H6.08341C3.58341 17.0833 1.91675 15.4166 1.91675 12.9166V7.08329C1.91675 4.81663 3.28342 3.23329 5.40842 2.96662C5.62508 2.93329 5.85008 2.91663 6.08341 2.91663H13.5834C13.8001 2.91663 14.0084 2.92495 14.2084 2.95828C16.3584 3.20828 17.7501 4.79996 17.7501 7.08329V8.29164H16.0167C15.5501 8.29164 15.1251 8.47495 14.8167 8.79162Z"
					strokeWidth="1.2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		</IconWrapper>
	);
}
