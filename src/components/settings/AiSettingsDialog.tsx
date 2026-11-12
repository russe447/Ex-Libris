import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  X,
  Loader2,
  Cloud,
  HardDrive,
  Check,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAiSettingsStore, AiProblem } from '@/stores/aiSettingsStore';
import { AiProvider, AiTier, TierInfo, TierMap, TIER_ORDER } from '@/services/settings';
import { cn } from '@/lib/utils';
import { onUiCommand } from '@/lib/uiBus';

function Problem({ problem }: { problem: AiProblem }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-academia-error/40 bg-academia-error/10 px-3 py-2">
      <AlertTriangle className="h-4 w-4 text-academia-error shrink-0 mt-0.5" />
      <div className="min-w-0 text-xs">
        <p className="text-academia-error">{problem.message}</p>
        {problem.hint && <p className="text-academia-text-muted mt-0.5">{problem.hint}</p>}
      </div>
    </div>
  );
}

function ProviderCard({
  id,
  title,
  subtitle,
  icon: Icon,
  isActive,
  onSelect,
}: {
  id: AiProvider;
  title: string;
  subtitle: string;
  icon: typeof Cloud;
  isActive: boolean;
  onSelect: (id: AiProvider) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={cn(
        'flex-1 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors',
        isActive
          ? 'border-academia-accent/50 bg-academia-bg-tertiary'
          : 'border-academia-border hover:bg-academia-bg-tertiary/60'
      )}
    >
      <Icon
        className={cn('h-4 w-4 mt-0.5 shrink-0', isActive ? 'text-academia-accent' : 'text-academia-text-muted')}
      />
      <span className="min-w-0">
        <span
          className={cn('block text-sm', isActive ? 'text-academia-accent' : 'text-academia-text-primary')}
        >
          {title}
        </span>
        <span className="block text-[11px] text-academia-text-muted">{subtitle}</span>
      </span>
    </button>
  );
}

/**
 * Quick / Default / Deep, each with its own model for this provider.
 *
 * Rendering the control is the caller's job: Claude picks from a fixed catalogue,
 * Ollama from whatever happens to be pulled.
 */
function TierAssignments({
  tiers,
  assigned,
  onAssign,
  renderControl,
}: {
  tiers: TierInfo[];
  assigned: TierMap;
  onAssign: (tier: AiTier, model: string) => void;
  renderControl: (
    tier: AiTier,
    value: string,
    onChange: (value: string) => void
  ) => React.ReactNode;
}) {
  const ordered = TIER_ORDER.map(
    (id) => tiers.find((tier) => tier.id === id) ?? { id, label: id, description: '' }
  );

  return (
    <div className="space-y-2.5">
      <label className="block text-xs text-academia-text-muted">Model for each job tier</label>
      {ordered.map((tier) => (
        <div key={tier.id} className="grid grid-cols-[5.5rem,1fr] gap-2 items-start">
          <div className="pt-1.5">
            <span className="block text-xs text-academia-text-primary">{tier.label}</span>
          </div>
          <div className="min-w-0">
            {renderControl(tier.id, assigned[tier.id] ?? '', (value) => onAssign(tier.id, value))}
            <p className="text-[10px] text-academia-text-muted mt-0.5">{tier.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Everything about where the prose gets generated. Lives in a dialog because
 * the settings sidebar is 384px wide and this needs room to explain itself.
 */
export function AiSettingsDialog({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  // Set by the desktop menu's "Test Connection": open, then run one test.
  const [pendingTest, setPendingTest] = useState(false);
  const {
    settings,
    isLoading,
    isSaving,
    error,
    ollamaModels,
    isLoadingModels,
    ollamaError,
    isTesting,
    testResult,
    testError,
    load,
    update,
    setProvider,
    saveKey,
    removeKey,
    refreshOllamaModels,
    test,
    clearFeedback,
  } = useAiSettingsStore();

  const [keyDraft, setKeyDraft] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [baseUrlDraft, setBaseUrlDraft] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    clearFeedback();
    setKeyDraft('');
    setShowKey(false);
    void load();
  }, [isOpen, load, clearFeedback]);

  // Desktop menu AI ▸ … — both land here so results are visible in context.
  useEffect(() => onUiCommand('open-ai-settings', () => setIsOpen(true)), []);
  useEffect(
    () =>
      onUiCommand('ai-test-connection', () => {
        setIsOpen(true);
        setPendingTest(true);
      }),
    []
  );
  // Runs after the open effect above, so its clearFeedback() can't erase the
  // result we're about to produce.
  useEffect(() => {
    if (!isOpen || !pendingTest) return;
    setPendingTest(false);
    void test();
  }, [isOpen, pendingTest, test]);

  useEffect(() => {
    if (settings) setBaseUrlDraft(settings.ollama.baseUrl);
  }, [settings]);

  // Only probe Ollama when the author is actually looking at that section.
  useEffect(() => {
    if (isOpen && settings?.provider === 'ollama') void refreshOllamaModels(settings.ollama.baseUrl);
  }, [isOpen, settings?.provider, settings?.ollama.baseUrl, refreshOllamaModels]);

  const provider = settings?.provider ?? 'anthropic';

  const handleSaveKey = async () => {
    const trimmed = keyDraft.trim();
    if (!trimmed) return;
    const ok = await saveKey(trimmed);
    if (ok) {
      setKeyDraft('');
      setShowKey(false);
    }
  };

  const handleBaseUrlCommit = async () => {
    const trimmed = baseUrlDraft.trim();
    if (!settings || trimmed === settings.ollama.baseUrl) return;
    await update({ ollamaBaseUrl: trimmed });
    await refreshOllamaModels(trimmed);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 w-[min(34rem,calc(100vw-2rem))] max-h-[calc(100vh-4rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-academia-border bg-academia-bg-secondary shadow-2xl focus:outline-none">
          <div className="flex items-start justify-between p-5 border-b border-academia-border sticky top-0 bg-academia-bg-secondary z-10">
            <div>
              <Dialog.Title className="font-display text-lg text-academia-text-primary">
                AI provider
              </Dialog.Title>
              <Dialog.Description className="text-xs text-academia-text-muted mt-1">
                Chat and Refine both use this. Your key is stored encrypted on the Ex Libris
                server, never in the browser.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="p-1 rounded text-academia-text-muted hover:text-academia-text-primary" title="Close">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {isLoading || !settings ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-academia-text-muted" />
            </div>
          ) : (
            <div className="p-5 space-y-5">
              {error && <Problem problem={error} />}

              <div className="flex gap-2">
                <ProviderCard
                  id="anthropic"
                  title="Anthropic"
                  subtitle="Claude, via the hosted API"
                  icon={Cloud}
                  isActive={provider === 'anthropic'}
                  onSelect={(id) => void setProvider(id)}
                />
                <ProviderCard
                  id="ollama"
                  title="Ollama"
                  subtitle="Local models on this machine"
                  icon={HardDrive}
                  isActive={provider === 'ollama'}
                  onSelect={(id) => void setProvider(id)}
                />
              </div>

              {provider === 'anthropic' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-academia-text-muted mb-1.5">API key</label>
                    {settings.anthropic.hasKey && (
                      <div className="flex items-center justify-between gap-2 mb-2 rounded-md border border-academia-border bg-academia-bg-tertiary/50 px-3 py-2">
                        <span className="text-xs min-w-0">
                          <span className="text-academia-success">Key stored</span>
                          <span className="text-academia-text-muted">
                            {' '}
                            — {settings.anthropic.keyHint}
                            {settings.anthropic.keySource === 'env' && ' (from ANTHROPIC_API_KEY)'}
                          </span>
                        </span>
                        {settings.anthropic.keySource === 'settings' && (
                          <button
                            onClick={() => void removeKey()}
                            disabled={isSaving}
                            className="p-1 rounded text-academia-text-muted hover:text-academia-error shrink-0"
                            title="Remove the stored key"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showKey ? 'text' : 'password'}
                          value={keyDraft}
                          autoComplete="off"
                          spellCheck={false}
                          placeholder={settings.anthropic.hasKey ? 'Replace key…' : 'sk-ant-…'}
                          onChange={(event) => setKeyDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              void handleSaveKey();
                            }
                          }}
                          className="h-9 pr-8 text-sm font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey((value) => !value)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-academia-text-muted hover:text-academia-text-primary"
                          title={showKey ? 'Hide' : 'Show while typing'}
                        >
                          {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      <Button onClick={() => void handleSaveKey()} disabled={!keyDraft.trim() || isSaving}>
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                      </Button>
                    </div>
                    <p className="text-[11px] text-academia-text-muted mt-1.5">
                      Sent once to your local server, encrypted there, and never returned.{' '}
                      <a
                        href="https://console.anthropic.com/settings/keys"
                        target="_blank"
                        rel="noreferrer"
                        className="text-academia-accent hover:underline inline-flex items-center gap-0.5"
                      >
                        Get a key <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                  </div>

                  <TierAssignments
                    tiers={settings.tiers}
                    assigned={settings.anthropic.tiers}
                    onAssign={(tier, model) => void update({ anthropicTiers: { [tier]: model } })}
                    renderControl={(_tier, value, onChange) => (
                      <select
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                        className="w-full h-8 rounded-md border border-academia-border bg-academia-bg-tertiary px-2 text-xs text-academia-text-primary"
                      >
                        {settings.anthropic.models.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.label}
                            {model.note ? ` — ${model.note}` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-academia-text-muted mb-1.5">
                      Ollama server URL
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={baseUrlDraft}
                        spellCheck={false}
                        placeholder="http://127.0.0.1:11434"
                        onChange={(event) => setBaseUrlDraft(event.target.value)}
                        onBlur={() => void handleBaseUrlCommit()}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void handleBaseUrlCommit();
                          }
                        }}
                        className="h-9 text-sm font-mono flex-1"
                      />
                      <Button
                        variant="secondary"
                        onClick={() => void refreshOllamaModels(baseUrlDraft.trim())}
                        disabled={isLoadingModels}
                        className="gap-1.5"
                        title="Re-check which models are installed"
                      >
                        {isLoadingModels ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        Refresh
                      </Button>
                    </div>
                  </div>

                  {ollamaError ? (
                    <Problem problem={ollamaError} />
                  ) : (
                    <div>
                      <label className="block text-xs text-academia-text-muted mb-1.5">
                        Installed models: {ollamaModels.length}
                      </label>
                      {isLoadingModels ? (
                        <div className="flex items-center gap-2 text-xs text-academia-text-muted py-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Looking for models…
                        </div>
                      ) : ollamaModels.length === 0 ? (
                        <p className="text-xs text-academia-text-muted py-2">
                          Ollama is reachable but has no models. Pull one first, e.g.{' '}
                          <code className="text-academia-accent">ollama pull llama3.1:8b</code>.
                        </p>
                      ) : (
                        <TierAssignments
                          tiers={settings.tiers}
                          assigned={settings.ollama.tiers}
                          onAssign={(tier, model) => void update({ ollamaTiers: { [tier]: model } })}
                          renderControl={(_tier, value, onChange) => (
                            <select
                              value={value}
                              onChange={(event) => onChange(event.target.value)}
                              className="w-full h-8 rounded-md border border-academia-border bg-academia-bg-tertiary px-2 text-xs font-mono text-academia-text-primary"
                            >
                              <option value="">— not assigned —</option>
                              {ollamaModels.map((model) => (
                                <option key={model.name} value={model.name}>
                                  {model.name}
                                  {model.parameterSize ? ` (${model.parameterSize})` : ''}
                                </option>
                              ))}
                              {/* A model assigned earlier but since removed must
                                  stay visible, or the UI would silently "fix" it. */}
                              {value && !ollamaModels.some((model) => model.name === value) && (
                                <option value={value}>{value} — not installed</option>
                              )}
                            </select>
                          )}
                        />
                      )}
                    </div>
                  )}

                  <p className="text-[11px] text-academia-text-muted">
                    Local models never leave this machine. Expect slower responses and shorter
                    usable context than Claude — a 7–8B model is a reasonable starting point.
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-academia-border space-y-3">
                <div>
                  <label className="block text-xs text-academia-text-muted mb-1.5">Routing</label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() =>
                        void update({ routing: { mode: 'auto', fixedTier: settings.routing.fixedTier } })
                      }
                      className={cn(
                        'px-2.5 py-1 rounded-full border text-xs transition-colors',
                        settings.routing.mode === 'auto'
                          ? 'border-academia-accent/50 bg-academia-accent/10 text-academia-accent'
                          : 'border-academia-border text-academia-text-muted hover:text-academia-text-primary'
                      )}
                      title="Pick a tier per request, from context size, selection length, and what you ask for"
                    >
                      Automatic
                    </button>
                    {TIER_ORDER.map((tier) => {
                      const isActive =
                        settings.routing.mode === 'fixed' && settings.routing.fixedTier === tier;
                      return (
                        <button
                          key={tier}
                          onClick={() => void update({ routing: { mode: 'fixed', fixedTier: tier } })}
                          className={cn(
                            'px-2.5 py-1 rounded-full border text-xs capitalize transition-colors',
                            isActive
                              ? 'border-academia-accent/50 bg-academia-accent/10 text-academia-accent'
                              : 'border-academia-border text-academia-text-muted hover:text-academia-text-primary'
                          )}
                          title={`Always use the ${tier} tier`}
                        >
                          Always {tier}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-academia-text-muted mt-1.5">
                    Automatic sends short refines and light questions to Quick, routine work to
                    Default, and full-novel or outline context, long selections, and explicit
                    requests for a stronger model to Deep.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-academia-text-muted">Test a tier:</span>
                  {TIER_ORDER.map((tier) => (
                    <Button
                      key={tier}
                      variant="secondary"
                      size="sm"
                      onClick={() => void test({ tier })}
                      disabled={isTesting}
                      className="gap-1.5 capitalize"
                    >
                      {isTesting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      {tier}
                    </Button>
                  ))}
                </div>
                {testResult && (
                  <div className="flex items-start gap-2 rounded-md border border-academia-success/40 bg-academia-success/10 px-3 py-2">
                    <Check className="h-4 w-4 text-academia-success shrink-0 mt-0.5" />
                    <p className="text-xs text-academia-text-secondary">{testResult.detail}</p>
                  </div>
                )}
                {testError && <Problem problem={testError} />}
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
