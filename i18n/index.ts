type LanguageCode = 'en' | 'es' | 'zh-cn';

const strings = {
  en: {
    home: 'Home',
    askAi: 'Ask-AI',
    settings: 'Settings',
    signIn: 'Sign in',
    signOut: 'Sign out',
    signedInAs: 'Signed in as',
    theme: 'Theme',
    system: 'System',
    light: 'Light',
    dark: 'Dark',
    language: 'Language',
    promptPlaceholder: 'Ask something... (stubbed)',
    send: 'Send',
    welcome: 'Welcome to the app!',
  },
  es: {
    home: 'Inicio',
    askAi: 'Preguntar-AI',
    settings: 'Configuración',
    signIn: 'Iniciar sesión',
    signOut: 'Cerrar sesión',
    signedInAs: 'Conectado como',
    theme: 'Tema',
    system: 'Sistema',
    light: 'Claro',
    dark: 'Oscuro',
    language: 'Idioma',
    promptPlaceholder: 'Pregunta algo... (simulado)',
    send: 'Enviar',
    welcome: '¡Bienvenido a la aplicación!',
  },
  'zh-cn': {
    home: '首页',
    askAi: '询问AI',
    settings: '设置',
    signIn: '登录',
    signOut: '退出登录',
    signedInAs: '当前用户',
    theme: '主题',
    system: '系统',
    light: '亮色',
    dark: '暗色',
    language: '语言',
    promptPlaceholder: '问点什么...（占位）',
    send: '发送',
    welcome: '欢迎使用应用！',
  },
} as const;

export type TranslationKey = keyof typeof strings['en'];

export function t(lang: LanguageCode, key: TranslationKey): string {
  const locale = strings[lang] ?? strings.en;
  return locale[key] ?? strings.en[key];
}


