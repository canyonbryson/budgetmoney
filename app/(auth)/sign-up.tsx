import React from 'react'
import { View, Text, StyleSheet, TextInput } from 'react-native'
import { useSignUp } from '@clerk/clerk-expo'
import { Link, useRouter } from 'expo-router'
import Button from '@/components/Button'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { ThemedView } from '@/components/ThemedView'
import { ThemedText } from '@/components/ThemedText'
import OAuthButton from '@/components/OAuthButton'
import ScreenWrapper from '@/components/ScreenWrapper'
import { useSettings } from '@/contexts/SettingsContext'
import { useAppTheme } from '@/hooks/useAppTheme'
import { t } from '@/i18n'

export default function SignUpScreen() {
  const { isLoaded, signUp, setActive } = useSignUp()
  const router = useRouter()
  const { language } = useSettings()
  const { colors, spacing, borderRadius } = useAppTheme()

  const [emailAddress, setEmailAddress] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [pendingVerification, setPendingVerification] = React.useState(false)
  const [code, setCode] = React.useState('')

  const onSignUpPress = async () => {
    if (!isLoaded) {
      return
    }

    try {
      await signUp.create({
        emailAddress,
        password,
      })

      await signUp.prepareEmailAddressVerification({
        strategy: 'email_code'
      })

      setPendingVerification(true)
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2))
    }
  }

  const onPressVerify = async () => {
    if (!isLoaded) {
      return
    }

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      })

      if (completeSignUp.status === 'complete') {
        await setActive({ session: completeSignUp.createdSessionId })
        router.replace('/')
      } else {
        console.error(JSON.stringify(completeSignUp, null, 2))
      }
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2))
    }
  }

  return (
    <ScreenWrapper style={styles.authScreen}>
      <View style={[styles.authForm, { padding: spacing.lg + 2, gap: spacing.sm }]}>
        {!pendingVerification && (
          <>
            <ThemedView style={{ marginVertical: spacing.lg, alignItems: "center" }}>
            <ThemedText type='title'>
              {t(language, 'signUp')}
            </ThemedText>
            <ThemedText type='default'>
              {t(language, 'appName')}
            </ThemedText>
            </ThemedView>

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

            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <View style={{flex: 1, height: 1, backgroundColor: colors.borderLight}} />
              <View>
                <Text style={{width: 50, textAlign: 'center', color: colors.textMuted}}>or</Text>
              </View>
              <View style={{flex: 1, height: 1, backgroundColor: colors.borderLight}} />
            </View>

            <ThemedText>{t(language, 'email')}</ThemedText>
            <TextInput
              style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
              autoCapitalize="none"
              placeholderTextColor={colors.textMuted}
              value={emailAddress}
              onChangeText={(email) => setEmailAddress(email)}
            />
            <ThemedText>{t(language, 'password')}</ThemedText>
            <TextInput
              style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
              value={password}
              placeholderTextColor={colors.textMuted}
              secureTextEntry={true}
              onChangeText={(password) => setPassword(password)}
            />
            <Button onPress={onSignUpPress}>
              <Text>{t(language, 'continue')}</Text> <Ionicons name='caret-forward' />
            </Button>

            <View style={{
              display: "flex",
              flexDirection: "row",
              gap: 4,
              justifyContent: "center",
              marginVertical: spacing.lg + 2
            }}>
              <ThemedText>{t(language, 'alreadyHaveAccount')}</ThemedText>
              <Link href="/sign-in">
                <ThemedText style={{ fontWeight: "bold" }}>{t(language, 'signIn')}</ThemedText>
              </Link>
            </View>
          </>
        )}

        {pendingVerification && (
          <>
            <TextInput
              style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
              value={code}
              placeholder={t(language, 'codePlaceholder')}
              placeholderTextColor={colors.textMuted}
              onChangeText={(code) => setCode(code)} />
            <Button onPress={onPressVerify}>
              {t(language, 'verifyCode')}
            </Button>
          </>
        )}

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
