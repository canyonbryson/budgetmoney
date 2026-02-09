import React from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '@/hooks/useAppTheme'

type Props = {
  children: React.ReactNode
  onPress: () => void
}

function ListItem({ children, onPress }: Props) {
  const { colors, borderRadius, spacing, shadows } = useAppTheme();

  return (
    <Pressable
      style={[
        styles.pressable,
        {
          borderRadius: borderRadius.lg,
          padding: spacing.lg,
          borderColor: colors.borderLight,
          backgroundColor: colors.backgroundCard,
          ...shadows.sm,
        },
      ]}
      onPress={onPress}
    >
      <View style={styles.outer}>
        <View style={styles.inner}>
          { children }
        </View>
        <Ionicons size={20} name='chevron-forward' color={colors.textMuted} />
      </View>
    </Pressable>
  )
}

export default ListItem

const styles = StyleSheet.create({
  pressable: {
    borderWidth: 1,
  },
  outer: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  inner: {
    display: "flex",
    gap: 3,
    flexDirection: "column",
    flex: 1
  },
})
