# Relatório técnico — OFICIN-IA V16 leve com IA local documental

Data da entrega: 18/07/2026

## Resultado

O projeto completo foi preservado, incluindo web/PWA, Jarvis, Equipe,
Superadmin, portais de cliente, cotação pública, checklist, Capacitor/Android,
Electron/Windows, regras Firebase, exportações e rotinas auxiliares. As
alterações ficaram limitadas ao escopo solicitado e às otimizações necessárias
para reduzir o carregamento inicial.

## Fluxos principais conferidos

| Entrada | Função |
|---|---|
| `selecionar-perfil.html` | Seleção do perfil de acesso |
| `index.html` | Login, resolução do tenant e criação da sessão |
| `jarvis.html` | Administração da oficina, O.S., clientes, estoque, financeiro, compras, equipe e IA |
| `equipe.html` | Pátio/O.S. da equipe, execução, permissões, chat e IA |
| `superadmin.html` | Gestão de tenants, módulos, cérebro local e financeiro SaaS |
| `cliente.html` / `clienteOficial.html` | Acompanhamento e aprovação pelo cliente |
| `cotacao.html` / `c.html` | Formulário público individual do fornecedor |
| `checklist.html` | Checklist técnico e vínculo com O.S. |

Os dados continuam no Firestore e são isolados por `tenantId`. A configuração
central do Firebase continua em `js/config.js`; configurações específicas de um
tenant continuam suportadas. Credenciais de IA externa não entram mais na
sessão, no Jarvis, no painel da Equipe ou no Superadmin.

## Cotação: somente envio manual

Foi mantido o fluxo completo existente em `js/cotacoes.js`:

1. abertura da cotação a partir da O.S.;
2. seleção de fornecedores e itens;
3. gravação em `cotacoesPecas` com token público individual;
4. geração do link/formulário por fornecedor;
5. geração das mensagens;
6. abertura manual de WhatsApp ou e-mail, cópia e compartilhamento;
7. recebimento das respostas no formulário público;
8. comparação, escolha, aplicação na O.S. e exportação da análise.

Foram removidos a publicação automática no Realtime Database, a fila do robô,
o envio ao Prec_IA/ValorIA, os botões de sincronização e a troca dos links pelo
portal externo.

## IA interna documental

A IA continua respondendo com dados reais do tenant, histórico de O.S.,
estoque, financeiro conforme permissão, equipe, notas fiscais e cérebro JSON.
Ela ganhou uma segunda fonte local: catálogos técnicos por página.

Fluxo da pergunta técnica:

1. a pergunta identifica fabricante, aplicação, referência ou código;
2. `manifest.json` escolhe somente os catálogos candidatos;
3. os arquivos candidatos são baixados sob demanda;
4. a busca pontua frase, termos e códigos exatos;
5. a resposta mostra fabricante, PDF, página, indicação de OCR e trecho fonte;
6. nenhuma compatibilidade é inventada quando não existe texto correspondente.

O carregamento normal do Jarvis/Equipe não baixa a base documental. O índice e
os catálogos entram somente na primeira pergunta técnica que precisar deles e
depois ficam no cache da sessão.

## Catálogos processados

| Catálogo | PDF | Páginas PDF | Páginas pesquisáveis | Extração | SHA-256 |
|---|---|---:|---:|---|---|
| Rainha das Sete | `367-Rainha-da-Sete.pdf` | 385 | 385 | texto | `139c91bd8a7c7058d4648c7186c3dc988f0f26b21716eab595d6edb18ba430fd` |
| AJE Peças | `100172-AJE-pecas.pdf` | 30 | 30 | OCR | `c65821331f9ae24b70a304e10269ddcb33e9dfc81eeb6a0beb7431eb43d78457` |
| Wahler Original | `100171-Wahler-Original.pdf` | 248 | 248 | texto | `95fdcf7c1a4c36c6f45694df38cffb9c3df37794753465e8d62aa260a32f7d14` |
| DNI | `Catalogo-DNI.pdf` | 204 | 204 | OCR | `cfb14cf44ae189141a23f2bac21110befb7ca7e4a0fbe4c51fe3a2f5272f24a1` |
| Nytron | `383-Nytron.pdf` | 120 | 118 | texto | `c8a0c9479eeb51b7032fcbb83d01a38920d8f5eb4d6583162181c61d81de6784` |
| Ranalle | `6052-Ranalle.pdf` | 94 | 90 | OCR | `5ea16969d815c0560c941dc6830851c324e3c74bd8c57a03cda2c25d53b4a0fe` |
| DPL / Forcecar | `6089-DPL.pdf` | 118 | 118 | OCR | `7b5a0cafed39e7034835d1754982e9ff5a008d8ee26804c863137f951e731bca` |
| BRK BrasilKits | `6078-BRK.pdf` | 84 | 81 | texto | `c607305ae559d19352117084d86c017e352411d8a96ea5085d6d7680f2def725` |
| Jurid | `6054-Jurid.pdf` | 120 | 119 | texto | `1916be64445f401317ac83be264e3c43ba2caa5ab9593a042452e963eef7b46d` |
| DS Automotive 2025 | `Catalogo_Completo_2025.pdf` | 320 | 320 | texto | `be3e38dbddff99a13d2b5feed37ccc76a35b80c8c6516b570221017037891138` |

Totais: 10 PDFs, 1.723 páginas, 1.713 páginas com texto útil, 3.890.074
caracteres documentais e 40.044 códigos/referências indexados. As dez páginas
restantes eram vazias ou exclusivamente gráficas; nenhum conteúdo foi criado
para preencher lacunas. Os PDFs originais e os arquivos temporários de OCR não
foram duplicados dentro do sistema, mantendo apenas a base compacta necessária
à busca.

## IA externa e chaves

Foram removidos:

- `js/ia-externa.js` e seu carregamento;
- `api/diagnostico.js`;
- o backend duplicado de `robo-vercel-ia-diagnostico`;
- telas e payloads de configuração da IA Diagnóstico/Supabase;
- credenciais, endpoint, usuário/senha, embed e autologin externos;
- documentação e smoke tests exclusivos das integrações removidas;
- dependência do Firebase Realtime Database usada somente pelo robô de cotação.

As páginas Jarvis, Equipe e Superadmin não contêm chave Gemini/Google AI. A
configuração web do Firebase foi centralizada em `js/config.js` e mantida porque
ela identifica o projeto Firestore utilizado pelo sistema; não executa IA. A
sessão filtra `apiKeys` e conserva somente os campos Cloudinary usados pelas
imagens. Ao salvar um tenant no Superadmin, os campos legados da IA externa são
apagados sem sobrescrever outras integrações do tenant.

## Otimizações de carregamento

- Jarvis inicia O.S., clientes e veículos; coleções secundárias são abertas por
  tela e uma única vez.
- Estoque e financeiro do dashboard aguardam um intervalo ocioso curto.
- Agenda, vendas, fornecedores, mensagens, chat da equipe e auditoria deixam de
  competir com a abertura inicial.
- A busca de módulos no banco central usa leituras pontuais sequenciais em vez
  de uma matriz permanente de listeners por ID e por slug.
- O lembrete de boleto SaaS usa leitura pontual, pois não precisa de tempo real.
- Equipe inicia o chat somente ao abrir a aba; o listener financeiro só existe
  quando o cargo tem permissão e nunca é duplicado.
- Superadmin abre inicialmente apenas tenants e cérebro; financeiro SaaS e
  auditoria carregam ao abrir suas telas.
- A Vercel publica somente `web-dist`, gerado por uma lista permitida de arquivos
  web, sem instalar as dependências nativas de Android/Electron.
- O Service Worker usa cache de versão nova e remove caches antigos do sistema.

## Arquivos centrais adicionados

- `js/catalogos-ia.js`
- `data/catalogos-ia/manifest.json`
- `data/catalogos-ia/*.json` (dez bases por catálogo)
- `scripts/build-catalog-knowledge.js`
- `scripts/build-web.sh`
- `.vercelignore`

## Validações executadas

- sintaxe de todos os arquivos JavaScript em `js/`;
- sintaxe de todos os blocos JavaScript inline das oito páginas principais;
- validação de todos os JSONs com `jq`;
- build web real por `npm run build`;
- presença dos arquivos essenciais em `web-dist`;
- ausência de referências runtime ao robô, Prec_IA/ValorIA, Gemini e endpoint
  externo;
- teste de carregamento e busca nos dez catálogos, um por um;
- conferência visual de páginas amostrais dos dez PDFs;
- validação do pacote Android `www` após a sincronização;
- teste de integridade do ZIP final.

Os testes estáticos e documentais não substituem um login de produção com as
regras, usuários e conexão reais do Firebase. Nenhuma gravação foi feita no
banco de produção durante esta atualização.
