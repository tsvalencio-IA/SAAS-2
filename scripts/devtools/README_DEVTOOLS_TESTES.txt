SCRIPTS DEVTOOLS - thIAguinho

Como usar:
1. Abra a tela correspondente no navegador.
2. Pressione F12 > Console.
3. Cole o arquivo inteiro e pressione Enter.

Arquivos:
- TESTE_DEVTOOLS_SUPERADMIN.js: valida Superadmin, importacao de conhecimento e salvar tenant sem fechar.
- TESTE_DEVTOOLS_JARVIS.js: valida Jarvis/Admin, O.S., IA local, catalogos, cotacao manual e isolamento basico.
- TESTE_DEVTOOLS_EQUIPE.js: valida perfil equipe, vazamento simples de valores e IA tecnica.
- TESTE_DEVTOOLS_CLIENTE.js: valida portal cliente comum.
- TESTE_DEVTOOLS_CLIENTEOFICIAL.js: valida portal cliente oficial/orgao publico.
- GERAR_TENANT_TESTE_300_FLUXO.js: cria massa realista em TENANT TESTE. Grava dados. Exige confirmacao digitando GERAR 300.

Limite honesto:
Os smoke tests de painel nao substituem testes reais com Firebase, WhatsApp autenticado, regras publicadas e usuarios reais. Eles foram feitos para encontrar regressao obvia, funcoes ausentes, DOM quebrado, modulo faltando, vazamento simples e problemas de carregamento.
