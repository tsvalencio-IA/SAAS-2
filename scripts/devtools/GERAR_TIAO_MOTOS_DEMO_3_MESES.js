/*
 * thIAguinho SaaS - massa demonstrativa Tiao Motos / 3 meses
 * Uso: abrir jarvis.html logado na Tiao Motos, F12 > Console, colar tudo e Enter.
 * Grava no Firestore do tenant ativo. E idempotente: usa IDs fixos demo_tiao_3m_* e nao duplica ao rodar de novo.
 */
(async function gerarTiaoMotosDemo3Meses() {
  'use strict';

  const J = window.J || {};
  const db = window.db;
  const tenantId = J.tid || sessionStorage.getItem('j_tid') || '';
  const tenantNome = J.tnome || sessionStorage.getItem('j_tnome') || '';
  const prefix = 'demo_tiao_3m_';
  const agora = new Date();
  const DAY = 86400000;
  const out = [];

  const log = (status, item, detalhe) => out.push({ status, item, detalhe: detalhe || '' });
  const iso = d => {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };
  const daysAgo = n => iso(new Date(agora.getTime() - n * DAY));
  const br = n => +(Math.round(Number(n || 0) * 100) / 100).toFixed(2);
  const pick = (arr, i) => arr[i % arr.length];
  const cleanId = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]/g, '_');

  if (!db || !tenantId) throw new Error('Abra o jarvis.html logado antes de executar este script.');

  const pareceTiao = /tiao|ti[aã]o|motos/i.test(`${tenantId} ${tenantNome}`);
  if (!pareceTiao && !confirm(`Tenant atual: ${tenantNome || tenantId}\n\nEste script foi feito para Tiao Motos. Deseja gravar mesmo assim neste tenant?`)) return;
  if (!confirm(`Vou criar/atualizar massa demonstrativa de 3 meses em:\n${tenantNome || tenantId}\n\nColecoes: clientes, veiculos, funcionarios, estoqueItems, fornecedores, vendas_pecas, financeiro, ordens_servico, mensagens, notasFiscaisEntrada e auditoria.\n\nContinuar?`)) return;

  const funcionarios = [
    { id: `${prefix}func_gerente`, nome: 'Marcos Gerente', cargo: 'gerente', usuario: 'marcos.gerente', senha: '123456', comissao: 8, comissaoVenda: 3 },
    { id: `${prefix}func_mec_01`, nome: 'Rafael Mecanico', cargo: 'mecanico', usuario: 'rafael.motos', senha: '123456', comissao: 12, comissaoVenda: 0 },
    { id: `${prefix}func_mec_02`, nome: 'Lucas Eletrica', cargo: 'eletricista', usuario: 'lucas.eletrica', senha: '123456', comissao: 10, comissaoVenda: 0 },
    { id: `${prefix}func_vendas`, nome: 'Bruna Balcao', cargo: 'vendedor', usuario: 'bruna.balcao', senha: '123456', comissao: 0, comissaoVenda: 4 }
  ];

  const fornecedores = [
    { id: `${prefix}forn_01`, nome: 'Moto Pecas Rio Preto', segmento: 'Pecas de reposicao', wpp: '17991230001', cnpj: '11222333000181' },
    { id: `${prefix}forn_02`, nome: 'Distribuidora Duas Rodas', segmento: 'Pneus e transmissao', wpp: '17991230002', cnpj: '22333444000172' },
    { id: `${prefix}forn_03`, nome: 'LubriMoto Atacado', segmento: 'Oleo e filtros', wpp: '17991230003', cnpj: '33444555000163' },
    { id: `${prefix}forn_04`, nome: 'Eletrica Moto Center', segmento: 'Baterias e eletrica', wpp: '17991230004', cnpj: '44555666000154' }
  ];

  const clientes = [
    ['Joao Pereira', '17988880001'], ['Ana Souza', '17988880002'], ['Carlos Lima', '17988880003'],
    ['Patricia Gomes', '17988880004'], ['Eduardo Rocha', '17988880005'], ['Fernanda Alves', '17988880006'],
    ['Diego Martins', '17988880007'], ['Mariana Lopes', '17988880008'], ['Renato Castro', '17988880009'],
    ['Silvia Nunes', '17988880010'], ['Fabio Teixeira', '17988880011'], ['Camila Prado', '17988880012'],
    ['Roberto Dias', '17988880013'], ['Juliana Ramos', '17988880014'], ['Gustavo Melo', '17988880015'],
    ['Leticia Barros', '17988880016'], ['Andre Moreira', '17988880017'], ['Bianca Sales', '17988880018']
  ].map((c, i) => ({
    id: `${prefix}cli_${String(i + 1).padStart(2, '0')}`,
    nome: c[0], wpp: c[1], telefone: c[1], login: cleanId(c[0]).toLowerCase(), pin: '1234',
    cidade: 'Sao Jose do Rio Preto', uf: 'SP', origem: 'demo_tiao_3m'
  }));

  const modelos = [
    ['Honda CG 160 Fan', 'moto'], ['Honda Biz 125', 'moto'], ['Yamaha Fazer 250', 'moto'],
    ['Yamaha Factor 150', 'moto'], ['Honda NXR 160 Bros', 'moto'], ['Suzuki Yes 125', 'moto'],
    ['Honda PCX 160', 'moto'], ['Yamaha XTZ 150 Crosser', 'moto'], ['Honda CB 300F', 'moto']
  ];
  const placas = ['FAN1A23','BIZ2B34','FAZ3C45','FAC4D56','BRO5E67','YES6F78','PCX7G89','XTZ8H90','CBF9I01','CGT1J12','MOT2K23','DUA3L34','RPD4M45','SCO5N56','TRI6O67','RUA7P78','URB8Q89','RDS9R90'];
  const veiculos = clientes.map((c, i) => {
    const m = pick(modelos, i);
    return {
      id: `${prefix}vei_${String(i + 1).padStart(2, '0')}`,
      clienteId: c.id, placa: placas[i], modelo: m[0], tipo: m[1], ano: 2015 + (i % 9),
      km: 18000 + i * 2350, cor: pick(['Preta','Vermelha','Prata','Azul','Branca'], i), origem: 'demo_tiao_3m'
    };
  });

  const pecas = [
    ['OLEO10W30','Oleo 10W30 1L', 24, 38, 80, 12], ['FILTRO-CG160','Filtro de oleo CG/Fan 160', 12, 28, 34, 6],
    ['PAST-TR-CG','Pastilha freio traseira CG 160', 29, 58, 24, 5], ['PAST-DT-FAZ','Pastilha freio dianteira Fazer 250', 38, 79, 18, 4],
    ['KIT-REL-CG','Kit relacao CG 160', 98, 189, 12, 3], ['CABO-ACEL','Cabo acelerador universal', 18, 42, 20, 4],
    ['VELA-NGK-D8','Vela NGK D8EA', 14, 32, 40, 8], ['BATERIA-6AH','Bateria moto 6Ah', 115, 189, 10, 2],
    ['PNEU-80-100','Pneu dianteiro 80/100-18', 145, 245, 8, 2], ['PNEU-90-90','Pneu traseiro 90/90-18', 168, 279, 7, 2],
    ['LAMP-H4','Lampada H4 moto', 19, 39, 15, 4], ['RETRO-UNIV','Retrovisor universal par', 32, 69, 11, 2],
    ['MANETE-CG','Manete freio/embreagem CG', 16, 35, 14, 3], ['CAMARA-18','Camara de ar aro 18', 29, 59, 16, 3],
    ['FLUIDO-FREIO','Fluido de freio DOT4', 18, 36, 22, 4], ['LONA-FREIO','Lona de freio traseira', 24, 52, 13, 3]
  ].map((p, i) => ({
    id: `${prefix}peca_${String(i + 1).padStart(2, '0')}`,
    codigo: p[0], desc: p[1], descricao: p[1], custo: p[2], venda: p[3], qtd: p[4], min: p[5],
    fornecedorId: pick(fornecedores, i).id, fornecedor: pick(fornecedores, i).nome, origem: 'demo_tiao_3m'
  }));

  const servicosBase = [
    ['Troca de oleo e filtro', 45], ['Limpeza e regulagem de carburador', 120], ['Revisao preventiva completa', 260],
    ['Troca de relacao', 150], ['Substituir pastilha de freio', 85], ['Diagnostico eletrico', 95],
    ['Troca de pneu e balanceamento', 60], ['Regulagem de valvulas', 140], ['Reparo chicote iluminacao', 130]
  ];
  const defeitos = ['barulho na roda traseira', 'moto falhando em baixa', 'freio baixo', 'corrente escapando', 'luz fraca', 'revisao antes de viagem', 'pneu furado', 'partida pesada'];
  const statusFluxo = ['Entregue','Entregue','Entregue','Entregue','Pronto','Andamento','Aprovado','Orcamento_Enviado','Orcamento','Triagem'];

  const writes = [];
  function setDoc(col, id, data) {
    writes.push({ col, id, data: { tenantId, updatedAt: new Date().toISOString(), ...data } });
  }

  funcionarios.forEach(f => setDoc('funcionarios', f.id, { ...f, origem: 'demo_tiao_3m', createdAt: new Date().toISOString() }));
  fornecedores.forEach(f => setDoc('fornecedores', f.id, { ...f, createdAt: new Date().toISOString() }));
  clientes.forEach(c => setDoc('clientes', c.id, { ...c, createdAt: new Date().toISOString() }));
  veiculos.forEach(v => setDoc('veiculos', v.id, { ...v, createdAt: new Date().toISOString() }));
  pecas.forEach(p => setDoc('estoqueItems', p.id, { ...p, createdAt: new Date().toISOString() }));

  const osDocs = [];
  for (let i = 0; i < 54; i++) {
    const cliente = pick(clientes, i);
    const veiculo = veiculos.find(v => v.clienteId === cliente.id) || pick(veiculos, i);
    const st = pick(statusFluxo, i);
    const data = daysAgo(88 - i * 1.6);
    const s1 = pick(servicosBase, i);
    const s2 = i % 3 === 0 ? pick(servicosBase, i + 2) : null;
    const p1 = pick(pecas, i);
    const p2 = i % 4 === 0 ? pick(pecas, i + 5) : null;
    const servicos = [{ desc: s1[0], valor: s1[1], qtd: 1 }].concat(s2 ? [{ desc: s2[0], valor: s2[1], qtd: 1 }] : []);
    const pecaOS = [{ codigo: p1.codigo, desc: p1.desc, qtd: 1 + (i % 2), custo: p1.custo, venda: p1.venda }].concat(p2 ? [{ codigo: p2.codigo, desc: p2.desc, qtd: 1, custo: p2.custo, venda: p2.venda }] : []);
    const totalServ = servicos.reduce((s, v) => s + Number(v.valor || 0), 0);
    const totalPecas = pecaOS.reduce((s, v) => s + Number(v.venda || 0) * Number(v.qtd || 1), 0);
    const total = br(totalServ + totalPecas);
    const mec = pick(funcionarios.slice(1, 3), i);
    const id = `${prefix}os_${String(i + 1).padStart(3, '0')}`;
    const os = {
      id, clienteId: cliente.id, veiculoId: veiculo.id, cliente: cliente.nome, placa: veiculo.placa,
      tipo: 'moto', status: st, etapa: st, data, dataEntrada: data, updatedAt: data + 'T15:00:00.000Z',
      defeito: pick(defeitos, i), diagnostico: `Diagnostico demo: ${pick(defeitos, i)} em ${veiculo.modelo}.`,
      servicos, pecas: pecaOS, total, totalServicos: br(totalServ), totalPecas: br(totalPecas),
      mecId: mec.id, mecNome: mec.nome, km: veiculo.km + i * 120, origem: 'demo_tiao_3m'
    };
    osDocs.push(os);
    setDoc('ordens_servico', id, os);

    if (['Entregue','Pronto'].includes(st)) {
      const pago = st === 'Entregue';
      setDoc('financeiro', `${prefix}fin_os_${String(i + 1).padStart(3, '0')}`, {
        tipo: 'Entrada', status: pago ? 'Pago' : 'A Receber',
        desc: `Recebimento O.S. ${veiculo.placa} - ${cliente.nome}`,
        valor: total, pgto: pick(['PIX','Dinheiro','Credito'], i), venc: data, osId: id,
        categoria: 'recebimento_os', createdAt: data + 'T16:00:00.000Z'
      });
    }
  }

  for (let i = 0; i < 30; i++) {
    const data = daysAgo(86 - i * 2.7);
    const p1 = pick(pecas, i + 2);
    const p2 = i % 5 === 0 ? pick(pecas, i + 7) : null;
    const itens = [{ estoqueId: p1.id, codigo: p1.codigo, desc: p1.desc, qtd: 1 + (i % 2), unit: p1.venda, total: br(p1.venda * (1 + (i % 2))), custoUnit: p1.custo }];
    if (p2) itens.push({ estoqueId: p2.id, codigo: p2.codigo, desc: p2.desc, qtd: 1, unit: p2.venda, total: p2.venda, custoUnit: p2.custo });
    const total = br(itens.reduce((s, it) => s + it.total, 0));
    const cliente = pick(clientes, i + 4);
    const vendedor = funcionarios[3];
    const id = `${prefix}venda_${String(i + 1).padStart(3, '0')}`;
    setDoc('vendas_pecas', id, {
      tipo: 'autopecas', canal: pick(['varejo','balcao','atacado'], i), clienteNome: cliente.nome, clienteWpp: cliente.wpp,
      itens, bruto: total, desconto: i % 6 === 0 ? 5 : 0, total: br(total - (i % 6 === 0 ? 5 : 0)),
      pagamento: pick(['PIX','Dinheiro','Debito','Credito'], i), status: i % 7 === 0 ? 'A Receber' : 'Pago',
      vendedorId: vendedor.id, vendedorNome: vendedor.nome, comissaoPercentual: 4, comissaoValor: br(total * 0.04),
      data, createdAt: data + 'T10:30:00.000Z', origem: 'demo_tiao_3m'
    });
    setDoc('financeiro', `${prefix}fin_venda_${String(i + 1).padStart(3, '0')}`, {
      tipo: 'Entrada', status: i % 7 === 0 ? 'A Receber' : 'Pago', desc: `Venda balcao - ${cliente.nome}`,
      valor: br(total - (i % 6 === 0 ? 5 : 0)), pgto: pick(['PIX','Dinheiro','Debito','Credito'], i), venc: data,
      categoria: 'venda_autopecas', vendaId: id, createdAt: data + 'T10:35:00.000Z'
    });
  }

  for (let i = 0; i < 10; i++) {
    const data = daysAgo(85 - i * 8);
    const fornecedor = pick(fornecedores, i);
    const itens = [pick(pecas, i), pick(pecas, i + 5)].map((p, idx) => ({ codigo: p.codigo, desc: p.desc, qtd: 3 + idx, custo: p.custo, venda: p.venda }));
    const total = br(itens.reduce((s, it) => s + it.qtd * it.custo, 0));
    const nfId = `${prefix}nf_${String(i + 1).padStart(3, '0')}`;
    setDoc('notasFiscaisEntrada', nfId, {
      numero: `D${String(7000 + i)}`, serie: '1', fornecedorId: fornecedor.id, fornecedorNome: fornecedor.nome,
      fornecedorCNPJ: fornecedor.cnpj, dataNF: data, totalNF: total, totalSistema: total, itens, itensCount: itens.length,
      origem: 'demo_tiao_3m', createdAt: data + 'T09:00:00.000Z'
    });
    setDoc('financeiro', `${prefix}fin_nf_${String(i + 1).padStart(3, '0')}`, {
      tipo: 'Saída', status: i < 7 ? 'Pago' : 'Pendente', desc: `NF ${7000 + i} - ${fornecedor.nome}`,
      valor: total, pgto: 'Boleto', venc: daysAgo(80 - i * 8), notaFiscalId: nfId, fornecedorId: fornecedor.id,
      categoria: 'compra_pecas', createdAt: data + 'T09:10:00.000Z'
    });
  }

  [
    ['Aluguel oficina', 1850, 70], ['Energia eletrica', 420, 63], ['Internet e sistemas', 189, 58],
    ['Conta agua', 115, 45], ['Marketing local', 300, 32], ['Taxas maquininhas', 175, 20]
  ].forEach((e, i) => setDoc('financeiro', `${prefix}fin_fixo_${String(i + 1).padStart(2, '0')}`, {
    tipo: 'Saída', status: i < 5 ? 'Pago' : 'Pendente', desc: e[0], valor: e[1], pgto: 'Boleto',
    venc: daysAgo(e[2]), categoria: 'despesa_fixa', createdAt: daysAgo(e[2]) + 'T08:00:00.000Z'
  }));

  clientes.slice(0, 8).forEach((c, i) => {
    setDoc('mensagens', `${prefix}msg_cli_${String(i + 1).padStart(2, '0')}`, {
      clienteId: c.id, sender: i % 2 ? 'cliente' : 'admin',
      autorTipo: i % 2 ? 'cliente' : 'equipe', autorId: funcionarios[0].id, autorNome: funcionarios[0].nome, autorCargo: funcionarios[0].cargo,
      msg: i % 2 ? 'Bom dia, minha moto ja ficou pronta?' : 'Bom dia. Sua moto esta em acompanhamento; qualquer novidade avisamos por aqui.',
      lidaAdmin: true, lidaCliente: false, ts: new Date(agora.getTime() - (20 - i) * DAY).getTime()
    });
  });

  setDoc('lixeira_auditoria', `${prefix}auditoria_execucao`, {
    modulo: 'DEMO', acao: 'Massa demonstrativa Tiao Motos 3 meses criada/atualizada via DevTools',
    usuario: J.nome || 'Jarvis', ts: new Date().toISOString()
  });

  async function commitAll() {
    let batch = db.batch();
    let count = 0;
    let total = 0;
    for (const w of writes) {
      batch.set(db.collection(w.col).doc(w.id), w.data, { merge: true });
      count++;
      total++;
      if (count >= 430) {
        await batch.commit();
        log('OK', 'batch', `${total} gravacoes`);
        batch = db.batch();
        count = 0;
      }
    }
    if (count) {
      await batch.commit();
      log('OK', 'batch final', `${total} gravacoes`);
    }
    return total;
  }

  try {
    const total = await commitAll();
    log('OK', 'Resumo', `${clientes.length} clientes, ${veiculos.length} motos, ${pecas.length} pecas, ${osDocs.length} OS, ${total} gravacoes.`);
    console.table(out);
    if (typeof window.toast === 'function') window.toast(`Demo Tiao Motos criada: ${total} gravacoes.`, 'ok');
    return { ok: true, tenantId, total, detalhes: out };
  } catch (e) {
    console.error('[DEMO TIAO MOTOS]', e);
    log('FALHA', 'Firestore', e.message || e);
    console.table(out);
    if (typeof window.toast === 'function') window.toast('Erro ao criar demo: ' + (e.message || e), 'err');
    throw e;
  }
})();
