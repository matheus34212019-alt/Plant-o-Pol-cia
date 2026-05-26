(function plantaoProfessionalCopy() {
    if(window.__plantaoProfessionalCopy) return;
    window.__plantaoProfessionalCopy = true;

    const VERSION = 'v227-corporate-readability';
    const legacyTextRepairs = [
        ['PLANT?O', 'PLANT\u00c3O'],
        ['PLANT\u00c3\u0192O', 'PLANT\u00c3O'],
        ['Plant?o', 'Plant\u00e3o'],
        ['FOR?A', 'FOR\u00c7A'],
        ['Miss?o', 'Miss\u00e3o'],
        ['miss?o', 'miss\u00e3o'],
        ['Quest?es', 'Quest\u00f5es'],
        ['quest?es', 'quest\u00f5es'],
        ['Precis?o', 'Precis\u00e3o'],
        ['precis?o', 'precis\u00e3o'],
        ['Revis?o', 'Revis\u00e3o'],
        ['revis?o', 'revis\u00e3o'],
        ['Exerc?cios', 'Exerc\u00edcios'],
        ['exerc?cios', 'exerc\u00edcios'],
        ['Mat?ria', 'Mat\u00e9ria'],
        ['mat?ria', 'mat\u00e9ria'],
        ['Mat?rias', 'Mat\u00e9rias'],
        ['mat?rias', 'mat\u00e9rias'],
        ['Lan?amentos', 'Lan\u00e7amentos'],
        ['lan?amentos', 'lan\u00e7amentos'],
        ['Sequ?ncia', 'Sequ\u00eancia'],
        ['sequ?ncia', 'sequ\u00eancia'],
        ['Conclu?das', 'Conclu\u00eddas'],
        ['conclu?das', 'conclu\u00eddas'],
        ['Compreens?o', 'Compreens\u00e3o'],
        ['compreens?o', 'compreens\u00e3o'],
        ['interpreta??o', 'interpreta\u00e7\u00e3o'],
        ['Proposi??es', 'Proposi\u00e7\u00f5es'],
        ['proposi??es', 'proposi\u00e7\u00f5es'],
        ['administra??o', 'administra\u00e7\u00e3o'],
        ['Publica??o', 'Publica\u00e7\u00e3o'],
        ['publica??o', 'publica\u00e7\u00e3o'],
        ['Aprova??o', 'Aprova\u00e7\u00e3o'],
        ['aprova??o', 'aprova\u00e7\u00e3o'],
        ['Sincroniza??o', 'Sincroniza\u00e7\u00e3o'],
        ['sincroniza??o', 'sincroniza\u00e7\u00e3o'],
        ['solicita??es', 'solicita\u00e7\u00f5es'],
        ['Distribui??o', 'Distribui\u00e7\u00e3o'],
        ['distribui??o', 'distribui\u00e7\u00e3o'],
        ['atualiza??o', 'atualiza\u00e7\u00e3o'],
        ['edi??o', 'edi\u00e7\u00e3o'],
        ['configura??o', 'configura\u00e7\u00e3o'],
        ['recupera??o', 'recupera\u00e7\u00e3o'],
        ['Permiss?o', 'Permiss\u00e3o'],
        ['permiss?o', 'permiss\u00e3o'],
        ['Sess?o', 'Sess\u00e3o'],
        ['sess?o', 'sess\u00e3o'],
        ['N?o', 'N\u00e3o'],
        ['n?o', 'n\u00e3o'],
        ['Voc?', 'Voc\u00ea'],
        ['voc?', 'voc\u00ea'],
        ['Amanh?', 'Amanh\u00e3'],
        ['amanh?', 'amanh\u00e3'],
        ['pr?ximos', 'pr\u00f3ximos'],
        ['pr?ximo', 'pr\u00f3ximo'],
        ['espa?o', 'espa\u00e7o'],
        ['refor?o', 'refor\u00e7o'],
        ['avan?o', 'avan\u00e7o'],
        ['usu?rio', 'usu\u00e1rio'],
        ['conte?do', 'conte\u00fado'],
        ['padr?o', 'padr\u00e3o'],
        ['inv?lido', 'inv\u00e1lido'],
        ['dispon?vel', 'dispon\u00edvel'],
        ['poss?vel', 'poss\u00edvel'],
        ['?reas', '\u00e1reas'],
        [' h? ', ' h\u00e1 '],
        [' est? ', ' est\u00e1 '],
        ['ap?s', 'ap\u00f3s']
    ];
    const windows1252Bytes = {
        '\u20ac': 0x80, '\u201a': 0x82, '\u0192': 0x83, '\u201e': 0x84,
        '\u2026': 0x85, '\u2020': 0x86, '\u2021': 0x87, '\u02c6': 0x88,
        '\u2030': 0x89, '\u0160': 0x8a, '\u2039': 0x8b, '\u0152': 0x8c,
        '\u017d': 0x8e, '\u2018': 0x91, '\u2019': 0x92, '\u201c': 0x93,
        '\u201d': 0x94, '\u2022': 0x95, '\u2013': 0x96, '\u2014': 0x97,
        '\u02dc': 0x98, '\u2122': 0x99, '\u0161': 0x9a, '\u203a': 0x9b,
        '\u0153': 0x9c, '\u017e': 0x9e, '\u0178': 0x9f
    };
    const replacements = [
        [/Miss\u00e3o da Semana/gi, 'Meta semanal'],
        [/Horas Acumuladas/gi, 'Horas estudadas'],
        [/Precis\u00e3o de Tiro/gi, 'Taxa de acertos'],
        [/Persegui\u00e7\u00e3o ao Edital/gi, 'Progresso do edital'],
        [/FOR[\u00c7?]A E HONRA,\s*([^!]+)!/gi, 'Ol\u00e1, $1'],
        [/FOR[\u00c7?]A E HONRA!?/gi, 'Plano de estudos'],
        [/\bSTREAK:/gi, 'Sequ\u00eancia:'],
        [/Miss\u00e3o de Hoje/gi, 'Plano de hoje'],
        [/Miss\u00e3o de Amanh\u00e3/gi, 'Plano de amanh\u00e3'],
        [/Miss\u00e3o cumprida/gi, 'Plano conclu\u00eddo'],
        [/CRONOGRAMA PLANT\u00c3O/gi, 'Cronograma de estudos'],
        [/Precis\u00e3o geral/gi, 'Taxa geral de acertos'],
        [/Precis\u00e3o de acertos/gi, 'Taxa de acertos'],
        [/INCLUIR NO PLANT\u00c3O/gi, 'Adicionar atividade']
    ];

    function corruptionScore(value) {
        return (String(value).match(/[\u00c2\u00c3\u0192\ufffd]|[A-Za-z\u00c0-\u00ff]\?+(?=[A-Za-z\u00c0-\u00ff])/g) || []).length;
    }

    function decodeMojibakeToken(value) {
        if(typeof TextDecoder === 'undefined') return value;
        let best = value;
        for(let pass = 0; pass < 2 && /[\u00c2\u00c3\u0192\ufffd]/.test(best); pass += 1) {
            const bytes = [];
            let canDecode = true;
            for(const char of best) {
                const code = char.codePointAt(0);
                if(code <= 0xff) bytes.push(code);
                else if(Object.prototype.hasOwnProperty.call(windows1252Bytes, char)) bytes.push(windows1252Bytes[char]);
                else {
                    canDecode = false;
                    break;
                }
            }
            if(!canDecode) break;
            try {
                const decoded = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
                if(corruptionScore(decoded) >= corruptionScore(best)) break;
                best = decoded;
            } catch(error) {
                break;
            }
        }
        return best;
    }

    function decodeMojibake(value) {
        return String(value).split(/(\s+)/).map(part => decodeMojibakeToken(part)).join('');
    }

    function repairVisibleText(value) {
        let next = decodeMojibake(String(value || ''));
        legacyTextRepairs.forEach(([broken, repaired]) => {
            next = next.split(broken).join(repaired);
        });
        return next;
    }

    function replaceText(value) {
        const repaired = repairVisibleText(value);
        return replacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), repaired);
    }

    function isDisplayNode(node) {
        const parent = node.parentElement;
        return parent && !parent.closest('script, style, textarea, input, [data-preserve-copy="true"]');
    }

    function applyCopy(root = document.body) {
        if(!root) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while(walker.nextNode()) nodes.push(walker.currentNode);
        nodes.filter(isDisplayNode).forEach(node => {
            const next = replaceText(node.nodeValue);
            if(next !== node.nodeValue) node.nodeValue = next;
        });

        const logoIcon = document.querySelector('.logo-box i');
        if(logoIcon) logoIcon.className = 'fas fa-graduation-cap';
        const sequenceIcon = document.querySelector('#streak-info i');
        if(sequenceIcon) sequenceIcon.className = 'fas fa-calendar-check';
        document.documentElement.dataset.professionalUi = VERSION;
    }

    let queued = false;
    function scheduleApply() {
        if(queued) return;
        queued = true;
        requestAnimationFrame(() => {
            queued = false;
            applyCopy();
        });
    }

    function install() {
        applyCopy();
        if(window.__plantaoProfessionalCopyObserver) return;
        const observer = new MutationObserver(scheduleApply);
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        window.__plantaoProfessionalCopyObserver = observer;
    }

    if(document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', install, { once: true });
    } else {
        install();
    }
})();
