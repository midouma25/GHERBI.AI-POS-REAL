/**
 * perf-core/zreport-external-funding-stage6c.js
 * الشطر 6-ج: دمج المعاملات الممولة من خارج درج الكاشير في Z-Report (80mm/A4) ونافذة مراجعة الوردية
 */
'use strict';
(function buildStage6CZReportExternalFundingBridge() {
  (function initWarStage6CZReportExternalFunding() {
    'use strict';

    if (window.GherbiZReportExternalFunding6C && window.GherbiZReportExternalFunding6C._installed) return;

    function esc(s) {
      return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function fmtDzd(v) {
      return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' د.ج';
    }

    const Bridge6C = {
      _installed: true,
      version: '6C.0.0-zreport-external-funding',
      _cacheBySession: new Map(),

      async fetchForSession(sessionId) {
        const sid = Number(sessionId || 0);
        if (!sid || !window.api || typeof window.api.getShiftExternalFunding !== 'function') {
          return { items: [], totals: { shop_vault: 0, bank_ccp: 0, external_owner: 0, grandTotal: 0, count: 0 } };
        }
        try {
          const res = await window.api.getShiftExternalFunding(sid);
          if (res && res.success) {
            this._cacheBySession.set(sid, res);
            return res;
          }
        } catch (_) {}
        return { items: [], totals: { shop_vault: 0, bank_ccp: 0, external_owner: 0, grandTotal: 0, count: 0 } };
      },

      // تغليف PSP.router.printDocumentByType لضمان تزويد تقارير Z-Report بالمعاملات الخارجية تلقائياً قبل الطباعة
      hookPrintRouter() {
        const PSP = window.GherbiPrintStudioPro;
        if (!PSP || !PSP.router || PSP.router._s6cZReportAutoHydrated) return false;
        PSP.router._s6cZReportAutoHydrated = true;

        const origPrintByType = PSP.router.printDocumentByType.bind(PSP.router);
        PSP.router.printDocumentByType = async (docType, docData, opts) => {
          if ((["receipt_thermal","caisse_z_report","caisse_shift_full_audit_a4","caisse_cash_in_voucher_80mm"].includes(docType)) && docData && typeof docData === 'object') {
            const dossier = docData.forensicDossier || docData.shiftSummary || null;
            const sid = Number(
              (dossier && dossier.session && dossier.session.id) ||
              (dossier && dossier.sessionId) ||
              docData.sessionId ||
              0
            );
            const alreadyHas = Array.isArray(docData.externalFundedTx) || (dossier && Array.isArray(dossier.externalFundedTx));
            if (sid > 0 && !alreadyHas) {
              const ext = await this.fetchForSession(sid);
              docData.externalFundedTx = ext.items || [];
              docData.externalFundedTotals = ext.totals || { shop_vault: 0, bank_ccp: 0, external_owner: 0, grandTotal: 0, count: 0 };
              if (dossier) {
                dossier.externalFundedTx = docData.externalFundedTx;
                dossier.externalFundedTotals = docData.externalFundedTotals;
              }
            }
          }
          return await origPrintByType(docType, docData, opts);
        };
        return true;
      },

      // حقن بطاقة "المعاملات المموّلة خارج درج الكاشير" في نافذة مراجعة تفاصيل المناوبة (#reviewCaisseModal)
      async hydrateReviewCaisseModal(explicitSessionId) {
        const modal = document.getElementById('reviewCaisseModal');
        const body = document.getElementById('reviewCaisseModalBody');
        const title = document.getElementById('reviewCaisseModalTitle');
        if (!modal || !body) return false;

        let sid = Number(explicitSessionId || 0);
        if (!sid && title) {
          const m = String(title.textContent || '').match(/#(\d+)/);
          if (m) sid = Number(m[1]);
        }
        if (!sid) {
          const m2 = String(body.textContent || '').match(/مناوبة\s*#(\d+)|وردية\s*#(\d+)/);
          if (m2) sid = Number(m2[1] || m2[2]);
        }
        if (!sid) return false;

        if (body.querySelector('#s6cReviewModalExtFundingCard[data-sid="' + sid + '"]')) return true;

        const ext = await this.fetchForSession(sid);
        const items = ext.items || [];
        const t = ext.totals || { shop_vault: 0, bank_ccp: 0, external_owner: 0, grandTotal: 0, count: 0 };

        const old = body.querySelector('#s6cReviewModalExtFundingCard');
        if (old) old.remove();

        const card = document.createElement('div');
        card.id = 's6cReviewModalExtFundingCard';
        card.setAttribute('data-sid', String(sid));
        card.style.cssText = 'margin-top:10px;padding:12px;border-radius:14px;border:1.5px solid #0284c7;background:linear-gradient(135deg,#f0f9ff 0%,#ffffff 100%);direction:rtl;text-align:right;color:#0f172a;';

        const rowsHtml = items.length === 0
          ? '<div style="text-align:center;color:#0369a1;font-weight:800;padding:8px;">لا توجد مدفوعات مموّلة من خارج درج الكاشير خلال الوردية #' + sid + '.</div>'
          : items.map((it, idx) => (
              '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;border-bottom:1px dotted #bae6fd;font-size:11.5px;">' +
                '<div><strong>' + (idx + 1) + '. ' + esc(it.partyName) + '</strong> <span style="color:#0369a1;font-weight:900;">[' + esc(it.sourceLabel) + ']</span> — <span style="color:#475569;">' + esc(it.notes) + '</span></div>' +
                '<strong style="font-family:monospace;color:#b45309;">' + fmtDzd(it.amount) + '</strong>' +
              '</div>'
            )).join('');

        card.innerHTML =
          '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1.5px dashed #7dd3fc;padding-bottom:6px;margin-bottom:8px;">' +
            '<span style="font-weight:900;font-size:13px;color:#0c4a6e;">🏦 معاملات مموّلة من خارج درج الكاشير خلال الوردية #' + sid + ' (' + items.length + ')</span>' +
            '<strong style="font-family:monospace;font-size:13px;color:#b45309;">' + fmtDzd(t.grandTotal) + '</strong>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;font-size:11.5px;font-weight:900;">' +
            '<div style="background:#eef2ff;padding:6px 8px;border-radius:9px;color:#3730a3;">🔐 الخزينة الرئيسية: ' + fmtDzd(t.shop_vault) + '</div>' +
            '<div style="background:#e0f2fe;padding:6px 8px;border-radius:9px;color:#0369a1;">🏦 بنك / CCP: ' + fmtDzd(t.bank_ccp) + '</div>' +
            '<div style="background:#fef3c7;padding:6px 8px;border-radius:9px;color:#92400e;">👤 مال خارجي / المالك: ' + fmtDzd(t.external_owner) + '</div>' +
          '</div>' +
          '<div>' + rowsHtml + '</div>' +
          '<div style="margin-top:6px;padding:5px 8px;border-radius:8px;background:#ecfdf5;border:1px solid #6ee7b7;color:#065f46;font-size:11px;font-weight:900;text-align:center;">' +
            '✅ هذه المبالغ خارج درج الكاشير ولم تُخصم من الرصيد المتوقع للصندوق.' +
          '</div>';

        body.appendChild(card);
        return true;
      },

      boot() {
        this.hookPrintRouter();
        let k = 0;
        const iv = setInterval(() => {
          k++;
          if (this.hookPrintRouter() || k >= 35) clearInterval(iv);
        }, 120);

        if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
          const revBody = document.getElementById('reviewCaisseModalBody');
          if (revBody && !revBody._s6cObs) {
            revBody._s6cObs = true;
            let t = null;
            const obs = new MutationObserver(() => {
              clearTimeout(t);
              t = setTimeout(() => this.hydrateReviewCaisseModal(), 80);
            });
            obs.observe(revBody, { childList: true });
          }
        }
        console.log('🛡️ [WAR STAGE 6C]: ربط معاملات الخزينة الرئيسية والبنك والمال الخارجي بـ Z-Report (80mm / A4) جاهز 100%.');
      }
    };

    window.GherbiZReportExternalFunding6C = Bridge6C;
    Bridge6C.boot();
  })();
})();
