// components/navigation/TabBarIcon.tsx (unchanged, slight tweak: default size 24)
import Ionicons from '../../$node_modules/@expo/vector-icons/Ionicons.js';
import { type IconProps } from '../../$node_modules/@expo/vector-icons/build/createIconSet.js';
import { type ComponentProps } from 'react';

export function TabBarIcon({
  style,
  ...rest
}: IconProps<ComponentProps<typeof Ionicons>['name']>) {
  return <Ionicons size={rest.size ?? 24} style={[{ marginBottom: 0 }, style]} {...rest} />;
}
