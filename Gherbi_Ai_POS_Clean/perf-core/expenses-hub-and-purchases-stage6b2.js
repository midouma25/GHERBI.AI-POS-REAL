/**
 * perf-core/expenses-hub-and-purchases-stage6b2.js
 * الشطر 6-ب2: مركز قيادة المصاريف والمدفوعات الشامل + السندات والتقارير (80mm/A4) + إصلاح استوديو المشتريات الذكي
 */
'use strict';
(function buildStage6B2ExpensesHubAndPurchasesFix() {
  (function initWarStage6B2ExpensesHubAndPurchases() {
    'use strict';

    if (window.GherbiExpensesHubStage6B2 && window.GherbiExpensesHubStage6B2._installed) return;

    function esc(s) {
      return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function fmtDzd(v) {
      return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' د.ج';
    }

    const Hub = {
      _installed: true,
      version: '6B2.0.0-unified-expenses-and-smart-supply',
      _lastReportData: null,
      _hubFilter: {
        scope: 'today',
        dateFrom: new Date().toISOString().slice(0, 10),
        dateTo: new Date().toISOString().slice(0, 10),
        sessionId: '',
        fundingSource: 'all',
        includeSuppliers: true,
        includePurchases: true
      },

      async getTreasuryStatus() {
        const uid = window.AppState?.currentUser?.id || null;
        try {
          if (window.api && typeof window.api.getTreasuryStatus === 'function') {
            return await window.api.getTreasuryStatus(uid);
          }
        } catch (_) {}
        return { hasOpenShift: false, sessionId: null, drawerExpectedCash: 0, vaultBalance: 0, externalPaidInShift: 0 };
      },

      // ======================================================================
      // 1. طباعة سند صرف واحد (80mm أو A4) عبر مركز الطباعة المعتمد
      // ======================================================================
      async printSingleVoucher(item, paper = '80mm', opts = {}) {
        const PSP = window.GherbiPrintStudioPro;
        if (!PSP || !PSP.router) return;
        const docType = paper === 'a4' ? 'expense_voucher_a4' : 'expense_voucher';
        const docData = {
          docNumber: item.docRef || ('EXP-' + String(item.rawId || Date.now()).slice(-4)),
          date: (item.date || new Date().toISOString().slice(0, 10)) + (item.time ? (' ' + item.time) : ''),
          partyName: item.beneficiary || item.category || 'المستفيد',
          cashierName: window.AppState?.currentUser?.name || 'المدير العام',
          total: Number(item.amount || 0),
          paidAmount: Number(item.amount || 0),
          remainingDebt: 0,
          expenseVoucher: {
            docRef: item.docRef || 'EXP-0001',
            date: item.date || new Date().toISOString().slice(0, 10),
            time: item.time || '',
            category: item.category || 'مصاريف عامة',
            beneficiary: item.beneficiary || 'غير محدد',
            description: item.description || item.category || 'مصروف تشغيلي',
            amount: Number(item.amount || 0),
            fundingSource: item.fundingSource || 'active_shift',
            fundingLabel: item.fundingLabel || 'درج الوردية',
            externalPayer: item.externalPayer || '',
            sessionId: item.sessionId || null,
            cashierName: window.AppState?.currentUser?.name || 'المدير العام'
          },
          items: [{
            barcode: item.docRef || 'EXP',
            name: (item.category || 'مصروف') + ' — ' + (item.description || ''),
            unit: 'سند',
            qty: 1,
            price: Number(item.amount || 0),
            subtotal: Number(item.amount || 0)
          }]
        };
        if (opts.renderOnly) {
          return PSP.router.renderDoc(docType, docData, opts.asPdf ? 'pdf' : 'print', { forceOverride: false });
        }
        return await PSP.router.printDocumentByType(docType, docData, {
          silent: Boolean(opts.silent),
          asPdf: Boolean(opts.asPdf)
        });
      },

      // ======================================================================
      // 2. طباعة التقرير النهائي الشامل للمصاريف والمدفوعات (80mm أو A4)
      // ======================================================================
      async printUnifiedOutflowsReport(filtersOverride, paper = 'a4', opts = {}) {
        const PSP = window.GherbiPrintStudioPro;
        if (!PSP || !PSP.router) return null;

        const filters = Object.assign({}, this._hubFilter, filtersOverride || {});
        let rep = opts.reportDataOverride || null;
        if (!rep && window.api && typeof window.api.getUnifiedOutflowsReport === 'function') {
          rep = await window.api.getUnifiedOutflowsReport(filters);
        }
        if (!rep) return null;
        this._lastReportData = rep;

        const docType = paper === '80mm' ? 'expenses_period_report_80mm' : 'expenses_period_report_a4';
        const docData = {
          docNumber: 'OUT-' + new Date().toISOString().slice(0, 10).replace(/-/g, ''),
          date: new Date().toISOString().replace('T', ' ').slice(0, 16),
          cashierName: window.AppState?.currentUser?.name || 'المدير العام',
          total: Number((rep.totals && rep.totals.grandTotal) || 0),
          paidAmount: Number((rep.totals && rep.totals.grandTotal) || 0),
          outflowsReport: rep
        };

        if (opts.renderOnly) {
          return PSP.router.renderDoc(docType, docData, opts.asPdf ? 'pdf' : 'print', { forceOverride: false });
        }
        return await PSP.router.printDocumentByType(docType, docData, {
          silent: Boolean(opts.silent),
          asPdf: Boolean(opts.asPdf)
        });
      },

      // ======================================================================
      // 3. فتح نافذة تسديد سريع لمورد أو فاتورة شراء مباشرةً من داخل صفحة المصاريف
      // ======================================================================
      async openQuickSupplierPayPicker() {
        const existing = document.getElementById('s6b2QuickSupPickerModal');
        if (existing) existing.remove();

        const suppliers = (window.api && typeof window.api.getSuppliers === 'function')
          ? await window.api.getSuppliers().catch(() => [])
          : (window.AppState?.suppliers || []);
        if (Array.isArray(suppliers) && window.AppState) window.AppState.suppliers = suppliers;

        const overlay = document.createElement('div');
        overlay.id = 's6b2QuickSupPickerModal';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;direction:rtl;';

        const rowsHtml = (suppliers || []).map((s) => {
          const debt = Number(s.debt_due !== undefined ? s.debt_due : Math.max(0, Number(s.total_debt || 0)));
          const adv = Number(s.advance_balance !== undefined ? s.advance_balance : (Number(s.total_debt || 0) < 0 ? Math.abs(Number(s.total_debt || 0)) : 0));
          const statusBadge = debt > 0.009
            ? '<span style="color:#be123c;font-weight:900;">دين علينا: ' + fmtDzd(debt) + '</span>'
            : adv > 0.009
            ? '<span style="color:#0284c7;font-weight:900;">💎 تسبقة لنا: ' + fmtDzd(adv) + '</span>'
            : '<span style="color:#059669;font-weight:800;">✅ خالص (0.00 د.ج)</span>';
          return (
            '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;margin-bottom:6px;">' +
              '<div><div style="font-weight:900;color:#0f172a;font-size:12px;">' + esc(s.name) + '</div><div style="font-size:11px;">' + statusBadge + '</div></div>' +
              '<button type="button" data-pick-sup-id="' + Number(s.id) + '" style="padding:6px 12px;border-radius:9px;border:none;background:' + (debt > 0.009 ? '#059669' : '#2563eb') + ';color:#fff;font-size:11px;font-weight:900;cursor:pointer;">' + (debt > 0.009 ? '💵 تسديد الآن' : '💎 منح تسبقة') + '</button>' +
            '</div>'
          );
        }).join('') || '<div style="text-align:center;color:#64748b;padding:20px;">لا يوجد موردون مسجلون حالياً.</div>';

        overlay.innerHTML =
          '<div style="width:100%;max-width:520px;background:#f8fafc;border-radius:18px;padding:18px;box-shadow:0 24px 50px rgba(0,0,0,0.35);max-height:82vh;display:flex;flex-direction:column;gap:10px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #cbd5e1;padding-bottom:8px;">' +
              '<span style="font-size:15px;font-weight:900;color:#0f172a;">🚚 تسديد حساب مورد أو منح تسبقة (بالمصادر الأربعة)</span>' +
              '<button type="button" data-close-s6b2="1" style="border:none;background:#e2e8f0;width:28px;height:28px;border-radius:8px;font-weight:900;cursor:pointer;">✕</button>' +
            '</div>' +
            '<div style="overflow-y:auto;max-height:58vh;">' + rowsHtml + '</div>' +
          '</div>';

        overlay.addEventListener('click', (ev) => {
          if (ev.target === overlay || (ev.target.closest && ev.target.closest('[data-close-s6b2="1"]'))) {
            overlay.remove();
            return;
          }
          const btn = ev.target.closest && ev.target.closest('[data-pick-sup-id]');
          if (btn) {
            const sid = Number(btn.getAttribute('data-pick-sup-id'));
            overlay.remove();
            if (window.App && typeof window.App.openSupplierPaymentModal === 'function') {
              window.App.openSupplierPaymentModal(sid);
            } else if (window.App && typeof window.App.openModal === 'function') {
              const inp = document.getElementById('supPaySupplierId');
              if (inp) inp.value = String(sid);
              window.App.openModal('supplierPaymentModal');
              window.GherbiTreasuryStage6A?.hydrateSupplierPaymentModal?.(sid);
            }
          }
        });
        document.body.appendChild(overlay);
      },

      async openQuickPurchasePayPicker() {
        const existing = document.getElementById('s6b2QuickPurchPickerModal');
        if (existing) existing.remove();

        const [openInvs, tr] = await Promise.all([
          (window.api && typeof window.api.getOpenPurchaseInvoices === 'function')
            ? window.api.getOpenPurchaseInvoices().catch(() => [])
            : Promise.resolve([]),
          this.getTreasuryStatus()
        ]);

        const overlay = document.createElement('div');
        overlay.id = 's6b2QuickPurchPickerModal';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;direction:rtl;';

        const rowsHtml = (openInvs || []).map((inv) => {
          const due = Number(inv.remaining_due || Math.max(0, Number(inv.total || 0) - Number(inv.paid_amount || 0)));
          return (
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 11px;border:1px solid #e2e8f0;border-radius:11px;background:#fff;margin-bottom:6px;">' +
              '<div><div style="font-weight:900;color:#0f172a;font-size:12px;">فاتورة #' + esc(inv.invoice_number || inv.id) + ' — ' + esc(inv.supplier_name || 'مورد') + '</div>' +
              '<div style="font-size:11px;color:#be123c;font-weight:800;">المتبقي للدفع: ' + fmtDzd(due) + ' (الإجمالي: ' + fmtDzd(inv.total) + ')</div></div>' +
              '<div style="display:flex;align-items:center;gap:5px;">' +
                '<input type="number" step="any" value="' + due.toFixed(2) + '" data-pay-inv-amt="' + inv.id + '" style="width:92px;padding:5px 7px;border:1px solid #cbd5e1;border-radius:8px;font-family:monospace;font-weight:900;font-size:11.5px;text-align:center;" />' +
                '<button type="button" data-pay-inv-btn="' + inv.id + '" style="padding:6px 11px;border-radius:9px;border:none;background:#059669;color:#fff;font-size:11px;font-weight:900;cursor:pointer;">✅ تسديد</button>' +
              '</div>' +
            '</div>'
          );
        }).join('') || '<div style="text-align:center;color:#059669;font-weight:900;padding:24px;">✅ جميع فواتير الشراء مسددة بالكامل حالياً!</div>';

        const defSrc = tr && tr.hasOpenShift ? 'active_shift' : 'shop_vault';

        overlay.innerHTML =
          '<div style="width:100%;max-width:600px;background:#f8fafc;border-radius:18px;padding:18px;box-shadow:0 24px 50px rgba(0,0,0,0.35);max-height:84vh;display:flex;flex-direction:column;gap:10px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #cbd5e1;padding-bottom:8px;">' +
              '<span style="font-size:15px;font-weight:900;color:#0f172a;">🛍️ تسديد فواتير الشراء المفتوحة مباشرةً</span>' +
              '<button type="button" data-close-s6b2="1" style="border:none;background:#e2e8f0;width:28px;height:28px;border-radius:8px;font-weight:900;cursor:pointer;">✕</button>' +
            '</div>' +
            '<div style="padding:8px 10px;border-radius:11px;border:1.5px solid #93c5fd;background:#eff6ff;display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:11.5px;font-weight:800;">' +
              '<span style="color:#1d4ed8;">🏦 مصدر المال:</span>' +
              '<select id="s6b2QuickPurchSrc" style="flex:1;padding:5px 8px;border-radius:8px;border:1px solid #93c5fd;font-weight:800;">' +
                '<option value="active_shift"' + (defSrc === 'active_shift' ? ' selected' : '') + '>💵 درج الوردية المفتوحة (' + (tr.hasOpenShift ? fmtDzd(tr.drawerExpectedCash) : 'مغلقة') + ')</option>' +
                '<option value="shop_vault"' + (defSrc === 'shop_vault' ? ' selected' : '') + '>🔐 الخزينة الرئيسية (' + fmtDzd(tr.vaultBalance) + ')</option>' +
                '<option value="bank_ccp">🏦 بنك / CCP / شيك</option>' +
                '<option value="external_owner">👤 مال خارجي / المالك</option>' +
              '</select>' +
              '<input id="s6b2QuickPurchExt" type="text" placeholder="اسم الدافع الخارجي..." style="display:none;width:150px;padding:5px 8px;border-radius:8px;border:1px solid #cbd5e1;font-size:11px;font-weight:800;" />' +
            '</div>' +
            '<div id="s6b2QuickPurchErr" style="display:none;padding:7px 10px;border-radius:9px;background:#fff1f2;border:1px solid #fda4af;color:#be123c;font-size:11px;font-weight:900;"></div>' +
            '<div style="overflow-y:auto;max-height:52vh;">' + rowsHtml + '</div>' +
          '</div>';

        const srcSel = overlay.querySelector('#s6b2QuickPurchSrc');
        const extInp = overlay.querySelector('#s6b2QuickPurchExt');
        const errBox = overlay.querySelector('#s6b2QuickPurchErr');
        srcSel?.addEventListener('change', () => {
          if (extInp) extInp.style.display = srcSel.value === 'external_owner' ? 'block' : 'none';
          if (errBox) errBox.style.display = 'none';
        });

        overlay.addEventListener('click', async (ev) => {
          if (ev.target === overlay || (ev.target.closest && ev.target.closest('[data-close-s6b2="1"]'))) {
            overlay.remove();
            return;
          }
          const btn = ev.target.closest && ev.target.closest('[data-pay-inv-btn]');
          if (!btn) return;
          const invId = Number(btn.getAttribute('data-pay-inv-btn'));
          const amtInp = overlay.querySelector('[data-pay-inv-amt="' + invId + '"]');
          const amt = Number(amtInp ? amtInp.value : 0);
          const funding_source = srcSel ? srcSel.value : 'active_shift';
          const external_payer = extInp ? extInp.value.trim() : '';

          const res = await window.api.addInvoicePayment(invId, amt, new Date().toISOString(), {
            payment_method: funding_source === 'bank_ccp' ? 'cib' : 'cash',
            funding_source,
            external_payer,
            userId: window.AppState?.currentUser?.id || null
          });

          if (!res || res.success === false) {
            if (errBox) {
              errBox.style.display = 'block';
              errBox.textContent = (res && res.message) || 'تعذر تسديد فاتورة الشراء.';
            }
            return;
          }

          window.App?.showToast?.('✅ تم تسديد دفعة فاتورة الشراء (' + fmtDzd(res.appliedAmount || amt) + ') — ' + (res.fundingLabel || ''), 'success');
          overlay.remove();
          this.refreshUnifiedOutflowsPanel();
        });

        document.body.appendChild(overlay);
      },

      // ======================================================================
      // 4. نافذة استوديو طباعة التقرير النهائي الشامل للمصاريف والتدفقات (يوم/فترة/وردية)
      // ======================================================================
      async openOutflowsReportStudioModal() {
        const existing = document.getElementById('s6b2OutflowsReportModal');
        if (existing) existing.remove();

        const rep = (window.api && typeof window.api.getUnifiedOutflowsReport === 'function')
          ? await window.api.getUnifiedOutflowsReport(this._hubFilter).catch(() => null)
          : null;
        const sessions = (rep && rep.sessions) || [];

        const overlay = document.createElement('div');
        overlay.id = 's6b2OutflowsReportModal';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.68);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;direction:rtl;';

        const shiftOpts = sessions.map((s) =>
          '<option value="' + Number(s.id) + '">وردية #' + Number(s.id) + ' — ' + esc(s.user_name || 'كاشير') + ' (' + esc(String(s.opened_at || '').slice(0, 16)) + ')</option>'
        ).join('');

        const f = this._hubFilter;
        overlay.innerHTML =
          '<div style="width:100%;max-width:560px;background:#ffffff;border-radius:18px;padding:20px;box-shadow:0 24px 55px rgba(0,0,0,0.38);display:flex;flex-direction:column;gap:12px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1.5px solid #e2e8f0;padding-bottom:8px;">' +
              '<span style="font-size:15.5px;font-weight:900;color:#0f172a;">🖨️ استوديو طباعة التقرير النهائي للمصاريف والتدفقات الخارجة</span>' +
              '<button type="button" data-close-rep="1" style="border:none;background:#f1f5f9;width:30px;height:30px;border-radius:9px;font-weight:900;cursor:pointer;">✕</button>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:11.5px;font-weight:800;">' +
              '<div><label style="display:block;margin-bottom:4px;color:#334155;">📅 النطاق الزمني:</label>' +
                '<select id="s6b2RepScope" style="width:100%;padding:7px 9px;border-radius:10px;border:1.5px solid #cbd5e1;font-weight:800;">' +
                  '<option value="today"' + (f.scope === 'today' ? ' selected' : '') + '>اليوم فقط</option>' +
                  '<option value="yesterday"' + (f.scope === 'yesterday' ? ' selected' : '') + '>الأمس</option>' +
                  '<option value="week"' + (f.scope === 'week' ? ' selected' : '') + '>آخر 7 أيام</option>' +
                  '<option value="month"' + (f.scope === 'month' ? ' selected' : '') + '>هذا الشهر</option>' +
                  '<option value="range"' + (f.scope === 'range' ? ' selected' : '') + '>فترة مخصصة (من -> إلى)</option>' +
                  '<option value="shift"' + (f.scope === 'shift' ? ' selected' : '') + '>حسب وردية محددة (مناوبة)</option>' +
                  '<option value="all"' + (f.scope === 'all' ? ' selected' : '') + '>جميع الفترات</option>' +
                '</select></div>' +
              '<div><label style="display:block;margin-bottom:4px;color:#334155;">🏦 فلترة مصدر المال:</label>' +
                '<select id="s6b2RepSource" style="width:100%;padding:7px 9px;border-radius:10px;border:1.5px solid #cbd5e1;font-weight:800;">' +
                  '<option value="all">الكل (جميع المصادر الأربعة)</option>' +
                  '<option value="active_shift">💵 درج الوردية فقط</option>' +
                  '<option value="shop_vault">🔐 الخزينة الرئيسية فقط</option>' +
                  '<option value="bank_ccp">🏦 البنك / CCP / شيك فقط</option>' +
                  '<option value="external_owner">👤 المال الخارجي / المالك فقط</option>' +
                '</select></div>' +
            '</div>' +
            '<div id="s6b2RepRangeRow" style="display:' + (f.scope === 'range' ? 'grid' : 'none') + ';grid-template-columns:1fr 1fr;gap:10px;font-size:11.5px;font-weight:800;">' +
              '<div><label style="display:block;margin-bottom:3px;">من تاريخ:</label><input id="s6b2RepFrom" type="date" value="' + esc(f.dateFrom) + '" style="width:100%;padding:6px 8px;border-radius:9px;border:1px solid #cbd5e1;font-family:monospace;" /></div>' +
              '<div><label style="display:block;margin-bottom:3px;">إلى تاريخ:</label><input id="s6b2RepTo" type="date" value="' + esc(f.dateTo) + '" style="width:100%;padding:6px 8px;border-radius:9px;border:1px solid #cbd5e1;font-family:monospace;" /></div>' +
            '</div>' +
            '<div id="s6b2RepShiftRow" style="display:' + (f.scope === 'shift' ? 'block' : 'none') + ';font-size:11.5px;font-weight:800;">' +
              '<label style="display:block;margin-bottom:3px;">اختر الوردية / المناوبة:</label>' +
              '<select id="s6b2RepShiftId" style="width:100%;padding:7px 9px;border-radius:10px;border:1.5px solid #93c5fd;font-weight:800;">' + shiftOpts + '</select>' +
            '</div>' +
            '<div style="display:flex;gap:14px;flex-wrap:wrap;padding:8px 10px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;font-size:11.5px;font-weight:800;">' +
              '<label style="display:flex;align-items:center;gap:5px;cursor:pointer;"><input id="s6b2RepIncSup" type="checkbox" checked style="width:15px;height:15px;" /> تضمين تسديدات وتسبقات الموردين</label>' +
              '<label style="display:flex;align-items:center;gap:5px;cursor:pointer;"><input id="s6b2RepIncPurch" type="checkbox" checked style="width:15px;height:15px;" /> تضمين دفعات فواتير الشراء</label>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding-top:4px;">' +
              '<button type="button" data-run-rep="80mm-print" style="padding:10px;border-radius:11px;border:none;background:#0f172a;color:#fff;font-weight:900;font-size:12px;cursor:pointer;">🧾 طباعة / PDF حراري (80mm)</button>' +
              '<button type="button" data-run-rep="a4-print" style="padding:10px;border-radius:11px;border:none;background:#2563eb;color:#fff;font-weight:900;font-size:12px;cursor:pointer;">📄 طباعة محضر رسمي (A4)</button>' +
              '<button type="button" data-run-rep="a4-pdf" style="padding:9px;border-radius:11px;border:none;background:#059669;color:#fff;font-weight:900;font-size:11.5px;cursor:pointer;">📥 تصدير ملف PDF رسمي (A4)</button>' +
              '<button type="button" data-open-studio-rep="1" style="padding:9px;border-radius:11px;border:1.5px solid #e11d48;background:#fff1f2;color:#be123c;font-weight:900;font-size:11.5px;cursor:pointer;">🎨 تعديل القالب في مركز الطباعة</button>' +
            '</div>' +
          '</div>';

        const scopeSel = overlay.querySelector('#s6b2RepScope');
        const rangeRow = overlay.querySelector('#s6b2RepRangeRow');
        const shiftRow = overlay.querySelector('#s6b2RepShiftRow');
        scopeSel?.addEventListener('change', () => {
          if (rangeRow) rangeRow.style.display = scopeSel.value === 'range' ? 'grid' : 'none';
          if (shiftRow) shiftRow.style.display = scopeSel.value === 'shift' ? 'block' : 'none';
        });

        overlay.addEventListener('click', async (ev) => {
          if (ev.target === overlay || (ev.target.closest && ev.target.closest('[data-close-rep="1"]'))) {
            overlay.remove();
            return;
          }
          if (ev.target.closest && ev.target.closest('[data-open-studio-rep="1"]')) {
            overlay.remove();
            if (window.GherbiPrintStudioPro?.state) {
              window.GherbiPrintStudioPro.state.setActiveDoc('expenses_period_report_a4');
            }
            window.App?.switchView?.('print');
            return;
          }
          const runBtn = ev.target.closest && ev.target.closest('[data-run-rep]');
          if (!runBtn) return;

          const mode = runBtn.getAttribute('data-run-rep');
          const pickedFilters = {
            scope: scopeSel ? scopeSel.value : 'today',
            dateFrom: overlay.querySelector('#s6b2RepFrom')?.value || '',
            dateTo: overlay.querySelector('#s6b2RepTo')?.value || '',
            sessionId: overlay.querySelector('#s6b2RepShiftId')?.value || '',
            fundingSource: overlay.querySelector('#s6b2RepSource')?.value || 'all',
            includeSuppliers: Boolean(overlay.querySelector('#s6b2RepIncSup')?.checked),
            includePurchases: Boolean(overlay.querySelector('#s6b2RepIncPurch')?.checked)
          };
          this._hubFilter = Object.assign({}, this._hubFilter, pickedFilters);
          overlay.remove();

          if (mode === '80mm-print') await this.printUnifiedOutflowsReport(pickedFilters, '80mm', { asPdf: false });
          else if (mode === 'a4-print') await this.printUnifiedOutflowsReport(pickedFilters, 'a4', { asPdf: false });
          else if (mode === 'a4-pdf') await this.printUnifiedOutflowsReport(pickedFilters, 'a4', { asPdf: true });
        });

        document.body.appendChild(overlay);
      },

      // ======================================================================
      // 5. ترقية صفحة المصاريف (#view-expenses) بحلتها الجديدة الشاملة
      // ======================================================================
      async refreshUnifiedOutflowsPanel() {
        const panelBody = document.getElementById('s6b2UnifiedOutflowsList');
        const kpiLine = document.getElementById('s6b2UnifiedOutflowsSummary');
        if (!panelBody) return;

        if (!window.api || typeof window.api.getUnifiedOutflowsReport !== 'function') return;
        const rep = await window.api.getUnifiedOutflowsReport(this._hubFilter).catch(() => null);
        if (!rep) return;
        this._lastReportData = rep;

        const t = rep.totals || {};
        const bfs = rep.byFundingSource || {};
        if (kpiLine) {
          kpiLine.innerHTML =
            '<span style="color:#be123c;font-weight:900;">الإجمالي الشامل (' + Number(t.count || 0) + '): ' + fmtDzd(t.grandTotal || 0) + '</span>' +
            '<span>💵 درج: <b>' + fmtDzd(bfs.active_shift || 0) + '</b></span>' +
            '<span>🔐 خزينة: <b>' + fmtDzd(bfs.shop_vault || 0) + '</b></span>' +
            '<span>🏦 بنك/CCP: <b>' + fmtDzd(bfs.bank_ccp || 0) + '</b></span>' +
            '<span>👤 خارجي: <b>' + fmtDzd(bfs.external_owner || 0) + '</b></span>';
        }

        const shiftSel = document.getElementById('s6b2HubShiftSel');
        if (shiftSel && shiftSel.options.length <= 1 && Array.isArray(rep.sessions)) {
          rep.sessions.forEach((s) => {
            const opt = document.createElement('option');
            opt.value = String(s.id);
            opt.textContent = 'وردية #' + s.id + ' (' + String(s.opened_at || '').slice(0, 10) + ')';
            shiftSel.appendChild(opt);
          });
        }

        const items = Array.isArray(rep.items) ? rep.items : [];
        if (items.length === 0) {
          panelBody.innerHTML = '<div style="text-align:center;padding:18px;color:#64748b;font-weight:800;">لا توجد عمليات صرف أو مدفوعات في هذا النطاق المحدد.</div>';
          return;
        }

        const srcColor = (src) =>
          src === 'external_owner' ? 'background:#fef3c7;color:#92400e;border:1px solid #fcd34d;' :
          src === 'shop_vault' ? 'background:#e0e7ff;color:#3730a3;border:1px solid #a5b4fc;' :
          src === 'bank_ccp' ? 'background:#e0f2fe;color:#0369a1;border:1px solid #7dd3fc;' :
          'background:#dcfce7;color:#166534;border:1px solid #86efac;';

        panelBody.innerHTML = items.slice(0, 80).map((it, idx) => (
          '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:11px;background:#ffffff;margin-bottom:6px;font-size:11.5px;">' +
            '<div style="display:flex;flex-direction:column;gap:2px;min-width:220px;flex:1;">' +
              '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
                '<span style="padding:1px 7px;border-radius:999px;background:#ffe4e6;color:#9f1239;font-size:10px;font-weight:900;">' + esc(it.category) + '</span>' +
                '<span style="padding:1px 7px;border-radius:999px;font-size:10px;font-weight:900;' + srcColor(it.fundingSource) + '">' + esc(it.fundingLabel) + '</span>' +
                '<strong style="color:#0f172a;">' + esc(it.beneficiary) + '</strong>' +
                '<span style="color:#475569;font-weight:700;">— ' + esc(it.description) + '</span>' +
              '</div>' +
              '<div style="font-size:10px;color:#64748b;font-family:monospace;">' + esc(it.docRef) + ' | ' + esc(it.date) + ' ' + esc(it.time) + (it.sessionId ? (' | وردية #' + it.sessionId) : '') + '</div>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:6px;">' +
              '<strong style="font-family:monospace;font-size:13px;color:#be123c;white-space:nowrap;">-' + fmtDzd(it.amount) + '</strong>' +
              '<button type="button" data-s6b2-v80="' + idx + '" style="padding:4px 8px;border-radius:8px;border:1px solid #cbd5e1;background:#f8fafc;color:#0f172a;font-size:10.5px;font-weight:900;cursor:pointer;" title="طباعة سند 80mm">🧾 80mm</button>' +
              '<button type="button" data-s6b2-va4="' + idx + '" style="padding:4px 8px;border-radius:8px;border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;font-size:10.5px;font-weight:900;cursor:pointer;" title="طباعة سند رسمي A4">📄 A4</button>' +
            '</div>' +
          '</div>'
        )).join('');
      },

      async upgradeExpensesPage() {
        if (window.GherbiExpensesMasterV2) return false;
        const expView = document.getElementById('view-expenses');
        if (!expView) return false;
        const rootContainer = expView.querySelector('#expenses-view-root') || expView;
        if (!rootContainer || !rootContainer.firstElementChild) return false;

        // 1. حقن شريط القيادة الموحّد للخزينة والربط بالموردين والمشتريات والتقارير أعلى صفحة المصاريف
        let hubBar = rootContainer.querySelector('#s6b2ExpensesCommandHub');
        const tr = await this.getTreasuryStatus();

        if (!hubBar) {
          hubBar = document.createElement('div');
          hubBar.id = 's6b2ExpensesCommandHub';
          hubBar.style.cssText =
            'margin:10px 0 12px;padding:12px 14px;border-radius:16px;border:1.5px solid #2563eb;background:linear-gradient(135deg,#eff6ff 0%,#ffffff 65%,#fff1f2 100%);direction:rtl;display:flex;flex-direction:column;gap:10px;box-shadow:0 4px 14px rgba(37,99,235,0.08);';

          hubBar.innerHTML =
            '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;">' +
              '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
                '<span style="font-size:13px;font-weight:900;color:#1e3a8a;">🏦 مركز قيادة الخزينة والمدفوعات الخارجة الموحّد</span>' +
                '<span id="s6b2HubShiftPill" style="padding:3px 10px;border-radius:999px;font-size:11px;font-weight:900;"></span>' +
                '<span id="s6b2HubVaultPill" style="padding:3px 10px;border-radius:999px;background:#e0e7ff;color:#3730a3;font-size:11px;font-weight:900;"></span>' +
                '<span id="s6b2HubExtPill" style="padding:3px 10px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:900;"></span>' +
              '</div>' +
              '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
                '<button type="button" data-hub-act="pay-supplier" style="padding:6px 11px;border-radius:10px;border:none;background:#059669;color:#fff;font-size:11px;font-weight:900;cursor:pointer;">🚚 تسديد / تسبقة لمورد</button>' +
                '<button type="button" data-hub-act="pay-purchase" style="padding:6px 11px;border-radius:10px;border:none;background:#0284c7;color:#fff;font-size:11px;font-weight:900;cursor:pointer;">🛍️ تسديد فاتورة شراء</button>' +
                '<button type="button" data-hub-act="print-report" style="padding:6px 12px;border-radius:10px;border:none;background:#4f46e5;color:#fff;font-size:11px;font-weight:900;cursor:pointer;">🖨️ التقرير النهائي (80mm / A4)</button>' +
                '<button type="button" data-hub-act="open-studio" style="padding:6px 10px;border-radius:10px;border:1px solid #e11d48;background:#fff1f2;color:#be123c;font-size:11px;font-weight:900;cursor:pointer;">🎨 قوالب السندات بمركز الطباعة</button>' +
              '</div>' +
            '</div>' +
            '<div style="border-top:1px dashed #bfdbfe;padding-top:8px;display:flex;flex-direction:column;gap:8px;">' +
              '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px;font-size:11px;font-weight:800;">' +
                '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
                  '<span style="color:#0f172a;font-weight:900;">📑 السجل الموحّد للأموال الخارجة (مصاريف + سلف + موردين + مشتريات):</span>' +
                  '<select id="s6b2HubScopeSel" style="padding:4px 8px;border-radius:8px;border:1px solid #cbd5e1;font-weight:800;font-size:11px;">' +
                    '<option value="today" selected>اليوم</option>' +
                    '<option value="yesterday">الأمس</option>' +
                    '<option value="week">آخر 7 أيام</option>' +
                    '<option value="month">هذا الشهر</option>' +
                    '<option value="shift">حسب وردية</option>' +
                    '<option value="all">الكل</option>' +
                  '</select>' +
                  '<select id="s6b2HubShiftSel" style="display:none;padding:4px 8px;border-radius:8px;border:1px solid #93c5fd;font-weight:800;font-size:11px;"><option value="">اختر الوردية...</option></select>' +
                  '<select id="s6b2HubSrcSel" style="padding:4px 8px;border-radius:8px;border:1px solid #cbd5e1;font-weight:800;font-size:11px;">' +
                    '<option value="all">كل المصادر الأربعة</option>' +
                    '<option value="active_shift">💵 درج الوردية</option>' +
                    '<option value="shop_vault">🔐 الخزينة الرئيسية</option>' +
                    '<option value="bank_ccp">🏦 بنك / CCP</option>' +
                    '<option value="external_owner">👤 مال خارجي</option>' +
                  '</select>' +
                  '<button type="button" data-hub-act="toggle-list" style="padding:4px 9px;border-radius:8px;border:1px solid #93c5fd;background:#fff;color:#1d4ed8;font-size:10.5px;font-weight:900;cursor:pointer;">👁️ إظهار / إخفاء السجل الموحد</button>' +
                '</div>' +
                '<div id="s6b2UnifiedOutflowsSummary" style="display:flex;flex-wrap:wrap;gap:10px;font-size:11px;"></div>' +
              '</div>' +
              '<div id="s6b2UnifiedOutflowsList" style="max-height:240px;overflow-y:auto;"></div>' +
            '</div>';

          // إدراج شريط القيادة بعد شريط التبويب العلوي مباشرةً أو في أعلى الحاوية
          rootContainer.insertBefore(hubBar, rootContainer.firstChild);

          hubBar.addEventListener('click', async (ev) => {
            const actBtn = ev.target.closest && ev.target.closest('[data-hub-act]');
            if (actBtn) {
              const act = actBtn.getAttribute('data-hub-act');
              if (act === 'pay-supplier') await this.openQuickSupplierPayPicker();
              else if (act === 'pay-purchase') await this.openQuickPurchasePayPicker();
              else if (act === 'print-report') await this.openOutflowsReportStudioModal();
              else if (act === 'open-studio') {
                window.GherbiPrintStudioPro?.state?.setActiveDoc?.('expense_voucher_a4');
                window.App?.switchView?.('print');
              } else if (act === 'toggle-list') {
                const lst = document.getElementById('s6b2UnifiedOutflowsList');
                if (lst) lst.style.display = lst.style.display === 'none' ? 'block' : 'none';
              }
              return;
            }

            const v80 = ev.target.closest && ev.target.closest('[data-s6b2-v80]');
            const va4 = ev.target.closest && ev.target.closest('[data-s6b2-va4]');
            if (v80 || va4) {
              const idx = Number((v80 || va4).getAttribute(v80 ? 'data-s6b2-v80' : 'data-s6b2-va4'));
              const it = this._lastReportData && this._lastReportData.items && this._lastReportData.items[idx];
              if (it) await this.printSingleVoucher(it, va4 ? 'a4' : '80mm', { asPdf: false });
            }
          });

          const scopeSel = hubBar.querySelector('#s6b2HubScopeSel');
          const shiftSel = hubBar.querySelector('#s6b2HubShiftSel');
          const srcSel = hubBar.querySelector('#s6b2HubSrcSel');

          scopeSel?.addEventListener('change', () => {
            this._hubFilter.scope = scopeSel.value;
            if (shiftSel) shiftSel.style.display = scopeSel.value === 'shift' ? 'inline-block' : 'none';
            this.refreshUnifiedOutflowsPanel();
          });
          shiftSel?.addEventListener('change', () => {
            this._hubFilter.sessionId = shiftSel.value;
            this.refreshUnifiedOutflowsPanel();
          });
          srcSel?.addEventListener('change', () => {
            this._hubFilter.fundingSource = srcSel.value;
            this.refreshUnifiedOutflowsPanel();
          });
        }

        // تحديث أرصدة الخزائن الحية
        const shiftPill = hubBar.querySelector('#s6b2HubShiftPill');
        const vaultPill = hubBar.querySelector('#s6b2HubVaultPill');
        const extPill = hubBar.querySelector('#s6b2HubExtPill');
        if (shiftPill) {
          shiftPill.textContent = tr.hasOpenShift
            ? ('🟢 درج الوردية #' + tr.sessionId + ': ' + fmtDzd(tr.drawerExpectedCash))
            : '🔴 الوردية مغلقة';
          shiftPill.style.background = tr.hasOpenShift ? '#dcfce7' : '#fee2e2';
          shiftPill.style.color = tr.hasOpenShift ? '#166534' : '#991b1b';
        }
        if (vaultPill) vaultPill.textContent = '🔐 الخزينة الرئيسية: ' + fmtDzd(tr.vaultBalance);
        if (extPill) extPill.textContent = '👤 خارجي بالوردية: ' + fmtDzd(tr.externalPaidInShift || 0);

        // ربط زر "تقرير PDF (F9)" الموجود في الصفحة باستوديو التقارير الشامل
        const pdfF9Btn = Array.from(rootContainer.querySelectorAll('button')).find((b) => /تقرير\s*PDF|F9/i.test(b.textContent || '') && !b.dataset.s6b2RepBound);
        if (pdfF9Btn) {
          pdfF9Btn.dataset.s6b2RepBound = '1';
          pdfF9Btn.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            this.openOutflowsReportStudioModal();
          }, true);
        }

        // ترقية أزرار "سند" في بطاقات سجل المصاريف الأصلية (image_6b2b43.png) لإضافة طباعة 80mm و A4 بمركز الطباعة
        const origVoucherBtns = Array.from(rootContainer.querySelectorAll('button')).filter((b) =>
          (b.textContent || '').trim().includes('سند') && !b.closest('#s6b2ExpensesCommandHub') && !b.dataset.s6b2VouchUpgraded
        );
        origVoucherBtns.forEach((btn) => {
          btn.dataset.s6b2VouchUpgraded = '1';
          const cardRow = btn.closest('div[class*="rounded"], div[class*="border"], li, tr') || btn.parentElement?.parentElement;
          const mId = (cardRow ? cardRow.textContent : '').match(/#(\d+)/);
          const expId = mId ? Number(mId[1]) : 0;
          if (!expId) return;

          // إضافة زر A4 صغير بجانب زر "سند" الأصلي
          const a4Btn = document.createElement('button');
          a4Btn.type = 'button';
          a4Btn.textContent = '📄 A4';
          a4Btn.title = 'طباعة سند الصرف الرسمي بمقاس A4 (قالب مركز الطباعة)';
          a4Btn.style.cssText = 'padding:4px 8px;border-radius:8px;border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:900;cursor:pointer;margin-right:4px;';
          a4Btn.addEventListener('click', async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const found = this._lastReportData?.items?.find((x) => x.rawId === expId && (x.kind === 'expense' || x.kind === 'worker_advance'));
            if (found) await this.printSingleVoucher(found, 'a4', { asPdf: false });
          });
          if (btn.parentNode) btn.parentNode.insertBefore(a4Btn, btn.nextSibling);

          btn.addEventListener('click', async (ev) => {
            const found = this._lastReportData?.items?.find((x) => x.rawId === expId && (x.kind === 'expense' || x.kind === 'worker_advance'));
            if (found) {
              ev.preventDefault();
              ev.stopImmediatePropagation();
              await this.printSingleVoucher(found, '80mm', { asPdf: false });
            }
          }, true);
        });

        await this.refreshUnifiedOutflowsPanel();
        return true;
      },

      // ======================================================================
      // 6. الإصلاح الجذري 100% لاستوديو إنشاء فاتورة الشراء الذكي (image_9d2064.jpg)
      //    يعثر مباشرةً على زر "حفظ الفاتورة وتغذية المخزون" أينما وُجد في document (بلا اعتماد على أي class!)
      // ======================================================================
      async scanAndUpgradeSmartSupplyStudioEverywhere() {
        if (typeof document === 'undefined') return false;

        // البحث المباشر عن زر "حفظ الفاتورة وتغذية المخزون" في كامل الصفحة
        const allButtons = Array.from(document.querySelectorAll('button'));
        const saveBtn = allButtons.find((b) =>
          /حفظ الفاتورة وتغذية المخزون/i.test(b.textContent || '') &&
          !b.closest('#purchaseInvoiceModal') // استبعاد النافذة القديمة المخفية في index.html إن وُجد الاستوديو الذكي
        ) || allButtons.find((b) => /حفظ الفاتورة وتغذية المخزون/i.test(b.textContent || ''));

        if (!saveBtn) return false;

        // الصعود في الشجرة لإيجاد حاوية استوديو فاتورة الشراء
        let studioRoot = saveBtn.parentElement;
        while (studioRoot && studioRoot.parentElement && studioRoot.tagName !== 'BODY') {
          const t = studioRoot.textContent || '';
          if (t.includes('استوديو إنشاء فاتورة الشراء') || t.includes('Smart Supply & Profit Radar') || t.includes('المدفوع للمورد:')) {
            if (t.includes('استوديو إنشاء فاتورة الشراء') || t.includes('Smart Supply')) break;
          }
          studioRoot = studioRoot.parentElement;
        }
        if (!studioRoot || studioRoot.querySelector('#s6b2SmartSupplyFundingBar')) return false;

        const btnBar = saveBtn.parentElement;
        if (!btnBar || !btnBar.parentElement) return false;

        const tr = await this.getTreasuryStatus();
        const defSrc = tr && tr.hasOpenShift ? 'active_shift' : 'shop_vault';

        const bar = document.createElement('div');
        bar.id = 's6b2SmartSupplyFundingBar';
        bar.style.cssText =
          'margin:8px 0;padding:10px 14px;border-radius:14px;border:2px solid #2563eb;background:linear-gradient(90deg,#eff6ff 0%,#ffffff 60%,#f0fdf4 100%);direction:rtl;text-align:right;font-size:12px;box-shadow:0 4px 12px rgba(37,99,235,0.12);';

        bar.innerHTML =
          '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;">' +
            '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
              '<span style="font-weight:900;color:#1d4ed8;">🏦 مصدر مال الدفعة للمورد:</span>' +
              '<select id="s6cLivePurchFundingSel" style="padding:6px 10px;border-radius:10px;border:1.5px solid #93c5fd;font-weight:900;font-size:11.5px;background:#ffffff;color:#0f172a;cursor:pointer;">' +
                '<option value="active_shift"' + (defSrc === 'active_shift' ? ' selected' : '') + '>💵 درج الوردية المفتوحة حالياً (Caisse Active)</option>' +
                '<option value="shop_vault"' + (defSrc === 'shop_vault' ? ' selected' : '') + '>🔐 الخزينة الرئيسية للمتجر (Coffre-Fort / خارج الدرج)</option>' +
                '<option value="bank_ccp">🏦 الحساب البنكي / بريدي موب / شيك (CCP / Banque)</option>' +
                '<option value="external_owner">👤 مال خارجي / من جيب المالك (خارج الصندوق تماماً)</option>' +
              '</select>' +
              '<input id="s6cLivePurchExtPayer" type="text" placeholder="اسم الدافع الخارجي (مثال: المالك)..." style="display:none;width:185px;padding:6px 10px;border-radius:10px;border:1.5px solid #cbd5e1;font-size:11.5px;font-weight:800;background:#ffffff;color:#0f172a;" />' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">' +
              '<span id="s6b2SmartAdvBadge" style="display:none;padding:3px 10px;border-radius:999px;background:linear-gradient(135deg,#0284c7,#2563eb);color:#ffffff;font-size:11px;font-weight:900;"></span>' +
              '<span id="s6b2SmartShiftBadge" style="padding:3px 10px;border-radius:999px;font-size:11px;font-weight:900;"></span>' +
            '</div>' +
          '</div>' +
          '<div id="s6b2SmartPurchAlert" style="display:none;margin-top:6px;padding:7px 10px;border-radius:9px;font-size:11.5px;font-weight:900;"></div>';

        btnBar.parentElement.insertBefore(bar, btnBar);

        const sel = bar.querySelector('#s6cLivePurchFundingSel');
        const extInp = bar.querySelector('#s6cLivePurchExtPayer');
        const shiftBadge = bar.querySelector('#s6b2SmartShiftBadge');
        const advBadge = bar.querySelector('#s6b2SmartAdvBadge');
        const alertBox = bar.querySelector('#s6b2SmartPurchAlert');

        // تحديد عناصر المورد والمدفوع ووسيلة الدفع داخل استوديو الشراء
        const allSelects = Array.from(studioRoot.querySelectorAll('select')).filter((s) => s.id !== 's6cLivePurchFundingSel');
        const supSelect = allSelects.find((s) => /ULTRA|مورد|sup/i.test((s.id || '') + ' ' + (s.textContent || ''))) || allSelects[0] || null;
        const payMethodSel = allSelects.find((s) => /نقداً|Espèces|شيك|CCP|cib/i.test(s.textContent || '')) || null;
        const paidInp = Array.from(studioRoot.querySelectorAll('input[type="number"], input')).find((inp) =>
          /paid|مدفوع/i.test((inp.id || '') + ' ' + ((inp.parentElement && inp.parentElement.textContent) || ''))
        ) || null;

        const updateSmartSupplyState = () => {
          const src = sel ? sel.value : 'active_shift';
          const ext = extInp ? extInp.value.trim() : '';
          const paidAmt = paidInp ? (Number(paidInp.value || 0) || 0) : 0;

          if (extInp) extInp.style.display = src === 'external_owner' ? 'inline-block' : 'none';
          window.__gherbiNextPurchaseFunding = { funding_source: src, external_payer: ext };
          if (window.GherbiTreasuryStage6B) {
            window.GherbiTreasuryStage6B._livePurchaseFunding = { funding_source: src, external_payer: ext };
          }

          // فحص رصيد التسبقة للمورد المختار
          if (advBadge && supSelect) {
            const sid = Number(supSelect.value || 0);
            const list = (window.AppState && Array.isArray(window.AppState.suppliers)) ? window.AppState.suppliers : [];
            const sup = list.find((x) => Number(x.id) === sid || String(x.name || '').trim() === String(supSelect.value || '').trim());
            const signed = sup ? Number(sup.total_debt || 0) : 0;
            const adv = signed < -0.009 ? Math.abs(signed) : Number((sup && sup.advance_balance) || 0);
            if (adv > 0.009) {
              advBadge.style.display = 'inline-flex';
              advBadge.textContent = '💎 لديك تسبقة عند هذا المورد: ' + fmtDzd(adv);
            } else {
              advBadge.style.display = 'none';
            }
          }

          if (shiftBadge) {
            if (tr && tr.hasOpenShift) {
              shiftBadge.textContent = '🟢 وردية #' + tr.sessionId + ' (' + fmtDzd(tr.drawerExpectedCash) + ')';
              shiftBadge.style.background = '#dcfce7';
              shiftBadge.style.color = '#166534';
            } else {
              shiftBadge.textContent = '🔴 الوردية مغلقة';
              shiftBadge.style.background = '#fee2e2';
              shiftBadge.style.color = '#991b1b';
            }
          }

          let blocked = false;
          let msg = '';
          let lvl = '';
          if (paidAmt > 0.009 && src === 'active_shift') {
            if (!tr || !tr.hasOpenShift) {
              blocked = true;
              msg = '⛔ الوردية مغلقة — لا يمكن دفع (' + fmtDzd(paidAmt) + ') من درج الوردية! اختر "الخزينة الرئيسية" أو "مال خارجي / المالك" أو اضغط "آجل (دين 0)".';
              lvl = 'error';
            } else if (paidAmt > Number(tr.drawerExpectedCash || 0) + 0.009) {
              msg = '⚠️ تنبيه سيولة: المدفوع (' + fmtDzd(paidAmt) + ') أكبر من سيولة درج الوردية (' + fmtDzd(tr.drawerExpectedCash) + '). يُفضَّل الدفع من الخزينة الرئيسية أو مال خارجي.';
              lvl = 'warn';
            }
          }

          if (alertBox) {
            if (msg) {
              alertBox.style.display = 'block';
              alertBox.textContent = msg;
              alertBox.style.background = lvl === 'error' ? '#fff1f2' : '#fffbeb';
              alertBox.style.border = lvl === 'error' ? '1px solid #fda4af' : '1px solid #fcd34d';
              alertBox.style.color = lvl === 'error' ? '#be123c' : '#92400e';
            } else {
              alertBox.style.display = 'none';
            }
          }

          saveBtn.disabled = blocked;
          saveBtn.style.opacity = blocked ? '0.5' : '1';
          saveBtn.style.cursor = blocked ? 'not-allowed' : 'pointer';
        };

        sel?.addEventListener('change', updateSmartSupplyState);
        extInp?.addEventListener('input', updateSmartSupplyState);
        paidInp?.addEventListener('input', updateSmartSupplyState);
        supSelect?.addEventListener('change', updateSmartSupplyState);
        payMethodSel?.addEventListener('change', () => {
          const v = String(payMethodSel.value || '').toLowerCase();
          if (sel && (v.includes('cib') || v.includes('cheq') || v.includes('ccp') || v.includes('baridi')) && sel.value === 'active_shift') {
            sel.value = 'bank_ccp';
          }
          updateSmartSupplyState();
        });

        studioRoot.addEventListener('click', (ev) => {
          const b = ev.target && ev.target.closest ? ev.target.closest('button') : null;
          if (b && /خالص|نصف|آجل/i.test(b.textContent || '')) setTimeout(updateSmartSupplyState, 30);
        });

        saveBtn.addEventListener('click', (ev) => {
          updateSmartSupplyState();
          if (saveBtn.disabled) {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            window.App?.showToast?.('⛔ الوردية مغلقة — اختر الخزينة الرئيسية أو مال خارجي أو اجعل الفاتورة آجلة.', 'error');
          }
        }, true);

        updateSmartSupplyState();
        return true;
      },

      // ترقية صفحة المشتريات الرئيسية (#view-purchases) بشريط الخزائن وزر التسديد السريع
      async upgradePurchasesPage() {
        const pView = document.getElementById('view-purchases');
        if (!pView) return;
        const root = pView.querySelector('#purchases-view-root') || pView;
        if (!root || !root.firstElementChild) return;

        let strip = root.querySelector('#s6b2PurchasesTreasuryStrip');
        const tr = await this.getTreasuryStatus();
        if (!strip) {
          strip = document.createElement('div');
          strip.id = 's6b2PurchasesTreasuryStrip';
          strip.style.cssText = 'margin:8px 0 10px;padding:9px 12px;border-radius:14px;border:1.5px solid #bfdbfe;background:linear-gradient(90deg,#eff6ff 0%,#ffffff 100%);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;font-size:11.5px;font-weight:800;direction:rtl;';
          root.insertBefore(strip, root.firstChild);
        }

        strip.innerHTML =
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
            '<span style="color:#1e3a8a;font-weight:900;">🏦 مصادر تمويل المشتريات:</span>' +
            '<span style="padding:3px 9px;border-radius:999px;' + (tr.hasOpenShift ? 'background:#dcfce7;color:#166534;' : 'background:#fee2e2;color:#991b1b;') + '">' +
              (tr.hasOpenShift ? ('🟢 درج الوردية #' + tr.sessionId + ': ' + fmtDzd(tr.drawerExpectedCash)) : '🔴 الوردية مغلقة (اختر خزينة/خارجي أو آجل)') +
            '</span>' +
            '<span style="padding:3px 9px;border-radius:999px;background:#e0e7ff;color:#3730a3;">🔐 الخزينة الرئيسية: ' + fmtDzd(tr.vaultBalance) + '</span>' +
          '</div>' +
          '<div style="display:flex;gap:6px;">' +
            '<button type="button" data-pstrip-pay="1" style="padding:5px 11px;border-radius:9px;border:none;background:#059669;color:#fff;font-size:11px;font-weight:900;cursor:pointer;">💳 تسديد فواتير الشراء المفتوحة (4 مصادر)</button>' +
            '<button type="button" data-pstrip-rep="1" style="padding:5px 11px;border-radius:9px;border:none;background:#4f46e5;color:#fff;font-size:11px;font-weight:900;cursor:pointer;">🖨️ تقرير المدفوعات الشامل</button>' +
          '</div>';

        if (!strip._s6b2Bound) {
          strip._s6b2Bound = true;
          strip.addEventListener('click', (ev) => {
            if (ev.target.closest && ev.target.closest('[data-pstrip-pay="1"]')) this.openQuickPurchasePayPicker();
            if (ev.target.closest && ev.target.closest('[data-pstrip-rep="1"]')) this.openOutflowsReportStudioModal();
          });
        }
      },

      scanAll() {
        this.scanAndUpgradeSmartSupplyStudioEverywhere();
        const expView = document.getElementById('view-expenses');
        if (expView && expView.classList && expView.classList.contains('active')) {
          this.upgradeExpensesPage();
        }
        const pView = document.getElementById('view-purchases');
        if (pView && pView.classList && pView.classList.contains('active')) {
          this.upgradePurchasesPage();
        }
      },

      boot() {
        if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined' && document.body && !document.body._s6b2Obs) {
          document.body._s6b2Obs = true;
          let t = null;
          const schedule = () => {
            clearTimeout(t);
            t = setTimeout(() => this.scanAll(), 80);
          };
          const obs = new MutationObserver(() => schedule());
          obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
        }
        // فحص دوري خفيف جداً يضمن التقاط استوديو الشراء فوراً حتى لو رُسم بشكل غير متزامن
        setInterval(() => this.scanAndUpgradeSmartSupplyStudioEverywhere(), 650);
        setTimeout(() => this.scanAll(), 300);
        console.log('🛡️ [WAR STAGE 6B2]: مركز قيادة المصاريف الموحّد + قوالب السندات/التقارير (80mm/A4) + استوديو المشتريات الذكي جاهز 100%.');
      }
    };

    window.GherbiExpensesHubStage6B2 = Hub;
    Hub.boot();
  })();
})();

/* === [WAR STAGE 6B3: DIRECT REAL-DATA PDF/PRINT DISPATCH & LIVE SUMMARY] === */
(function installDirectOutflowsPrintPatchV2() {
  'use strict';

  function fmtDzd(v) {
    return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' د.ج';
  }

  function padThermalBottom(html, isThermal) {
    if (!isThermal || !html || html.includes('data-s6b3-thermal-pad')) return html;
    return html.replace('</body>', '<div data-s6b3-thermal-pad="1" style="height:6mm;"></div></body>');
  }

  async function dispatchRenderedHtml(rendered, paper, docType, opts) {
    const isThermal = paper === '80mm' || paper === '58mm';
    const fullHtml = padThermalBottom(rendered && rendered.fullHtml ? rendered.fullHtml : '', isThermal);
    if (!fullHtml) return { success: false, error: 'empty_html' };

    const filename = (docType || 'report') + '_' + paper + '_' + new Date().toISOString().slice(0, 10) + '.pdf';
    const payload = {
      html: fullHtml,
      paperSize: paper,
      paper,
      silent: Boolean(opts && opts.silent),
      asPdf: Boolean(opts && opts.asPdf),
      filename
    };

    if (opts && opts.asPdf) {
      if (window.api && typeof window.api.pspExportPdf === 'function') {
        return await window.api.pspExportPdf(payload);
      }
      if (window.api && typeof window.api.exportPDF === 'function') {
        return await window.api.exportPDF(payload);
      }
    } else {
      if (window.api && typeof window.api.pspPrint80mm === 'function') {
        return await window.api.pspPrint80mm(payload);
      }
      if (window.api && typeof window.api.printSilent === 'function') {
        return await window.api.printSilent(payload);
      }
    }
    return { success: false, error: 'no_print_api' };
  }

  function applyDirectPatch() {
    const hub = window.GherbiExpensesHubStage6B2;
    if (!hub || hub._directPrintV2Patched) return false;
    hub._directPrintV2Patched = true;

    hub.printSingleVoucher = async function directPrintSingleVoucherV2(item, paper = '80mm', opts = {}) {
      const PSP = window.GherbiPrintStudioPro;
      if (!PSP || !PSP.router) return null;
      const docType = paper === 'a4' ? 'expense_voucher_a4' : 'expense_voucher';
      const nowDate = new Date().toISOString().slice(0, 10);
      const docData = {
        docNumber: (item && item.docRef) || ('EXP-' + String((item && item.rawId) || Date.now()).slice(-4)),
        date: ((item && item.date) || nowDate) + (item && item.time ? (' ' + item.time) : ''),
        partyName: (item && (item.beneficiary || item.category)) || 'المستفيد',
        cashierName: window.AppState?.currentUser?.name || 'المدير العام',
        total: Number((item && item.amount) || 0),
        paidAmount: Number((item && item.amount) || 0),
        remainingDebt: 0,
        expenseVoucher: {
          docRef: (item && item.docRef) || 'EXP-0001',
          date: (item && item.date) || nowDate,
          time: (item && item.time) || '',
          category: (item && item.category) || 'مصاريف عامة',
          beneficiary: (item && item.beneficiary) || 'غير محدد',
          description: (item && (item.description || item.category)) || 'مصروف تشغيلي',
          amount: Number((item && item.amount) || 0),
          fundingSource: (item && item.fundingSource) || 'active_shift',
          fundingLabel: (item && item.fundingLabel) || 'درج الوردية',
          externalPayer: (item && item.externalPayer) || '',
          sessionId: (item && item.sessionId) || null,
          cashierName: window.AppState?.currentUser?.name || 'المدير العام'
        },
        items: [{
          barcode: (item && item.docRef) || 'EXP',
          name: ((item && item.category) || 'مصروف') + ' — ' + ((item && item.description) || ''),
          unit: 'سند',
          qty: 1,
          price: Number((item && item.amount) || 0),
          subtotal: Number((item && item.amount) || 0)
        }]
      };

      const mode = opts.asPdf ? 'pdf' : 'print';
      const rendered = PSP.router.renderDoc(docType, docData, mode, { forceOverride: false });
      if (opts.renderOnly) return rendered;
      return await dispatchRenderedHtml(rendered, paper, docType, opts);
    };

    hub.printUnifiedOutflowsReport = async function directPrintUnifiedOutflowsV2(filtersOverride, paper = 'a4', opts = {}) {
      const PSP = window.GherbiPrintStudioPro;
      if (!PSP || !PSP.router) return null;

      const filters = Object.assign({}, this._hubFilter, filtersOverride || {});
      let rep = opts.reportDataOverride || null;
      if (!rep && window.api && typeof window.api.getUnifiedOutflowsReport === 'function') {
        rep = await window.api.getUnifiedOutflowsReport(filters);
      }
      if (!rep) return null;
      this._lastReportData = rep;

      const docType = paper === '80mm' ? 'expenses_period_report_80mm' : 'expenses_period_report_a4';
      const todayStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const docData = {
        docNumber: 'OUT-' + todayStamp,
        date: new Date().toISOString().replace('T', ' ').slice(0, 16),
        cashierName: window.AppState?.currentUser?.name || 'المدير العام',
        total: Number((rep.totals && rep.totals.grandTotal) || 0),
        paidAmount: Number((rep.totals && rep.totals.grandTotal) || 0),
        outflowsReport: rep
      };

      const mode = opts.asPdf ? 'pdf' : 'print';
      const rendered = PSP.router.renderDoc(docType, docData, mode, { forceOverride: false });
      if (opts.renderOnly) return rendered;
      return await dispatchRenderedHtml(rendered, paper, docType, opts);
    };

    // تحسين نافذة استوديو التقرير لعرض ملخص حي فوري للعدد والمبلغ الحقيقي قبل الطباعة!
    const origOpenRepModal = hub.openOutflowsReportStudioModal.bind(hub);
    hub.openOutflowsReportStudioModal = async function openRepWithLiveSummary() {
      await origOpenRepModal();
      const modal = document.getElementById('s6b2OutflowsReportModal');
      if (!modal) return;
      const box = modal.firstElementChild;
      if (!box || box.querySelector('#s6b3LiveRepPreviewStrip')) return;

      const strip = document.createElement('div');
      strip.id = 's6b3LiveRepPreviewStrip';
      strip.style.cssText = 'padding:8px 11px;border-radius:10px;border:1.5px solid #93c5fd;background:#eff6ff;color:#1e3a8a;font-size:11.5px;font-weight:900;text-align:center;';
      strip.textContent = 'جاري حساب المجموع الفعلي للنطاق المختار...';
      box.insertBefore(strip, box.lastElementChild);

      const updateLiveCount = async () => {
        if (!window.api || typeof window.api.getUnifiedOutflowsReport !== 'function') return;
        const picked = {
          scope: modal.querySelector('#s6b2RepScope')?.value || 'all',
          dateFrom: modal.querySelector('#s6b2RepFrom')?.value || '',
          dateTo: modal.querySelector('#s6b2RepTo')?.value || '',
          sessionId: modal.querySelector('#s6b2RepShiftId')?.value || '',
          fundingSource: modal.querySelector('#s6b2RepSource')?.value || 'all',
          includeSuppliers: Boolean(modal.querySelector('#s6b2RepIncSup')?.checked),
          includePurchases: Boolean(modal.querySelector('#s6b2RepIncPurch')?.checked)
        };
        const rep = await window.api.getUnifiedOutflowsReport(picked).catch(() => null);
        if (!rep || !rep.totals) return;
        const cnt = Number(rep.totals.count || 0);
        const tot = Number(rep.totals.grandTotal || 0);
        strip.style.background = cnt > 0 ? '#ecfdf5' : '#fffbeb';
        strip.style.borderColor = cnt > 0 ? '#6ee7b7' : '#fcd34d';
        strip.style.color = cnt > 0 ? '#065f46' : '#92400e';
        strip.textContent = cnt > 0
          ? ('✅ سيُطبع التقرير بـ (' + cnt + ') عملية حقيقية | الإجمالي: ' + fmtDzd(tot) + ' — ' + (rep.periodLabel || ''))
          : ('⚠️ لا توجد عمليات في النطاق المختار (' + (rep.periodLabel || '') + ') — غيّر النطاق إلى "هذا الشهر" أو "جميع الفترات".');
      };

      ['#s6b2RepScope', '#s6b2RepSource', '#s6b2RepFrom', '#s6b2RepTo', '#s6b2RepShiftId', '#s6b2RepIncSup', '#s6b2RepIncPurch'].forEach((s) => {
        modal.querySelector(s)?.addEventListener('change', updateLiveCount);
      });
      updateLiveCount();
    };

    return true;
  }

  if (!applyDirectPatch()) {
    let k = 0;
    const iv = setInterval(() => {
      k++;
      if (applyDirectPatch() || k >= 40) clearInterval(iv);
    }, 100);
  }
})();
