(function plantaoScheduleOverrides() {
    const APP_NAME = 'PLANTÃO';
    const MAX_ESTUDO_DIA = 2;
    const STORAGE_KEY = 'prf_v120';
    const original = {
        renderDiario: window.renderDiario,
        renderSemanal: window.renderSemanal,
        updateDashboard: window.updateDashboard,
        save: window.save,
        showToast: window.showToast
    };

    const pad = value => String(value).padStart(2, '0');
    const cloneDate = date => {
        const d = new Date(date || new Date());
        d.setHours(0, 0, 0, 0);
        return d;
    };
    const dateKeyLocal = date => {
        const d = cloneDate(date);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };
    const keyToDateLocal = key => {
        const [year, month, day] = String(key).split('-').map(Number);
        return cloneDate(new Date(year, (month || 1) - 1, day || 1));
    };
    const addDaysLocal = (date, amount) => {
        const d = cloneDate(date);
        d.setDate(d.getDate() + amount);
        return d;
    };
    const state = () => (typeof db !== 'undefined' ? db : window.db);
    const currentViewDate = () => (typeof vDate !== 'undefined' ? vDate : new Date());
    const setCurrentViewDate = date => {
        try { if (typeof vDate !== 'undefined') vDate = cloneDate(date); } catch (error) {}
    };
    const taskHours = task => {
        if (!task) return 0;
        if (typeof task.h === 'number') return Math.max(0.5, task.h || 1);
        if (task.h && typeof task.h === 'object') return Math.max(0.5, parseFloat(task.h[task.k] || task.h.E || 1));
        return 1;
    };
    const isExtra = task => task?.extra === true || task?.l === 'Extra';
    const isStudy = task => task?.k === 'E' || /estudo/i.test(String(task?.l || ''));
    const isDone = task => task?.c === true;
    const dayCapacity = date => Math.max(0, parseFloat(state()?.h?.[cloneDate(date).getDay()]) || 0);
    const dayName = date => ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'][cloneDate(date).getDay()];
    const labelType = task => {
        if (task?.l && task.l !== 'Extra') return task.l;
        if (task?.k === 'Rev') return 'Revisão';
        if (task?.k === 'Ex') return 'Exercícios';
        if (task?.l === 'Extra') return 'Extra';
        return 'Estudo';
    };
    const typeClass = task => task?.k === 'Rev' ? 'tag-rev' : (task?.k === 'Ex' ? 'tag-ex' : 'tag-e');
    const taskClass = task => task?.k === 'Rev' ? 'tag-rev' : (task?.k === 'Ex' ? 'tag-ex' : 'tag-e');

    function toast(title, message) {
        if (typeof original.showToast === 'function') original.showToast(title, message);
    }

    function persist() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state())); } catch (error) {}
        if (typeof original.save === 'function') original.save();
    }

    function normalizeBrand() {
        document.title = APP_NAME;
        document.querySelectorAll('.logo-box').forEach(el => {
            const icon = el.querySelector('i')?.outerHTML || '<i class="fas fa-shield-halved"></i>';
            el.innerHTML = `${icon} ${APP_NAME}`;
        });
        document.querySelectorAll('.login-card h2').forEach(el => { el.textContent = APP_NAME; });
    }

    function canPlace(dayTasks, date, task) {
        if (isExtra(task)) return true;
        const capacity = dayCapacity(date);
        const usedHours = dayTasks.filter(t => !isExtra(t)).reduce((sum, t) => sum + taskHours(t), 0);
        const usedStudies = dayTasks.filter(t => !isExtra(t) && isStudy(t)).length;
        if (capacity <= 0) return false;
        if (usedHours + taskHours(task) > capacity) return false;
        if (isStudy(task) && usedStudies >= MAX_ESTUDO_DIA) return false;
        return true;
    }

    function placeTask(task, startDate) {
        const data = state();
        for (let offset = 0; offset < 240; offset++) {
            const date = addDaysLocal(startDate, offset);
            const key = dateKeyLocal(date);
            const tasks = data.metaFixa[key] || [];
            if (canPlace(tasks, date, task)) {
                data.metaFixa[key] = tasks.concat(task);
                return key;
            }
        }
        const fallback = dateKeyLocal(startDate);
        data.metaFixa[fallback] = (data.metaFixa[fallback] || []).concat(task);
        return fallback;
    }

    function collectOverdue(today) {
        const data = state();
        if (!data?.metaFixa) return [];
        const todayKey = dateKeyLocal(today);
        const queue = [];
        Object.keys(data.metaFixa).sort().forEach(key => {
            if (key >= todayKey) return;
            const keep = [];
            (data.metaFixa[key] || []).forEach(task => {
                if (!isDone(task) && !isExtra(task)) queue.push({ ...task, c: false, atraso: false, replanejado: true, origemAtraso: task.origemAtraso || key });
                else keep.push(task);
            });
            if (keep.length) data.metaFixa[key] = keep;
            else delete data.metaFixa[key];
        });
        return queue;
    }

    function enforceFutureCapacity(today) {
        const data = state();
        const todayKey = dateKeyLocal(today);
        const overflow = [];
        Object.keys(data.metaFixa || {}).sort().forEach(key => {
            if (key < todayKey) return;
            const date = keyToDateLocal(key);
            const fixed = [];
            (data.metaFixa[key] || []).forEach(task => {
                if (isDone(task) || isExtra(task) || canPlace(fixed, date, task)) fixed.push(task);
                else overflow.push({ ...task, c: false, replanejado: true });
            });
            if (fixed.length) data.metaFixa[key] = fixed;
            else delete data.metaFixa[key];
        });
        overflow.forEach(task => placeTask(task, today));
        return overflow.length;
    }

    function replanejarAtrasos() {
        const data = state();
        if (!data) return;
        if (!data.metaFixa) data.metaFixa = {};
        const today = cloneDate(new Date());
        const overdue = collectOverdue(today);
        overdue.forEach(task => placeTask(task, today));
        const movedOverflow = enforceFutureCapacity(today);
        persist();
        setCurrentViewDate(today);
        renderSemanalCorrigido();
        renderDiarioCorrigido(today);
        if (typeof original.updateDashboard === 'function') original.updateDashboard();
        toast('Cronograma atualizado', `${overdue.length + movedOverflow} atividade(s) redistribuída(s) sem ultrapassar sua meta diária.`);
    }

    function getTasksForDay(date) {
        const data = state();
        const key = dateKeyLocal(date);
        return (data?.metaFixa?.[key] || []).filter(task => !isExtra(task));
    }

    function completeTask(key, index, checked) {
        const data = state();
        const task = data?.metaFixa?.[key]?.[index];
        if (!task) return;
        task.c = checked;
        if (task.done && task.k) task.done[task.k] = checked;
        if (!checked) {
            task.teoriaRespondida = false;
            task.teoriaPendente = false;
            task.precisaMaisTempo = false;
            delete task.lastInitialStudyDate;
        }
        if (checked && isStudy(task)) {
            const needsMore = confirm('Você precisa de mais tempo para este assunto?');
            task.teoriaRespondida = true;
            if (needsMore) {
                task.precisaMaisTempo = true;
                const extra = Math.max(0.5, parseFloat(prompt('Quantas horas extras?', '1') || '1') || 1);
                placeTask({ ...task, c: false, h: extra, l: 'Reforço', k: 'E', extra: false, replanejado: true }, addDaysLocal(new Date(), 1));
            }
        }
        persist();
        renderSemanalCorrigido();
        renderDiarioCorrigido(keyToDateLocal(key));
        if (typeof original.updateDashboard === 'function') original.updateDashboard();
    }

    window.plantaoToggleTask = completeTask;

    function renderDiarioCorrigido(date = currentViewDate()) {
        const d = cloneDate(date);
        const key = dateKeyLocal(d);
        setCurrentViewDate(d);
        enforceFutureCapacity(cloneDate(new Date()));
        normalizeBrand();

        const title = document.getElementById('view-title');
        if (title) title.textContent = key === dateKeyLocal(new Date()) ? 'Painel Hoje' : `Painel ${dayName(d)} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
        const status = document.getElementById('meta-status');
        const tasks = getTasksForDay(d);
        const hours = tasks.reduce((sum, task) => sum + taskHours(task), 0);
        const capacity = dayCapacity(d);
        if (status) status.textContent = `${tasks.length} atividade(s) | ${hours.toFixed(1)}h de ${capacity.toFixed(1)}h disponíveis`;

        const target = document.getElementById('lista-diaria');
        if (!target) return;
        if (!tasks.length) {
            target.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-check"></i><strong>Nenhuma atividade neste dia</strong><span>O cronograma semanal está sem tarefa planejada para esta data.</span></div>';
            return;
        }
        target.innerHTML = `<div class="today-schedule-grid">${tasks.map((task, index) => `
            <div class="task-card today-schedule-card ${task.c ? 'done' : ''}">
                <input type="checkbox" ${task.c ? 'checked' : ''} onchange="plantaoToggleTask('${key}', ${index}, this.checked)">
                <div class="today-task-main">
                    <span class="tag ${typeClass(task)}">${labelType(task)}</span>
                    <b>${task.m || 'Matéria'}</b>
                    <small>${task.a || ''}</small>
                    ${task.origemAtraso ? `<em>Replanejado de ${task.origemAtraso}</em>` : ''}
                </div>
                <strong>${taskHours(task).toFixed(1)}h</strong>
            </div>`).join('')}</div>`;
    }

    function renderSemanalCorrigido() {
        const grid = document.getElementById('grid-semanal');
        if (!grid) return;
        const start = cloneDate(new Date());
        enforceFutureCapacity(start);
        const todayKey = dateKeyLocal(start);
        grid.innerHTML = Array.from({ length: 7 }, (_, offset) => {
            const date = addDaysLocal(start, offset);
            const key = dateKeyLocal(date);
            const tasks = getTasksForDay(date);
            const hours = tasks.reduce((sum, task) => sum + taskHours(task), 0);
            const capacity = dayCapacity(date);
            return `<div class="day-column ${key === todayKey ? 'today-column' : ''}">
                <div class="day-head">
                    ${dayName(date)} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}
                    <small>${hours.toFixed(1)}h / ${capacity.toFixed(1)}h</small>
                </div>
                ${tasks.length ? tasks.map(task => `
                    <div class="sim-task ${taskClass(task)} ${task.c ? 'done' : ''}">
                        <b>${labelType(task)}</b><br>${task.m || ''}<em>${task.a || ''}</em>
                        ${task.origemAtraso ? `<em>Replanejado de ${task.origemAtraso}</em>` : ''}
                    </div>`).join('') : '<div class="sim-empty">Sem atividades</div>'}
            </div>`;
        }).join('');
        normalizeBrand();
    }

    window.replanejarAgora = replanejarAtrasos;
    window.renderDiario = renderDiarioCorrigido;
    window.renderSemanal = renderSemanalCorrigido;

    function boot() {
        normalizeBrand();
        const today = cloneDate(new Date());
        enforceFutureCapacity(today);
        renderSemanalCorrigido();
        renderDiarioCorrigido(currentViewDate());
    }

    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
    else setTimeout(boot, 0);
    setTimeout(boot, 500);
    setTimeout(boot, 1500);
})();
