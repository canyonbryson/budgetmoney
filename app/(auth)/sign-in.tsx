import { useSignIn } from '@clerk/clerk-expo'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { Text, View, ActivityIndicator, TextInput, StyleSheet } from 'react-native'
import React from 'react'
import Button from '@/components/Button'
import OAuthButton from '@/components/OAuthButton'
import MaterialCommunityIcons from '@expo/vector-icons/build/MaterialCommunityIcons'
import { ThemedText } from '@/components/ThemedText'
import ScreenWrapper from '@/components/ScreenWrapper'
import { useSettings } from '@/contexts/SettingsContext'
import { useAppTheme } from '@/hooks/useAppTheme'
import { t } from '@/i18n'
import { resolvePostAuthPath } from '@/lib/authNavigation'

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn()
  const router = useRouter()
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>()
  const { language } = useSettings()
  const { colors, spacing, borderRadius, typography, shadows } = useAppTheme()

  const [emailAddress, setEmailAddress] = React.useState('')
  const [password, setPassword] = React.useState('')

  const onSignInPress = React.useCallback(async () => {
    if (!isLoaded) {
      return
    }

    try {
      const signInAttempt = await signIn.create({
        identifier: emailAddress,
        password,
      })

      if (signInAttempt.status === 'complete') {
        await setActive({
          session: signInAttempt.createdSessionId
        })

        router.replace(resolvePostAuthPath(params.returnTo))
      } else {
        console.error(JSON.stringify(signInAttempt, null, 2))
      }
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2))
    }
  }, [isLoaded, emailAddress, password, params.returnTo])

  if (!isLoaded) {
    return (
      <ScreenWrapper edges={['top', 'bottom']} style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenWrapper>
    )
  }

  return (
    <ScreenWrapper edges={['top', 'bottom']} style={styles.screen}>
      {/* Top branding area */}
      <View style={styles.brandingArea}>
        <ThemedText type='title' style={{ letterSpacing: -0.5 }}>
          {t(language, 'appName')}
        </ThemedText>
        <ThemedText style={{ color: colors.textMuted, fontSize: typography.body.fontSize }}>
          {t(language, 'signIn')}
        </ThemedText>
      </View>

      {/* Form card */}
      <View style={[
        styles.formCard,
        {
          backgroundColor: colors.backgroundCard,
          borderRadius: borderRadius.lg,
          padding: spacing.xl,
          marginHorizontal: spacing.lg,
          gap: spacing.lg,
          ...shadows.md,
        },
      ]}>
        {/* OAuth */}
        <OAuthButton strategy="oauth_google">
          <MaterialCommunityIcons name="google" size={18} />{' '}
          Google
        </OAuthButton>

        {/* Separator */}
        <View style={styles.separator}>
          <View style={[styles.separatorLine, { backgroundColor: colors.borderLight }]} />
          <Text style={[styles.separatorText, { color: colors.textMuted, fontFamily: typography.caption.fontFamily }]}>
            or
          </Text>
          <View style={[styles.separatorLine, { backgroundColor: colors.borderLight }]} />
        </View>

        {/* Input fields */}
        <View style={{ gap: spacing.md }}>
          <View style={{ gap: spacing.xs }}>
            <ThemedText style={{ fontSize: typography.caption.fontSize, fontFamily: typography.label.fontFamily, color: colors.textSecondary }}>
              {t(language, 'email')}
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  borderRadius: borderRadius.md,
                  borderColor: colors.border,
                  color: colors.text,
                  backgroundColor: colors.background,
                  fontFamily: typography.body.fontFamily,
                  fontSize: typography.body.fontSize,
                },
              ]}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={colors.textMuted}
              value={emailAddress}
              onChangeText={setEmailAddress}
            />
          </View>
          <View style={{ gap: spacing.xs }}>
            <ThemedText style={{ fontSize: typography.caption.fontSize, fontFamily: typography.label.fontFamily, color: colors.textSecondary }}>
              {t(language, 'password')}
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  borderRadius: borderRadius.md,
                  borderColor: colors.border,
                  color: colors.text,
                  backgroundColor: colors.background,
                  fontFamily: typography.body.fontFamily,
                  fontSize: typography.body.fontSize,
                },
              ]}
              value={password}
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              onChangeText={setPassword}
            />
          </View>
        </View>

        {/* Sign in button */}
        <Button onPress={onSignInPress}>
          {t(language, 'signIn')}
        </Button>
      </View>

      {/* Bottom link */}
      <View style={[styles.bottomLink, { gap: spacing.xs }]}>
        <ThemedText style={{ color: colors.textMuted }}>
          {t(language, 'dontHaveAccount')}
        </ThemedText>
        <Link href="/sign-up">
          <ThemedText style={{ fontWeight: '700', color: colors.primary }}>
            {t(language, 'signUp')}
          </ThemedText>
        </Link>
      </View>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  screen: {
    marginTop: 50,
    flex: 1,
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandingArea: {
    alignItems: 'center',
    marginBottom: 28,
    gap: 4,
  },
  formCard: {
    // dynamic styles applied inline
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  separatorLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  separatorText: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    height: 48,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  bottomLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
})
