(function plantaoAppFixes() {
    const APP_NAME = 'Plantão';

    function todayDate() {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        return date;
    }

    function toDateKey(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function fromDateKey(key) {
        const [year, month, day] = String(key).split('-').map(Number);
        return new Date(year, month - 1, day);
    }

    function addDays(date, amount) {
        const next = new Date(date);
        next.setDate(next.getDate() + amount);
        next.setHours(0, 0, 0, 0);
        return next;
    }

    function getTaskHours(task) {
        const hours = parseFloat(task?.h);
        return Number.isFinite(hours) && hours > 0 ? hours : 1;
    }

    function isExtraTask(task) {
        return task?.extra === true || task?.l === 'Extra';
    }

    function normalizeTask(task, sourceDate) {
        return {
            ...task,
            c: false,
            atraso: false,
            replanejado: true,
            dataOriginal: task?.dataOriginal || sourceDate,
            origemAtraso: task?.origemAtraso || sourceDate
        };
    }

    function getDayCapacity(date) {
        const day = new Date(date).getDay();
        const hours = parseFloat(window.db?.h?.[day]);
        return Number.isFinite(hours) && hours > 0 ? hours : 0;
    }

    function getUsedHours(key) {
        return (window.db?.metaFixa?.[key] || []).reduce((sum, task) => sum + getTaskHours(task), 0);
    }

    function findSlot(task, startDate) {
        const taskHours = getTaskHours(task);
        let fallback = null;

        for (let offset = 0; offset < 120; offset++) {
            const date = addDays(startDate, offset);
            const key = toDateKey(date);
            const capacity = getDayCapacity(date);
            if (!fallback && capacity > 0) fallback = { key, capacity };
            if (capacity > 0 && getUsedHours(key) + taskHours <= capacity) return key;
        }

        if (fallback) return fallback.key;
        return toDateKey(startDate);
    }

    function collectOverdueTasks() {
        if (!window.db?.metaFixa) return [];
        const todayKey = toDateKey(todayDate());
        const overdue = [];

        Object.keys(window.db.metaFixa).sort().forEach(key => {
            if (key >= todayKey) return;
            const tasks = window.db.metaFixa[key] || [];
            const remaining = [];

            tasks.forEach(task => {
                if (!task?.c && !isExtraTask(task)) overdue.push(normalizeTask(task, key));
                else remaining.push(task);
            });

            if (remaining.length) window.db.metaFixa[key] = remaining;
            else delete window.db.metaFixa[key];
        });

        return overdue;
    }

    function refreshAfterReplan() {
        const currentDate = typeof window.vDate !== 'undefined' ? window.vDate : new Date();
        if (typeof window.save === 'function') window.save();
        if (typeof window.renderDiario === 'function') window.renderDiario(currentDate);
        if (typeof window.renderSemanal === 'function') window.renderSemanal();
        if (typeof window.updateDashboard === 'function') window.updateDashboard();
        if (typeof window.renderReplanejar === 'function') window.renderReplanejar();
        if (typeof window.corrigirTextosDaTela === 'function') window.corrigirTextosDaTela();
    }

    window.replanejarAgora = function replanejarAgoraCorrigido() {
        if (!window.db?.metaFixa) {
            if (typeof window.showToast === 'function') window.showToast('Nada para replanejar', 'Seu planejamento ainda não tem atividades atrasadas.');
            return;
        }

        const atrasadas = collectOverdueTasks();
        if (!atrasadas.length) {
            if (typeof window.showToast === 'function') window.showToast('Sem atrasos', 'Não encontrei matérias atrasadas para redistribuir.');
            refreshAfterReplan();
            return;
        }

        const start = todayDate();
        atrasadas.forEach(task => {
            const targetKey = findSlot(task, start);
            if (!window.db.metaFixa[targetKey]) window.db.metaFixa[targetKey] = [];
            window.db.metaFixa[targetKey].push(task);
        });

        refreshAfterReplan();
        if (typeof window.showToast === 'function') {
            window.showToast('Atrasos replanejados', `${atrasadas.length} atividade(s) foram redistribuídas nos horários diários e no cronograma semanal.`);
        }
    };

    function applyBranding() {
        document.title = APP_NAME;
        document.querySelectorAll('.logo-box').forEach(el => {
            const icon = el.querySelector('i')?.outerHTML || '<i class="fas fa-shield-halved"></i>';
            el.innerHTML = `${icon} ${APP_NAME}`;
        });
        document.querySelectorAll('h2, h1, h3, span, small, button, div, title').forEach(el => {
            if (!el.childElementCount && el.textContent) {
                el.textContent = el.textContent
                    .replace(/PLANT(?:Ãƒ|Ã)?O|PLANTO|PLANTAO/gi, match => match === match.toUpperCase() ? 'PLANTÃO' : APP_NAME)
                    .replace(/\bv\.?(\d+)\b/gi, '')
                    .replace(/\s{2,}/g, ' ')
                    .trim();
            }
        });
    }

    function enhanceUiHooks() {
        document.body.classList.add('plantao-polished');
        document.querySelectorAll('.replan-btn').forEach(btn => {
            btn.classList.add('btn-replan-primary');
            btn.title = 'Redistribuir atividades atrasadas nos próximos horários disponíveis';
        });
    }

    function boot() {
        applyBranding();
        enhanceUiHooks();
        setTimeout(applyBranding, 250);
        setTimeout(applyBranding, 1000);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
