import { useInterfaceLanguage, getInterfaceLanguageDirection } from "@/lib/interface-locale";
import { formatRegionalDistanceToNow, useRegionalPreference } from "@/lib/regional-format";

interface RegionalRelativeTimeProps {
  date: Date;
}

export function RegionalRelativeTime({ date }: RegionalRelativeTimeProps) {
  const { language } = useInterfaceLanguage();
  useRegionalPreference();

  return (
    <time
      dateTime={date.toISOString()}
      lang={language}
      dir={getInterfaceLanguageDirection(language)}
    >
      {formatRegionalDistanceToNow(date)}
    </time>
  );
}
