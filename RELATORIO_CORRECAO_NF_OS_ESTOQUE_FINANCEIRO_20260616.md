# Relatorio de Correcao - NF, O.S., Estoque e Financeiro

Base auditada: `OFICIN-IA-COM_IA-main (11).zip`

Data: 2026-06-16

## Arquivos alterados

- `js/nfe-real-pro.js`
- `jarvis.html`
- `service-worker.js`
- `capacitor-android/www/js/nfe-real-pro.js`
- `capacitor-android/www/jarvis.html`
- `capacitor-android/www/service-worker.js`

## Funcoes / pontos alterados

- `mergePecasOrcamentoNF` / novo apoio `refletirPecasNFNaOSTelaAtual`:
  - Motivo: quando a NF vincula item a uma O.S. aberta, a peca real ja era gravada na O.S., mas a linha visivel do orcamento podia nao aparecer imediatamente na tela. Agora, para cliente comum, a peca vinculada por NF tambem e refletida no container de pecas da O.S. aberta, sem duplicar pela chave `origemNFItemKey`.

- `registrarPecasReaisOSNF`:
  - Motivo: apos montar `pecasReais` e, quando aplicavel, `pecas` da O.S., tambem atualiza a tela da O.S. aberta. O fluxo de gravacao original foi preservado: NF, vinculos, estoque, movimentos e financeiro continuam no mesmo `batch` de entrada.

- `gerarParcelasManuais`:
  - Motivo: a divisao automatica de parcelas agora ajusta a ultima parcela pelo saldo restante para evitar divergencia de centavos entre total fiscal e financeiro.

- `salvarNF`:
  - Motivo: para formas parcelaveis, se o editor de parcelas ainda nao tiver linhas, o sistema gera parcelas antes de coletar o financeiro. Isso evita NF parcelada sem titulos por ausencia de renderizacao previa.

- CSS do card de pecas da O.S. em `jarvis.html`:
  - Motivo: somente ajuste visual solicitado. O codigo ficou menor, a descricao maior e as colunas de peca normal com estoque ficaram alinhadas. Nenhum campo ou botao foi removido.

- `service-worker.js`:
  - Motivo: versao de cache atualizada para publicar a correcao sem manter JS/HTML antigo em PWA.

## Fluxos testados / validados

- Auditoria estatica do fluxo de NF nova:
  - `salvarNF` cria `notas_fiscais_entrada`;
  - `registrarPecasReaisOSNF` cria/mescla `pecasReais` e, em cliente comum, `pecas`;
  - estoque recebe `qtdDisponivel` conforme destino operacional;
  - `nf_itens_vinculos` grava destino, O.S., placa, quantidade, custo, fornecedor e NF;
  - financeiro cria agrupamento, parcelas ou titulo unico conforme forma de pagamento.

- Auditoria estatica da edicao de NF:
  - `salvarEdicaoNF` continua desviando o modo edicao antes de `salvarNF`;
  - `aplicarEstornosEdicaoNF` e `ajustarFinanceiroEdicaoNF` foram preservados.

- Espelho Android:
  - hashes SHA-256 iguais entre raiz e `capacitor-android/www` para os tres arquivos alterados.

## Fluxos preservados

- Cilia, PMSP, Tempária, CRM, IA/Jarvis, cliente, clienteOficial, XML, devolucao, exclusao auditada e edicao auditada de NF nao foram reescritos.
- Nenhuma funcao existente foi removida.
- Nenhum campo de NF, O.S., estoque, peca real, financeiro, boleto ou parcela foi removido.

## Limitacoes da validacao local

- `node`, `npm`, `git`, `deno` e `bun` nao estavam disponiveis no PATH deste ambiente, portanto `node --check` e `git diff --no-index` nao puderam ser executados.
- A validacao feita foi por leitura direcionada, busca estatica com `rg`, hash de espelho e conferencia dos pontos de gravacao.

## Garantias de compatibilidade

- A correcao nao altera colecoes Firestore nem renomeia campos.
- A chave `origemNFItemKey` continua sendo o criterio de compatibilidade para evitar duplicidade na O.S.
- O fluxo de entrada de NF continua usando o mesmo `batch` de gravacao.
- O ajuste visual da O.S. afeta apenas grid/colunas; nao altera dados nem eventos.
