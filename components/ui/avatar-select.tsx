"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { useCloseDetailsOnOutside } from "@/components/ui/use-close-details-on-outside";
import { cn } from "@/lib/utils";

export type AvatarSelectOption = {
  value: string;
  label: string;
  imageUrl?: string | null;
};

export function AvatarSelect({
  id,
  name,
  options,
  emptyLabel,
  defaultValue,
  value,
  onValueChange,
  triggerClassName,
  contentClassName,
  disabled,
}: {
  id?: string;
  name?: string;
  options: AvatarSelectOption[];
  emptyLabel: string;
  defaultValue?: string | null;
  value?: string | null;
  onValueChange?: (value: string) => void;
  triggerClassName?: string;
  contentClassName?: string;
  disabled?: boolean;
}) {
  const isControlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? "");
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  useCloseDetailsOnOutside(detailsRef);

  const currentValue = (isControlled ? value : uncontrolledValue) ?? "";
  const hasCurrentOption =
    currentValue === "" || options.some((option) => option.value === currentValue);
  const normalizedCurrentValue = hasCurrentOption ? currentValue : "";

  const selectedOption = useMemo(
    () => options.find((option) => option.value === normalizedCurrentValue) ?? null,
    [options, normalizedCurrentValue]
  );

  function selectValue(nextValue: string) {
    const normalizedValue = nextValue.trim();
    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = normalizedValue;
    }
    if (!isControlled) {
      setUncontrolledValue(normalizedValue);
    }
    onValueChange?.(normalizedValue);
    detailsRef.current?.removeAttribute("open");
  }

  useEffect(() => {
    if (isControlled) return;
    const form = hiddenInputRef.current?.form;
    if (!form) return;

    function handleReset() {
      setUncontrolledValue(defaultValue ?? "");
    }

    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  }, [defaultValue, isControlled]);

  return (
    <>
      {name ? (
        <input
          ref={hiddenInputRef}
          type="hidden"
          name={name}
          value={normalizedCurrentValue}
        />
      ) : null}
      <details ref={detailsRef} className="group relative [&[open]]:z-[9998]">
        <summary
          id={id}
          className={cn(
            "flex h-9 w-full list-none items-center gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs transition-colors [&::-webkit-details-marker]:hidden",
            disabled
              ? "pointer-events-none opacity-50"
              : "cursor-pointer hover:bg-muted/50",
            triggerClassName
          )}
        >
          {selectedOption ? (
            <EntityAvatar
              name={selectedOption.label}
              imageUrl={selectedOption.imageUrl}
              size="xs"
            />
          ) : null}
          <span className="min-w-0 flex-1 truncate">
            {selectedOption?.label ?? emptyLabel}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60 transition-transform group-open:rotate-180" />
        </summary>

        <div
          className={cn(
            "absolute left-0 right-0 z-[9999] mt-1 max-h-72 overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
            contentClassName
          )}
        >
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
              normalizedCurrentValue === "" ? "bg-accent text-accent-foreground" : ""
            )}
            onClick={() => selectValue("")}
          >
            <span className="min-w-0 flex-1 truncate">{emptyLabel}</span>
            {normalizedCurrentValue === "" ? <Check className="h-4 w-4 shrink-0" /> : null}
          </button>

          {options.map((option) => {
            const isSelected = normalizedCurrentValue === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                  isSelected ? "bg-accent text-accent-foreground" : ""
                )}
                onClick={() => selectValue(option.value)}
              >
                <EntityAvatar
                  name={option.label}
                  imageUrl={option.imageUrl}
                  size="xs"
                />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {isSelected ? <Check className="h-4 w-4 shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      </details>
    </>
  );
}
