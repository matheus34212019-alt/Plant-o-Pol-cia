(function plantaoProfessionalCopy() {
    if(window.__plantaoProfessionalCopy) return;
    window.__plantaoProfessionalCopy = true;

    const VERSION = 'v226-professional-study-ui';
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

    function replaceText(value) {
        return replacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), String(value || ''));
    }

    function applyCopy(root = document.body) {
        if(!root) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while(walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(node => {
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