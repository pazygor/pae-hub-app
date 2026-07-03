import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from '@/components/ui/command';
import { Ship, Siren } from 'lucide-react';
import { NAV_CONFIG } from '@/lib/nav-config';

// Itens de navegação derivados da fonte única (nav-config).
const NAV_ITEMS = NAV_CONFIG;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (view: string) => void;
  onOpenSituationRoom: (id: string) => void;
}

export function GlobalSearch({ open, onOpenChange, onNavigate, onOpenSituationRoom }: Props) {
  const { data } = useAuth();

  const occurrences = useMemo(() =>
    data.occurrences.map(o => ({
      ...o,
      terminalName: data.terminals.find(t => t.id === o.terminalId)?.name || '',
    })),
    [data.occurrences, data.terminals]
  );

  const select = (view: string) => {
    onNavigate(view);
    onOpenChange(false);
  };

  const openOcc = (id: string) => {
    onOpenSituationRoom(id);
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar módulos, ocorrências, terminais..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        <CommandGroup heading="Navegação">
          {NAV_ITEMS.map(item => (
            <CommandItem key={item.id} onSelect={() => select(item.id)} className="gap-2">
              <item.icon size={16} className="text-muted-foreground shrink-0" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {occurrences.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Ocorrências">
              {occurrences.map(o => (
                <CommandItem key={o.id} onSelect={() => openOcc(o.id)} className="gap-2">
                  <Siren size={16} className={`shrink-0 ${o.status === 'emergência ativa' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm truncate">{o.incNumber} — {o.description}</span>
                    <span className="text-[10px] text-muted-foreground">{o.terminalName} · {o.status}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {data.terminals.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Terminais">
              {data.terminals.map(t => (
                <CommandItem key={t.id} onSelect={() => select('terminals')} className="gap-2">
                  <Ship size={16} className="text-muted-foreground shrink-0" />
                  <span>{t.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
