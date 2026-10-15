interface BilingualLocaleNameProps {
  language: string;
  nativeName: string;
  englishName?: string | undefined;
}

export function BilingualLocaleName({
  language,
  nativeName,
  englishName,
}: Readonly<BilingualLocaleNameProps>) {
  const languageBase = language.toLowerCase().split(/[-_]/, 1)[0] ?? "";
  const direction = ["ar", "fa", "he", "ur"].includes(languageBase) ? "rtl" : "ltr";

  return (
    <>
      <span lang={language} dir={direction}>
        {nativeName}
      </span>
      {englishName ? (
        <span lang="en" dir="ltr">
          {` — ${englishName}`}
        </span>
      ) : null}
    </>
  );
}
