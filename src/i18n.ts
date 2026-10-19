import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpBackend from "i18next-http-backend";

export interface LanguageMetadata {
  code: string;
  nativeName: string;
  englishName: string;
  rtl?: boolean;
}

export const LANGUAGES: LanguageMetadata[] = [
  { code: "en", nativeName: "English", englishName: "English" },
  { code: "zh-CN", nativeName: "简体中文", englishName: "Chinese Simplified" },
  { code: "de", nativeName: "Deutsch", englishName: "German" },
  { code: "pt-PT", nativeName: "Português (EU)", englishName: "Portuguese" },
  { code: "ja", nativeName: "日本語", englishName: "Japanese" },
  { code: "ru", nativeName: "Русский", englishName: "Russian" },
  { code: "ar", nativeName: "العربية", englishName: "Arabic", rtl: true },
  { code: "fr", nativeName: "Français", englishName: "French" },
  { code: "it", nativeName: "Italiano", englishName: "Italian" },
  { code: "pt-BR", nativeName: "Português (BR)", englishName: "Portuguese" },
  { code: "ko", nativeName: "한국인", englishName: "Korean" },
  { code: "es", nativeName: "Español", englishName: "Spanish" },
];

const supportedLanguages = LANGUAGES.map((language) => language.code);

void i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: supportedLanguages,
    backend: { loadPath: "/locales/{{lng}}/translation.json" },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng",
    },
    interpolation: { escapeValue: false },
  })
  .then(() => {
    applyDocumentDirection(i18n.language);
  });

export function applyDocumentDirection(languageCode: string) {
  const metadata = LANGUAGES.find((language) => language.code === languageCode);
  document.documentElement.dir = metadata?.rtl ? "rtl" : "ltr";
  document.documentElement.lang = languageCode;
}

export default i18n;
