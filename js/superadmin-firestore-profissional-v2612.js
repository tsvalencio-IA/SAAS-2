/** OFICIN-IA V26.12 — Superadmin com listeners limitados. */
(function (W, D) {
  'use strict';
  if (W.__SUPERADMIN_FIRESTORE_PRO_V2612__) return;
  W.__SUPERADMIN_FIRESTORE_PRO_V2612__ = true;
  const RT = () => W.ThiaFirestoreV2612;
  const DB = () => W.db;

  function install() {
    if (!RT() || !DB()) return;
    W.escutarTenants = function () {
      const q = DB().collection('oficinas');
      return RT().listen('super:oficinas', q, { apply: snap => {
        allTenants = RT().docs(snap);
        renderTenants(); renderDashboard();
        const sel = D.getElementById('sfTenant');
        if (sel) sel.innerHTML = '<option value="">Avulso</option>' + allTenants.map(t => `<option value="${t.id}">${t.nomeFantasia || t.id}</option>`).join('');
      }});
    };
    W.escutarSaasFin = function () {
      const base = DB().collection('saas_financeiro');
      return RT().listen('super:saas-financeiro', base.orderBy('data','desc').limit(1000), {
        fallback: () => base.limit(1000),
        apply: snap => { allSaasFin = RT().docs(snap).sort((a,b)=>String(b.data||'').localeCompare(String(a.data||''))); renderSaasFin(); }
      });
    };
    W.escutarAuditoria = function () {
      const base = DB().collection('lixeira_auditoria');
      return RT().listen('super:auditoria', base.orderBy('ts','desc').limit(300), {
        fallback: () => base.limit(300),
        apply: snap => { allAudit = RT().docs(snap).sort((a,b)=>String(b.ts||'').localeCompare(String(a.ts||''))); renderAuditoria(); }
      });
    };
    D.documentElement.dataset.thiaSuperFirestore = 'profissional-v2612';
  }
  install();
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', install, { once:true });
  console.info('[OFICIN-IA] Superadmin Firestore profissional V26.12.0 ativo');
})(window, document);
