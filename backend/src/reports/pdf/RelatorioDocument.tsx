import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { RelatorioResultado, RelatorioValor } from '../../dto/relatorio.dto.js';
import type { RelatorioBranding } from '../../services/reportExport.service.js';

interface Props {
  relatorio: RelatorioResultado;
  branding: RelatorioBranding;
}

const CINZA_TEXTO = '#475569';
const CINZA_CLARO = '#94a3b8';
const LINHA = '#e2e8f0';
const LINHA_ALT = '#f8fafc';

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, color: '#0f172a' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, borderBottomWidth: 3, paddingBottom: 10 },
  logo: { width: 42, height: 42, marginRight: 12, objectFit: 'contain' },
  empresa: { fontSize: 15, fontWeight: 700 },
  tituloRelatorio: { fontSize: 11, color: CINZA_TEXTO, marginTop: 3 },
  periodo: { fontSize: 9, color: CINZA_CLARO, marginTop: 10 },
  table: { marginTop: 16 },
  tr: { flexDirection: 'row' },
  th: { padding: 6, color: '#ffffff', fontSize: 9, fontWeight: 700 },
  td: { padding: 6, borderBottomWidth: 0.5, borderBottomColor: LINHA },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: CINZA_CLARO,
  },
});

function formatarCelula(valor: RelatorioValor | undefined, tipo?: string): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (tipo === 'moeda' && typeof valor === 'number') {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  }
  if (tipo === 'data') {
    return new Date(valor as string).toLocaleDateString('pt-BR');
  }
  return String(valor);
}

/** Template único de PDF reaproveitado pelos 3 relatórios — só os dados/colunas mudam. */
export function RelatorioDocument({ relatorio, branding }: Props) {
  const corDestaque = /^#[0-9a-fA-F]{6}$/.test(branding.corDestaque) ? branding.corDestaque : '#0369a1';
  const larguraColuna = `${100 / relatorio.colunas.length}%`;

  return (
    <Document title={relatorio.titulo}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={[styles.header, { borderBottomColor: corDestaque }]}>
          {branding.logoUrl ? <Image src={branding.logoUrl} style={styles.logo} /> : null}
          <View>
            <Text style={styles.empresa}>{branding.nomeEmpresa || 'Oeste Freios'}</Text>
            <Text style={styles.tituloRelatorio}>{relatorio.titulo}</Text>
          </View>
        </View>

        {relatorio.periodo && (
          <Text style={styles.periodo}>
            Período: {new Date(relatorio.periodo.inicio).toLocaleDateString('pt-BR')} a{' '}
            {new Date(relatorio.periodo.fim).toLocaleDateString('pt-BR')}
          </Text>
        )}

        <View style={styles.table}>
          <View style={[styles.tr, { backgroundColor: corDestaque }]} fixed>
            {relatorio.colunas.map((col) => (
              <Text key={col.key} style={[styles.th, { width: larguraColuna, textAlign: col.alinhamento ?? 'left' }]}>
                {col.label}
              </Text>
            ))}
          </View>
          {relatorio.linhas.map((linha, i) => (
            <View key={i} style={[styles.tr, { backgroundColor: i % 2 === 1 ? LINHA_ALT : '#ffffff' }]} wrap={false}>
              {relatorio.colunas.map((col) => (
                <Text key={col.key} style={[styles.td, { width: larguraColuna, textAlign: col.alinhamento ?? 'left' }]}>
                  {formatarCelula(linha[col.key], col.tipo)}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text>Gerado em {new Date(relatorio.geradoEm).toLocaleString('pt-BR')}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
