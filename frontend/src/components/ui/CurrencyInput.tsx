import { forwardRef, type ComponentProps } from 'react';
import { Input } from './Input.js';

type InputProps = Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type' | 'inputMode'>;

interface CurrencyInputProps extends InputProps {
  /** Valor em reais (ex.: 60.5). */
  value: number;
  onValueChange: (valor: number) => void;
  /** Teto em reais — impede digitar valor absurdo por engano. */
  max?: number;
}

const formatoBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Campo de valor em reais com máscara "R$ 1.234,56": os dígitos entram pela direita (centavos primeiro),
 * então "6", "0", "0", "0" vira R$ 60,00 e o usuário nunca digita vírgula nem perde as casas decimais.
 */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(function CurrencyInput(
  { value, onValueChange, max = 1_000_000, ...rest },
  ref,
) {
  return (
    <Input
      {...rest}
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={formatoBRL.format(Number.isFinite(value) ? value : 0)}
      onChange={(event) => {
        const centavos = Number(event.target.value.replace(/\D/g, '') || '0');
        onValueChange(Math.min(max, centavos / 100));
      }}
    />
  );
});
