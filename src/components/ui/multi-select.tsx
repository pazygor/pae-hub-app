import { useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

export interface MultiSelectOption {
  value: string;
  label: string;
  /** Texto curto à direita (ex.: nível do risco). */
  hint?: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Multi-select combobox (Popover + Command): chips das seleções no trigger, busca
 * e checkmarks na lista. Reutilizável em qualquer form.
 */
export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Selecione...',
  searchPlaceholder = 'Buscar...',
  emptyText = 'Nenhuma opção.',
  disabled,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);

  const selectedOptions = options.filter(o => selected.includes(o.value));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            'flex min-h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
            className,
          )}
        >
          <span className="flex flex-1 flex-wrap items-center gap-1 min-w-0">
            {selectedOptions.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              selectedOptions.map(o => (
                <Badge key={o.value} variant="secondary" className="gap-1 pr-1 font-normal">
                  {o.label}
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={e => { e.stopPropagation(); toggle(o.value); }}
                    className="ml-0.5 rounded-sm hover:bg-muted-foreground/20 cursor-pointer"
                  >
                    <X size={12} />
                  </span>
                </Badge>
              ))
            )}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map(o => {
                const isSelected = selected.includes(o.value);
                return (
                  <CommandItem key={o.value} value={`${o.label} ${o.value}`} onSelect={() => toggle(o.value)} className="cursor-pointer">
                    <Check className={cn('mr-2 h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                    <span className="flex-1">{o.label}</span>
                    {o.hint && <span className="ml-2 text-[10px] uppercase font-bold text-muted-foreground">{o.hint}</span>}
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
