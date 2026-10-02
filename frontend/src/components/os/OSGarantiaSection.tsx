import { useState } from 'react';
import { Button, Input } from '../ui/index.js';

interface Props {
  /** Garantia salva na OS (AAAA-MM-DD). */
  garantia?: string;
  /** Dia de abertura da OS (AAAA-MM-DD): a garantia sempre parte dele, como no CHERP. */
  diaAbertura: string;
  podeEditar: boolean;
  salvando: boolean;
  onSave: (valor: string) => void;
}

/**
 * Data de garantia da OS (mesmo campo GARANTIA do CHERP): sempre parte da data de abertura e pode ser ajustada.
 * OS sem garantia gravada (criadas antes deste campo) mostram a data de abertura.
 */
export function OSGarantiaSection({ garantia, diaAbertura, podeEditar, salvando, onSave }: Props) {
  const servidor = garantia || diaAbertura;
  const [valor, setValor] = useState(servidor);
  const [servidorVisto, setServidorVisto] = useState(servidor);
  // O polling da OS traz o valor do servidor: só sobrescreve o campo se a pessoa não estiver editando.
  if (servidor !== servidorVisto) {
    setServidorVisto(servidor);
    if (valor === servidorVisto) setValor(servidor);
  }
  const alterado = valor !== servidor && valor !== '';

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 'var(--space-3)' }}>
      <Input
        type="date"
        label="Garantia até"
        value={valor}
        disabled={!podeEditar || salvando}
        onChange={(e) => setValor(e.target.value)}
      />
      {podeEditar && (
        <>
          <Button disabled={!alterado} loading={salvando} onClick={() => onSave(valor)}>
            Salvar garantia
          </Button>
          {valor !== diaAbertura && (
            <Button variant="secondary" disabled={salvando} onClick={() => setValor(diaAbertura)}>
              Usar data de abertura
            </Button>
          )}
        </>
      )}
    </div>
  );
}
