(function plantaoHotfix() {
    if (window.__plantaoHotfixV194) return;
    window.__plantaoHotfixV194 = true;

    function extra(task) {
        return task?.extra === true || task?.l === 'Extra' || task?.k === 'Extra';
    }

    function planejadas(tasks) {
        return (tasks || []).filter((task) => !extra(task));
    }

    function roundHour(value) {
        return Math.round((parseFloat(value) || 0) * 10) / 10;
    }

    function readLocalDb() {
        try {
            return JSON.parse(localStorage.getItem('prf_v120') || 'null');
        } catch (e) {
            return null;
        }
    }

    function writeLocalDb() {
        try {
            localStorage.setItem('prf_v120', JSON.stringify(db));
        } catch (e) {}
    }

    function stampLocalChange() {
        if (!db || typeof db !== 'object') return;
        db.__lastLocalSaveAt = new Date().toISOString();
        writeLocalDb();
    }

    function summary(data) {
        const meta = data?.metaFixa && typeof data.metaFixa === 'object' ? data.metaFixa : {};
        const tasks = Object.values(meta).flat().filter(Boolean);
        const done = tasks.filter((task) => task?.c === true).length;
        return {
            assuntos: Array.isArray(data?.lista) ? data.lista.length : 0,
            dias: Object.keys(meta).length,
            tarefas: tasks.length,
            concluidas: done,
            lancamentos: done,
            stamp: Date.parse(data?.__lastLocalSaveAt || data?.__lastUpdatedAt || 0) || 0,
        };
    }

    function shouldKeepLocal(localData, remoteData) {
        if (!localData || !localData.lista) return false;
        if (!remoteData || !remoteData.lista) return true;
        const local = summary(localData);
        const remote = summary(remoteData);
        const newerLocal = local.stamp && local.stamp > remote.stamp + 1000;
        if (newerLocal && JSON.stringify(localData?.h || {}) !== JSON.stringify(remoteData?.h || {})) return true;
        if (newerLocal && JSON.stringify(localData?.ciclo || []) !== JSON.stringify(remoteData?.ciclo || [])) return true;
        if (local.concluidas > remote.concluidas) return true;
        if (local.lancamentos > remote.lancamentos) return true;
        if (newerLocal && local.assuntos >= remote.assuntos && local.tarefas >= Math.floor(remote.tarefas * 0.8)) return true;
        if (local.dias > remote.dias && local.tarefas >= remote.tarefas && local.assuntos >= remote.assuntos) return true;
        return false;
    }

    function installPersistenceGuard() {
        if (window.__plantaoPersistenceGuardV193) return;
        window.__plantaoPersistenceGuardV193 = true;

        if (typeof save === 'function' && !save.__hotfixV193) {
            const originalSave = save;
            save = function saveWithStamp() {
                stampLocalChange();
                return originalSave.apply(this, arguments);
            };
            save.__hotfixV193 = true;
        }

        if (typeof salvarDadosSupabase === 'function' && !salvarDadosSupabase.__hotfixV193) {
            const originalCloudSave = salvarDadosSupabase;
            salvarDadosSupabase = async function salvarDadosSupabaseWithStamp() {
                stampLocalChange();
                return originalCloudSave.apply(this, arguments);
            };
            salvarDadosSupabase.__hotfixV193 = true;
        }

        if (typeof resumoPersistencia === 'function') {
            resumoPersistencia = summary;
            resumoPersistencia.__hotfixV193 = true;
        }

        if (typeof carregarDadosSupabase === 'function' && !carregarDadosSupabase.__hotfixV193) {
            carregarDadosSupabase = async function carregarDadosSupabasePreservandoLocal() {
                if (!supabaseClient || !cloudUser || typeof alvoDadosNuvem !== 'function') return false;
                const target = alvoDadosNuvem();
                if (!target.user_id) {
                    if (typeof showToast === 'function') showToast('Aluno sem dados ainda', 'Esse aluno precisa entrar uma vez pelo Google antes de editar o perfil dele.');
                    return false;
                }

                carregandoNuvem = true;
                try {
                    const localBeforeLoad = readLocalDb() || db;
                    const result = await comTimeout(
                        supabaseClient
                            .from('plantao_user_data')
                            .select('data')
                            .eq('user_id', target.user_id)
                            .maybeSingle(),
                        6500,
                        'Tempo esgotado ao carregar dados do Supabase.'
                    );
                    if (result.error) throw result.error;

                    const remote = result.data?.data || null;
                    if (remote && shouldKeepLocal(localBeforeLoad, remote)) {
                        db = localBeforeLoad;
                        stampLocalChange();
                        if (typeof normalizarBanco === 'function') normalizarBanco();
                        if (typeof aplicarPreferenciasLocais === 'function') aplicarPreferenciasLocais();
                        dadosSupabaseCarregados = true;
                        carregandoNuvem = false;
                        await salvarDadosSupabase(true);
                        if (typeof recuperarLancamentosAdminConhecidos === 'function') recuperarLancamentosAdminConhecidos();
                        if (typeof showToast === 'function') showToast('Progresso preservado', 'Mantive os lancamentos deste navegador e reenviei para a nuvem.');
                        return true;
                    }

                    if (remote) {
                        db = remote;
                        if (typeof normalizarBanco === 'function') normalizarBanco();
                        if (typeof aplicarPreferenciasLocais === 'function') aplicarPreferenciasLocais();
                        writeLocalDb();
                        dadosSupabaseCarregados = true;
                        if (typeof recuperarLancamentosAdminConhecidos === 'function') recuperarLancamentosAdminConhecidos();
                        if (typeof showToast === 'function') showToast('Dados sincronizados', editandoAlunoComoAdmin() ? `Perfil de ${target.email} carregado.` : 'Seu planejamento foi carregado do Supabase.');
                        return true;
                    }

                    if (editandoAlunoComoAdmin()) {
                        if (typeof showToast === 'function') showToast('Aluno sem planejamento', 'O aluno ainda nao tem dados salvos no Supabase.');
                        return false;
                    }

                    if (typeof aplicarPreferenciasLocais === 'function') aplicarPreferenciasLocais();
                    dadosSupabaseCarregados = true;
                    await salvarDadosSupabase(true);
                    if (typeof showToast === 'function') showToast('Nuvem ativada', 'Seus dados locais foram salvos no Supabase.');
                    return true;
                } catch (e) {
                    if (typeof showToast === 'function') showToast('Sincronizacao indisponivel', 'O site continua usando a copia local deste navegador.');
                    return false;
                } finally {
                    carregandoNuvem = false;
                }
            };
            carregarDadosSupabase.__hotfixV193 = true;
        }
    }

    function installReplanFix() {
        if (typeof replanejarAgora !== 'function' || replanejarAgora.__hotfixV193) return;

        function atrasoList(today) {
            const base = new Date(today);
            base.setHours(0, 0, 0, 0);
            const list = [];
            Object.entries(db.metaFixa || {}).forEach(([dia, tasks]) => {
                const date = keyToDate(dia);
                date.setHours(0, 0, 0, 0);
                if (date >= base) return;
                (tasks || []).forEach((task, idx) => {
                    if (!task.c && !extra(task)) list.push({ dia, task, idx });
                });
            });
            return list.sort((a, b) => keyToDate(a.dia) - keyToDate(b.dia) || a.idx - b.idx);
        }

        function totalDay(dayKey) {
            return planejadas(db.metaFixa?.[dayKey]).reduce((acc, task) => acc + (parseFloat(task.h) || 0), 0);
        }

        function studyDay(dayKey, itemId) {
            return planejadas(db.metaFixa?.[dayKey])
                .filter((task) => task.itemId === itemId && task.k === 'E')
                .reduce((acc, task) => acc + (parseFloat(task.h) || 0), 0);
        }

        function lockPlan(dayKey) {
            if (typeof atualizarPlanoDiaTravado === 'function') atualizarPlanoDiaTravado(dayKey);
        }

        function clearFuturePending(startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            Object.keys(db.metaFixa || {}).forEach((dayKey) => {
                const date = keyToDate(dayKey);
                date.setHours(0, 0, 0, 0);
                if (date < start) return;
                const kept = (db.metaFixa[dayKey] || []).filter((task) => task.c || extra(task));
                if (kept.length) {
                    db.metaFixa[dayKey] = kept;
                    lockPlan(dayKey);
                } else {
                    delete db.metaFixa[dayKey];
                    if (db.planosTravados) delete db.planosTravados[dayKey];
                }
            });
        }

        function addMovedTask(dayKey, task, hours, sourceDay) {
            db.metaFixa[dayKey] = db.metaFixa[dayKey] || [];
            const h = roundHour(hours);
            if (h <= 0.01) return false;
            const existing = db.metaFixa[dayKey].find((item) =>
                !item.c && !extra(item) && item.itemId === task.itemId && item.k === task.k && (item.k === 'E' || item.k === 'Rev')
            );
            if (existing) {
                existing.h = roundHour((parseFloat(existing.h) || 0) + h);
                existing.replanejado = true;
                existing.replanejadoDe = existing.replanejadoDe || sourceDay;
                existing.data = dayKey;
                return true;
            }
            const moved = { ...task, h, c: false, data: dayKey, replanejado: true, replanejadoDe: sourceDay };
            delete moved.perf;
            db.metaFixa[dayKey].push(moved);
            return true;
        }

        function moveToNextSpace(task, sourceDay, startDate) {
            let remaining = roundHour(task.h);
            if (remaining <= 0.01) return false;
            const metaSnapshot = JSON.stringify(db.metaFixa || {});
            const lockSnapshot = JSON.stringify(db.planosTravados || {});

            for (let offset = 0; offset <= 365 && remaining > 0.01; offset += 1) {
                const date = addDays(startDate, offset);
                const dayKey = dateKey(date);
                if (typeof diaPausado === 'function' && diaPausado(dayKey)) continue;
                const limit = parseFloat(db.h?.[date.getDay()]) || 0;
                const free = roundHour(Math.max(0, limit - totalDay(dayKey)));
                if (free <= 0.01) continue;

                if (task.k === 'E') {
                    const perSubject = Math.max(0, (typeof MAX_ESTUDO_DIA === 'number' ? MAX_ESTUDO_DIA : 2) - studyDay(dayKey, task.itemId));
                    const block = roundHour(Math.min(remaining, free, perSubject));
                    if (block < 0.5 && remaining >= 0.5) continue;
                    if (!addMovedTask(dayKey, task, block, sourceDay)) continue;
                    remaining = roundHour(remaining - block);
                    lockPlan(dayKey);
                    continue;
                }

                if (free + 0.01 < remaining) continue;
                if (addMovedTask(dayKey, task, remaining, sourceDay)) {
                    lockPlan(dayKey);
                    remaining = 0;
                }
            }

            if (remaining <= 0.01) return true;
            db.metaFixa = JSON.parse(metaSnapshot);
            db.planosTravados = JSON.parse(lockSnapshot);
            return false;
        }

        function removeMoved(records) {
            const byDay = new Map();
            records.forEach(({ dia, idx }) => {
                if (!byDay.has(dia)) byDay.set(dia, new Set());
                byDay.get(dia).add(idx);
            });
            byDay.forEach((indices, dia) => {
                const filtered = (db.metaFixa[dia] || []).filter((task, idx) => !indices.has(idx));
                if (filtered.length) {
                    db.metaFixa[dia] = filtered;
                    lockPlan(dia);
                } else {
                    delete db.metaFixa[dia];
                    if (db.planosTravados) delete db.planosTravados[dia];
                }
            });
        }

        replanejarAgora = function replanejarMovendoAtrasos() {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const delays = atrasoList(today);
            if (!delays.length) {
                if (typeof showToast === 'function') showToast('Sem atrasos', 'Nenhuma pendencia encontrada para replanejar.');
                return;
            }
            clearFuturePending(today);
            const moved = [];
            delays.forEach((record) => {
                if (moveToNextSpace(record.task, record.dia, today)) moved.push(record);
            });
            removeMoved(moved);
            const todayKey = dateKey(today);
            if (typeof garantirDiaPlanejado === 'function') garantirDiaPlanejado(todayKey, today);
            if (typeof calcularSemanaPlanejada === 'function' && typeof fixarSemanaPlanejada === 'function') {
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - today.getDay());
                fixarSemanaPlanejada(calcularSemanaPlanejada(), weekStart, today);
            }
            if (typeof save === 'function') save();
            if (typeof showToast === 'function') {
                const pending = delays.length - moved.length;
                showToast(
                    pending ? 'Plantao parcialmente replanejado' : 'Plantao replanejado',
                    pending
                        ? `${moved.length} atraso(s) foram movidos. ${pending} ainda ficaram pendentes por falta de espaco nas horas diarias.`
                        : `${moved.length} atraso(s) foram movidos para os proximos dias respeitando suas horas diarias.`
                );
            }
            vDate = new Date(today);
            if (typeof updateDashboard === 'function') updateDashboard();
            if (typeof renderDiario === 'function') renderDiario(vDate);
            if (typeof renderReplanejamento === 'function') renderReplanejamento();
        };

        replanejarAgora.__hotfixV193 = true;
    }

    function taskSignature(task) {
        return encodeURIComponent(JSON.stringify([
            task?.recoveryId || '',
            task?.itemId || '',
            task?.k || '',
            task?.m || '',
            task?.a || '',
            task?.l || '',
            roundHour(task?.h),
            task?.data || '',
        ]));
    }

    function installSafeTaskClick() {
        if (window.__plantaoSafeTaskClickV194) return;
        if (typeof renderTaskCard !== 'function' || typeof cliqueTask !== 'function') return;
        window.__plantaoSafeTaskClickV194 = true;

        window.cliqueTaskSeguro = function cliqueTaskSeguro(event, dia, signature, fallbackIdx) {
            if (event?.stopPropagation) event.stopPropagation();
            const tasks = db?.metaFixa?.[dia] || [];
            const idx = tasks.findIndex((task) => taskSignature(task) === signature);
            const fallback = Number.isFinite(Number(fallbackIdx)) ? Number(fallbackIdx) : -1;
            const alvo = idx >= 0 ? idx : fallback;
            if (alvo < 0 || !tasks[alvo]) {
                if (typeof showToast === 'function') showToast('Atividade atualizada', 'Recarreguei o dia para evitar marcar a tarefa errada.');
                if (typeof renderDiarioSemRecalcular === 'function') renderDiarioSemRecalcular(vDate);
                return false;
            }
            return cliqueTask(dia, alvo);
        };

        const originalRenderTaskCard = renderTaskCard;
        renderTaskCard = function renderTaskCardSeguro(task, dia, idx, atrasada) {
            const html = originalRenderTaskCard.apply(this, arguments);
            const signature = taskSignature(task);
            const fallback = Number.isFinite(Number(idx)) ? Number(idx) : -1;
            return html.replace(
                /onclick="cliqueTask\('[^']+',\s*[^)]*\)"/,
                `onclick="cliqueTaskSeguro(event, '${dia}', '${signature}', ${fallback})"`
            );
        };
        renderTaskCard.__hotfixV194 = true;

        setTimeout(() => {
            if (typeof renderDiarioSemRecalcular === 'function' && typeof vDate !== 'undefined') {
                renderDiarioSemRecalcular(vDate);
            }
        }, 0);
    }

    function boot() {
        installPersistenceGuard();
        installReplanFix();
        installSafeTaskClick();
    }

    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
    boot();
    setTimeout(boot, 300);
    setTimeout(boot, 1200);
})();
