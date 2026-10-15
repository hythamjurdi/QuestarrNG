import { getLocalizedApiErrorDetail } from "@/lib/api-error-locale";
import { getInterfaceLanguageDirection, useInterfaceLanguage } from "@/lib/interface-locale";

/** Localizes known app-owned details while leaving provider and user text untouched. */
export function ApiErrorDetailText({ source }: { source: string }) {
  const { language } = useInterfaceLanguage();
  const translation = getLocalizedApiErrorDetail(source, language);

  if (translation === undefined) {
    return (
      <bdi lang="und" dir="auto">
        {source}
      </bdi>
    );
  }

  return (
    <bdi lang={language} dir={getInterfaceLanguageDirection(language)}>
      {translation}
    </bdi>
  );
}
