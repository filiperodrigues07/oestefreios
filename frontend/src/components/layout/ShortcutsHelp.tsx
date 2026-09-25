import { Modal } from '../ui/Modal.js';
import styles from './ShortcutsHelp.module.css';

const ATALHOS: { teclas: string[]; acao: string }[] = [
  { teclas: ['/'], acao: 'Buscar no sistema' },
  { teclas: ['Ctrl', 'K'], acao: 'Buscar no sistema (de qualquer lugar)' },
  { teclas: ['N'], acao: 'Abrir nova OS' },
  { teclas: ['Esc'], acao: 'Fechar janela ou busca' },
  { teclas: ['?'], acao: 'Mostrar esta lista' },
];

/** Lista de atalhos de teclado (tecla `?`). Atalhos de letra não valem enquanto se digita num campo. */
export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} title="Atalhos de teclado" onClose={onClose} centerOnMobile>
      <dl className={styles.lista}>
        {ATALHOS.map(({ teclas, acao }) => (
          <div key={acao} className={styles.item}>
            <dt>
              {teclas.map((tecla) => (
                <kbd key={tecla}>{tecla}</kbd>
              ))}
            </dt>
            <dd>{acao}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.nota}>Os atalhos de uma letra não funcionam enquanto você digita num campo.</p>
    </Modal>
  );
}
