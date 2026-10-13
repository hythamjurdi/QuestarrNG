import { useEffect, useState } from "react";

interface PriorityInputProps {
  id: string;
  priority: number;
  onSave: (id: string, priority: number) => void;
}

function parsePriority(value: string, fallback: number): number {
  if (value.trim() === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/** An editable priority field that preserves an empty draft while the user is typing. */
export function PriorityInput({ id, priority, onSave }: PriorityInputProps) {
  const [value, setValue] = useState(String(priority));

  useEffect(() => {
    setValue(String(priority));
  }, [priority]);

  const save = (next: number) => {
    const clamped = Math.max(1, Math.min(100, next));
    if (clamped !== priority) onSave(id, clamped);
    setValue(String(clamped));
  };

  const currentValue = () => parsePriority(value, priority);

  return (
    <div className="flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold">
      <span className="text-muted-foreground">Priority</span>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground w-3.5 text-center leading-none"
        onClick={() => save(currentValue() - 1)}
        aria-label="Decrease priority"
      >
        −
      </button>
      <input
        type="number"
        min={1}
        max={100}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={(event) => save(parsePriority(event.target.value, priority))}
        onKeyDown={(event) => event.key === "Enter" && save(currentValue())}
        className="w-7 bg-transparent text-center outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        aria-label="Priority value"
      />
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground w-3.5 text-center leading-none"
        onClick={() => save(currentValue() + 1)}
        aria-label="Increase priority"
      >
        +
      </button>
    </div>
  );
}
