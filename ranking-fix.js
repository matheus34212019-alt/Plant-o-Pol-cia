(function rankingLaunchFix() {
    if (window.__plantaoRankingLaunchFixV197) return;
    window.__plantaoRankingLaunchFixV197 = true;

    function extra(task) {
        return task?.extra === true || task?.l === 'Extra' || task?.k === 'Extra';
    }

    function norm(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase();
    }

    function roundHour(value) {
        return Math.round((parseFloat(value) || 0) * 10) / 10;
    }

    function launchKey(day, task) {
        return [
            day || task?.data || '',
            task?.__launchId || task?.recoveryId || '',
            task?.itemId || '',
            task?.k || '',
            norm(task?.m),
            norm(task?.a),
            roundHour(task?.h),
        ].join('|');
    }

    function listarHistoricoBanco(banco) {
        const out = [];
        const seen = new Set();
        const push = (dia, task, id) => {
            if (!dia || !task || extra(task)) return;
            const key = id || launchKey(dia, task);
            if (seen.has(key)) return;
            seen.add(key);
            out.push({ dia, task: { ...task, c: true, data: dia } });
        };

        (Array.isArray(banco?.lancamentos) ? banco.lancamentos : []).forEach((record) => {
            if (record?.task) push(record.dia || record.task.data, record.task, record.id);
        });

        Object.entries(banco?.metaFixa || {}).forEach(([dia, tasks]) => {
            (tasks || []).forEach((task) => {
                if (task?.c) push(dia, task, task.__launchId || launchKey(dia, task));
            });
        });

        return out;
    }

    function install() {
        if (typeof listarLancamentosBanco === 'function') {
            listarLancamentosBanco = function listarLancamentosBancoComHistorico(banco) {
                return listarHistoricoBanco(banco);
            };
        }

        if (typeof resumoRankingAluno === 'function') {
            resumoRankingAluno = function resumoRankingAlunoComHistorico(aluno, dados) {
                const banco = dados || {};
                const lancamentos = listarHistoricoBanco(banco);
                const total = lancamentos.reduce((acc, { task }) => {
                    acc.horas += parseFloat(task.h) || 0;
                    if (task.perf) {
                        acc.questoes += parseInt(task.perf.t) || 0;
                        acc.acertos += parseInt(task.perf.a) || 0;
                    }
                    return acc;
                }, { horas: 0, questoes: 0, acertos: 0 });
                return {
                    nome: banco.perfilNome || aluno.name || aluno.email || 'Aluno',
                    email: aluno.email || '',
                    horas: total.horas,
                    questoes: total.questoes,
                    acertos: total.acertos,
                    taxa: total.questoes ? Math.round((total.acertos / total.questoes) * 100) : 0,
                    streak: typeof calcularStreakBanco === 'function' ? calcularStreakBanco(banco) : 0,
                };
            };
        }
    }

    install();
    setTimeout(install, 800);
    setTimeout(install, 2000);
})();
