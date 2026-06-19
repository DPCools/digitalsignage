import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';

const SUPPORTED_LOCALES = ['en', 'fr'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

function parseLocale(raw: string | null): Locale {
  if (!raw) return 'en';
  const lang = raw.split(',')[0].split(';')[0].trim().substring(0, 2).toLowerCase();
  return (SUPPORTED_LOCALES as readonly string[]).includes(lang)
    ? (lang as Locale)
    : 'en';
}

export default getRequestConfig(async () => {
  // 1. Respect an explicit locale cookie (set by user preference)
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('locale')?.value;
  if (cookieLocale && (SUPPORTED_LOCALES as readonly string[]).includes(cookieLocale)) {
    const locale = cookieLocale as Locale;
    return {
      locale,
      messages: (await import(`../../messages/${locale}.json`)).default,
    };
  }

  // 2. Fall back to Accept-Language header
  const headersList = await headers();
  const acceptLanguage = headersList.get('accept-language');
  const locale = parseLocale(acceptLanguage);

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
