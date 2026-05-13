(function plannerFix() {
    const APP_NAME = 'PLANT\u00c3O';
    const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

    const CP1252_BYTES = {
        0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84,
        0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
        0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c,
        0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
        0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
        0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
        0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
    };

    function badScore(value) {
        return (String(value).match(/[\u00c3\u00c2\ufffd]|\u00ef\u00bf\u00bd|\u00e2[\u0080-\u00bf]/g) || []).length;
    }

    function byteCp1252(char) {
        const code = char.codePointAt(0);
        if (code <= 0xff) return code;
        return CP1252_BYTES[code] ?? null;
    }

    function decodeMojibakeOnce(value) {
        const bytes = [];
        for (const char of value) {
            const byte = byteCp1252(char);
            if (byte === null) return value;
            bytes.push(byte);
        }
        return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    }

    function fixText(value) {
        if (typeof value !== 'string') return value;
        let text = value;
        for (let index = 0; index < 5; index += 1) {
            const decoded = decodeMojibakeOnce(text);
            if (decoded === text || badScore(decoded) > badScore(text)) break;
            text = decoded;
            if (badScore(text) === 0) break;
        }
        return text
            .replace(/PLANT(?:AO|\u00c3O|[\u00c0-\u017f\ufffd]+O)/gi, APP_NAME)
            .replace(/Voc\ufffd/g, 'Voc\u00ea')
            .replace(/n\ufffdo/g, 'n\u00e3o')
            .replace(/N\ufffdo/g, 'N\u00e3o')
            .replace(/Miss\ufffdo/g, 'Miss\u00e3o')
            .replace(/Quest\ufffdes/g, 'Quest\u00f5es')
            .replace(/Precis\ufffdo/g, 'Precis\u00e3o')
            .replace(/Revis\ufffdo/g, 'Revis\u00e3o')
            .replace(/Exerc\ufffdcios/g, 'Exerc\u00edcios')
            .replace(/Mat\ufffdrias/g, 'Mat\u00e9rias')
            .replace(/Publica\ufffdo/g, 'Publica\u00e7\u00e3o')
            .replace(/solicita\ufffdes/g, 'solicita\u00e7\u00f5es')
            .replace(/lan\ufffamentos/g, 'lan\u00e7amentos')
            .replace(/Hor\ufffarios/g, 'Hor\u00e1rios')
            .replace(/Di\ufffarias/g, 'Di\u00e1rias');
    }

    function fixAttributes(root) {
        root.querySelectorAll?.('[placeholder], [title], [aria-label], [data-label]').forEach((el) => {
            ['placeholder', 'title', 'aria-label', 'data-label'].forEach((attr) => {
                const original = el.getAttribute(attr);
                if (!original) return;
                const fixed = fixText(original);
                if (fixed !== original) el.setAttribute(attr, fixed);
            });
        });
    }

    function forceBrand() {
        document.title = APP_NAME;
        document.querySelectorAll('.login-card h2').forEach((el) => {
            if (el.textContent.trim() !== APP_NAME) el.textContent = APP_NAME;
        });
        document.querySelectorAll('.logo-box').forEach((el) => {
            if (el.textContent.trim() !== APP_NAME) {
                el.innerHTML = `<i class="fas fa-shield-halved"></i> ${APP_NAME}`;
            }
        });
        document.querySelectorAll('[data-brand]').forEach((el) => {
            if (el.textContent.trim() !== APP_NAME) el.textContent = APP_NAME;
        });
    }

    function hideRankingEmails(root) {
        root.querySelectorAll?.('#ranking-content small, #ranking small, .ranking-card small, .ranking-row small').forEach((el) => {
            const cleaned = el.textContent.replace(EMAIL_RE, '').replace(/\s*\|\s*\|/g, ' | ').replace(/^\s*\|\s*/, '').trim();
            if (cleaned !== el.textContent) el.textContent = cleaned;
        });
    }

    function isExtraTask(task) {
        return task?.extra === true || task?.l === 'Extra' || task?.k === 'Extra';
    }

    function teoriaPendenteDaTarefa(task, state = db) {
        if (isExtraTask(task) || task?.k === 'E') return null;
        const item = state?.lista?.find((x) => x.id === task?.itemId);
        if (!item || item.f) return null;
        const feitas = parseFloat(item.hF) || 0;
        const necessarias = parseFloat(item.h?.E) || 0;
        return feitas < necessarias - 0.01 ? item : null;
    }

    function avisarTeoriaPendente(task, item) {
        if (typeof showToast === 'function') {
            showToast(
                'Estudo pendente',
                `Conclua o estudo de ${fixText(item?.a || task?.a || 'esta aula')} antes da revisao ou dos exercicios.`
            );
        }
    }

    function bloquearConclusaoSemTeoria() {
        if (typeof concluirTask === 'function' && !concluirTask.__plantaoTeoriaGuard) {
            const originalConcluirTask = concluirTask;
            concluirTask = function concluirTaskComTeoria(task, diaKey) {
                const item = teoriaPendenteDaTarefa(task, db);
                if (item) {
                    avisarTeoriaPendente(task, item);
                    return false;
                }
                return originalConcluirTask.apply(this, arguments);
            };
            concluirTask.__plantaoTeoriaGuard = true;
        }

        if (typeof confirmarExercicio === 'function' && !confirmarExercicio.__plantaoTeoriaGuard) {
            const originalConfirmarExercicio = confirmarExercicio;
            confirmarExercicio = function confirmarExercicioComTeoria() {
                const task = exPendente ? db?.metaFixa?.[exPendente.dK]?.[exPendente.idx] : null;
                const item = teoriaPendenteDaTarefa(task, db);
                if (item) {
                    avisarTeoriaPendente(task, item);
                    if (typeof fecharModais === 'function') fecharModais();
                    if (typeof renderDiarioSemRecalcular === 'function') renderDiarioSemRecalcular(vDate);
                    return false;
                }
                return originalConfirmarExercicio.apply(this, arguments);
            };
            confirmarExercicio.__plantaoTeoriaGuard = true;
        }
    }

    function tarefasPlanejadas(tasks) {
        return (tasks || []).filter((task) => !isExtraTask(task));
    }

    function agendarTeoriaExtraFutura(item, diaOrigem, horas) {
        let restante = Math.max(0, parseFloat(horas) || 0);
        const inicio = keyToDate(diaOrigem);
        for (let offset = 1; restante > 0.01 && offset <= 365; offset += 1) {
            const data = addDays(inicio, offset);
            const key = dateKey(data);
            if (typeof diaPausado === 'function' && diaPausado(key)) continue;
            const limite = parseFloat(db.h?.[data.getDay()]) || 0;
            if (limite <= 0) continue;
            const tasks = db.metaFixa[key] || [];
            const ocupado = tarefasPlanejadas(tasks).reduce((acc, task) => acc + (parseFloat(task.h) || 0), 0);
            const livre = Math.max(0, limite - ocupado);
            if (livre <= 0.01) continue;
            const bloco = Math.min(restante, livre, typeof MAX_ESTUDO_DIA === 'number' ? MAX_ESTUDO_DIA : 2);
            if (bloco < 0.5 && restante >= 0.5) continue;
            tasks.push({ ...criarTask(item, 'E', Math.round(bloco * 10) / 10, key), extraTeoriaContinuidade: true });
            db.metaFixa[key] = tasks;
            restante = Math.round((restante - bloco) * 10) / 10;
        }
        if (restante > 0.01 && typeof showToast === 'function') {
            showToast('Tempo extra pendente', 'Nao encontrei espaco suficiente nos proximos dias. Ajuste as horas diarias ou replaneje.');
        }
    }

    function substituirTempoExtraTeoria() {
        if (typeof aplicarTempoExtraTeoria !== 'function' || aplicarTempoExtraTeoria.__plantaoExtraGuard) return;
        aplicarTempoExtraTeoria = function aplicarTempoExtraTeoriaCorrigido(destino) {
            if (!teoriaPendente) return;
            const diaOrigem = teoriaPendente.dK;
            const item = db.lista.find((x) => x.id === teoriaPendente.itemId);
            const horas = Math.max(0, parseFloat(document.getElementById('teoria-extra-horas')?.value) || 0);
            if (!item || horas <= 0) return;

            const planoOriginalDia = JSON.parse(JSON.stringify(db.metaFixa?.[diaOrigem] || []));

            item.h.E = (parseFloat(item.h.E) || 0) + horas;
            item.extraTeoria = (parseFloat(item.extraTeoria) || 0) + horas;
            item.done.E = false;
            item.done.Rev = false;
            item.done.Ex = false;
            item.f = false;
            item.revCycle = null;

            if (typeof limparPlanejamentoFuturo === 'function') limparPlanejamentoFuturo(diaOrigem);
            db.metaFixa[diaOrigem] = planoOriginalDia;

            if (destino === 'hoje' && typeof inserirTeoriaExtraNoDia === 'function') {
                inserirTeoriaExtraNoDia(item, diaOrigem, horas);
            } else {
                agendarTeoriaExtraFutura(item, diaOrigem, horas);
            }

            teoriaPendente = null;
            if (typeof fecharModais === 'function') fecharModais();
            if (typeof save === 'function') save();
            if (typeof showToast === 'function') {
                showToast('Tempo extra planejado', destino === 'hoje' ? 'O reforco foi tentado no dia atual.' : 'O estudo extra entrou antes da revisao e dos exercicios.');
            }
            if (typeof updateDashboard === 'function') updateDashboard();
            if (typeof renderDiarioSemRecalcular === 'function') renderDiarioSemRecalcular(vDate);
        };
        aplicarTempoExtraTeoria.__plantaoExtraGuard = true;
    }

    function fixVisibleText(root = document.body) {
        if (!root) return;
        forceBrand();
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach((node) => {
            const fixed = fixText(node.nodeValue);
            if (fixed !== node.nodeValue) node.nodeValue = fixed;
        });
        fixAttributes(root);
        hideRankingEmails(root);
        forceBrand();
    }

    function wrapRender(name) {
        if (typeof window[name] !== 'function' || window[name].__plantaoTextFixWrapped) return;
        const original = window[name];
        window[name] = function wrappedRender(...args) {
            const result = original.apply(this, args);
            setTimeout(fixVisibleText, 0);
            return result;
        };
        window[name].__plantaoTextFixWrapped = true;
    }

    function boot() {
        bloquearConclusaoSemTeoria();
        substituirTempoExtraTeoria();
        ['renderDiario', 'renderSemanal', 'updateDashboard', 'renderTree', 'renderFluxo', 'renderCiclo', 'renderReplanejar', 'renderRankingAlunos', 'renderPerfil'].forEach(wrapRender);
        fixVisibleText();
        setTimeout(fixVisibleText, 400);
        setTimeout(fixVisibleText, 1200);
        let pending = false;
        new MutationObserver(() => {
            if (pending) return;
            pending = true;
            setTimeout(() => {
                pending = false;
                fixVisibleText();
            }, 80);
        }).observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
