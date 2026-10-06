import { useState } from 'react';
import { Button } from '../ui/index.js';
import styles from './OSForm.module.css';

interface Props {
  problema: string;
  podeEditar: boolean;
  salvando: boolean;
  onSave: (valor: string) => void;
}

/** "Diagnóstico de abertura" (ORDEMSERVICO.PROBLEMAABERTURAOS no CHERP): texto da abertura da OS, editável depois. */
export function OSProblemaSection({ problema, podeEditar, salvando, onSave }: Props) {
  const [valor, setValor] = useState(problema);
  const [servidorVisto, setServidorVisto] = useState(problema);
  // O polling da OS traz o texto do servidor: só sobrescreve o campo se a pessoa não estiver editando.
  if (problema !== servidorVisto) {
    setServidorVisto(problema);
    if (valor === servidorVisto) setValor(problema);
  }
  const alterado = valor.trim() !== problema.trim();

  if (!podeEditar) return <p className={styles.problemaTexto}>{problema || 'Não informado.'}</p>;

  return (
    <div className={styles.createStack}>
      <textarea
        aria-label="Diagnóstico de abertura"
        value={valor}
        onChange={(e) => setValor(e.target.value.toLocaleUpperCase('pt-BR'))}
        autoCapitalize="characters"
        maxLength={5000}
        rows={3}
        disabled={salvando}
        className={styles.textarea}
      />
      <div>
        <Button disabled={!alterado} loading={salvando} onClick={() => onSave(valor.trim())}>
          Salvar diagnóstico de abertura
        </Button>
      </div>
    </div>
  );
}
