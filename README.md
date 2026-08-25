# JARVIS ERP V2 — Sistema de Gestão Automotiva

**Sistema 100% funcional para GitHub Pages** — Vanilla JavaScript + Firestore + IA Local

---

## 📋 Estrutura de Arquivos

```
JARVIS_V2_FINAL/
├── index.html              # Login (Master + Equipe + PIN)
├── jarvis.html             # Dashboard Admin
├── equipe.html             # Painel Equipe
├── css/
│   └── design.css          # Design System Dark Mode Premium
├── js/
│   ├── config.js           # Firebase + White-label
│   ├── core.js             # Namespace J + Listeners Firestore
│   ├── auth.js             # Autenticação híbrida
│   ├── os.js               # Ordens de Serviço (Kanban)
│   ├── financeiro.js       # DRE + Parcelamento + NF
│   ├── ia.js               # IA local + cérebro JSON
│   └── catalogos-ia.js     # Busca documental sob demanda
├── data/catalogos-ia/      # Índice técnico dos 10 PDFs fornecidos
└── README.md               # Este arquivo
```

---

## 🚀 Deployment no GitHub Pages

### 1. Preparar Repositório

```bash
# Clonar este projeto
git clone https://github.com/tsvalencio-ia/OFICIN-IA.git
cd OFICIN-IA

# Criar branch gh-pages (se não existir)
git checkout --orphan gh-pages
git reset --hard
git commit --allow-empty -m "Initial commit"
git push -u origin gh-pages
```

### 2. Copiar Arquivos

Copie todos os arquivos de `JARVIS_V2_FINAL/` para a raiz do repositório.

### 3. Configurar GitHub Pages

No repositório:
- **Settings** → **Pages**
- Source: `Deploy from a branch`
- Branch: `gh-pages` / `root`
- Salvar

### 4. Fazer Push

```bash
git add .
git commit -m "Deploy JARVIS ERP V2"
git push origin gh-pages
```

Seu site estará disponível em: `https://tsvalencio-ia.github.io/OFICIN-IA/`

---

## 🔐 Configuração do Firebase

### 1. Criar Projeto Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Crie um novo projeto
3. Ative **Firestore Database** (modo teste ou produção)
4. Copie as credenciais

### 2. Atualizar `js/config.js`

```javascript
window.JARVIS_FB_CONFIG = {
  apiKey:            "SUA_API_KEY",
  authDomain:        "seu-projeto.firebaseapp.com",
  projectId:         "seu-projeto",
  storageBucket:     "seu-projeto.firebasestorage.app",
  messagingSenderId: "SEU_MESSAGING_ID",
  appId:             "SEU_APP_ID"
};
```

### 3. Estrutura Firestore

Crie as coleções:

```
oficinas/
├── {id_oficina}/
│   ├── nomeFantasia: "Oficina XYZ"
│   ├── usuario: "admin"
│   ├── senha: "senha123"
│   ├── status: "Ativo"
│   ├── brandColor: "#3B82F6"
│   ├── apiKeys: {
│   │   cloudName: "seu-cloudinary",
│   │   cloudPreset: "seu-preset"
│   │ }
│   └── brain: { /* cérebro JSON local do tenant */ }
├── ordens_servico/{id}     # documentos com tenantId
├── clientes/{id}           # documentos com tenantId
├── veiculos/{id}           # documentos com tenantId
├── funcionarios/{id}       # documentos com tenantId
├── estoqueItems/{id}       # documentos com tenantId
├── financeiro/{id}         # documentos com tenantId
├── fornecedores/{id}       # documentos com tenantId
├── mensagens/{id}          # documentos com tenantId
├── chat_equipe/{id}        # documentos com tenantId
├── agendamentos/{id}       # documentos com tenantId
├── conhecimento_ia/{id}    # cérebro e conhecimento interno
└── lixeira_auditoria/{id}  # trilha de auditoria
```

---

## 🤖 Configurar IA Local

A IA interna não usa Google AI, Gemini, Supabase ou chave externa. Ela consulta
os dados já carregados da oficina, o cérebro local do tenant e os catálogos
técnicos publicados em `data/catalogos-ia/`.

A `apiKey` existente em `JARVIS_FB_CONFIG` é a configuração web do Firebase
necessária para conectar ao Firestore; não é uma chave de IA. Restrinja essa
chave aos serviços Firebase e mantenha regras Firestore adequadas.

## 🧾 Cotação de peças

A cotação funciona somente por envio manual: o usuário escolhe os fornecedores,
gera formulários e mensagens individuais e confirma o envio por WhatsApp,
e-mail, compartilhamento ou cópia. Não existe fila de robô ou envio automático.

---

## 👥 Criar Usuários

### Admin (Master)

```javascript
// Firestore: oficinas/{id}
{
  usuario: "admin",
  senha: "senha123",
  nomeFantasia: "Oficina ABC",
  status: "Ativo"
}
```

### Funcionário (Equipe)

```javascript
// Firestore: oficinas/{id}/funcionarios/{id}
{
  usuario: "joao",
  senha: "senha123",
  pin: "1234",
  nome: "João Silva",
  cargo: "mecanico",
  comissao: 10,
  tenantId: "{id_oficina}"
}
```

---

## 📊 Módulos Implementados

### ✅ Autenticação
- Login Master (Admin)
- Login Equipe (Funcionário)
- Login com PIN (4 dígitos)
- Sessão persistente (sessionStorage)

### ✅ Ordens de Serviço
- Kanban visual com 6 status
- CRUD completo
- Atribuição de mecânicos
- Dashboard com resumos

### ✅ Financeiro
- DRE (Entradas × Saídas)
- Lançamentos manuais
- NF Entrada com **parcelamento automático**
- Comissões por mecânico
- Status: Pago/Pendente

### ✅ IA (RAG)
- IA local integrada
- Contexto dinâmico (dados da oficina)
- Base de conhecimento técnico
- Chat com admin

### ✅ Estoque
- CRUD de itens
- Controle de mínimo
- Sugestão automática em NF

### ✅ Clientes & Equipe
- Cadastro completo
- Vinculação com O.S.
- Chat CRM (admin ↔ cliente)

---

## 🎨 Customização

### Cores (White-Label)

Edite `js/config.js`:

```javascript
window.JARVIS_BRAND = {
  name:        "Sua Oficina",
  tagline:     "Seu slogan",
  logoLetter:  "S",
  color:       "#FF6B35",  // Cor principal
  colorDark:   "#D84315"   // Cor escura
};
```

### Temas

Modifique `css/design.css`:

```css
:root {
  --brand:      #3B82F6;
  --success:    #22D3A0;
  --danger:     #F43F5E;
  /* ... */
}
```

---

## 🔧 Troubleshooting

### "Erro ao conectar com o servidor"
- Verifique credenciais do Firebase em `js/config.js`
- Confirme que Firestore está ativo
- Verifique regras de segurança (modo teste = aberto)

### Dados não aparecem
- Abra DevTools (F12) → Console
- Verifique se há erros de Firestore
- Confirme que `tenantId` está correto

---

## 📱 Responsividade

Sistema otimizado para:
- ✅ Desktop (1920px+)
- ✅ Tablet (768px - 1024px)
- ✅ Mobile (320px - 767px)

---

## 🔒 Segurança

Publique as regras e os índices versionados na pasta `firebase/`. Não use regras
abertas em produção; valide também as restrições da chave Firebase e App Check
quando aplicável.

---

## 📞 Suporte

Para dúvidas ou bugs:
1. Verifique o console (F12)
2. Consulte o README de cada módulo
3. Abra issue no GitHub

---

## 📄 Licença

Desenvolvido por **thIAguinho Soluções Digitais** — 2026

---

## 🎯 Roadmap

- [ ] Exportação de relatórios (PDF)
- [ ] Integração com WhatsApp API
- [ ] Dashboard mobile nativo
- [ ] Backup automático
- [ ] Sincronização offline
- [ ] Integração com sistemas de pagamento

---

**Versão:** 16.0.0 — leve / IA local documental  
**Última atualização:** 18 de julho de 2026  
**Status:** ✅ Produção

