import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  label: string;
  value: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
  searchPlaceholder?: string;
  lang?: string;
  dir?: "ltr" | "rtl";
  emptyLang?: string;
  emptyDir?: "ltr" | "rtl";
  searchLang?: string;
  searchDir?: "ltr" | "rtl";
  removeLabel?: (label: string) => string;
  removeLang?: string;
  removeDir?: "ltr" | "rtl";
  className?: string;
  disabled?: boolean;
  // Support additional HTML attributes like data-testid
  [key: string]: unknown;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select items...",
  emptyMessage = "No items found.",
  searchPlaceholder = "Search...",
  lang,
  dir,
  emptyLang = lang,
  emptyDir = dir,
  searchLang = lang,
  searchDir = dir,
  removeLabel = (label) => `Remove ${label}`,
  removeLang = lang,
  removeDir = dir,
  className,
  disabled = false,
  ...rest
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setSearchValue("");
    setOpen(nextOpen);
  };

  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleRemove = (value: string) => {
    onChange(selected.filter((item) => item !== value));
  };

  const selectedOptions = options.filter((option) => selected.includes(option.value));

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal={true}>
      <PopoverTrigger asChild>
        <Button
          {...rest}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
          lang={lang}
          dir={dir}
        >
          <div className="flex gap-1 flex-wrap">
            {selectedOptions.length > 0 ? (
              selectedOptions.map((option) => (
                <Badge variant="secondary" key={option.value} className="flex items-center">
                  <span lang="und" dir="auto">
                    {option.label}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(option.value);
                    }}
                    aria-label={removeLabel(option.label)}
                    className="ml-1 rounded hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
                    lang={removeLang}
                    dir={removeDir}
                  >
                    <X className="h-3 w-3 cursor-pointer" />
                  </button>
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground" lang={lang} dir={dir}>
                {placeholder}
              </span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        dir={dir}
      >
        <Command dir={searchDir}>
          <CommandInput
            placeholder={searchPlaceholder}
            lang={searchLang}
            dir={searchValue ? "auto" : searchDir}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty lang={emptyLang} dir={emptyDir}>
              {emptyMessage}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.value}`}
                    onSelect={() => handleToggle(option.value)}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")}
                    />
                    <span lang="und" dir="auto">
                      {option.label}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
