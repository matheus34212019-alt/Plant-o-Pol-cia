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

    function instalarReplanejamentoDeAtrasos() {
        if (typeof replanejarAgora !== 'function' || replanejarAgora.__plantaoMoveAtrasos) return;

        const tarefasPlanejadasLocal = (tasks) => (tasks || []).filter((task) => !isExtraTask(task));
        const arredondarHoras = (valor) => Math.round((parseFloat(valor) || 0) * 10) / 10;

        function ordenarAtrasosPorData(atrasos) {
            return atrasos.sort((a, b) => keyToDate(a.dia) - keyToDate(b.dia) || a.idx - b.idx);
        }

        function getAtrasosComIndice(hoje) {
            const hojeBase = new Date(hoje);
            hojeBase.setHours(0, 0, 0, 0);
            const atrasos = [];
            Object.entries(db.metaFixa || {}).forEach(([dia, tasks]) => {
                const data = keyToDate(dia);
                data.setHours(0, 0, 0, 0);
                if (data >= hojeBase) return;
                (tasks || []).forEach((task, idx) => {
                    if (!task.c && !isExtraTask(task)) atrasos.push({ dia, task, idx });
                });
            });
            return ordenarAtrasosPorData(atrasos);
        }

        function totalPlanejadoDia(diaKey) {
            return tarefasPlanejadasLocal(db.metaFixa?.[diaKey])
                .reduce((acc, task) => acc + (parseFloat(task.h) || 0), 0);
        }

        function estudoDoAssuntoDia(diaKey, itemId) {
            return tarefasPlanejadasLocal(db.metaFixa?.[diaKey])
                .filter((task) => task.itemId === itemId && task.k === 'E')
                .reduce((acc, task) => acc + (parseFloat(task.h) || 0), 0);
        }

        function guardarPlano(diaKey) {
            if (typeof atualizarPlanoDiaTravado === 'function') atualizarPlanoDiaTravado(diaKey);
        }

        function limparPlanejamentoRecalculavel(inicioDate) {
            const inicio = new Date(inicioDate);
            inicio.setHours(0, 0, 0, 0);
            Object.keys(db.metaFixa || {}).forEach((dia) => {
                const data = keyToDate(dia);
                data.setHours(0, 0, 0, 0);
                if (data < inicio) return;
                const preservadas = (db.metaFixa[dia] || []).filter((task) => task.c || isExtraTask(task));
                if (preservadas.length) {
                    db.metaFixa[dia] = preservadas;
                    guardarPlano(dia);
                } else {
                    delete db.metaFixa[dia];
                    if (db.planosTravados) delete db.planosTravados[dia];
                }
            });
        }

        function adicionarAtraso(diaKey, task, horas, origemDia) {
            db.metaFixa[diaKey] = db.metaFixa[diaKey] || [];
            const h = arredondarHoras(horas);
            if (h <= 0.01) return false;

            const existente = db.metaFixa[diaKey].find((item) =>
                !item.c &&
                !isExtraTask(item) &&
                item.itemId === task.itemId &&
                item.k === task.k &&
                (item.k === 'E' || item.k === 'Rev')
            );

            if (existente) {
                existente.h = arredondarHoras((parseFloat(existente.h) || 0) + h);
                existente.replanejado = true;
                existente.replanejadoDe = existente.replanejadoDe || origemDia;
                existente.data = diaKey;
                return true;
            }

            const novo = { ...task, h, c: false, data: diaKey, replanejado: true, replanejadoDe: origemDia };
            delete novo.perf;
            db.metaFixa[diaKey].push(novo);
            return true;
        }

        function inserirAtrasoNoProximoEspaco(task, origemDia, inicioDate) {
            let restante = arredondarHoras(task.h);
            if (restante <= 0.01) return false;

            const metaSnapshot = JSON.stringify(db.metaFixa || {});
            const travadosSnapshot = JSON.stringify(db.planosTravados || {});

            for (let offset = 0; offset <= 365 && restante > 0.01; offset += 1) {
                const data = addDays(inicioDate, offset);
                const diaKey = dateKey(data);
                if (typeof diaPausado === 'function' && diaPausado(diaKey)) continue;

                const limite = parseFloat(db.h?.[data.getDay()]) || 0;
                if (limite <= 0) continue;

                const livre = arredondarHoras(Math.max(0, limite - totalPlanejadoDia(diaKey)));
                if (livre <= 0.01) continue;

                if (task.k === 'E') {
                    const limiteAssunto = Math.max(0, (typeof MAX_ESTUDO_DIA === 'number' ? MAX_ESTUDO_DIA : 2) - estudoDoAssuntoDia(diaKey, task.itemId));
                    const bloco = arredondarHoras(Math.min(restante, livre, limiteAssunto));
                    if (bloco < 0.5 && restante >= 0.5) continue;
                    if (!adicionarAtraso(diaKey, task, bloco, origemDia)) continue;
                    restante = arredondarHoras(restante - bloco);
                    guardarPlano(diaKey);
                    continue;
                }

                if (livre + 0.01 < restante) continue;
                if (adicionarAtraso(diaKey, task, restante, origemDia)) {
                    guardarPlano(diaKey);
                    restante = 0;
                }
            }

            if (restante <= 0.01) return true;
            db.metaFixa = JSON.parse(metaSnapshot);
            db.planosTravados = JSON.parse(travadosSnapshot);
            return false;
        }

        function removerMovidosDoHistorico(movidos) {
            const porDia = new Map();
            movidos.forEach(({ dia, idx }) => {
                if (!porDia.has(dia)) porDia.set(dia, new Set());
                porDia.get(dia).add(idx);
            });

            porDia.forEach((indices, dia) => {
                const filtradas = (db.metaFixa[dia] || []).filter((task, idx) => !indices.has(idx));
                if (filtradas.length) {
                    db.metaFixa[dia] = filtradas;
                    guardarPlano(dia);
                } else {
                    delete db.metaFixa[dia];
                    if (db.planosTravados) delete db.planosTravados[dia];
                }
            });
        }

        replanejarAgora = function replanejarMovendoAtrasos() {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            const atrasos = getAtrasosComIndice(hoje);
            if (!atrasos.length) {
                if (typeof showToast === 'function') showToast('Sem atrasos', 'Nenhuma pendencia encontrada para replanejar.');
                return;
            }

            limparPlanejamentoRecalculavel(hoje);
            const movidos = [];
            atrasos.forEach((registro) => {
                if (inserirAtrasoNoProximoEspaco(registro.task, registro.dia, hoje)) movidos.push(registro);
            });
            removerMovidosDoHistorico(movidos);

            const hojeKey = dateKey(hoje);
            if (typeof garantirDiaPlanejado === 'function') garantirDiaPlanejado(hojeKey, hoje);
            if (typeof calcularSemanaPlanejada === 'function' && typeof fixarSemanaPlanejada === 'function') {
                const inicioSemana = new Date(hoje);
                inicioSemana.setDate(hoje.getDate() - hoje.getDay());
                fixarSemanaPlanejada(calcularSemanaPlanejada(), inicioSemana, hoje);
            }

            if (typeof save === 'function') save();
            if (typeof showToast === 'function') {
                const pendentes = atrasos.length - movidos.length;
                showToast(
                    pendentes ? 'Plantao parcialmente replanejado' : 'Plantao replanejado',
                    pendentes
                        ? `${movidos.length} atraso(s) foram movidos. ${pendentes} ainda ficaram pendentes por falta de espaco nas horas diarias.`
                        : `${movidos.length} atraso(s) foram movidos para os proximos dias respeitando suas horas diarias.`
                );
            }

            vDate = new Date(hoje);
            if (typeof updateDashboard === 'function') updateDashboard();
            if (typeof renderDiario === 'function') renderDiario(vDate);
            if (typeof renderReplanejamento === 'function') renderReplanejamento();
        };

        replanejarAgora.__plantaoMoveAtrasos = true;
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
        instalarReplanejamentoDeAtrasos();
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
