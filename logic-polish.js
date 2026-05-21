(function plantaoLogicPolish() {
    if(window.__plantaoLogicPolish) return;
    window.__plantaoLogicPolish = true;

    const VERSION = 'v214-logic-layout';
    const WRAPPED = '__plantaoLogicPolishWrapped';
    const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
    let weeklyAutoScrolled = false;

    function fn(name) {
        try { return Function(`return typeof ${name} === "function" ? ${name} : null;`)(); }
        catch(_) { return typeof window[name] === 'function' ? window[name] : null; }
    }

    function setFn(name, value) {
        try { Function('value', `${name} = value;`)(value); } catch(_) {}
        try { window[name] = value; } catch(_) {}
    }

    function state() {
        try { return Function('return typeof db === "undefined" ? null : db;')(); }
        catch(_) { return null; }
    }

    function safeId(value) {
        return String(value || 'item')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'item';
    }

    function asNumber(value, fallback = 0) {
        const n = parseFloat(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function dayKey(value) {
        const canonical = fn('canonicalDateKey');
        if(canonical) {
            const fixed = canonical(value);
            if(fixed) return fixed;
        }
        const dateKey = fn('dateKey');
        if(dateKey) {
            try { return dateKey(value instanceof Date ? value : new Date(value)); } catch(_) {}
        }
        return String(value || '').trim();
    }

    function taskKind(task) {
        const kind = String(task?.k || 'E');
        return ['E', 'Rev', 'Ex'].includes(kind) ? kind : 'E';
    }

    function isExtraTask(task) {
        const original = fn('isExtraTask');
        if(original) {
            try { return original(task); } catch(_) {}
        }
        return task?.extra === true || task?.l === 'Extra';
    }

    function matchingItem(task, list) {
        if(task?.itemId) {
            const direct = list.find(item => item.id === task.itemId);
            if(direct) return direct;
        }
        return list.find(item => item.m === task?.m && item.a === task?.a) || null;
    }

    function normalizeItem(item, index) {
        if(!item || typeof item !== 'object') return null;
        item.m = String(item.m || 'SEM MATERIA').trim().toUpperCase();
        item.a = String(item.a || `Assunto ${index + 1}`).trim();
        item.id = item.id || `${safeId(item.m)}-${safeId(item.a)}-${index}`;
        item.peso = Math.min(5, Math.max(1, parseInt(item.peso || 1, 10) || 1));
        item.h = item.h && typeof item.h === 'object' ? item.h : {};
        item.h.E = Math.max(0.5, asNumber(item.h.E, 1.5));
        item.h.Rev = Math.max(0.5, asNumber(item.h.Rev, 1));
        item.h.Ex = Math.max(0.5, asNumber(item.h.Ex, 1));
        item.hF = Math.max(0, Math.min(asNumber(item.hF, 0), item.h.E));
        item.done = item.done && typeof item.done === 'object' ? item.done : {};
        item.done.E = Boolean(item.done.E);
        item.done.Rev = Boolean(item.done.Rev);
        item.done.Ex = Boolean(item.done.Ex);
        item.f = Boolean(item.f);
        item.sinalizado = Boolean(item.sinalizado);
        item.maintDone = Boolean(item.maintDone);
        if(item.lastInitialStudyDate) item.lastInitialStudyDate = dayKey(item.lastInitialStudyDate);
        if(item.lastInitialRevDate) item.lastInitialRevDate = dayKey(item.lastInitialRevDate);
        if(item.reviewAnchorDate) item.reviewAnchorDate = dayKey(item.reviewAnchorDate);
        if(item.revCycle?.due) item.revCycle.due = dayKey(item.revCycle.due);
        return item;
    }

    function normalizeTask(task, day, list) {
        if(!task || typeof task !== 'object') return null;
        const linked = matchingItem(task, list);
        if(!linked && !isExtraTask(task)) return null;
        task.k = taskKind(task);
        task.l = task.l || ({ E: 'Estudo', Rev: 'Revisao', Ex: 'Exercicio' }[task.k]);
        task.h = Math.max(0.25, asNumber(task.h, linked?.h?.[task.k] || 1));
        task.c = Boolean(task.c);
        task.data = dayKey(task.data || day);
        if(linked) {
            task.itemId = linked.id;
            task.m = linked.m;
            task.a = linked.a;
        } else {
            task.m = String(task.m || 'EXTRA').trim().toUpperCase();
            task.a = String(task.a || 'Atividade extra').trim();
        }
        return task;
    }

    function normalizeDateMap(map, normalizer) {
        const out = {};
        if(!map || typeof map !== 'object' || Array.isArray(map)) return out;
        Object.entries(map).forEach(([key, value]) => {
            const fixedKey = dayKey(key);
            if(!fixedKey) return;
            const normalized = normalizer ? normalizer(value, fixedKey) : value;
            if(Array.isArray(normalized)) {
                out[fixedKey] = [...(out[fixedKey] || []), ...normalized];
            } else if(normalized && typeof normalized === 'object') {
                out[fixedKey] = { ...(out[fixedKey] || {}), ...normalized };
            } else if(normalized !== undefined && normalized !== null) {
                out[fixedKey] = normalized;
            }
        });
        return out;
    }

    function normalizeCoreState() {
        const db = state();
        if(!db || typeof db !== 'object') return false;

        db.lista = Array.isArray(db.lista) ? db.lista.map(normalizeItem).filter(Boolean) : [];
        const validSubjects = new Set(db.lista.map(item => item.m));

        db.ciclo = Array.isArray(db.ciclo) ? db.ciclo.map(m => String(m || '').trim().toUpperCase()) : [];
        db.ciclo = [...new Set(db.ciclo.filter(m => validSubjects.has(m)))];
        if(!db.ciclo.length && validSubjects.size) db.ciclo = [...validSubjects];

        db.h = db.h && typeof db.h === 'object' ? db.h : {};
        for(let i = 0; i <= 6; i += 1) db.h[i] = Math.max(0, asNumber(db.h[i], 0));

        db.metaFixa = normalizeDateMap(db.metaFixa, (tasks, day) => {
            if(!Array.isArray(tasks)) return [];
            return tasks.map(task => normalizeTask(task, day, db.lista)).filter(Boolean);
        });
        Object.keys(db.metaFixa).forEach(day => {
            if(!db.metaFixa[day].length) delete db.metaFixa[day];
        });

        db.planosTravados = normalizeDateMap(db.planosTravados, (tasks, day) => {
            if(!Array.isArray(tasks)) return [];
            return tasks.map(task => normalizeTask(task, day, db.lista)).filter(Boolean);
        });

        db.diasPausados = Array.isArray(db.diasPausados)
            ? [...new Set(db.diasPausados.map(dayKey).filter(Boolean))]
            : [];

        if(Array.isArray(db.lancamentos)) {
            db.lancamentos.forEach(item => {
                if(item?.dia) item.dia = dayKey(item.dia);
            });
        }
        if(!Array.isArray(db.tempoLiquido)) db.tempoLiquido = [];
        window.__plantaoLogicPolishVersion = VERSION;
        return true;
    }

    function netSecondsThisWeek() {
        const db = state();
        const keyToDate = fn('keyToDate');
        if(!db || !Array.isArray(db.tempoLiquido) || !keyToDate) return 0;
        const start = new Date();
        start.setHours(0,0,0,0);
        start.setDate(start.getDate() - start.getDay());
        const end = new Date(start);
        end.setDate(start.getDate() + 7);
        return db.tempoLiquido.reduce((acc, row) => {
            const day = row?.dia ? keyToDate(row.dia) : new Date(row?.createdAt || 0);
            if(day >= start && day < end) return acc + Math.max(0, asNumber(row.segundos, 0));
            return acc;
        }, 0);
    }

    function polishDashboard() {
        const seconds = netSecondsThisWeek();
        if(seconds <= 0) return;
        const hours = seconds / 3600;
        const value = document.getElementById('horas-hoje');
        if(value) {
            value.textContent = `${hours.toFixed(1)}h`;
            value.title = 'Tempo liquido registrado pelo cronometro nesta semana.';
        }
    }

    function polishWeeklyGrid() {
        const grid = document.getElementById('grid-semanal');
        if(!grid) return;
        const todayText = dayKey(new Date()).slice(0, 5);
        const columns = [...grid.querySelectorAll('.day-column')];
        columns.forEach(column => {
            const head = column.querySelector('.day-head');
            const isToday = Boolean(head && head.textContent.includes(todayText));
            column.classList.toggle('is-today', isToday);
            if(isToday && !weeklyAutoScrolled) {
                weeklyAutoScrolled = true;
                requestAnimationFrame(() => {
                    try { column.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'auto' }); } catch(_) {}
                });
            }
        });
    }

    function polishTaskCards() {
        document.querySelectorAll('.task-card').forEach(card => {
            const checkbox = card.querySelector('input[type="checkbox"]');
            if(checkbox) checkbox.setAttribute('aria-label', checkbox.checked ? 'Atividade concluida' : 'Marcar atividade como concluida');
        });
    }

    function removeEmailsFromText(value, fallback = '') {
        const cleaned = String(value || '')
            .replace(EMAIL_PATTERN, '')
            .replace(/\s+\|\s*$/, '')
            .replace(/^\s+\|\s*/, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
        return cleaned || fallback;
    }

    function scrubStudentEmails(root = document) {
        const scopes = [
            '#ranking-content',
            '#study-admin-panel',
            '#perfil-content',
            '#admin-student-banner',
            '.admin-student-banner'
        ];
        root.querySelectorAll?.(scopes.join(',')).forEach(scope => {
            scope.querySelectorAll('small').forEach(node => {
                if(EMAIL_PATTERN.test(node.textContent || '')) {
                    node.textContent = '';
                    node.style.display = 'none';
                }
                EMAIL_PATTERN.lastIndex = 0;
            });
            scope.querySelectorAll('b,strong,span,td,div').forEach(node => {
                if(!EMAIL_PATTERN.test(node.textContent || '')) {
                    EMAIL_PATTERN.lastIndex = 0;
                    return;
                }
                if(node.children.length) {
                    EMAIL_PATTERN.lastIndex = 0;
                    return;
                }
                node.textContent = removeEmailsFromText(node.textContent, 'Aluno');
                EMAIL_PATTERN.lastIndex = 0;
            });
            const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
            const textNodes = [];
            while(walker.nextNode()) textNodes.push(walker.currentNode);
            textNodes.forEach(textNode => {
                const parent = textNode.parentElement;
                if(!parent || ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(parent.tagName)) return;
                const original = textNode.nodeValue || '';
                if(!EMAIL_PATTERN.test(original)) {
                    EMAIL_PATTERN.lastIndex = 0;
                    return;
                }
                textNode.nodeValue = removeEmailsFromText(original, parent.closest('td') ? 'Aluno' : '');
                EMAIL_PATTERN.lastIndex = 0;
            });
        });
    }

    function cleanupInternalUi() {
        const selectors = [
            '#seguranca',
            '#diagnostico',
            '[onclick*="seguranca"]',
            '[onclick*="diagnostico"]'
        ];
        document.querySelectorAll(selectors.join(',')).forEach(el => {
            el.setAttribute('aria-hidden', 'true');
            el.style.display = 'none';
        });
    }

    function afterRender() {
        polishDashboard();
        polishWeeklyGrid();
        polishTaskCards();
        scrubStudentEmails();
        cleanupInternalUi();
    }

    function wrap(name, before, after) {
        const original = fn(name);
        if(!original || original[WRAPPED]) return false;
        function wrapped() {
            if(before) before.apply(this, arguments);
            const result = original.apply(this, arguments);
            if(after) {
                if(result && typeof result.finally === 'function') result.finally(() => after.apply(this, arguments));
                else after.apply(this, arguments);
            }
            return result;
        }
        wrapped[WRAPPED] = true;
        wrapped.__plantaoOriginal = original;
        setFn(name, wrapped);
        return true;
    }

    function install() {
        normalizeCoreState();
        wrap('normalizarBanco', null, normalizeCoreState);
        wrap('save', normalizeCoreState, null);
        wrap('updateDashboard', null, polishDashboard);
        wrap('renderSemanal', normalizeCoreState, polishWeeklyGrid);
        wrap('renderDiario', normalizeCoreState, polishTaskCards);
        wrap('renderDiarioSemRecalcular', normalizeCoreState, polishTaskCards);
        wrap('renderRankingAlunos', null, afterRender);
        wrap('renderPainelProfessor', null, afterRender);
        wrap('renderPerfil', null, afterRender);
        wrap('renderAdminAccessList', null, afterRender);
        wrap('renderAdminStudentBanner', null, afterRender);
        wrap('showTab', null, afterRender);
        afterRender();
        return true;
    }

    if(document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', install, { once: true });
    } else {
        install();
    }

    let tries = 0;
    const timer = setInterval(() => {
        tries += 1;
        install();
        if(tries > 80) clearInterval(timer);
    }, 250);
})();
