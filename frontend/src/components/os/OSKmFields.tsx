import { useId, type ReactNode } from 'react';
import { somenteDigitos } from '../../utils/veiculoFormatters.js';
import { RequiredMark } from '../ui/index.js';
import styles from './OSKmFields.module.css';
import { OSFieldInfo } from './OSFieldInfo.js';

interface Props {
  kmAtual: string;
  kmFinal: string;
  onKmAtualChange: (value: string) => void;
  onKmFinalChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  /** Botão na mesma linha dos campos no desktop (ex.: "Salvar KM"); no celular vai pra baixo, largura cheia. */
  acao?: ReactNode;
}

export function parseKm(value: string): number | undefined {
  return /^\d{1,8}$/.test(value.trim()) ? Number(value.trim()) : undefined;
}

export const formatarKm = (km: number) => `${km.toLocaleString('pt-BR')} km`;

export function OSKmFields({ kmAtual, kmFinal, onKmAtualChange, onKmFinalChange, disabled, required = true, acao }: Props) {
  const id = useId();
  const inicial = parseKm(kmAtual);
  const final = parseKm(kmFinal);
  const ambos = inicial !== undefined && final !== undefined;
  const invertido = ambos && final < inicial;

  function campo(sufixo: 'inicial' | 'final', rotulo: ReactNode, valor: string, onChange: (v: string) => void) {
    return (
      <div className={styles.field}>
        <label htmlFor={`${id}-${sufixo}`} className={styles.label}>
          {rotulo} {required && <RequiredMark />}
        </label>
        <div className={styles.inputWrap}>
          <input
            id={`${id}-${sufixo}`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={8}
            autoComplete="off"
            value={valor}
            onChange={(event) => onChange(somenteDigitos(event.target.value, 8))}
            disabled={disabled}
            aria-required={required}
            aria-invalid={sufixo === 'final' && invertido ? true : undefined}
            aria-describedby={ambos ? `${id}-dica` : undefined}
          />
          <span className={styles.unidade} aria-hidden="true">km</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={acao ? `${styles.grid} ${styles.comAcao}` : styles.grid}>
        {campo('inicial', <OSFieldInfo field="kmAtual">KM inicial</OSFieldInfo>, kmAtual, onKmAtualChange)}
        {campo('final', <OSFieldInfo field="kmFinal">KM final</OSFieldInfo>, kmFinal, onKmFinalChange)}
        {acao && <div className={styles.acao}>{acao}</div>}
      </div>
      {ambos && (
        <p id={`${id}-dica`} role="status" className={invertido ? `${styles.dica} ${styles.aviso}` : styles.dica}>
          {invertido
            ? 'KM final menor que o KM inicial. Confira se não houve erro de digitação.'
            : <>Percorrido: <strong>{(final - inicial).toLocaleString('pt-BR')}</strong> km</>}
        </p>
      )}
    </div>
  );
}
