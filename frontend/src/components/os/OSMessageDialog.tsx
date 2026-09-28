import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getOsMessageHistory, getOsMessagePreview, revokeOsWhatsappConsent, sendOsMessage, type OsMessageChannel, type OsMessageType } from '../../api/os.api.js';
import { getUserErrorMessage } from '../../utils/errorPresentation.js';
import { hasPermission } from '../../store/authStore.js';
import { ClienteFormModal } from '../clientes/ClienteFormModal.js';
import { Button, Modal, Select, useToast } from '../ui/index.js';
import styles from './OSMessageDialog.module.css';

const OPTIONS: { value: OsMessageType; label: string }[] = [
  { value: 'aberta', label: 'OS aberta' },
  { value: 'aguardando_cliente', label: 'Aguardando retorno' },
  { value: 'aguardando_peca', label: 'Aguardando peças' },
  { value: 'pronta', label: 'OS pronta' },
  { value: 'resumo_financeiro', label: 'Resumo financeiro' },
];

function historyState(state: string, errorCode: string | null): string {
  if (state === 'accepted') return 'Enviado à integração';
  if (state !== 'failed') return 'Pendente';
  if (errorCode === 'CONSENT_REVOKED') return 'Cancelado: autorização revogada';
  if (errorCode === 'DELIVERY_UNCONFIRMED') return 'Sem confirmação: confira com o cliente antes de reenviar';
  if (errorCode === 'SMTP_NOT_CONFIGURED') return 'Falhou: e-mail não configurado';
  if (errorCode === 'WHATSAPP_NOT_CONFIGURED') return 'Falhou: WhatsApp não configurado';
  if (errorCode === 'WHATSAPP_AUTH_FAILED') return 'Falhou: chave do WhatsApp inválida';
  return 'Falhou: confira a conexão e tente novamente';
}

function formattedPreview(body: string) {
  return body.split(/(\*[^*\n]+\*)/g).map((part, index) =>
    part.startsWith('*') && part.endsWith('*') ? <strong key={index}>{part.slice(1, -1)}</strong> : part,
  );
}

export function OSMessageDialog({ id, clientCode, channel, defaultType, onClose }: { id: string; clientCode: string; channel: OsMessageChannel; defaultType: OsMessageType; onClose: () => void }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [type, setType] = useState<OsMessageType>(defaultType);
  const [consent, setConsent] = useState(false);
  const [attachPdf, setAttachPdf] = useState(false);
  const [editingClient, setEditingClient] = useState(false);
  const preview = useQuery({ queryKey: ['os', id, 'message-preview'], queryFn: () => getOsMessagePreview(id) });
  const history = useQuery({ queryKey: ['os', id, 'message-history'], queryFn: () => getOsMessageHistory(id) });
  const send = useMutation({
    mutationFn: () => sendOsMessage(id, channel, type, consent, channel === 'whatsapp' && attachPdf),
    onSuccess: () => {
      showToast(channel === 'whatsapp' ? attachPdf ? 'Mensagem e PDF enviados à integração do WhatsApp.' : 'Mensagem enviada à integração do WhatsApp.' : 'E-mail enviado.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['os', id, 'message-history'] });
      void queryClient.invalidateQueries({ queryKey: ['os', id, 'message-preview'] });
      onClose();
    },
  });
  const revoke = useMutation({
    mutationFn: () => revokeOsWhatsappConsent(id),
    onSuccess: () => {
      showToast('Autorização de WhatsApp revogada para este cliente.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['os', id, 'message-preview'] });
      void queryClient.invalidateQueries({ queryKey: ['os', id, 'message-history'] });
    },
  });
  const target = channel === 'whatsapp' ? preview.data?.whatsapp : preview.data?.email;
  const needsConsent = channel === 'whatsapp' && !preview.data?.whatsappConsent;
  const canSend = !!target && !!preview.data?.messages[type] && (!needsConsent || consent) && !send.isPending;

  return <><Modal open={!editingClient} title={channel === 'whatsapp' ? 'Enviar OS por WhatsApp' : 'Enviar OS por e-mail'} onClose={() => { if (!send.isPending) onClose(); }}
    footer={<><Button variant="secondary" onClick={onClose} disabled={send.isPending}>Cancelar</Button><Button onClick={() => send.mutate()} loading={send.isPending} disabled={!canSend}>Enviar</Button></>}>
    <div className={styles.body}>
      {preview.isLoading && <p>Carregando dados do cliente...</p>}
      {preview.isError && <p role="alert" className={styles.error}>{getUserErrorMessage(preview.error, 'Não foi possível preparar a mensagem.')}</p>}
      {preview.data && <>
        <p className={styles.target}><strong>Para:</strong> {target ?? 'Destinatário não disponível'}</p>
        {!target && <div role="alert" className={styles.blocked}>
          <strong>O que falta para enviar</strong>
          <p>{channel === 'whatsapp'
            ? preview.data.whatsappIssue === 'invalid'
              ? 'O campo Celular / WhatsApp do cliente contém um número inválido. Corrija para DDD + número, com 10 ou 11 dígitos.'
              : 'O campo Celular / WhatsApp do cliente está vazio. Cadastre DDD + número, com 10 ou 11 dígitos.'
            : 'Cadastre o E-mail NFe/NFSe ou o e-mail financeiro do cliente.'}</p>
          {hasPermission('OS_EDIT')
            ? <Button type="button" variant="secondary" size="sm" onClick={() => setEditingClient(true)}>Editar cadastro do cliente</Button>
            : <p>Peça a um usuário com permissão para editar clientes que atualize o cadastro.</p>}
        </div>}
        <Select label="Tipo de mensagem" value={type} options={OPTIONS.filter((item) => preview.data.messages[item.value]).map((item) => ({ value: item.value, label: item.label }))} onChange={(event) => setType(event.target.value as OsMessageType)} />
        <div className={styles.preview}><strong>Prévia</strong><p>{formattedPreview(preview.data.messages[type] ?? '')}</p></div>
        {channel === 'whatsapp' && <label className={styles.attachPdf}><input type="checkbox" checked={attachPdf} disabled={send.isPending} onChange={(event) => setAttachPdf(event.target.checked)} /><span><strong>Anexar PDF da OS</strong><small>O texto acima será a legenda do documento. O PDF só terá valores ao enviar o resumo financeiro.</small></span></label>}
        {channel === 'email' && <p className={styles.note}>O PDF da OS será anexado. O resumo financeiro só inclui valores se você tiver permissão.</p>}
        {needsConsent && target && <label className={styles.consent}><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>Confirmo que o cliente autorizou receber atualizações da oficina por WhatsApp neste número.</span></label>}
        {needsConsent && !consent && target && <p className={styles.requirement}>Para liberar o envio, confirme a autorização do cliente acima.</p>}
        {channel === 'whatsapp' && preview.data.whatsappConsent && <div className={styles.consentControl}><span>Cliente autorizou mensagens por WhatsApp.</span><Button variant="secondary" onClick={() => revoke.mutate()} loading={revoke.isPending} disabled={send.isPending}>Revogar autorização</Button></div>}
        {channel === 'whatsapp' && <p className={styles.note}>A integração confirma o recebimento do pedido de envio. Ela não garante que o cliente já recebeu a mensagem.</p>}
      </>}
      {send.isError && <p role="alert" className={styles.error}>{getUserErrorMessage(send.error, 'Não foi possível enviar. Confira a conexão e tente novamente.')}</p>}
      {revoke.isError && <p role="alert" className={styles.error}>{getUserErrorMessage(revoke.error, 'Não foi possível revogar a autorização. Tente novamente.')}</p>}
      <div className={styles.history}><h3>Últimos envios</h3>
        {history.data?.length ? <ul>{history.data.slice(0, 5).map((entry) => <li key={entry.id}>{new Date(entry.createdAt).toLocaleString('pt-BR')} · {entry.channel === 'whatsapp' ? 'WhatsApp' : 'E-mail'} · {historyState(entry.state, entry.errorCode)}</li>)}</ul> : <p>Nenhuma mensagem registrada nesta OS.</p>}
      </div>
    </div>
  </Modal>
    <ClienteFormModal open={editingClient} mode="edit" codigo={clientCode} onClose={() => setEditingClient(false)} onSaved={() => {
      void queryClient.invalidateQueries({ queryKey: ['cliente', clientCode] });
      void preview.refetch();
      setEditingClient(false);
    }} />
  </>;
}
