import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { exportarAuditLogs, listarAuditLogs, type AuditLogFilters } from '../../api/auditLog.api.js';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Pagination,
  ResponsiveFilters,
  SearchInput,
  Select,
  Skeleton,
  useToast,
} from '../../components/ui/index.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import type { AuditLogDTO } from '../../types/auditLog.types.js';
import styles from './AuditoriaTab.module.css';

const EVENT_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: 'Login bem-sucedido',
  LOGIN_FAILURE: 'Tentativa de login falhou',
  LOGOUT: 'Logout',
  TOKEN_REUSE_DETECTED: 'Reuso de token detectado (possível roubo de sessão)',
  OS_CREATED: 'OS criada',
  OS_UPDATED: 'OS atualizada',
  OS_STATUS_CHANGED: 'Status da OS alterado',
  OS_DELETED: 'OS excluída',
  OS_DUPLICATED: 'OS duplicada',
  OS_PRODUCT_ADDED: 'Produto adicionado à OS',
  OS_PRODUCT_REMOVED: 'Produto removido da OS',
  OS_PRODUCT_RESTORED: 'Produto restaurado na OS',
  OS_PRODUCT_UPDATED: 'Produto atualizado na OS',
  OS_SERVICE_ADDED: 'Serviço adicionado à OS',
  OS_SERVICE_REMOVED: 'Serviço removido da OS',
  OS_SERVICE_RESTORED: 'Serviço restaurado na OS',
  OS_SERVICE_UPDATED: 'Serviço atualizado na OS',
  CLIENTE_CREATED: 'Cliente criado', CLIENTE_UPDATED: 'Cliente atualizado',
  VEICULO_CREATED: 'Veículo criado', VEICULO_UPDATED: 'Veículo atualizado',
  SETTINGS_FIREBIRD_UPDATED: 'Firebird atualizado', SETTINGS_SMTP_UPDATED: 'E-mail atualizado',
  SETTINGS_GERAL_UPDATED: 'Configurações gerais atualizadas',
  SETTINGS_INTEGRACOES_UPDATED: 'Integrações atualizadas',
  CLIENTE_DELETED: 'Cliente excluído', VEICULO_DELETED: 'Veículo excluído',
  BILLING_COBRANCA_CREATED: 'Boleto anexado', BILLING_COBRANCA_SENT: 'Boleto enviado por e-mail', BILLING_COBRANCA_REMOVED: 'Boleto removido', BILLING_COBRANCA_CONFIG: 'E-mail de cobrança configurado',
  LICENSE_UPDATED: 'Limite de licenças alterado', BILLING_CONTROL: 'Controle manual da assinatura',
  BILLING_UPDATED: 'Dados da assinatura atualizados', BILLING_PAYMENT_ADDED: 'Pagamento da mensalidade registrado', BILLING_PAYMENT_REMOVED: 'Pagamento da mensalidade removido',
  SESSION_REPLACED: 'Sessão anterior derrubada por novo login', SESSION_FORCE_LOGOUT: 'Sessão encerrada', SESSION_FORCE_LOGOUT_ALL: 'Todas as sessões encerradas',
  USER_CREATED: 'Usuário criado', USER_UPDATED: 'Usuário atualizado', USER_DELETED: 'Usuário excluído',
  USER_INVITE_RESENT: 'Convite reenviado',
  OS_IMAGE_ADDED: 'Imagem adicionada à OS', OS_IMAGE_REMOVED: 'Imagem removida da OS',
  PASSWORD_RESET_REQUESTED: 'Redefinição de senha solicitada',
  PASSWORD_RESET_COMPLETED: 'Senha redefinida', PASSWORD_CHANGED: 'Senha alterada',
  PROFILE_UPDATED: 'Perfil atualizado', PROFILE_PHOTO_UPDATED: 'Foto de perfil atualizada',
};

function eventCategory(event: string): string {
  if (['LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT', 'TOKEN_REUSE_DETECTED', 'PASSWORD_RESET_REQUESTED',
    'PASSWORD_RESET_COMPLETED', 'PASSWORD_CHANGED', 'PROFILE_UPDATED', 'PROFILE_PHOTO_UPDATED'].includes(event)) return 'AUTH';
  return event.split('_')[0] ?? '';
}

function EventFilter({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const labelId = useId();
  const listId = useId();

  useEffect(() => {
    if (open) optionRefs.current[Math.max(0, options.findIndex((option) => option.value === value))]?.focus();
  }, [open, options, value]);

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  function choose(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function optionKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
      optionRefs.current[next]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      optionRefs.current[event.key === 'Home' ? 0 : options.length - 1]?.focus();
    }
  }

  return (
    <div
      className={styles.eventPicker}
      ref={wrapperRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <span id={labelId} className={styles.filterLabel}>Evento</span>
      <button
        ref={triggerRef}
        type="button"
        className={styles.eventTrigger}
        aria-labelledby={labelId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{options.find((option) => option.value === value)?.label ?? 'Todos'}</span>
        <span className={styles.chevron} aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div id={listId} role="listbox" className={styles.eventList} aria-label="Selecionar evento">
          {options.map((option, index) => (
            <button
              key={option.value}
              ref={(element) => { optionRefs.current[index] = element; }}
              type="button"
              role="option"
              aria-selected={option.value === value}
              tabIndex={option.value === value ? 0 : -1}
              className={styles.eventOption}
              onClick={() => choose(option.value)}
              onKeyDown={(event) => optionKeyDown(event, index)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Trilha de auditoria (seção 24 do briefing) — só acessível com SYSTEM_SETTINGS (rota já protege no backend). */
export function AuditoriaTab() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selecionado, setSelecionado] = useState<AuditLogDTO | null>(null);
  const [filtros, setFiltros] = useState<AuditLogFilters>({});
  const [busca, setBusca] = useState('');
  const buscaDebounced = useDebouncedValue(busca, 300);
  const [exportando, setExportando] = useState(false);
  const { showToast } = useToast();

  function updateFiltro(key: keyof AuditLogFilters, value: string) {
    setPage(1);
    setFiltros(current => ({ ...current, [key]: value || undefined, ...(key === 'categoria' ? { event: undefined } : {}) }));
  }

  function limparFiltros() {
    setPage(1);
    setFiltros({});
    setBusca('');
  }

  const activeCount = Object.values(filtros).filter(Boolean).length;

  async function exportar() {
    setExportando(true);
    try { await exportarAuditLogs({ ...filtros, busca: buscaDebounced || undefined }); }
    catch (error) { showToast(error instanceof Error ? error.message : 'Falha ao exportar.', 'danger'); }
    finally { setExportando(false); }
  }

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['audit-logs', page, limit, filtros, buscaDebounced],
    queryFn: () => listarAuditLogs({ ...filtros, busca: buscaDebounced || undefined, page, limit }),
  });

  function handleLimitChange(novoLimit: number) {
    setLimit(novoLimit);
    setPage(1);
  }

  return (
    <div className={styles.page}>
      <section className={styles.filterCard}>
        <h2>Auditoria</h2>
        <p>Rastreie ações do sistema. Busca livre cobre usuário, evento e ID; não cobre dados alterados.</p>
        <div className={styles.filters}>
          <div className={styles.search}>
            <SearchInput
              placeholder="Buscar por usuário, evento ou ID"
              value={busca}
              onChange={e => { setBusca(e.target.value); setPage(1); }}
            />
          </div>
          <ResponsiveFilters activeCount={activeCount} onClear={limparFiltros}>
            <div className={styles.date}><Input label="Data inicial" type="date" value={filtros.dataInicial ?? ''} onChange={e => updateFiltro('dataInicial', e.target.value)} /></div>
            <div className={styles.date}><Input label="Data final" type="date" value={filtros.dataFinal ?? ''} onChange={e => updateFiltro('dataFinal', e.target.value)} /></div>
            <div className={styles.narrow}><Select label="Entidade" value={filtros.entityType ?? ''} onChange={e => updateFiltro('entityType', e.target.value)} options={[
              { value: '', label: 'Todas' }, ...['OS', 'USER', 'CLIENTE', 'VEICULO', 'SETTINGS', 'SESSION'].map(value => ({ value, label: value }))
            ]} /></div>
            <div className={styles.narrow}><Select label="Categoria" value={filtros.categoria ?? ''} onChange={e => updateFiltro('categoria', e.target.value)} options={[
              { value: '', label: 'Todas' }, ...['AUTH', 'OS', 'USER', 'CLIENTE', 'VEICULO', 'SETTINGS', 'SESSION'].map(value => ({ value, label: value }))
            ]} /></div>
            <div className={styles.event}>
              <EventFilter
                value={filtros.event ?? ''}
                onChange={value => updateFiltro('event', value)}
                options={[
                  { value: '', label: 'Todos' }, ...Object.entries(EVENT_LABELS)
                    .filter(([value]) => !filtros.categoria || eventCategory(value) === filtros.categoria)
                    .map(([value, label]) => ({ value, label }))
                ]}
              />
            </div>
            <div className={styles.user}><Input label="Usuário" value={filtros.usuario ?? ''} onChange={e => updateFiltro('usuario', e.target.value)} /></div>
          </ResponsiveFilters>
          <Button className={styles.export} variant="secondary" loading={exportando} onClick={exportar}>Exportar Excel</Button>
        </div>
      </section>

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <Skeleton height={56} />
          <Skeleton height={56} />
          <Skeleton height={56} />
        </div>
      )}

      {isError && <ErrorState error={error} />}

      {!isLoading && !isError && data?.items.length === 0 && (
        <EmptyState
          title={activeCount > 0 || busca ? 'Nenhum evento encontrado' : 'Nenhum evento registrado ainda.'}
          description={activeCount > 0 || busca ? 'Não encontramos resultados com os filtros atuais.' : undefined}
          action={(activeCount > 0 || busca) ? <Button variant="secondary" onClick={limparFiltros}>Limpar filtros</Button> : undefined}
        />
      )}

      <div className={styles.logList}>
        {data?.items.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setSelecionado(entry)}
            style={{ all: 'unset', cursor: 'pointer', display: 'block' }}
          >
            <Card elevated className={styles.entryCard} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{EVENT_LABELS[entry.event] ?? entry.event}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {entry.userName ?? 'Sistema'}
                  {entry.entityType && ` · ${entry.entityType} ${entry.entityId?.slice(0, 8)}`}
                </div>
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                {new Date(entry.createdAt).toLocaleString('pt-BR')}
              </div>
            </Card>
          </button>
        ))}
      </div>

      {data && (
        <div className={styles.pagination}>
          <Pagination page={data.page} limit={data.limit} total={data.total} onPageChange={setPage} onLimitChange={handleLimitChange} />
        </div>
      )}

      <Modal
        open={selecionado !== null}
        title={selecionado ? (EVENT_LABELS[selecionado.event] ?? selecionado.event) : ''}
        onClose={() => setSelecionado(null)}
      >
        {selecionado && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <Row label="Usuário" value={selecionado.userName ?? 'Sistema'} />
            <Row label="Data/hora" value={new Date(selecionado.createdAt).toLocaleString('pt-BR')} />
            {selecionado.entityType && <Row label="Entidade" value={`${selecionado.entityType} ${selecionado.entityId ?? ''}`} />}
            {selecionado.ip && <Row label="IP" value={selecionado.ip} />}
            {selecionado.userAgent && <Row label="Dispositivo" value={selecionado.userAgent} />}
            {selecionado.changes !== null && selecionado.changes !== undefined && (
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
                  Dados alterados
                </div>
                <pre
                  style={{
                    background: 'var(--color-neutral-surface)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 'var(--space-3)',
                    fontSize: 'var(--font-size-xs)',
                    overflowX: 'auto',
                    margin: 0,
                  }}
                >
                  {JSON.stringify(selecionado.changes, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{label}</div>
      <div style={{ fontWeight: 500 }}>{value}</div>
    </div>
  );
}
