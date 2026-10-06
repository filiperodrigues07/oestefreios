import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { AdminOSDTO, OperationalOSDTO } from '../../dto/os.dto.js';
import type { RelatorioBranding, OSFotoPdf } from '../../services/reportExport.service.js';
import { PRIORIDADE_LABEL, STATUS_LABEL } from '../../services/relatorio.service.js';

interface Props {
  os: OperationalOSDTO | AdminOSDTO;
  branding: RelatorioBranding;
  fotos?: OSFotoPdf[];
}

const CINZA_TEXTO = '#475569';
const CINZA_CLARO = '#94a3b8';
const LINHA = '#e2e8f0';
const LINHA_ALT = '#f8fafc';

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, color: '#0f172a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, borderBottomWidth: 3, paddingBottom: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 42, height: 42, marginRight: 12, objectFit: 'contain' },
  empresa: { fontSize: 15, fontWeight: 700 },
  subtitulo: { fontSize: 10, color: CINZA_TEXTO, marginTop: 3 },
  headerRight: { alignItems: 'flex-end' },
  numeroOS: { fontSize: 18, fontWeight: 700 },
  statusChip: { marginTop: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 3, fontSize: 8, fontWeight: 700, color: '#ffffff' },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 9, fontWeight: 700, color: CINZA_TEXTO, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  grid2: { flexDirection: 'row', gap: 24 },
  gridCol: { flex: 1 },
  /** Abertura e Conclusão lado a lado dentro da coluna do Veículo (alinhadas com ela). */
  datas: { flexDirection: 'row', gap: 12 },
  campoLabel: { fontSize: 8, color: CINZA_CLARO },
  campoValor: { fontSize: 10, marginBottom: 6 },
  texto: { fontSize: 9.5, lineHeight: 1.5, color: '#0f172a' },
  table: { marginTop: 4 },
  tr: { flexDirection: 'row' },
  th: { padding: 5, color: '#ffffff', fontSize: 8, fontWeight: 700 },
  td: { padding: 5, fontSize: 9, borderBottomWidth: 0.5, borderBottomColor: LINHA },
  // Largura = colunas "Preço unit." + "Total" da tabela (flex 1+1 de 5); mesmo recuo das células (5):
  // os valores terminam exatamente na linha da coluna Total.
  totaisBox: { marginTop: 10, alignSelf: 'flex-end', width: '40%' },
  totaisLinha: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, paddingHorizontal: 5 },
  totaisLabel: { fontSize: 9, color: CINZA_TEXTO },
  totaisValor: { fontSize: 9, fontWeight: 700 },
  totalGeral: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingVertical: 7, paddingHorizontal: 5, borderRadius: 4 },
  totalGeralTexto: { fontSize: 10, fontWeight: 700, color: '#ffffff' },
  assinaturas: { flexDirection: 'row', gap: 40, marginTop: 44 },
  linhaAssinatura: { flex: 1, borderTopWidth: 0.75, borderTopColor: '#94a3b8', paddingTop: 4, textAlign: 'center', fontSize: 8, color: CINZA_TEXTO },
  photoTitle: { fontSize: 12, fontWeight: 700, marginBottom: 10 },
  // 2 colunas x 3 linhas por página (~259pt de largura cada): 6 fotos por folha em vez de 2.
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  photoBox: { width: '48.5%', height: 226, marginBottom: 8 },
  photoCaption: { fontSize: 8, color: CINZA_TEXTO, marginBottom: 4 },
  photoCaptionNumero: { fontWeight: 700, color: '#0f172a' },
  photoImage: { width: '100%', height: 202, objectFit: 'contain', borderWidth: 0.5, borderColor: LINHA },
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

function formatarData(valor?: string): string {
  if (!valor) return '—';
  return new Date(valor).toLocaleString('pt-BR');
}

/** Dia de calendário AAAA-MM-DD → dd/mm/aaaa direto da string (new Date() leria como UTC e mostraria um dia a menos). */
export function formatarDia(valor?: string): string {
  const m = valor ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function temFinanceiro(os: OperationalOSDTO | AdminOSDTO): os is AdminOSDTO {
  return 'faturamento' in os;
}

/** Documento de impressão de uma OS — cabeçalho, cliente/veículo, diagnóstico, itens e assinatura. */
const FOTOS_POR_PAGINA = 6;

/** Descrição só quando a pessoa escreveu uma; se for igual ao nome do arquivo enviado, não repete. */
function legendaFoto(foto: OSFotoPdf): string {
  const descricao = foto.descricao?.trim();
  return descricao && descricao !== foto.nomeArquivo ? descricao : '';
}

export function OSDocument({ os, branding, fotos = [] }: Props) {
  const corDestaque = /^#[0-9a-fA-F]{6}$/.test(branding.corDestaque) ? branding.corDestaque : '#0369a1';
  const financeiro = temFinanceiro(os);
  const totalProdutos = financeiro ? os.produtos.reduce((acc, p) => acc + (p.total ?? 0), 0) : 0;
  const totalServicos = financeiro ? os.servicos.reduce((acc, s) => acc + (s.total ?? 0), 0) : 0;

  return (
    <Document title={`Ordem de Serviço #${os.numero}`}>
      <Page size="A4" style={styles.page}>
        <View style={[styles.header, { borderBottomColor: corDestaque }]}>
          <View style={styles.headerLeft}>
            {branding.logoUrl ? <Image src={branding.logoUrl} style={styles.logo} /> : null}
            <View>
              <Text style={styles.empresa}>{branding.nomeEmpresa || 'Oeste Freios'}</Text>
              <Text style={styles.subtitulo}>Ordem de Serviço</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.numeroOS}>#{os.numero}</Text>
            <Text style={[styles.statusChip, { backgroundColor: corDestaque }]}>{STATUS_LABEL[os.status] ?? os.status}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.grid2}>
            <View style={styles.gridCol}>
              <Text style={styles.sectionTitle}>Cliente</Text>
              <Text style={styles.campoLabel}>Nome</Text>
              <Text style={styles.campoValor}>{os.clienteNome || os.clienteCodigo}</Text>
              <Text style={styles.campoLabel}>Código</Text>
              <Text style={styles.campoValor}>{os.clienteCodigo}</Text>
            </View>
            <View style={styles.gridCol}>
              <Text style={styles.sectionTitle}>Veículo</Text>
              <Text style={styles.campoLabel}>Identificação</Text>
              <Text style={styles.campoValor}>{os.equipamentoDescricao || os.equipamentoCodigo}</Text>
              <Text style={styles.campoLabel}>Código</Text>
              <Text style={styles.campoValor}>{os.equipamentoCodigo}</Text>
              <View style={styles.datas}>
                <View style={styles.gridCol}>
                  <Text style={styles.campoLabel}>KM inicial</Text>
                  <Text style={styles.campoValor}>{os.kmAtual !== undefined ? os.kmAtual.toLocaleString('pt-BR') : '—'}</Text>
                </View>
                <View style={styles.gridCol}>
                  <Text style={styles.campoLabel}>KM final</Text>
                  <Text style={styles.campoValor}>{os.kmFinal !== undefined ? os.kmFinal.toLocaleString('pt-BR') : '—'}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.grid2}>
            <View style={styles.gridCol}>
              <Text style={styles.campoLabel}>Prioridade</Text>
              <Text style={styles.campoValor}>{PRIORIDADE_LABEL[os.prioridade] ?? os.prioridade}</Text>
              <Text style={styles.campoLabel}>Garantia até</Text>
              <Text style={styles.campoValor}>{formatarDia(os.garantia)}</Text>
            </View>
            <View style={[styles.gridCol, styles.datas]}>
              <View style={styles.gridCol}>
                <Text style={styles.campoLabel}>Abertura</Text>
                <Text style={styles.campoValor}>{formatarData(os.dataAbertura)}</Text>
              </View>
              <View style={styles.gridCol}>
                <Text style={styles.campoLabel}>Conclusão</Text>
                <Text style={styles.campoValor}>{formatarData(os.dataConclusao)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Diagnóstico de abertura</Text>
          <Text style={styles.texto}>{os.problema || 'Não informado.'}</Text>
        </View>

        {os.diagnostico && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Diagnóstico</Text>
            <Text style={styles.texto}>{os.diagnostico}</Text>
          </View>
        )}

        {os.produtos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Produtos</Text>
            <View style={styles.table}>
              <View style={[styles.tr, { backgroundColor: corDestaque }]}>
                <Text style={[styles.th, { flex: 2 }]}>Descrição</Text>
                <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Qtd.</Text>
                {financeiro && <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Preço unit.</Text>}
                {financeiro && <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Total</Text>}
              </View>
              {os.produtos.map((p, i) => (
                <View key={p.itemId ?? i} style={[styles.tr, { backgroundColor: i % 2 === 1 ? LINHA_ALT : '#ffffff' }]}>
                  <Text style={[styles.td, { flex: 2 }]}>{p.descricao}{p.descricaoComplementar?.trim() ? ` — ${p.descricaoComplementar.trim()}` : ''}</Text>
                  <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>{p.quantidade}</Text>
                  {financeiro && 'precoUnitario' in p && (
                    <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>
                      {p.precoUnitario !== undefined ? formatarMoeda(p.precoUnitario) : '—'}
                    </Text>
                  )}
                  {financeiro && 'total' in p && (
                    <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>{p.total !== undefined ? formatarMoeda(p.total) : '—'}</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {os.servicos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Serviços</Text>
            <View style={styles.table}>
              <View style={[styles.tr, { backgroundColor: corDestaque }]}>
                <Text style={[styles.th, { flex: 2 }]}>Descrição</Text>
                <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Qtd.</Text>
                {financeiro && <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Valor unit.</Text>}
                {financeiro && <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Total</Text>}
              </View>
              {os.servicos.map((s, i) => (
                <View key={s.itemId ?? i} style={[styles.tr, { backgroundColor: i % 2 === 1 ? LINHA_ALT : '#ffffff' }]}>
                  <Text style={[styles.td, { flex: 2 }]}>{s.descricao}{s.descricaoComplementar?.trim() ? ` — ${s.descricaoComplementar.trim()}` : ''}</Text>
                  <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>{s.quantidade}</Text>
                  {financeiro && 'valorUnitario' in s && (
                    <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>
                      {s.valorUnitario !== undefined ? formatarMoeda(s.valorUnitario) : '—'}
                    </Text>
                  )}
                  {financeiro && 'total' in s && (
                    <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>{s.total !== undefined ? formatarMoeda(s.total) : '—'}</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {financeiro && (
          <View style={styles.totaisBox}>
            <View style={styles.totaisLinha}>
              <Text style={styles.totaisLabel}>Produtos</Text>
              <Text style={styles.totaisValor}>{formatarMoeda(totalProdutos)}</Text>
            </View>
            <View style={styles.totaisLinha}>
              <Text style={styles.totaisLabel}>Serviços</Text>
              <Text style={styles.totaisValor}>{formatarMoeda(totalServicos)}</Text>
            </View>
            <View style={[styles.totalGeral, { backgroundColor: corDestaque }]}>
              <Text style={styles.totalGeralTexto}>Total geral</Text>
              <Text style={styles.totalGeralTexto}>{formatarMoeda(os.faturamento ?? totalProdutos + totalServicos)}</Text>
            </View>
          </View>
        )}

        <View style={styles.assinaturas}>
          <Text style={styles.linhaAssinatura}>Assinatura do cliente</Text>
          <Text style={styles.linhaAssinatura}>Assinatura do responsável</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>Gerado em {new Date().toLocaleString('pt-BR')}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
      {Array.from({ length: Math.ceil(fotos.length / FOTOS_POR_PAGINA) }, (_, pageIndex) => {
        const inicio = pageIndex * FOTOS_POR_PAGINA;
        return (
          <Page key={pageIndex} size="A4" style={styles.page}>
            <Text style={styles.photoTitle}>OS #{os.numero} · Fotos ({inicio + 1}–{Math.min(inicio + FOTOS_POR_PAGINA, fotos.length)} de {fotos.length})</Text>
            <View style={styles.photoGrid}>
              {fotos.slice(inicio, inicio + FOTOS_POR_PAGINA).map((foto, index) => (
                <View key={`${pageIndex}-${index}`} style={styles.photoBox} wrap={false}>
                  {/* Nome sequencial (Img. 1, Img. 2...): o nome do arquivo enviado (WhatsApp Image...) não ajuda quem lê. */}
                  <Text style={styles.photoCaption}>
                    <Text style={styles.photoCaptionNumero}>Img. {inicio + index + 1}</Text>
                    {legendaFoto(foto) ? ` · ${legendaFoto(foto)}` : ''}
                  </Text>
                  <Image src={foto.src} style={styles.photoImage} />
                </View>
              ))}
            </View>
            <View style={styles.footer} fixed>
              <Text>Gerado em {new Date().toLocaleString('pt-BR')}</Text>
              <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
            </View>
          </Page>
        );
      })}
    </Document>
  );
}
