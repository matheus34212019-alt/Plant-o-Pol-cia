(function plantaoLaunchDedupeFix() {
    if(window.__plantaoLaunchDedupeFix) return;
    window.__plantaoLaunchDedupeFix = true;

    const VERSION = 'v242-launch-dedupe';

    function value(name, fallback = null) {
        try { return Function(`return typeof ${name} === "undefined" ? null : ${name};`)() ?? fallback; }
        catch(_) { return fallback; }
    }

    function fn(name) {
        const found = value(name);
        return typeof found === 'function' ? found : null;
    }

    function setFn(name, replacement) {
        try { Function('replacement', `${name} = replacement;`)(replacement); } catch(_) {}
        try { window[name] = replacement; } catch(_) {}
    }

    function state() {
        return value('db', null);
    }

    function num(input) {
        const parsed = parseFloat(String(input ?? '0').replace(',', '.'));
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function int(input) {
        const parsed = parseInt(input, 10);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function clean(input) {
        return String(input ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();
    }

    function parseDay(key) {
        const direct = fn('keyToDate');
        if(direct) {
            try {
                const date = direct(key);
                if(date && !Number.isNaN(date.getTime())) return date;
            } catch(_) {}
        }
        const text = String(key || '');
        const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if(br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
        const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if(iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
        const fallback = new Date(text);
        return Number.isNaN(fallback.getTime()) ? new Date(0) : fallback;
    }

    function keyForDate(date) {
        const local = fn('dateKey');
        if(local) {
            try { return local(date); } catch(_) {}
        }
        const pad = value => String(value).padStart(2, '0');
        return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
    }

    function isExtra(task) {
        const local = fn('isExtraTask');
        if(local) {
            try { return Boolean(local(task)); } catch(_) {}
        }
        return Boolean(task?.extra || clean(task?.l) === 'EXTRA');
    }

    function launchIdentity(day, task) {
        const kind = clean(task?.k || task?.tipo || task?.l);
        const itemId = clean(task?.itemId || task?.item_id || task?.idItem);
        if(itemId) return `${String(day)}|${kind}|item:${itemId}`;
        return [
            String(day),
            kind,
            clean(task?.m || task?.materia),
            clean(task?.a || task?.assunto),
            clean(task?.l || task?.label)
        ].join('|');
    }

    function chooseLaunch(current, next) {
        const currentTask = current?.task || {};
        const nextTask = next?.task || {};
        const currentHasPerf = int(currentTask.perf?.t) > 0 || int(currentTask.perf?.a) > 0;
        const nextHasPerf = int(nextTask.perf?.t) > 0 || int(nextTask.perf?.a) > 0;
        if(!currentHasPerf && nextHasPerf) return next;
        const currentHours = num(currentTask.h);
        const nextHours = num(nextTask.h);
        if(currentHasPerf === nextHasPerf && nextHours > 0 && (currentHours <= 0 || nextHours < currentHours)) return next;
        return current;
    }

    function uniqueRows(rows) {
        const result = [];
        const seen = new Map();
        rows.forEach(row => {
            if(!row?.task?.c) return;
            if(isExtra(row.task)) {
                result.push(row);
                return;
            }
            const key = launchIdentity(row.dia, row.task);
            if(!seen.has(key)) {
                seen.set(key, result.length);
                result.push(row);
                return;
            }
            const index = seen.get(key);
            result[index] = chooseLaunch(result[index], row);
        });
        return result;
    }

    function getUniqueLaunches(source = state(), options = {}) {
        const includeExtra = options.includeExtra !== false;
        const rows = [];
        Object.keys(source?.metaFixa || {}).forEach(dia => {
            (source.metaFixa[dia] || []).forEach((task, idx) => {
                if(!task?.c) return;
                if(!includeExtra && isExtra(task)) return;
                rows.push({ dia, idx, task });
            });
        });
        return uniqueRows(rows).sort((a, b) => parseDay(b.dia) - parseDay(a.dia));
    }

    function listarLancamentosSeguro() {
        return getUniqueLaunches(state(), { includeExtra: true });
    }

    function listarLancamentosBancoSeguro(banco) {
        return getUniqueLaunches(banco, { includeExtra: false }).map(({ dia, task }) => ({ dia, task }));
    }

    function getPerformanceDataSeguro() {
        const lancamentos = getUniqueLaunches(state(), { includeExtra: false });
        const porMateria = {};
        const porAssunto = {};
        const ensure = (obj, key, extra = {}) => {
            const safeKey = key || 'Sem classificacao';
            if(!obj[safeKey]) obj[safeKey] = {
                nome: safeKey,
                horas: 0,
                questoes: 0,
                acertos: 0,
                atividades: 0,
                estudos: 0,
                revisoes: 0,
                exercicios: 0,
                ...extra
            };
            return obj[safeKey];
        };

        lancamentos.forEach(({ task }) => {
            const materia = String(task.m || 'Sem materia').trim() || 'Sem materia';
            const assunto = String(task.a || 'Sem assunto').trim() || 'Sem assunto';
            const mat = ensure(porMateria, materia);
            const ass = ensure(porAssunto, `${materia}||${assunto}`, { materia, assunto });
            [mat, ass].forEach(alvo => {
                alvo.horas += num(task.h);
                alvo.atividades += 1;
                if(task.k === 'E') alvo.estudos += 1;
                if(task.k === 'Rev') alvo.revisoes += 1;
                if(task.k === 'Ex') alvo.exercicios += 1;
                alvo.questoes += int(task.perf?.t);
                alvo.acertos += int(task.perf?.a);
            });
        });

        const total = Object.values(porMateria).reduce((acc, item) => {
            acc.horas += item.horas;
            acc.questoes += item.questoes;
            acc.acertos += item.acertos;
            acc.atividades += item.atividades;
            acc.estudos += item.estudos;
            acc.revisoes += item.revisoes;
            acc.exercicios += item.exercicios;
            return acc;
        }, { horas: 0, questoes: 0, acertos: 0, atividades: 0, estudos: 0, revisoes: 0, exercicios: 0 });

        return {
            lancamentos,
            total,
            materias: Object.values(porMateria),
            assuntos: Object.values(porAssunto)
        };
    }

    function correctDashboardKpis() {
        const banco = state();
        if(!banco) return;
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - start.getDay());
        const end = new Date(start);
        end.setDate(start.getDate() + 7);
        let horas = 0;
        let questoes = 0;
        let acertos = 0;
        getUniqueLaunches(banco, { includeExtra: false }).forEach(({ dia, task }) => {
            const date = parseDay(dia);
            if(date < start || date >= end) return;
            horas += num(task.h);
            questoes += int(task.perf?.t);
            acertos += int(task.perf?.a);
        });
        const horasEl = document.getElementById('horas-hoje');
        const precisaoEl = document.getElementById('precisao-dia');
        if(horasEl) horasEl.innerText = `${horas.toFixed(1)}h`;
        if(precisaoEl) precisaoEl.innerText = questoes ? `${Math.round((acertos / questoes) * 100)}%` : '0%';
    }

    function mesclarComplementoPlanejadoSeguro(tasks, extras) {
        const base = [...(tasks || [])];
        (extras || []).forEach(extra => {
            const existente = base.find(t => t.itemId === extra.itemId && t.k === extra.k && (extra.k === 'E' || extra.k === 'Rev'));
            if(existente) {
                if(existente.c) return;
                existente.h = Math.round((num(existente.h) + num(extra.h)) * 10) / 10;
                return;
            }
            if(!base.some(t => t.itemId === extra.itemId && t.k === extra.k)) base.push(extra);
        });
        return base;
    }

    const originalUpdateDashboard = fn('updateDashboard');
    if(originalUpdateDashboard && !originalUpdateDashboard.__plantaoLaunchDedupeWrapped) {
        function updateDashboardSeguro() {
            const result = originalUpdateDashboard.apply(this, arguments);
            correctDashboardKpis();
            return result;
        }
        updateDashboardSeguro.__plantaoLaunchDedupeWrapped = true;
        updateDashboardSeguro.__plantaoOriginal = originalUpdateDashboard;
        setFn('updateDashboard', updateDashboardSeguro);
    }

    function refreshActiveScreens() {
        if(document.getElementById('lancamentos')?.classList.contains('active')) fn('renderLancamentos')?.();
        if(document.getElementById('desempenho')?.classList.contains('active')) fn('renderPerformance')?.();
        if(document.getElementById('evolucao')?.classList.contains('active')) fn('renderEvolucaoEstudo')?.();
        correctDashboardKpis();
    }

    function metaFixaDeduplicada(banco) {
        const meta = {};
        getUniqueLaunches(banco, { includeExtra: true }).forEach(({ dia, task }) => {
            if(!meta[dia]) meta[dia] = [];
            meta[dia].push(task);
        });
        Object.entries(banco?.metaFixa || {}).forEach(([dia, tasks]) => {
            (tasks || []).forEach(task => {
                if(task?.c) return;
                if(!meta[dia]) meta[dia] = [];
                meta[dia].push(task);
            });
        });
        return meta;
    }

    const originalRenderEvolucao = fn('renderEvolucaoEstudo');
    if(originalRenderEvolucao && !originalRenderEvolucao.__plantaoLaunchDedupeWrapped) {
        function renderEvolucaoDeduplicada() {
            const banco = state();
            if(!banco?.metaFixa) return originalRenderEvolucao.apply(this, arguments);
            const originalMeta = banco.metaFixa;
            try {
                banco.metaFixa = metaFixaDeduplicada(banco);
                return originalRenderEvolucao.apply(this, arguments);
            } finally {
                banco.metaFixa = originalMeta;
            }
        }
        renderEvolucaoDeduplicada.__plantaoLaunchDedupeWrapped = true;
        renderEvolucaoDeduplicada.__plantaoOriginal = originalRenderEvolucao;
        setFn('renderEvolucaoEstudo', renderEvolucaoDeduplicada);
    }

    window.__plantaoGetUniqueLaunches = getUniqueLaunches;
    window.__plantaoLaunchDedupeVersion = VERSION;
    setFn('listarLancamentos', listarLancamentosSeguro);
    setFn('listarLancamentosBanco', listarLancamentosBancoSeguro);
    setFn('getPerformanceData', getPerformanceDataSeguro);
    setFn('mesclarComplementoPlanejado', mesclarComplementoPlanejadoSeguro);

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refreshActiveScreens, { once: true });
    else setTimeout(refreshActiveScreens, 0);
})();
