/** OFICIN-IA V26.1 — proteção da visão do mecânico por serviço e rateio interno.
 * Hotfix: usa a sessão lexical J do equipe.html (não apenas window.J) e
 * mantém compatibilidade com vínculos legados por ID, nome ou login.
 */
(function(){
  'use strict';

  function sessao(){
    try { if (typeof J !== 'undefined' && J) return J; } catch (_) {}
    return window.J || {
      fid: sessionStorage.getItem('j_fid') || '',
      nome: sessionStorage.getItem('j_nome') || '',
      role: sessionStorage.getItem('j_role') || ''
    };
  }
  function norm(v){
    return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  }
  function role(){ return norm(sessao().role); }
  function gestor(){ return ['gerente','gestor','admin','superadmin','dono'].includes(role()); }
  function rateios(s){ return Array.isArray(s?.rateiosComissao) ? s.rateiosComissao : []; }
  function idsUsuario(){
    const s=sessao();
    return [s.fid, sessionStorage.getItem('j_fid')].map(v=>String(v||'').trim()).filter(Boolean);
  }
  function nomesUsuario(){
    const s=sessao();
    return [s.nome, sessionStorage.getItem('j_nome'), sessionStorage.getItem('j_login')].map(norm).filter(Boolean);
  }
  function combinaPessoa(id,nome){
    const idTxt=String(id||'').trim();
    const nomeTxt=norm(nome);
    return (idTxt && idsUsuario().includes(idTxt)) || (nomeTxt && nomesUsuario().includes(nomeTxt));
  }
  function serviceOwn(s,os){
    const r=rateios(s);
    if(r.length) return r.some(x=>combinaPessoa(x?.mecId||x?.id, x?.mecNome||x?.nome||x?.login));
    if(combinaPessoa(s?.mecId||s?.mecanicoId||s?.responsavelId, s?.mecNome||s?.mecanicoNome||s?.responsavelNome||s?.responsavel)) return true;
    return combinaPessoa(os?.mecId||os?.mecanicoId||os?.responsavelId, os?.mecNome||os?.mecanicoNome||os?.responsavelNome||os?.responsavel);
  }
  function own(os){
    if(gestor()) return true;
    if(!idsUsuario().length && !nomesUsuario().length) return false;
    const servs=Array.isArray(os?.servicos)?os.servicos:[];
    const temAtribuicao=servs.some(s=>rateios(s).length||s?.mecId||s?.mecanicoId||s?.responsavelId||s?.mecNome||s?.mecanicoNome||s?.responsavelNome);
    if(temAtribuicao) return servs.some(s=>serviceOwn(s,os));
    if(combinaPessoa(os?.mecId||os?.mecanicoId||os?.responsavelId, os?.mecNome||os?.mecanicoNome||os?.responsavelNome)) return true;
    if((os?.mecIds||[]).some(x=>combinaPessoa(x,''))) return true;
    if((os?.mecanicos||[]).some(x=>combinaPessoa(x?.id||x?.mecId, x?.nome||x?.mecNome||x?.login))) return true;
    return false;
  }

  window.equipeServicoPertenceAoUsuarioV22=function(s,os){ return gestor() || serviceOwn(s,os||{}); };
  window.equipePodeConsultarOSV21=own;
  function boot(){
    const s=sessao();
    window.J_EQUIPE_SESSAO = {fid:s.fid||'', nome:s.nome||'', role:s.role||''};
    const label=document.querySelector('#kpiComissao .mec-kpi-label');
    if(label) label.textContent='COMISSÕES RECEBIDAS';
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
