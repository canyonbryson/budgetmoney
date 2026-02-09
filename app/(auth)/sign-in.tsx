import { useSignIn } from '@clerk/clerk-expo'
import { Link, useRouter } from 'expo-router'
import { Text, View, ActivityIndicator, TextInput, StyleSheet } from 'react-native'
import React from 'react'
import Button from '@/components/Button'
import OAuthButton from '@/components/OAuthButton'
import MaterialCommunityIcons from '@expo/vector-icons/build/MaterialCommunityIcons'
import { ThemedText } from '@/components/ThemedText'
import { ThemedView } from '@/components/ThemedView'
import ScreenWrapper from '@/components/ScreenWrapper'
import { Ionicons } from '@expo/vector-icons'
import { useSettings } from '@/contexts/SettingsContext'
import { useAppTheme } from '@/hooks/useAppTheme'
import { t } from '@/i18n'

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn()
  const router = useRouter()
  const { language } = useSettings()
  const { colors, spacing, borderRadius } = useAppTheme()

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

        router.replace('/')
      } else {
        console.error(JSON.stringify(signInAttempt, null, 2))
      }
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2))
    }
  }, [isLoaded, emailAddress, password])

  if(!isLoaded) {
    return (
      <ScreenWrapper style={styles.authScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenWrapper>
    )
  }

  return (
    <ScreenWrapper style={styles.authScreen}>
      <View style={[styles.authForm, { padding: spacing.lg + 2, gap: spacing.sm }]}>

        {/* Header text */}
        <ThemedView style={{ marginVertical: spacing.lg, alignItems: "center" }}>
          <ThemedText type='title'>
            {t(language, 'appName')}
          </ThemedText>
          <ThemedText type='default'>
            {t(language, 'signIn')}
          </ThemedText>
        </ThemedView>

        {/* OAuth buttons */}
        <View style={{
          display: "flex",
          flexDirection: "row",
          gap: spacing.sm
        }}>
          <View style={{ flex: 1 }}>
            <OAuthButton strategy="oauth_google">
              <MaterialCommunityIcons name="google" size={18} />{" "}
              Google
            </OAuthButton>
          </View>
        </View>

        {/* Form separator */}
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <View style={{flex: 1, height: 1, backgroundColor: colors.borderLight}} />
          <View>
            <Text style={{width: 50, textAlign: 'center', color: colors.textMuted}}>or</Text>
          </View>
          <View style={{flex: 1, height: 1, backgroundColor: colors.borderLight}} />
        </View>

        {/* Input fields */}
        <View style={{ gap: spacing.sm, marginBottom: spacing.xl }}>
          <ThemedText>{t(language, 'email')}</ThemedText>
          <TextInput
            style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
            autoCapitalize="none"
            placeholderTextColor={colors.textMuted}
            value={emailAddress}
            onChangeText={(emailAddress) => setEmailAddress(emailAddress)}
          />
          <ThemedText>{t(language, 'password')}</ThemedText>
          <TextInput
            style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
            value={password}
            placeholderTextColor={colors.textMuted}
            secureTextEntry={true}
            onChangeText={(password) => setPassword(password)}
          />
        </View>

        {/* Sign in button */}
        <Button onPress={onSignInPress}>
          <Text>{t(language, 'signIn')}</Text> <Ionicons name='caret-forward' />
        </Button>

        {/* Suggest new users create an account */}
        <View style={{
          display: "flex",
          flexDirection: "row",
          gap: 4,
          justifyContent: "center",
          marginVertical: spacing.lg + 2
        }}>
          <ThemedText>{t(language, 'dontHaveAccount')}</ThemedText>
          <Link href="/sign-up">
            <ThemedText style={{ fontWeight: "bold" }}>{t(language, 'signUp')}</ThemedText>
          </Link>
        </View>

      </View>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  authScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authForm: {
    display: "flex",
    width: "100%",
  },
  input: {
    height: 40,
    borderWidth: 1,
    padding: 10,
  },
})
