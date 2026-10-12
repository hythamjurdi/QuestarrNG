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
  className,
  disabled = false,
  ...rest
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

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
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          {...rest}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          <div className="flex flex-wrap gap-1 text-left">
            {selected.length > 0 ? (
              <span>{selected.length} selected</span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      {selectedOptions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="Selected items">
          {selectedOptions.map((option) => (
            <Badge variant="secondary" key={option.value} className="flex items-center">
              {option.label}
              <button
                type="button"
                disabled={disabled}
                onClick={() => handleRemove(option.value)}
                aria-label={`Remove ${option.label}`}
                className="ml-1 rounded hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <X className="h-3 w-3 cursor-pointer" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
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
                    {option.label}
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
