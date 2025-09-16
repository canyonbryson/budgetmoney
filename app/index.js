import { jsx as _jsx } from "react/jsx-runtime";
import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
export default function Index() {
    const { isLoaded, isSignedIn } = useAuth();
    if (!isLoaded)
        return null;
    return _jsx(Redirect, { href: isSignedIn ? '/(tabs)' : '/(auth)/sign-in' });
}
