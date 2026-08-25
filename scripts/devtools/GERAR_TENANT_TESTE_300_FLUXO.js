/*
 * thIAguinho SaaS - gerador de massa realista para TENANT TESTE
 * Uso recomendado: abrir jarvis.html no tenant de teste, F12 > Console, colar tudo e Enter.
 * Grava no Firestore do tenant atual. Exige confirmacao digitando: GERAR 300
 * Nao apaga e nao sobrescreve dados existentes; cria documentos com massaTesteId.
 */
(async function thiaGerarTenantTeste300() {
  'use strict';
  const J = window.J || {};
  const db = window.db || J.db;
  if (!db || !J.tid) throw new Error('Abra o Jarvis logado em um tenant de teste antes de gerar massa.');
  const confirma = prompt('Isto vai CRIAR massa de teste no tenant atual: ' + J.tid + '. Nao apaga nada. Digite GERAR 300 para continuar.');
  if (confirma !== 'GERAR 300') return { cancelado: true };

  const massaTesteId = 'massa_' + new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const rnd = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
  const pick = arr => arr[rnd(0, arr.length - 1)];
  const money = (min, max) => +(min + Math.random() * (max - min)).toFixed(2);
  const today = new Date();
  const iso = d => d.toISOString().slice(0, 10);
  const dateBack = days => { const d = new Date(today); d.setDate(d.getDate() - days); return iso(d); };
  const plate = i => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return letters[rnd(0,25)] + letters[rnd(0,25)] + letters[rnd(0,25)] + rnd(0,9) + letters[rnd(0,25)] + rnd(0,9) + rnd(0,9);
  };
  const names = ['Thiago','Raphael','Danielle','Felipe','Ana','Bruno','Carlos','Daniel','Eduardo','Fabio','Gabriel','Helena','Igor','Juliana','Kaique','Lucas','Mariana','Nicolas','Otavio','Patricia','Renato','Sabrina','Tiago','Vanessa','Wesley'];
  const last = ['Valencio','Toledo','Silva','Santos','Oliveira','Souza','Pereira','Costa','Ribeiro','Almeida','Barbosa','Moura','Cardoso','Araujo','Rocha'];
  const modelos = [
    ['VW','GOL','1.6 FLEX'], ['FIAT','PALIO','1.0 FIRE'], ['GM','ONIX','1.4'], ['RENAULT','DUSTER','2.0'],
    ['HONDA','CG 160','FAN'], ['YAMAHA','FAZER 250','ABS'], ['TOYOTA','COROLLA','2.0'], ['FORD','KA','1.5'],
    ['HYUNDAI','HB20','1.0'], ['JEEP','RENEGADE','1.8'], ['PEUGEOT','208','1.6'], ['CITROEN','C3','1.4']
  ];
  const servicos = ['Troca de oleo e filtro','Substituir pastilhas dianteiras','Diagnostico injecao eletronica','Troca correia dentada','Revisao arrefecimento','Substituir amortecedores','Alinhamento e balanceamento','Troca bomba de combustivel','Higienizacao ar condicionado','Troca velas e cabos'];
  const pecas = [
    ['FIL001','Filtro de oleo',38,89], ['OLEO5W30','Oleo sintetico 5W30',42,78], ['PASTDI','Pastilha dianteira',120,280],
    ['CORRD','Correia dentada',85,220], ['BOMBCOMB','Bomba de combustivel',260,620], ['VELA4','Jogo de velas',80,210],
    ['AMORTD','Amortecedor dianteiro',220,640], ['ADITRAD','Aditivo radiador',22,55], ['FILTAR','Filtro ar motor',45,120],
    ['BUCHAEST','Bucha estabilizadora',18,75]
  ];
  const cargos = [
    ['gerente','LIZ gerente'], ['mecanico','Raphael Toledo Boriola'], ['mecanico','Felipe Furlan'], ['estoque','Ana Estoque'],
    ['financeiro','Danielle Financeiro'], ['atendimento','Bruno Atendimento'], ['orcamentista','Mariana Orcamentos']
  ];
  const fornecedores = ['Auto Pecas Sao Jose','Distribuidora Brasil Auto','CIA Brasileira Dist Auto','Motopecas Avenida','Atacado Vale Pecas','Importadora Rio Preto'];

  async function commitChunks(rows) {
    let batch = db.batch();
    let count = 0;
    let commits = 0;
    for (const row of rows) {
      batch.set(db.collection(row.col).doc(row.id), row.data, { merge: false });
      count++;
      if (count >= 430) {
        await batch.commit();
        commits++;
        batch = db.batch();
        count = 0;
      }
    }
    if (count) { await batch.commit(); commits++; }
    return commits;
  }

  const rows = [];
  const equipe = cargos.map((c, i) => ({
    id: `${massaTesteId}_eq_${i}`,
    tenantId: J.tid,
    role: c[0],
    cargo: c[0],
    nome: c[1],
    ativo: true,
    massaTesteId,
    createdAt: new Date().toISOString()
  }));
  equipe.forEach(e => rows.push({ col: 'equipe', id: e.id, data: e }));

  const forn = fornecedores.map((nome, i) => ({
    id: `${massaTesteId}_forn_${i}`,
    tenantId: J.tid,
    nome,
    razao: nome + ' LTDA',
    cnpj: String(10000000000100 + i),
    telefone: '55' + (17000000000 + rnd(10000000, 99999999)),
    wpp: '55' + (17000000000 + rnd(10000000, 99999999)),
    ativo: true,
    massaTesteId,
    createdAt: new Date().toISOString()
  }));
  forn.forEach(f => rows.push({ col: 'fornecedores', id: f.id, data: f }));

  const estoque = [];
  for (let i = 0; i < 80; i++) {
    const p = pick(pecas);
    const item = {
      id: `${massaTesteId}_est_${i}`,
      tenantId: J.tid,
      codigo: p[0] + '-' + i,
      desc: p[1],
      descricao: p[1],
      categoria: pick(['Motor','Freio','Suspensao','Arrefecimento','Injecao','Filtros']),
      qtd: rnd(0, 28),
      minimo: rnd(2, 8),
      custo: money(p[2], p[3] * 0.75),
      venda: money(p[3] * 0.8, p[3] * 1.25),
      fornecedorId: pick(forn).id,
      massaTesteId,
      updatedAt: new Date().toISOString()
    };
    estoque.push(item);
    rows.push({ col: 'estoque', id: item.id, data: item });
  }

  const clientes = [];
  const veiculos = [];
  for (let i = 0; i < 300; i++) {
    const nome = pick(names) + ' ' + pick(last);
    const cli = {
      id: `${massaTesteId}_cli_${i}`,
      tenantId: J.tid,
      nome,
      telefone: '55' + (17000000000 + rnd(10000000, 99999999)),
      documento: String(10000000000 + rnd(1000000000, 8999999999)),
      email: nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '.') + '@teste.local',
      origem: pick(['indicacao','whatsapp','retorno','frota','google']),
      massaTesteId,
      createdAt: new Date().toISOString()
    };
    const m = pick(modelos);
    const vei = {
      id: `${massaTesteId}_vei_${i}`,
      tenantId: J.tid,
      clienteId: cli.id,
      placa: plate(i),
      marca: m[0],
      modelo: m[1],
      versao: m[2],
      ano: rnd(2012, 2026),
      km: rnd(18000, 240000),
      cor: pick(['branco','prata','preto','vermelho','azul','cinza']),
      prefixo: i % 7 === 0 ? 'FROTA-' + String(i).padStart(3, '0') : '',
      massaTesteId,
      createdAt: new Date().toISOString()
    };
    clientes.push(cli); veiculos.push(vei);
    rows.push({ col: 'clientes', id: cli.id, data: cli });
    rows.push({ col: 'veiculos', id: vei.id, data: vei });
  }

  const osRows = [];
  for (let i = 0; i < 360; i++) {
    const cli = clientes[i % clientes.length];
    const vei = veiculos[i % veiculos.length];
    const mecanico = pick(equipe.filter(e => e.role === 'mecanico'));
    const status = pick(['Triagem','Em Orçamento','Aprovada','Em Execução','Pronto','Entregue','Cancelada']);
    const qtdServ = rnd(1, 4);
    const qtdPecas = rnd(1, 5);
    const servList = Array.from({ length: qtdServ }).map((_, idx) => ({
      key: 'serv-' + idx,
      desc: pick(servicos),
      qtd: 1,
      valorUnit: money(80, 420),
      valorFinal: money(80, 420),
      aprovado: status !== 'Cancelada' && rnd(0, 10) > 1,
      mecanicoId: mecanico.id
    }));
    const pecaList = Array.from({ length: qtdPecas }).map((_, idx) => {
      const e = pick(estoque);
      return {
        key: 'peca-' + idx,
        estoqueId: e.id,
        codigo: e.codigo,
        desc: e.desc,
        qtd: rnd(1, 3),
        valorUnit: e.venda,
        valorFinal: +(e.venda * rnd(1, 3)).toFixed(2),
        aprovado: status !== 'Cancelada' && rnd(0, 10) > 2
      };
    });
    const total = [...servList, ...pecaList].filter(x => x.aprovado).reduce((a, x) => a + Number(x.valorFinal || 0), 0);
    const os = {
      id: `${massaTesteId}_os_${i}`,
      tenantId: J.tid,
      numero: 10000 + i,
      clienteId: cli.id,
      veiculoId: vei.id,
      clienteSnapshot: { nome: cli.nome, telefone: cli.telefone },
      veiculoSnapshot: { placa: vei.placa, marca: vei.marca, modelo: vei.modelo, ano: vei.ano, km: vei.km },
      placa: vei.placa,
      status,
      mecanicoId: mecanico.id,
      mecanicoNome: mecanico.nome,
      defeito: pick(['Barulho ao frear','Luz de injecao acesa','Vazamento de oleo','Motor falhando','Superaquecimento','Revisao preventiva','Ruido na suspensao']),
      servicos: servList,
      pecas: pecaList,
      total,
      data: dateBack(rnd(0, 180)),
      timeline: [
        { dt: new Date().toISOString(), user: 'Massa teste', acao: 'O.S. criada por gerador de fluxo verdadeiro', tipo: 'massa_teste', interno: true },
        { dt: new Date().toISOString(), user: mecanico.nome, acao: 'Mecanico vinculado para execucao simulada', tipo: 'execucao', interno: true }
      ],
      massaTesteId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    osRows.push(os);
    rows.push({ col: 'ordens_servico', id: os.id, data: os });
    if (status === 'Entregue' || status === 'Pronto') {
      rows.push({ col: 'financeiro', id: `${massaTesteId}_fin_receb_${i}`, data: {
        tenantId: J.tid, tipo: 'Entrada', desc: 'Recebimento O.S. ' + vei.placa + ' - ' + cli.nome, valor: +total.toFixed(2),
        data: os.data, status: status === 'Entregue' ? 'Recebido' : 'A Receber', forma: pick(['Pix','Dinheiro','Débito','Crédito Parcelado']),
        osId: os.id, clienteId: cli.id, massaTesteId, createdAt: new Date().toISOString()
      }});
    }
  }

  for (let i = 0; i < 90; i++) {
    const f = pick(forn);
    const total = money(120, 4200);
    const nf = {
      id: `${massaTesteId}_nf_${i}`,
      tenantId: J.tid,
      numero: 50000 + i,
      fornecedorId: f.id,
      fornecedorNome: f.nome,
      fornecedorCNPJ: f.cnpj,
      dataEmissao: dateBack(rnd(0, 170)),
      valorTotal: total,
      itens: Array.from({ length: rnd(1, 6) }).map(() => {
        const e = pick(estoque);
        return { codigo: e.codigo, desc: e.desc, qtd: rnd(1, 12), valorUnit: e.custo };
      }),
      massaTesteId,
      createdAt: new Date().toISOString()
    };
    rows.push({ col: 'notas_fiscais_entrada', id: nf.id, data: nf });
    rows.push({ col: 'financeiro', id: `${massaTesteId}_fin_nf_${i}`, data: {
      tenantId: J.tid, tipo: 'Saída', desc: 'NF ' + nf.numero + ' — ' + f.nome, valor: total,
      data: nf.dataEmissao, status: pick(['Pendente','Pago','Vencido']), forma: pick(['Boleto','Pix','A Combinar']),
      notaFiscalId: nf.id, fornecedorId: f.id, massaTesteId, createdAt: new Date().toISOString()
    }});
  }

  for (let i = 0; i < 120; i++) {
    const cli = pick(clientes);
    const itens = Array.from({ length: rnd(1, 4) }).map(() => {
      const e = pick(estoque);
      return { estoqueId: e.id, codigo: e.codigo, desc: e.desc, qtd: rnd(1, 3), valorUnit: e.venda };
    });
    const total = itens.reduce((a, x) => a + x.qtd * x.valorUnit, 0);
    rows.push({ col: 'vendas_autopecas', id: `${massaTesteId}_venda_${i}`, data: {
      tenantId: J.tid, clienteId: cli.id, clienteNome: cli.nome, itens, total: +total.toFixed(2),
      vendedor: pick(equipe).nome, data: dateBack(rnd(0, 120)), status: pick(['Finalizada','Orçamento','Cancelada']),
      massaTesteId, createdAt: new Date().toISOString()
    }});
  }

  console.log('Gerando massa', { massaTesteId, docs: rows.length, tenantId: J.tid });
  const commits = await commitChunks(rows);
  console.log('Massa de teste concluida.', { massaTesteId, docs: rows.length, commits });
  alert('Massa de teste criada: ' + rows.length + ' documentos. ID: ' + massaTesteId);
  return { massaTesteId, tenantId: J.tid, documentos: rows.length, commits };
})();
