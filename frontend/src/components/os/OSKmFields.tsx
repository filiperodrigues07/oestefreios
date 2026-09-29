import { useId } from 'react';
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
}

export function parseKm(value: string): number | undefined {
  return /^\d{1,8}$/.test(value.trim()) ? Number(value.trim()) : undefined;
}

export function OSKmFields({ kmAtual, kmFinal, onKmAtualChange, onKmFinalChange, disabled, required = true }: Props) {
  const id = useId();
  const inicial = parseKm(kmAtual);
  const final = parseKm(kmFinal);
  return (
    <div>
      <div className={styles.grid}>
        <label htmlFor={`${id}-inicial`}>
          <span><OSFieldInfo field="kmAtual">KM inicial</OSFieldInfo> {required && <RequiredMark />}</span>
          <input id={`${id}-inicial`} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={8} value={kmAtual}
            onChange={(event) => onKmAtualChange(somenteDigitos(event.target.value, 8))} disabled={disabled} aria-required={required} />
        </label>
        <label htmlFor={`${id}-final`}>
          <span><OSFieldInfo field="kmFinal">KM final</OSFieldInfo> {required && <RequiredMark />}</span>
          <input id={`${id}-final`} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={8} value={kmFinal}
            onChange={(event) => onKmFinalChange(somenteDigitos(event.target.value, 8))} disabled={disabled} aria-required={required} />
        </label>
      </div>
      {inicial !== undefined && final !== undefined && final < inicial && (
        <p role="status" className={styles.warning}>KM final menor que o KM inicial. Confira se não houve erro de digitação.</p>
      )}
    </div>
  );
}
