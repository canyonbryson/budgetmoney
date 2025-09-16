# Injured 👋

**Expo React Native athlete app** for injury tracking and recovery management, powered by Convex, NativeWind, Clerk, and Figma design tokens.

## Architecture

```
Expo Router (RN) App
├─ Clerk (Expo SDK) → Authentication & user sessions
├─ NativeWind → Utility-first styling with Tailwind classes
├─ i18n (Custom) + expo-localization → Multi-language support
├─ Expo Notifications → Device push tokens & notifications
├─ Convex Client → Real-time queries/mutations & data management
│  ├─ Actions: AI processing, notifications via Expo Push
│  └─ Tables: users, patients, injuries, messages, organizations, etc.
├─ React Navigation → Stack & tab navigation
├─ Secure Store → Encrypted local storage for sensitive data
├─ Design Tokens → Figma integration via packages/shared/ui
└─ Context Providers → Settings, theme, and app state management
```

## Core Packages

### Primary Dependencies

- **Expo SDK** (`expo@53.0.22`) - React Native framework with native modules
- **React Native** (`0.79.5`) - Core mobile framework
- **React** (`19.1.0`) - UI framework
- **Clerk** (`@clerk/clerk-expo@2.14.27`) - Authentication & user management
- **Convex** (`@injured/backend`) - Real-time backend & database
- **React Navigation** (`@react-navigation/native@7.1.17`) - Navigation framework
- **Expo Router** (`expo-router@5.1.5`) - File-based routing
- **NativeWind** - Tailwind CSS for React Native
- **Expo Secure Store** (`expo-secure-store@14.2.4`) - Encrypted local storage

### UI & Theming

- **Expo Font** (`expo-font@13.3.2`) - Custom font loading
- **Expo Blur** (`expo-blur@14.1.5`) - Native blur effects
- **React Native Reanimated** (`~3.17.5`) - Animations
- **React Native Gesture Handler** (`~2.24.0`) - Touch gestures
- **React Native Safe Area Context** - Safe area insets

## Features

- **Convex Integration** - Built-in real-time state management and subscriptions
- **Clerk Authentication** - User/organization management with secure sessions
- **Figma Tokens & MCP** - Live design-to-code workflows with design system
- **PostHog Analytics** - Crash reporting and performance metrics
- **Reusable Components** - Shared UI library with Storybook gallery
- **Deep Linking** - Universal links and app scheme handling
- **Push Notifications** - Device push tokens via Expo
- **AI Streaming** - Real-time AI interactions

## Navigation & Routing

### Expo Router Structure

```
app/                        # Expo Router entrypoint
├── _layout.tsx             # Root providers (Clerk, Convex, Theme, i18n)
├── (auth)/                 # Authentication flow
│   ├── _layout.tsx
│   ├── sign-in.tsx
│   ├── sign-up.tsx
│   └── forgot-password.tsx # (add for long-term auth support)
├── (tabs)/                 # Main tab navigation
│   ├── _layout.tsx
│   ├── index.tsx           # Home
│   ├── ask-ai.tsx
│   ├── injured/            # Injury tracking feature
│   │   ├── index.tsx       # Injury list
│   │   ├── [injuryId].tsx  # Dynamic injury detail
│   │   └── new.tsx         # Create new injury
│   ├── providers/          # Healthcare providers feature
│   │   ├── index.tsx
│   │   └── [providerId].tsx
│   └── settings/           # Settings feature
│       ├── index.tsx
│       ├── language.tsx
│       └── theme.tsx
├── (modals)/               # Modal/full-screen routes
│   ├── family.tsx
│   ├── profile.tsx
│   └── notifications.tsx   # (add for push notification settings)
└── (org)/                  # Organization-specific routes
    ├── index.tsx           # Org dashboard
    └── [orgId]/            # Dynamic org context
        ├── members.tsx
        └── reports.tsx
```

### Navigation Patterns

- **File-based Routing** - Routes automatically generated from file structure
- **Tab Navigation** - Bottom tabs with custom blur background and icons
- **Stack Navigation** - Modal screens with custom headers
- **Dynamic Routes** - URL parameters for workout/entry editing
- **Authentication Guards** - Automatic redirects based on auth state

## File Structure

```
app/                        # Expo Router pages & layouts
components/                 # Reusable UI components
│   ├── ui/                 # Generic UI (Button, ThemedText, etc.)
│   ├── navigation/         # TabBarIcon, headers, etc.
│   └── forms/              # Form inputs, validation wrappers
contexts/                   # React Context providers
hooks/                      # Custom hooks (useAuth, useInjury, useTheme)
i18n/                       # Translation system
convex/                     # Convex client + queries/mutations
lib/                        # Utilities (encryption, notifications, analytics)
constants/                  # Colors, styles, config
assets/                     # Fonts, images, icons
```

## Internationalization (i18n)

### Implementation

- **Custom Translation System** - Type-safe translation keys
- **Supported Languages**: English, Spanish (es), Chinese Simplified (zh-cn)
- **Translation Keys** - Enum-based with TypeScript support
- **Fallback Handling** - Graceful fallback to English for missing translations

### Usage

```typescript
import { useTranslation } from "@injured/i18n";
import { useSettings } from "@/contexts/SettingsContext";

// In component
const { language } = useSettings();
const welcomeText = t(language, "welcome"); // Type-safe key
```

### Translation Structure

```typescript
type LanguageCode = "en" | "es" | "zh-cn";

const strings = {
  en: { home: "Home", settings: "Settings" },
  es: { home: "Inicio", settings: "Configuración" },
  "zh-cn": { home: "首页", settings: "设置" },
};

export type TranslationKey = keyof (typeof strings)["en"];
```

## Theming & Design System

### Design Tokens Architecture

```
packages/shared/ui/
├── theme.ts               # Complete design token system
├── tokens.generated.ts    # Auto-generated from Figma
├── tokens.generator.ts    # Token generation utilities
├── tailwind.config.js     # Tailwind configuration
└── theme.ts               # Theme composition
```

### Theme Structure

- **Primitive Tokens** - Raw design values from Figma
- **Semantic Tokens** - Named tokens for specific use cases
- **Theme Modes** - Light, dark, and high-contrast variants
- **Component Tokens** - Pre-configured component styles
- **CSS Variables** - Runtime theme switching

### Supported Themes

- **Light Theme** - Default daytime appearance
- **Dark Theme** - Low-light optimized
- **High Contrast Light** - Accessibility enhanced
- **High Contrast Dark** - Accessibility enhanced
- **System Theme** - Follows device preference

### Color System

```typescript
// Semantic color usage
const colors = {
  modes: {
    light: {
      background_primary: "#FFFFFF",
      text_primary: "#000000",
      action_primary_fill: "#0066CC",
      // ... extensive color palette
    },
    dark: {
      /* dark mode colors */
    },
    // ... high contrast variants
  },
};
```

### Typography Scale

- **Display Fonts** - Headlines, hero text (SF Pro Display)
- **Text Fonts** - Body copy, UI elements (SF Pro Text)
- **Mono Fonts** - Code and technical text
- **Responsive Scaling** - Consistent ratios across screen sizes

## Shared Components

### UI Component Library

Located in `packages/shared/ui/` with comprehensive design tokens and reusable components.

### Themed Components

- **ThemedText** - Typography with automatic theme adaptation
- **ThemedView** - Containers with theme-aware backgrounds
- **Button** - Consistent button styling across the app
- **TabBarIcon** - Navigation icons with theme support

### Component Patterns

```typescript
// Themed component example
export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  return (
    <Text style={[{ color }, styles[type], style]} {...rest} />
  );
}
```

### Storybook Integration

- **Component Gallery** - Visual component documentation
- **Interactive Examples** - Live component testing
- **Design System Docs** - Token usage and guidelines

## PHI Encryption & Security

### Encryption Architecture

The app implements **envelope encryption** for PHI (Protected Health Information) using AWS KMS with the following components:

### Encrypted Data Types

- **Patient Injury Notes** - Medical observations and treatment notes
- **User Messages** - Chat communications with healthcare providers
- **AI Messages** - AI assistant conversations
- **Medical Documents** - PHI-bearing documents and reports
- **Patient Allergies** - Allergic reaction details
- **Medication Records** - Treatment indications and notes
- **Medical Conditions** - Health condition details

### Encryption Implementation

```typescript
// Envelope encryption pattern
interface EncryptedField {
  ciphertext: Uint8Array; // AEAD encrypted data
  iv: Uint8Array; // Initialization vector
  wrappedDek: Uint8Array; // KMS-wrapped data encryption key
  keyVersion: number; // Key version reference
  aad: Uint8Array; // Additional authenticated data
  encAlgo: "AES_256_GCM" | "XCHACHA20_POLY1305";
  sha256?: string; // Integrity hash
}
```

### Security Features

- **AES-256-GCM** - Primary encryption algorithm
- **XChaCha20-Poly1305** - Alternative for specific use cases
- **Key Rotation** - Automatic key rotation with background re-encryption
- **Additional Authenticated Data (AAD)** - Context binding to prevent misuse
- **Dual Control** - Superadmin approval required for decryption
- **Audit Logging** - Complete decryption event tracking

### AAD (Additional Authenticated Data)

```json
{
  "table": "patient_injury_notes",
  "column": "notes",
  "rowId": "uuid",
  "keyVersion": 123,
  "organizationId": "org-uuid"
}
```

### Decryption Governance

1. **Request Phase** - Reviewer submits decryption request with justification
2. **Approval Phase** - Security/privacy approver grants access with expiry
3. **JIT Access** - Just-in-time decryption using short-lived KMS credentials
4. **Audit Logging** - Every decryption event logged with context
5. **Auto-Expiry** - Grants automatically expire; can be revoked early

### AWS KMS Integration

- **GenerateDataKey** - Creates per-row data encryption keys
- **Decrypt** - Unwraps DEKs for decryption operations
- **OIDC → STS** - Short-lived AWS credentials via OIDC federation
- **Envelope Pattern** - DEKs never stored; only wrapped versions persist

### Convex Implementation

```typescript
// Server-side encryption/decryption functions
export const encryptField = mutation(async ({ db }, args) => {
  // Generate DEK via KMS
  // AEAD encrypt with AAD
  // Store wrapped DEK and ciphertext
});

export const decryptField = query(async ({ db, auth }, args) => {
  // Authorize request
  // Unwrap DEK via KMS
  // AEAD decrypt with AAD
  // Audit log the access
});
```

## Development

### Getting Started

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev:mobile

# Build for production
pnpm build
```

### Key Scripts

- `dev` - Start Expo development server
- `start` - Expo start menu
- `android/ios/web` - Platform-specific development
- `test` - Run Jest test suite
- `lint` - ESLint code quality checks
