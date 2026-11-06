// Окно тамагочи: шкалы сверху, кнопки действий, чат снизу. Плюс кнопка-лапка и облачко над котиком.
import { KEYS, LABELS, ICONS } from './stats.js';

const SEGMENTS = 20;
const LOG_LIMIT = 40;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function h(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
}

export function createPanel({ ui, root, onAction, onSend, onToggle, onLogChange, getCatRect, layout = {}, onLayout }) {
    const ico = (name, cls = 'kw-ico') => {
        const i = document.createElement('img');
        i.src = ui + name;
        i.className = cls;
        i.alt = '';
        i.draggable = false;
        return i;
    };

    /* ---------- кнопка-лапка (открывает окно) ---------- */
    const toggle = h('button', 'ktoggle kotik-ui');
    toggle.id = 'kotik-toggle';
    toggle.title = 'Нуар';
    toggle.appendChild(ico('i_paw.png', 'ktoggle-ico'));
    toggle.addEventListener('click', e => { e.stopPropagation(); api.toggle(); onToggle && onToggle(api.isOpen()); });

    /* ---------- окно ---------- */
    const win = h('div', 'kwin kotik-ui');
    win.id = 'kotik-win';
    win.style.display = 'none';

    const title = h('div', 'kw-title');
    const nameEl = h('span', 'kw-name', 'Нуар');
    const closeBtn = h('button', 'kw-btn kw-x');
    closeBtn.appendChild(ico('i_close.png'));
    closeBtn.addEventListener('click', () => { api.close(); onToggle && onToggle(false); });
    title.append(ico('i_paw.png'), nameEl, closeBtn);

    const statsBox = h('div', 'kw-stats');
    const rows = {};
    for (const k of KEYS) {
        const row = h('div', 'kw-row');
        const bar = h('div', 'kw-bar');
        const segs = [];
        for (let i = 0; i < SEGMENTS; i++) { const s = h('span', 'kw-seg'); bar.appendChild(s); segs.push(s); }
        const val = h('span', 'kw-val', '0%');
        row.append(ico(ICONS[k]), h('span', 'kw-lbl', LABELS[k]), bar, val);
        statsBox.appendChild(row);
        rows[k] = { bar, segs, val };
    }

    const actions = h('div', 'kw-actions');
    const ACTIONS = [
        ['feed', 'Кормить', 'i_hunger.png'],
        ['play', 'Играть', 'i_happy.png'],
        ['pet', 'Гладить', 'i_love.png'],
        ['sleep', 'Спать', 'i_sleep.png'],
        ['coffee', 'Кофе', 'i_coffee.png'],
    ];
    const actBtns = {};
    for (const [id, label, icon] of ACTIONS) {
        const b = h('button', 'kw-btn kw-act');
        b.append(ico(icon), h('span', '', label));
        b.addEventListener('click', () => onAction && onAction(id));
        actions.appendChild(b);
        actBtns[id] = b;
    }
    const buffEl = h('span', 'kw-buff', '');
    buffEl.style.display = 'none';
    title.insertBefore(buffEl, closeBtn);

    const divider = h('div', 'kw-div');

    const log = h('div', 'kw-log');
    const form = h('div', 'kw-form');
    const input = h('input', 'kw-in');
    input.type = 'text';
    input.placeholder = 'Сказать коту…';
    input.maxLength = 400;
    input.autocomplete = 'off';
    const send = h('button', 'kw-btn kw-send');
    send.title = 'Отправить';
    send.appendChild(ico('i_paw.png'));
    form.append(input, send);

    const grip = h('div', 'kw-grip kotik-ui');
    grip.title = 'Потяни, чтобы изменить масштаб окна';
    win.append(title, statsBox, actions, divider, log, form, grip);

    // размер и положение: right/bottom = расстояние до краёв экрана, null = автоматически над домиком
    const L = { z: Number(layout.z) || 1, right: layout.right ?? null, bottom: layout.bottom ?? null };
    const Z_MIN = 0.6, Z_MAX = 2.4;
    const saveLayout = () => onLayout && onLayout({ ...L });
    // масштаб интерфейса: окно, облачко и кнопка-лапка растут и уменьшаются целиком, без перекраивания
    const applyZ = () => {
        L.z = clamp(L.z, Z_MIN, Z_MAX);
        for (const el of [win, bubble, toggle]) {
            el.style.transformOrigin = '0 0';
            el.style.transform = `scale(${L.z})`;
        }
    };
    const pin = () => {
        const r = win.getBoundingClientRect();
        L.right = Math.round(window.innerWidth - r.right);
        L.bottom = Math.round(window.innerHeight - r.bottom);
        saveLayout();
    };

    // перетаскивание за заголовок
    title.addEventListener('pointerdown', e => {
        if (e.button !== 0 || (e.target.closest && e.target.closest('.kw-btn'))) return;
        e.preventDefault();
        const r = win.getBoundingClientRect();
        const ox = e.clientX - r.left, oy = e.clientY - r.top;
        const move = ev => {
            win.style.left = clamp(ev.clientX - ox, 0, window.innerWidth - 60) + 'px';
            win.style.top = clamp(ev.clientY - oy, 0, window.innerHeight - 40) + 'px';
        };
        const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            pin();
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    });
    // двойной клик по заголовку возвращает окно на место над домиком
    title.addEventListener('dblclick', e => {
        if (e.target.closest && e.target.closest('.kw-btn')) return;
        api.resetLayout();
    });

    // изменение размера за правый нижний угол
    grip.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const r = win.getBoundingClientRect();
        const sx = e.clientX, sy = e.clientY, w0 = r.width, h0 = r.height, left = r.left, top = r.top, z0 = L.z;
        const move = ev => {
            const rw = (w0 + ev.clientX - sx) / w0, rh = (h0 + ev.clientY - sy) / h0;
            L.z = clamp(z0 * (rw + rh) / 2, Z_MIN, Z_MAX);
            applyZ();
            win.style.left = left + 'px';
            win.style.top = top + 'px';
        };
        const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            pin();
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    });

    /* ---------- облачко над котиком ---------- */
    const bubble = h('div', 'kbubble kotik-ui');
    bubble.id = 'kotik-bubble';
    bubble.style.display = 'none';
    const bubbleText = h('div', 'kbubble-text');
    const bubbleTail = ico('bubble_tail.png', 'kbubble-tail');
    bubble.append(bubbleText, bubbleTail);
    bubble.addEventListener('click', e => { e.stopPropagation(); api.hideBubble(); });

    root.append(toggle, win, bubble);

    /* ---------- логика окна ---------- */
    let open = false;
    let busy = false;
    let bubbleTimer = null;
    let messages = [];   // { role: 'cat' | 'you' | 'sys', text, auto? }

    function renderMsg(m, temp = false) {
        const el = h('div', `kw-msg kw-${m.role}${temp ? ' kw-temp' : ''}`);
        if (m.role === 'cat' && m.auto) el.classList.add('kw-auto');
        el.textContent = m.text;
        log.appendChild(el);
        log.scrollTop = log.scrollHeight;
        return el;
    }

    async function doSend() {
        const text = input.value.trim();
        if (!text || busy || !onSend) return;
        input.value = '';
        api.setBusy(true);
        api.addMsg('you', text);
        const typing = renderMsg({ role: 'cat', text: '…' }, true);
        try {
            const reply = await onSend(text);
            typing.remove();
            if (reply) api.addMsg('cat', reply);
        } catch (e) {
            typing.remove();
            api.addMsg('sys', 'Мяу? Не вышло: ' + (e && e.message ? e.message : e));
            console.error('[Kotik] ошибка чата', e);
        } finally {
            api.setBusy(false);
            input.focus();
        }
    }
    send.addEventListener('click', doSend);
    input.addEventListener('keydown', e => {
        e.stopPropagation();   // чтобы горячие клавиши Таверны не перехватывали ввод
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
    });
    for (const ev of ['keyup', 'keypress']) input.addEventListener(ev, e => e.stopPropagation());

    const api = {
        el: win, toggleEl: toggle, bubbleEl: bubble,

        setName(name) { nameEl.textContent = (name || 'Нуар').toUpperCase(); toggle.title = name || 'Нуар'; },

        setStats(s) {
            for (const k of KEYS) {
                const v = clamp(Number(s[k]) || 0, 0, 100);
                const r = rows[k];
                const n = Math.round(v / (100 / SEGMENTS));
                r.segs.forEach((seg, i) => seg.classList.toggle('on', i < n));
                r.bar.dataset.level = v < 30 ? 'low' : v < 60 ? 'mid' : 'high';
                r.val.textContent = Math.round(v) + '%';
            }
        },

        isOpen: () => open,
        open() { open = true; win.style.display = ''; toggle.classList.add('on'); log.scrollTop = log.scrollHeight; },
        close() { open = false; win.style.display = 'none'; toggle.classList.remove('on'); },
        toggle() { open ? api.close() : api.open(); },

        /** Кнопка «Кофе» опциональна: включается в настройках расширения. */
        setCoffee(on) {
            actBtns.coffee.style.display = on ? '' : 'none';
            actions.classList.toggle('kw-actions5', !!on);
            actions.style.gridTemplateColumns = `repeat(${on ? 5 : 4}, 1fr)`;
        },
        /** Подпись «бодр ещё N мин» в заголовке окна; пустая строка прячет. */
        setBuff(text) {
            buffEl.textContent = text || '';
            buffEl.style.display = text ? '' : 'none';
        },

        setBusy(b) { busy = b; input.disabled = b; send.disabled = b; win.classList.toggle('kw-busy', b); },

        loadLog(list) {
            messages = Array.isArray(list) ? list.filter(m => m && m.text).slice(-LOG_LIMIT) : [];
            log.innerHTML = '';
            messages.forEach(m => renderMsg(m));
        },
        getLog: () => messages,

        addMsg(role, text, opts = {}) {
            const m = { role, text, ...(opts.auto ? { auto: true } : {}) };
            messages.push(m);
            if (messages.length > LOG_LIMIT) { messages.shift(); if (log.firstChild) log.firstChild.remove(); }
            renderMsg(m);
            onLogChange && onLogChange(messages);
        },

        showBubble(text, ms = 7000) {
            bubbleText.textContent = text;
            bubble.style.display = '';
            const r = getCatRect && getCatRect();
            if (r) api.placeBubble(r);       // сразу над котом, не дожидаясь его движения
            clearTimeout(bubbleTimer);
            bubbleTimer = setTimeout(() => api.hideBubble(), ms);
        },
        hideBubble() { bubble.style.display = 'none'; clearTimeout(bubbleTimer); },
        bubbleVisible: () => bubble.style.display !== 'none',

        /** Кнопка-лапка в верхнем правом углу якоря (домик или кот). */
        placeToggle(a) {
            if (!a) return;
            const size = 30 * L.z;
            let left = a.right - size + 4;
            let top = a.top - size + 2;
            if (top < 4) top = a.top + 2;
            left = clamp(left, 4, window.innerWidth - size - 4);
            toggle.style.left = Math.round(left) + 'px';
            toggle.style.top = Math.round(top) + 'px';
        },

        /** Окно: на месте, которое выбрал пользователь, иначе над якорем (домиком); если места нет, то слева от него. */
        place(a) {
            if (!open) return;
            applyZ();
            const W = (win.offsetWidth || 320) * L.z, H = (win.offsetHeight || 400) * L.z;
            let left, top;
            if (L.right !== null && L.bottom !== null) {
                left = window.innerWidth - L.right - W;
                top = window.innerHeight - L.bottom - H;
            } else if (a) {
                left = a.right - W;
                top = a.top - H - 36;
                if (top < 8) { top = a.bottom - H; left = a.left - W - 12; }
            } else {
                return;
            }
            left = clamp(left, 8, Math.max(8, window.innerWidth - W - 8));
            top = clamp(top, 8, Math.max(8, window.innerHeight - H - 8));
            win.style.left = Math.round(left) + 'px';
            win.style.top = Math.round(top) + 'px';
        },

        getScale: () => L.z,
        setScale(z) {
            L.z = Number(z) || 1;
            applyZ();
            saveLayout();
            onToggle && onToggle(open);
        },

        /** Вернуть окно на место и в исходный размер. */
        resetLayout() {
            L.z = 1; L.right = null; L.bottom = null;
            saveLayout();
            applyZ();
            onToggle && onToggle(open);      // index пересчитает положение над домиком
        },

        /** Облачко над головой кота. */
        placeBubble(a) {
            if (!a || bubble.style.display === 'none') return;
            const W = (bubble.offsetWidth || 160) * L.z, H = (bubble.offsetHeight || 50) * L.z;
            let left = (a.left + a.right) / 2 - W / 2;
            let top = a.top - H - 4;
            left = clamp(left, 6, window.innerWidth - W - 6);
            if (top < 6) top = a.bottom + 4;
            bubble.style.left = Math.round(left) + 'px';
            bubble.style.top = Math.round(top) + 'px';
            const cx = clamp((a.left + a.right) / 2 - left, 14, W - 24);
            bubbleTail.style.left = Math.round(cx / L.z - 10) + 'px';
        },
    };
    applyZ();
    return api;
}
