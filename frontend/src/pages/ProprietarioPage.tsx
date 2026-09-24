import { useSearchParams } from 'react-router';
import { PageHeader, Tabs } from '../components/ui/index.js';
import { AssinaturaTab } from './proprietario/AssinaturaTab.js';
import { LicencasTab } from './proprietario/LicencasTab.js';
import { VisaoGeralTab } from './proprietario/VisaoGeralTab.js';
import styles from './ProprietarioPage.module.css';

const ABAS = [
  { key: 'visao', label: 'Visão geral' },
  { key: 'assinatura', label: 'Assinatura' },
  { key: 'licencas', label: 'Licenças e sessões', mobileLabel: 'Licenças' },
];

/** Painel do proprietário (super admin): assinatura, licenças e sessões. Só ele vê — a rota devolve 404 aos demais. */
export function ProprietarioPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const pedida = searchParams.get('tab');
  const aba = ABAS.some((item) => item.key === pedida) ? pedida! : 'visao';
  const irPara = (tab: string, acao?: string) => setSearchParams(acao ? { tab, acao } : { tab });

  return (
    <div className={styles.page}>
      <PageHeader title="Painel do proprietário" description="Assinatura, licenças e sessões desta instalação. Os demais usuários não veem esta área." />
      <Tabs items={ABAS} active={aba} onChange={(key) => irPara(key)} fullWidth>
        {aba === 'visao' && <VisaoGeralTab onIr={irPara} />}
        {aba === 'assinatura' && <AssinaturaTab />}
        {aba === 'licencas' && <LicencasTab />}
      </Tabs>
    </div>
  );
}
