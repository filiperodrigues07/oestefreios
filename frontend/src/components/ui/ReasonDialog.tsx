import { useId, useState } from 'react';
import { Button } from './Button.js';
import { Modal } from './Modal.js';
import styles from './ReasonDialog.module.css';

interface ReasonDialogProps {
  open: boolean;
  title: string;
  description: string;
  /** Rótulo do campo de texto (ex.: "Motivo da exclusão"). */
  reasonLabel?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  minLength?: number;
  maxLength?: number;
  loading?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

/** Confirmação destrutiva que exige uma justificativa digitada — o texto vai pra trilha de auditoria. */
export function ReasonDialog(props: ReasonDialogProps) {
  return props.open ? <ReasonDialogContent {...props} /> : null;
}

function ReasonDialogContent({
  open,
  title,
  description,
  reasonLabel = 'Motivo',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  minLength = 5,
  maxLength = 500,
  loading,
  onConfirm,
  onCancel,
}: ReasonDialogProps) {
  const [reason, setReason] = useState('');
  const fieldId = useId();
  const trimmed = reason.trim();
  const valid = trimmed.length >= minLength;

  return (
    <Modal
      open={open}
      centerOnMobile
      title={title}
      onClose={() => {
        if (!loading) onCancel();
      }}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={() => onConfirm(trimmed)} loading={loading} disabled={!valid}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        <p className={styles.description}>{description}</p>
        <label htmlFor={fieldId} className={styles.label}>
          {reasonLabel}
          <span className={styles.required} aria-hidden="true"> *</span>
        </label>
        <textarea
          id={fieldId}
          className={styles.textarea}
          value={reason}
          maxLength={maxLength}
          rows={3}
          required
          autoFocus
          disabled={loading}
          aria-describedby={`${fieldId}-hint`}
          onChange={(event) => setReason(event.target.value)}
        />
        <p id={`${fieldId}-hint`} className={styles.hint}>
          {valid ? 'Este motivo ficará registrado na auditoria.' : `Informe pelo menos ${minLength} caracteres.`}
          <span className={styles.counter}>{reason.length}/{maxLength}</span>
        </p>
      </div>
    </Modal>
  );
}
