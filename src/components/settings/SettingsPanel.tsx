import { useEffect } from 'react';
import { Cloud, HardDrive, Settings2, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ThemeSelector } from './ThemeSelector';
import { AiSettingsDialog } from './AiSettingsDialog';
import { useAiSettingsStore } from '@/stores/aiSettingsStore';
import { TIER_ORDER } from '@/services/settings';
import { cn } from '@/lib/utils';

/** One-line summary of where generation happens, plus anything that's broken. */
function AiSummary() {
  const settings = useAiSettingsStore((state) => state.settings);
  const isLoading = useAiSettingsStore((state) => state.isLoading);
  const error = useAiSettingsStore((state) => state.error);
  const load = useAiSettingsStore((state) => state.load);

  useEffect(() => {
    if (!settings) void load();
  }, [settings, load]);

  if (isLoading && !settings) {
    return (
      <div className="flex items-center gap-2 text-xs text-academia-text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
      </div>
    );
  }

  if (!settings) {
    return (
      <p className="text-xs text-academia-error">
        {error?.message ?? 'Could not reach the Ex Libris server.'}
      </p>
    );
  }

  const isOllama = settings.provider === 'ollama';
  const Icon = isOllama ? HardDrive : Cloud;
  const assigned = isOllama ? settings.ollama.tiers : settings.anthropic.tiers;
  const routing = settings.routing;

  const label = (model: string) =>
    isOllama
      ? model || '—'
      : settings.anthropic.models.find((entry) => entry.id === model)?.label ?? model ?? '—';

  // The ways to be "configured but unusable".
  const warning = isOllama
    ? !assigned.default
      ? 'No local model assigned to the Default tier.'
      : null
    : !settings.anthropic.hasKey
      ? 'No API key set — chat and refine will fail until you add one.'
      : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-academia-accent shrink-0" />
        <div className="min-w-0">
          <p className="text-sm text-academia-text-primary">
            {isOllama ? 'Ollama (local)' : 'Anthropic (Claude)'}
          </p>
          <p className="text-[11px] text-academia-text-muted truncate">
            {routing.mode === 'auto'
              ? 'automatic routing'
              : `pinned to ${routing.fixedTier}`}
            {!isOllama && settings.anthropic.hasKey && ` · key ${settings.anthropic.keyHint}`}
          </p>
        </div>
      </div>
      <dl className="space-y-0.5">
        {TIER_ORDER.map((tier) => (
          <div key={tier} className="flex items-baseline gap-2 text-[11px]">
            <dt className="w-14 shrink-0 capitalize text-academia-text-muted">{tier}</dt>
            <dd
              className={cn(
                'truncate',
                assigned[tier] ? 'text-academia-text-secondary' : 'text-academia-text-muted/60'
              )}
            >
              {assigned[tier] ? label(assigned[tier]) : 'not assigned'}
            </dd>
          </div>
        ))}
      </dl>

      {warning && (
        <p className="flex items-start gap-1.5 text-[11px] text-academia-error">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
          {warning}
        </p>
      )}
    </div>
  );
}

/** The Settings tab: AI provider first, appearance below. */
export function SettingsPanel() {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-academia-border">
        <h2 className="font-display text-lg text-academia-text-primary">Settings</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <section className="space-y-3">
          <h3 className="text-xs uppercase tracking-wide text-academia-text-muted">
            AI provider
          </h3>
          <div className="rounded-lg border border-academia-border bg-academia-bg-tertiary/40 p-3 space-y-3">
            <AiSummary />
            <AiSettingsDialog>
              <Button variant="secondary" size="sm" className="w-full gap-2">
                <Settings2 className="h-3.5 w-3.5" />
                Configure provider
              </Button>
            </AiSettingsDialog>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs uppercase tracking-wide text-academia-text-muted">Appearance</h3>
          <ThemeSelector />
        </section>
      </div>
    </div>
  );
}
