import React from "react";
import { ThemedScreen, type ThemedScreenProps } from "@injured/ui";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";

export type Props = ThemedScreenProps & {
	title?: string;
	showTitle?: boolean;
	right?: React.ReactNode;
	left?: React.ReactNode;
	children: React.ReactNode;
};

export default function Screen({ title, showTitle = false, right, left, children, ...rest }: Props) {
	const header = showTitle && title ? (
		<ThemedView style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 12 }}>
			{left}
			<ThemedText variant="heading" style={{ textAlign: "center", flex: 1 }}>
				{title}
			</ThemedText>
			{right}
		</ThemedView>
	) : undefined;

	return (
		<ThemedScreen header={header} {...rest}>
			{children}
		</ThemedScreen>
	);
}
