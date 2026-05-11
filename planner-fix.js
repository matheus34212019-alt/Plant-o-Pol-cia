(function plannerFix() {
    const APP_NAME = 'PLANTAO';
    const STORAGE_KEY = 'prf_v120';
    const MAX_STUDY_PER_DAY = 2;
    const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

    const pad = n => String(n).padStart(2, '0');
    const cleanDate = value => {
        const date = new Date(value || new Date());
        date.setHours(0, 0, 0, 0);
        return date;
    };
    const dateKey = value => {
        const date = cleanDate(value);
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    };
    const addDays = (date, amount) => {
        const next = cleanDate(date);
        next.setDate(next.getDate() + amount);
        return next;
    };
    const getDb = () => (typeof db !== 'undefined' ? db : window.db);
    const isExtraTask = task => task?.extra === true || task?.l === 'Extra' || task?.k === 'Extra';
    const isDone = task => task?.c === true;
    const isStudy = task => task?.k === 'E' || task?.l === 'Estudo' || !task?.k;

    const fixes = [
        ['PLANT?O', 'PLANTAO'], ['PLANTÃO', 'PLANTAO'], ['PLANTÃƒO', 'PLANTAO'], ['PLANTÃ�O', 'PLANTAO'], ['PLANT�O', 'PLANTAO'], ['PLANTÃÕ', 'PLANTAO'],
        ['PORTUGUES', 'PORTUGUÊS'], ['PORTUGUÃŠS', 'PORTUGUÊS'], ['PORTUGU�S', 'PORTUGUÊS'],
        ['RACIOCINIO LOGICO', 'RACIOCÍNIO LÓGICO'], ['RACIOCÃ�NIO LÃ“GICO', 'RACIOCÍNIO LÓGICO'], ['RACIOC�NIO L�GICO', 'RACIOCÍNIO LÓGICO'],
        ['Compreensao', 'Compreensão'], ['CompreensÃ£o', 'Compreensão'], ['Compreens�o', 'Compreensão'], ['compreensao', 'compreensão'], ['compreensÃ£o', 'compreensão'], ['compreens�o', 'compreensão'],
        ['interpretacao', 'interpretação'], ['interpretaÃ§Ã£o', 'interpretação'], ['interpreta��o', 'interpretação'],
        ['Proposi??es', 'Proposições'], ['ProposiÃ§Ãµes', 'Proposições'], ['Proposi��es', 'Proposições'], ['proposicoes', 'proposições'], ['proposiÃ§Ãµes', 'proposições'], ['proposi��es', 'proposições'],
        ['Mat?ria', 'Matéria'], ['MatÃ©ria', 'Matéria'], ['Mat�ria', 'Matéria'], ['materia', 'matéria'], ['matÃ©ria', 'matéria'], ['mat�ria', 'matéria'],
        ['Mat?rias', 'Matérias'], ['MatÃ©rias', 'Matérias'], ['Mat�rias', 'Matérias'], ['materias', 'matérias'], ['matÃ©rias', 'matérias'], ['mat�rias', 'matérias'],
        ['Revis?o', 'Revisão'], ['RevisÃ£o', 'Revisão'], ['Revis�o', 'Revisão'], ['revisao', 'revisão'], ['revisÃ£o', 'revisão'], ['revis�o', 'revisão'],
        ['Quest?es', 'Questões'], ['QuestÃµes', 'Questões'], ['Quest�es', 'Questões'], ['questoes', 'questões'], ['questÃµes', 'questões'], ['quest�es', 'questões'],
        ['Exerc?cios', 'Exercícios'], ['ExercÃ­cios', 'Exercícios'], ['Exerc�cios', 'Exercícios'], ['exercicios', 'exercícios'], ['exercÃ­cios', 'exercícios'], ['exerc�cios', 'exercícios'],
        ['Lan?amentos', 'Lançamentos'], ['LanÃ§amentos', 'Lançamentos'], ['Lan�amentos', 'Lançamentos'], ['lancamentos', 'lançamentos'], ['lanÃ§amentos', 'lançamentos'], ['lan�amentos', 'lançamentos'],
        ['Hor?rios', 'Horários'], ['HorÃ¡rios', 'Horários'], ['Hor�rios', 'Horários'], ['horarios', 'horários'], ['horÃ¡rios', 'horários'], ['hor�rios', 'horários'],
        ['Di?rias', 'Diárias'], ['DiÃ¡rias', 'Diárias'], ['Di�rias', 'Diárias'], ['diarias', 'diárias'], ['diÃ¡rias', 'diárias'], ['di�rias', 'diárias'],
        ['Amanha', 'Amanhã'], ['AmanhÃ£', 'Amanhã'], ['Amanh�', 'Amanhã'], ['amanha', 'amanhã'], ['amanhÃ£', 'amanhã'], ['amanh�', 'amanhã'],
        ['Voc?', 'Você'], ['VocÃª', 'Você'], ['Voc�', 'Você'], ['voce', 'você'], ['vocÃª', 'você'], ['voc�', 'você'],
        ['Precis?o', 'Precisão'], ['PrecisÃ£o', 'Precisão'], ['Precis�o', 'Precisão'], ['precisao', 'precisão'], ['precisÃ£o', 'precisão'], ['precis�o', 'precisão'],
        ['Perseguicao', 'Perseguição'], ['PerseguiÃ§Ã£o', 'Perseguição'], ['Persegui��o', 'Perseguição'],
        ['Miss?o', 'Missão'], ['MissÃ£o', 'Missão'], ['Miss�o', 'Missão'], ['missao', 'missão'], ['missÃ£o', 'missão'], ['miss�o', 'missão'],
        ['Sequ?ncia', 'Sequência'], ['SequÃªncia', 'Sequência'], ['Sequ�ncia', 'Sequência'], ['sequencia', 'sequência'], ['sequÃªncia', 'sequência'], ['sequ�ncia', 'sequência'],
        ['concluidas', 'concluídas'], ['concluÃ­das', 'concluídas'], ['conclu�das', 'concluídas'],
        ['ja dominados', 'já dominados'], ['jÃ¡ dominados', 'já dominados'], ['j� dominados', 'já dominados'],
        ['recomeca', 'recomeça'], ['recomeÃ§a', 'recomeça'], ['recome�a', 'recomeça'],
        ['Proximos', 'Próximos'], ['PrÃ³ximos', 'Próximos'], ['Pr�ximos', 'Próximos'], ['proximos', 'próximos'], ['prÃ³ximos', 'próximos'], ['pr�ximos', 'próximos'],
        ['P?blica', 'Pública'], ['PÃºblica', 'Pública'], ['P�blica', 'Pública'], ['publica', 'pública'], ['pÃºblica', 'pública'], ['p�blica', 'pública'],
        ['Administra??o', 'Administração'], ['AdministraÃ§Ã£o', 'Administração'], ['Administra��o', 'Administração'],
        ['FORCA', 'FORÇA'], ['FORÃ‡A', 'FORÇA'], ['FOR�A', 'FORÇA'], ['For?a', 'Força'], ['ForÃ§a', 'Força'], ['For�a', 'Força'],
        ['N?o', 'Não'], ['NÃ£o', 'Não'], ['N�o', 'Não'], ['nao', 'não'], ['nÃ£o', 'não'], ['n�o', 'não']
    ];

    function badTextScore(value) {
        if (typeof value !== 'string') return 0;
        return (value.match(/Ã[\u0080-\u00bf\u0152-\u017e\u2018-\u201d]|Â|�|ï¿½|â€|â€œ|â€|â€™|â€“|â€”/g) || []).length;
    }

    const cp1252Bytes = {
        0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
        0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
        0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
        0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
        0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
        0x017e: 0x9e, 0x0178: 0x9f
    };

    function charToByte(char) {
        const code = char.codePointAt(0);
        if (code <= 255) return code;
        return cp1252Bytes[code] ?? null;
    }

    function decodeLatin1AsUtf8(value) {
        try {
            const raw = [];
            for (const char of value) {
                const byte = charToByte(char);
                if (byte === null) return value;
                raw.push(byte);
            }
            const bytes = Uint8Array.from(raw);
            return new TextDecoder('utf-8').decode(bytes);
        } catch (error) {
            return value;
        }
    }

    function decodeMojibake(value) {
        if (typeof value !== 'string') return value;
        let text = value;
        for (let i = 0; i < 3; i++) {
            const decoded = decodeLatin1AsUtf8(text);
            if (!decoded || decoded === text || badTextScore(decoded) > badTextScore(text)) break;
            text = decoded;
            if (badTextScore(text) === 0) break;
        }
        return text;
    }

    function fixText(value) {
        if (typeof value !== 'string') return value;
        let text = decodeMojibake(value);
        fixes.forEach(([from, to]) => { text = text.split(from).join(to); });
        const directFixes = [
            ['PLANT�O', 'PLANTAO'],
            ['PLANTÃO', 'PLANTAO'],
            ['PLANTÃƒO', 'PLANTAO'],
            ['PLANTÃƒÂ£O', 'PLANTAO'],
            ['PLANTÃƒÆ’O', 'PLANTAO'],
            ['PLANTÃƒâ€šO', 'PLANTAO'],
            ['Miss�o', 'Missão'],
            ['MissÃƒÂ£o', 'Missão'],
            ['MissÃ£o', 'Missão'],
            ['Quest�es', 'Questões'],
            ['QuestÃƒÂµes', 'Questões'],
            ['QuestÃµes', 'Questões'],
            ['Revis�o', 'Revisão'],
            ['RevisÃƒÂ£o', 'Revisão'],
            ['RevisÃ£o', 'Revisão'],
            ['Exerc�cios', 'Exercícios'],
            ['ExercÃƒÂ­cios', 'Exercícios'],
            ['ExercÃ­cios', 'Exercícios'],
            ['Lan�amentos', 'Lançamentos'],
            ['LanÃƒÂ§amentos', 'Lançamentos'],
            ['LanÃ§amentos', 'Lançamentos'],
            ['Mat�ria', 'Matéria'],
            ['MatÃƒÂ©ria', 'Matéria'],
            ['MatÃ©ria', 'Matéria'],
            ['Precis�o', 'Precisão'],
            ['PrecisÃƒÂ£o', 'Precisão'],
            ['PrecisÃ£o', 'Precisão'],
            ['Voc�', 'Você'],
            ['VocÃƒÂª', 'Você'],
            ['VocÃª', 'Você'],
            ['Amanh�', 'Amanhã']
        ];
        directFixes.forEach(([from, to]) => { text = text.split(from).join(to); });
        return text;
    }

    function fixAttributes(root = document.body) {
        if (!root?.querySelectorAll) return;
        root.querySelectorAll('[placeholder], [title], [aria-label], option').forEach(element => {
            ['placeholder', 'title', 'aria-label'].forEach(attr => {
                if (!element.hasAttribute(attr)) return;
                const fixed = fixText(element.getAttribute(attr));
                if (fixed !== element.getAttribute(attr)) element.setAttribute(attr, fixed);
            });
            if (element.tagName === 'OPTION') {
                const fixed = fixText(element.textContent);
                if (fixed !== element.textContent) element.textContent = fixed;
            }
        });
    }

    function hideRankingEmails() {
        const ranking = document.getElementById('ranking-content') || document.getElementById('ranking');
        if (!ranking) return;
        const walker = document.createTreeWalker(ranking, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(node => {
            const cleaned = String(node.nodeValue || '').replace(EMAIL_RE, 'Aluno');
            if (cleaned !== node.nodeValue) node.nodeValue = cleaned;
        });
    }

    function fixVisibleText(root = document.body) {
        if (!root) return;
        document.title = APP_NAME;
        const forceBrand = () => {
            document.title = APP_NAME;
            document.querySelectorAll('.logo-box').forEach(element => {
                element.innerHTML = '<i class="fas fa-shield-halved"></i> ' + APP_NAME;
            });
            document.querySelectorAll('.login-card h2').forEach(element => {
                element.textContent = APP_NAME;
            });
            document.querySelectorAll('h2').forEach(element => {
                if (/Cronograma PLANT/i.test(element.textContent || '')) element.textContent = 'Cronograma ' + APP_NAME;
            });
        };
        forceBrand();
        document.querySelectorAll('.logo-box').forEach(element => {
            if (/PLANT/i.test(element.textContent || '')) {
                element.innerHTML = '<i class="fas fa-shield-halved"></i> ' + APP_NAME;
            }
        });
        document.querySelectorAll('.login-card h2').forEach(element => {
            if (/PLANT/i.test(element.textContent || '')) element.textContent = APP_NAME;
        });
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(node => {
            const fixed = fixText(node.nodeValue);
            if (fixed !== node.nodeValue) node.nodeValue = fixed;
        });
        fixAttributes(root);
        hideRankingEmails();
        forceBrand();
    }

    function taskHours(task) {
        if (typeof task?.h === 'number') return Math.max(0.5, task.h || 1);
        if (task?.h && typeof task.h === 'object') return Math.max(0.5, parseFloat(task.h[task.k] || task.h.E || 1));
        return Math.max(0.5, parseFloat(task?.h) || 1);
    }

    function dayCapacity(date) {
        const data = getDb();
        return Math.max(0, parseFloat(data?.h?.[cleanDate(date).getDay()]) || 0);
    }

    function dayUsage(tasks) {
        return (tasks || []).filter(task => !isExtraTask(task)).reduce((total, task) => total + taskHours(task), 0);
    }

    function studyCount(tasks) {
        return (tasks || []).filter(task => !isExtraTask(task) && isStudy(task)).length;
    }

    function taskId(task) {
        return [task?.id || '', task?.m || '', task?.a || '', task?.k || '', task?.l || '', task?.origemAtraso || ''].join('|').toLowerCase();
    }

    function normalizeTask(task, origem) {
        return { ...task, c: false, atraso: false, replanejado: false, origemAtraso: task?.origemAtraso || origem, l: task?.l === 'Extra' ? task.l : (task?.l || 'Estudo'), k: task?.k || 'E' };
    }

    function canFit(tasks, date, task) {
        if (isExtraTask(task) || isDone(task)) return true;
        const capacity = dayCapacity(date);
        if (capacity <= 0) return false;
        if (dayUsage(tasks) + taskHours(task) > capacity) return false;
        if (isStudy(task) && studyCount(tasks) >= MAX_STUDY_PER_DAY) return false;
        return true;
    }

    function placeTask(task, startDate) {
        const data = getDb();
        for (let offset = 1; offset <= 365; offset++) {
            const targetDate = addDays(startDate, offset);
            const key = dateKey(targetDate);
            const tasks = data.metaFixa[key] || [];
            if (canFit(tasks, targetDate, task)) {
                data.metaFixa[key] = tasks.concat(task);
                return key;
            }
        }
        const fallbackKey = dateKey(addDays(startDate, 1));
        data.metaFixa[fallbackKey] = (data.metaFixa[fallbackKey] || []).concat(task);
        return fallbackKey;
    }

    function saveNow() {
        const data = getDb();
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (error) {}
        if (typeof save === 'function') save();
    }

    function getAtrasosAteHoje(today = new Date()) {
        const data = getDb();
        const todayKey = dateKey(today);
        const atrasos = [];
        Object.keys(data?.metaFixa || {}).sort().forEach(key => {
            if (key >= todayKey) return;
            (data.metaFixa[key] || []).forEach(task => {
                if (!isExtraTask(task) && !isDone(task)) atrasos.push({ dia: key, task });
            });
        });
        return atrasos;
    }

    function encaixarAtrasosNoCronograma(atrasos, inicioDate) {
        const seen = new Set();
        atrasos.map(({ dia, task }) => normalizeTask(task, dia)).filter(task => {
            const id = taskId(task);
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
        }).forEach(task => placeTask(task, inicioDate));
    }

    function refresh(today) {
        if (typeof vDate !== 'undefined') vDate = new Date(today);
        if (typeof renderSemanal === 'function') renderSemanal();
        if (typeof renderDiario === 'function') renderDiario(today);
        if (typeof updateDashboard === 'function') updateDashboard();
        if (typeof renderReplanejar === 'function') renderReplanejar();
        setTimeout(fixVisibleText, 0);
    }

    function replanejarAgoraCorrigido() {
        const data = getDb();
        if (!data) return;
        data.metaFixa = data.metaFixa || {};
        const today = cleanDate(new Date());
        const atrasos = getAtrasosAteHoje(today);
        if (!atrasos.length) {
            if (typeof showToast === 'function') showToast('Sem atrasos', 'Nenhuma pendência encontrada para replanejar.');
            return;
        }
        const porDia = atrasos.reduce((map, item) => {
            if (!map[item.dia]) map[item.dia] = new Set();
            map[item.dia].add(item.task);
            return map;
        }, {});
        Object.keys(porDia).forEach(key => {
            data.metaFixa[key] = (data.metaFixa[key] || []).filter(task => !porDia[key].has(task));
            if (!data.metaFixa[key].length) delete data.metaFixa[key];
        });
        encaixarAtrasosNoCronograma(atrasos, today);
        saveNow();
        refresh(today);
        if (typeof showToast === 'function') showToast('Plantão replanejado', 'Os atrasos foram redistribuídos respeitando as horas diárias.');
    }

    function wrapRender(name) {
        if (typeof window[name] !== 'function' || window[name].__plantaoFixWrapped) return;
        const original = window[name];
        window[name] = function wrappedRender(...args) {
            const result = original.apply(this, args);
            setTimeout(fixVisibleText, 0);
            return result;
        };
        window[name].__plantaoFixWrapped = true;
    }

    function boot() {
        window.getAtrasosAteHoje = getAtrasosAteHoje;
        window.encaixarAtrasosNoCronograma = encaixarAtrasosNoCronograma;
        window.replanejarAgora = replanejarAgoraCorrigido;
        ['renderDiario', 'renderSemanal', 'updateDashboard', 'renderTree', 'renderFluxo', 'renderCiclo', 'renderReplanejar', 'renderRankingAlunos', 'renderPerfil'].forEach(wrapRender);
        fixVisibleText();
        setTimeout(fixVisibleText, 400);
        setTimeout(fixVisibleText, 1200);
        setTimeout(fixVisibleText, 2500);
        let pending = false;
        new MutationObserver(() => {
            if (pending) return;
            pending = true;
            setTimeout(() => { pending = false; fixVisibleText(); }, 50);
        }).observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
