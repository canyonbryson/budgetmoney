import React from 'react';
import { Redirect } from 'expo-router';

export default function AppEntry() {
  return <Redirect href="/(onboarding)/splash" />;
}
