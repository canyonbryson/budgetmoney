// components/navigation/TabBarIcon.tsx (unchanged, slight tweak: default size 24)
import React from "react";
import { Ionicons } from "@expo/vector-icons";
import type { IconProps } from "@expo/vector-icons/build/createIconSet";
import { type ComponentProps } from "react";

export function TabBarIcon({
  style,
  ...rest
}: IconProps<ComponentProps<typeof Ionicons>["name"]>) {
  return (
    <Ionicons
      size={rest.size ?? 24}
      style={[{ marginBottom: 0 }, style]}
      {...rest}
    />
  );
}
