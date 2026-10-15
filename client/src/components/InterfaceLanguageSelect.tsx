import { BilingualLocaleName } from "@/components/BilingualLocaleName";
import { INTERFACE_LANGUAGE_OPTIONS, type InterfaceLanguage } from "@/lib/interface-locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface InterfaceLanguageSelectProps {
  id: string;
  value: InterfaceLanguage;
  onValueChange: (value: InterfaceLanguage) => void;
  className?: string;
}

export function InterfaceLanguageSelect({
  id,
  value,
  onValueChange,
  className,
}: Readonly<InterfaceLanguageSelectProps>) {
  const selectedOption = INTERFACE_LANGUAGE_OPTIONS.find((option) => option.value === value);

  return (
    <Select
      value={value}
      onValueChange={(nextValue) => onValueChange(nextValue as InterfaceLanguage)}
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue>
          {selectedOption ? (
            <BilingualLocaleName
              language={selectedOption.value}
              nativeName={selectedOption.nativeName}
              englishName={selectedOption.englishName}
            />
          ) : null}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {INTERFACE_LANGUAGE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <BilingualLocaleName
              language={option.value}
              nativeName={option.nativeName}
              englishName={option.englishName}
            />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
