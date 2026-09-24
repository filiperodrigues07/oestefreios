import { useSearchParams } from 'react-router';
import { Tabs } from '../components/ui/index.js';
import { NavIcon } from '../components/layout/NavIcon.js';
import { AssinaturaTab } from './proprietario/AssinaturaTab.js';
import { ContasReceberTab } from './proprietario/ContasReceberTab.js';
import { ActionIcon } from '../components/ui/ActionIcon.js';
import { LicencasTab } from './proprietario/LicencasTab.js';
import { VisaoGeralTab } from './proprietario/VisaoGeralTab.js';
import styles from './ProprietarioPage.module.css';

const ABAS = [
  {
    key: 'visao',
    label: (
      <>
        <NavIcon name="chart" /> Visão geral
      </>
    ),
    mobileLabel: (
      <>
        <NavIcon name="chart" /> Visão
      </>
    ),
  },
  {
    key: 'assinatura',
    label: (
      <>
        <NavIcon name="shield" /> Assinatura
      </>
    ),
    mobileLabel: (
      <>
        <NavIcon name="shield" /> Assinatura
      </>
    ),
  },
  {
    key: 'receber',
    label: (
      <>
        <ActionIcon name="receipt" size={18} /> Contas a receber
      </>
    ),
    mobileLabel: (
      <>
        <ActionIcon name="receipt" size={17} /> A receber
      </>
    ),
  },
  {
    key: 'licencas',
    label: (
      <>
        <NavIcon name="users" /> Licenças e sessões
      </>
    ),
    mobileLabel: (
      <>
        <NavIcon name="users" /> Licenças
      </>
    ),
  },
];

/** Painel do proprietário (super admin): assinatura, licenças e sessões. Só ele vê — a rota devolve 404 aos demais. */
export function ProprietarioPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const pedida = searchParams.get('tab');
  const aba = ABAS.some((item) => item.key === pedida) ? pedida! : 'visao';
  const irPara = (tab: string, acao?: string) => setSearchParams(acao ? { tab, acao } : { tab });

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <span className={styles.heroIcon}>
          <NavIcon name="shield" />
        </span>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>Área restrita</span>
          <h1>Painel do proprietário</h1>
          <p>Controle a assinatura, as cobranças e os acessos desta instalação.</p>
        </div>
        <span className={styles.accessBadge}>Acesso exclusivo</span>
      </header>
      <Tabs items={ABAS} active={aba} onChange={(key) => irPara(key)} fullWidth>
        {aba === 'visao' && <VisaoGeralTab onIr={irPara} />}
        {aba === 'assinatura' && <AssinaturaTab />}
        {aba === 'receber' && <ContasReceberTab />}
        {aba === 'licencas' && <LicencasTab />}
      </Tabs>
    </div>
  );
}
