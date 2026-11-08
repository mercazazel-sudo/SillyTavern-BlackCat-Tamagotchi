// Котик-тамагочи для SillyTavern, v0.6
// Кадры + глаза слоем + крылья + домик + шкалы + окно с чатом. Спрайты: tools/process.py и tools/make_ui.py.

import { createPanel } from './panel.js';
import { initStats, tick, bump, sleepFactor, coffeeOn, HUNGRY_BELOW, TIRED_BELOW } from './stats.js';
import { askCat, isMainBusy, looksFunny, isFragment } from './chat.js';
import { initLang, t, tl, tpick, catNameOf, isDefaultPrompt } from './i18n.js';
import { buildSettings } from './settings-ui.js';

const MODULE = 'kotik';
const BASE = new URL('.', import.meta.url).href + 'assets/';
const DEFAULTS = {
    enabled: true, size: 24, glow: true,
    homeEnabled: true, homeScale: 100, homeRight: 12, homeBottom: 6,
    hungerMinutes: 10,
    catName: '', catPrompt: '', lang: 'auto', catMode: 'main', catProfile: 'main', catMaxTokens: 120, chatContext: 4,
    commentsEnabled: true, commentMinutes: 10,
    sleepNeed: 100, coffeeEnabled: true, coffeeMinutes: 20, coffeeUntil: 0,
    flyFreq: 50, winScale: 1, winRight: null, winBottom: null, boxCxR: null, boxBottom: null,
    v: 8,
};

// предметы (коробка, сыр, крошки) крупнее кота в пропорции, иначе за сыр не ухватиться
const ITEM = 1.7;
const CHEESE_MIN_PX = 26;
const HAND_SCALE = 1.0;      // размер руки при поглаживании относительно спрайта

// где крылья крепятся на спине летящего кота (в пикселях спрайта fly) и их масштаб
const WING = {
    frame: 'fly',
    x: 455, y: 462,          // основание ближнего крыла на спине (в пикселях спрайта fly)
    scale: 1.2,              // размер крыла относительно кота
    rot: 38,                 // поворот по часовой: крыло отведено назад вдоль спины, а не свисает с плеча
    far: false,              // второе (дальнее) крыло: false = не рисовать, оно читалось как тёмная клякса
    farDx: 30, farDy: -8,    // сдвиг дальнего крыла относительно ближнего
    farScale: 0.88,
    order: ['up', 'mid', 'down', 'mid'], ms: 110,
};

let settings = { ...DEFAULTS };
let meta = null;
let root, pos, flip, body, hint, zzzBox, homeEl, panel;
const frameEls = {};       // name -> { el, img, eyes:[{el,pupil,data}], wings }
const hitCanvas = {};      // ключ -> canvas для проверки прозрачности под курсором
let k = 0.08;              // масштаб: пикселей экрана на пиксель спрайта
let cur = null;            // имя текущего кадра
let x = 0, y = 0, facing = 1, bob = 0;
let home = null;           // положение домика на экране: { left, top, w, h, x, y (якорь лежанки) }
let inBed = false;
let token = 0;             // номер текущего поведения, старые сами останавливаются
let hungry = false;
let actLeft = 0;
let blinkTimer = null, wingTimer = null, statsTimer = null, commentTimer = null;
let box = null, cheese = null;
let nextFlyAt = Infinity, hand = null;
let ready = false;
let stats = null;
let settingsUI = null;
let drag = null, suppressClick = false, hoverOn = false;
let lastPet = 0, lastAnnoy = 0, sleepPokes = 0, lastSleepPoke = 0, zzzIdx = 0, lastSave = 0, lastCommentAt = Date.now(), lastCommentKey = '', commentBusy = false;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const sizePx = () => Number(settings.size) || DEFAULTS.size;
const S = () => Math.max(0.55, sizePx() / 70);    // множитель скоростей и амплитуд под размер
const hasFrame = n => !!frameEls[n];

// частота полётов: 0 = не летает, 100 = примерно раз в 5 минут, 1 = раз в час
function flyIntervalMs() {
    const f = Number(settings.flyFreq) || 0;
    if (f <= 0) return Infinity;
    return (5 + (100 - Math.min(100, f)) / 100 * 55) * 60000;
}
function scheduleFly(first) {
    const iv = flyIntervalMs();
    nextFlyAt = iv === Infinity ? Infinity : Date.now() + iv * (first ? rand(0.3, 0.9) : rand(0.8, 1.2));
}
const flyDue = () => Date.now() >= nextFlyAt;

/* ---------- настройки ---------- */

function loadSettings() {
    try {
        const store = SillyTavern.getContext().extensionSettings;
        let st = store[MODULE] || {};
        const old = st.v;
        // миграция проверяется ДО заполнения умолчаний: самые старые версии хранили чужой размер
        if (!old || old < 4) {
            st = { ...DEFAULTS, enabled: st.enabled !== false, hungerMinutes: st.hungerMinutes || DEFAULTS.hungerMinutes };
        }
        for (const key of Object.keys(DEFAULTS)) {
            if (st[key] === undefined) st[key] = DEFAULTS[key];
        }
        if (!Array.isArray(st.chatLog)) st.chatLog = [];
        // стандартный характер храним пустым: он берётся по языку (русский для ru, английский для остальных)
        if (isDefaultPrompt(st.catPrompt)) st.catPrompt = '';
        // стандартное имя тоже храним пустым: «Нуар» по-русски, «Noir» по-английски
        if (String(st.catName || '').trim() === 'Нуар') st.catName = '';
        // режим модели появился в v7: раньше выбор профиля означал «профиль», иначе «основная»
        if (old !== undefined && old < 7) st.catMode = (st.catProfile && st.catProfile !== 'main') ? 'profile' : 'main';
        st.catApi = { url: '', key: '', model: '', temperature: 0.9, ...(st.catApi && typeof st.catApi === 'object' ? st.catApi : {}) };
        st.v = DEFAULTS.v;
        store[MODULE] = st;
        settings = st;
        if (old !== DEFAULTS.v) saveSettings();
    } catch (e) {
        console.error('[Kotik] не удалось прочитать настройки', e);
    }
}

function saveSettings() {
    try {
        SillyTavern.getContext().saveSettingsDebounced();
    } catch (e) {
        console.error('[Kotik] не удалось сохранить настройки', e);
    }
}

/* ---------- построение DOM ---------- */

async function loadMeta() {
    const res = await fetch(BASE + 'frames.json');
    if (!res.ok) throw new Error('frames.json: HTTP ' + res.status);
    meta = await res.json();
}

function floorY() {
    return window.innerHeight - (settings.homeEnabled ? settings.homeBottom : 6);
}

function buildFrames() {
    k = sizePx() / (meta.R * 2);
    body.innerHTML = '';
    for (const key of Object.keys(frameEls)) delete frameEls[key];

    for (const [name, f] of Object.entries(meta.frames)) {
        const el = document.createElement('div');
        el.className = 'kf';
        el.dataset.frame = name;
        Object.assign(el.style, {
            left: -f.ax * k + 'px', top: -f.ay * k + 'px',
            width: f.w * k + 'px', height: f.h * k + 'px',
        });

        // крылья: дальнее позади кота и темнее, ближнее поверх него; оба растут из спины (кадр полёта в профиль)
        let wings = null;
        let nearWings = null;
        if (name === WING.frame) {
            const makeSet = (far) => {
                const box = document.createElement('div');
                box.className = 'kwings' + (far ? ' kwings-far' : '');
                const sc = WING.scale * (far ? WING.farScale : 1) * k;
                const ax = (WING.x + (far ? WING.farDx : 0)) * k, ay = (WING.y + (far ? WING.farDy : 0)) * k;
                Object.assign(box.style, { left: ax + 'px', top: ay + 'px', transform: `rotate(${WING.rot + (far ? 6 : 0)}deg)` });
                const imgs = {};
                for (const w of meta.wings) {
                    const wi = document.createElement('img');
                    wi.src = BASE + w.file;
                    Object.assign(wi.style, {
                        width: w.w * sc + 'px', height: w.h * sc + 'px',
                        left: (-w.px * sc) + 'px', top: (-w.py * sc) + 'px',
                    });
                    box.appendChild(wi);
                    imgs[w.name] = wi;
                }
                return { box, imgs, shift: far ? 1 : 0 };
            };
            const far = WING.far === false ? null : makeSet(true);
            const near = makeSet(false);
            wings = { _sets: [far, near].filter(Boolean) };
            if (far) el.appendChild(far.box); // позади кота
            nearWings = near.box;             // ближнее добавим после картинки кота
        }

        const img = document.createElement('img');
        img.src = BASE + f.file;
        img.alt = '';
        img.draggable = false;
        el.appendChild(img);
        if (nearWings) el.appendChild(nearWings);

        const eyes = [];
        for (const e of f.eyes) {
            const eel = document.createElement('div');
            eel.className = 'keye';
            const url = `url(${BASE + e.file})`;
            Object.assign(eel.style, {
                left: e.x * k + 'px', top: e.y * k + 'px', width: e.w * k + 'px', height: e.h * k + 'px',
                backgroundImage: url, webkitMaskImage: url, maskImage: url,
            });
            let pupil = null;
            if (e.pupil) {
                pupil = document.createElement('div');
                pupil.className = 'kpupil';
                const p = e.pupil;
                Object.assign(pupil.style, {
                    left: (p.cx - p.rx) * k + 'px', top: (p.cy - p.ry) * k + 'px',
                    width: p.rx * 2 * k + 'px', height: p.ry * 2 * k + 'px',
                });
                pupil._base = `rotate(${-p.ang}deg)`;
                pupil.style.transform = pupil._base;
                eel.appendChild(pupil);
            }
            el.appendChild(eel);
            eyes.push({ el: eel, pupil, data: e });
        }

        body.appendChild(el);
        frameEls[name] = { el, img, eyes, wings, data: f };
    }
    hand = null;
    if (meta.items && meta.items.hand) {
        const hm = meta.items.hand;
        hand = document.createElement('img');
        hand.id = 'kotik-hand';
        hand.className = 'khand';
        hand.src = BASE + hm.file;
        hand.alt = '';
        hand.draggable = false;
        hand.style.width = hm.w * k * HAND_SCALE + 'px';
        hand.style.height = hm.h * k * HAND_SCALE + 'px';
        body.appendChild(hand);
    }
    placeZzz();
    layoutHome();
    if (cur) show(cur, { pop: false });
}

function buildDom() {
    root = document.createElement('div');
    root.id = 'kotik-root';
    pos = document.createElement('div');
    pos.id = 'kotik-pos';
    flip = document.createElement('div');
    flip.id = 'kotik-flip';
    body = document.createElement('div');
    body.id = 'kotik-body';
    flip.appendChild(body);

    zzzBox = document.createElement('div');
    zzzBox.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0';
    for (const t of ['z', 'Z', 'z']) {
        const s = document.createElement('span');
        s.className = 'kzzz';
        s.textContent = t;
        zzzBox.appendChild(s);
    }

    hint = document.createElement('button');
    hint.id = 'kotik-hint';
    hint.className = 'kotik-ui';
    hint.textContent = t('hint.feed');
    hint.addEventListener('click', e => { e.stopPropagation(); toggleBox('cheese'); });

    pos.append(flip, zzzBox, hint);
    root.appendChild(pos);
    document.body.appendChild(root);
    applyGlow();
}

// светлый ободок вокруг кота можно выключить
function applyGlow() {
    if (root) root.classList.toggle('kotik-noglow', !settings.glow);
}

function placeZzz() {
    const f = meta && meta.frames.sleep;
    if (!f) return;
    zzzBox.style.left = (-f.ax + f.w * 0.6) * k + 'px';
    zzzBox.style.top = (-f.ay + f.h * 0.12) * k + 'px';
    zzzBox.querySelectorAll('.kzzz').forEach(s => { s.style.fontSize = Math.max(8, k * 55) + 'px'; });
}

/* ---------- домик ---------- */

function layoutHome() {
    const h = meta && meta.home;
    if (!h || !root) return;
    if (!settings.homeEnabled) {
        if (homeEl) homeEl.style.display = 'none';
        home = null;
        updateUI();
        return;
    }
    if (!homeEl) {
        homeEl = document.createElement('img');
        homeEl.id = 'kotik-home';
        homeEl.alt = '';
        homeEl.draggable = false;
        homeEl.src = BASE + h.file;
        root.insertBefore(homeEl, pos);
    }
    homeEl.style.display = '';
    const hs = (Number(settings.homeScale) || 100) / 100;
    const w = h.w * k * hs, hh = h.h * k * hs;
    // домик не должен уходить за экран
    settings.homeRight = Math.min(Math.max(0, Number(settings.homeRight) || 0), Math.max(0, window.innerWidth - w));
    settings.homeBottom = Math.min(Math.max(0, Number(settings.homeBottom) || 0), Math.max(0, window.innerHeight - hh));
    const left = window.innerWidth - w - settings.homeRight;
    const top = window.innerHeight - settings.homeBottom - hh;
    Object.assign(homeEl.style, { left: left + 'px', top: top + 'px', width: w + 'px', height: hh + 'px' });
    home = { left, top, w, h: hh, x: left + h.ax * k * hs, y: top + h.ay * k * hs };
    updateUI();
}

// куда встаёт кот, вылезая из лежанки: слева от домика, с запасом на самый широкий кадр
const standX = () => {
    const widest = Math.max(...Object.values(meta.frames).filter(f => !f.air).map(f => f.w)) * k;
    return Math.max(widest / 2 + 4, (home ? home.left : window.innerWidth) - widest / 2 - 4);
};

/* ---------- показ кадров ---------- */

const BODY_FX = {
    sleep: 'kb-slow', angry: 'kb-breathe', roll: 'kb-breathe', hungry: 'kb-breathe',
    eat1: 'kb-breathe', eat2: 'kb-breathe', eat3: 'kb-breathe',
    ball: 'kb-rock', fly: 'kb-fly',
};

function show(name, opts = {}) {
    const fe = frameEls[name];
    if (!fe) { console.warn('[Kotik] нет кадра', name); return; }
    const pop = opts.pop !== false && name !== cur;
    const prevEl = (opts.fade && cur && cur !== name && frameEls[cur]) ? frameEls[cur].el : null;
    for (const [n, o] of Object.entries(frameEls)) o.el.classList.toggle('active', n === name);
    fe.el.classList.remove('kf-out');
    if (prevEl) {                                   // старый кадр коротко растворяется поверх нового
        prevEl.classList.add('kf-out');
        setTimeout(() => prevEl.classList.remove('kf-out'), 170);
    }
    cur = name;
    body.className = BODY_FX[name] || '';
    if (pop) {
        // на время «сжатия» постоянная анимация снимается, потом возвращается
        body.classList.remove(BODY_FX[name] || '_');
        body.classList.remove('kb-pop');
        void body.offsetWidth;
        body.classList.add('kb-pop');
        setTimeout(() => body.classList.remove('kb-pop'), 320);
        setTimeout(() => { if (cur === name && BODY_FX[name]) body.classList.add(BODY_FX[name]); }, 330);
    }
    root.classList.toggle('sleeping', name === 'sleep');
    hint.style.top = (-fe.data.ay * k - 34) + 'px';
    render();
}

function clampX() {
    const m = sizePx() * 1.3;
    x = Math.min(Math.max(m, x), Math.max(m, window.innerWidth - m));
}

function render() {
    if (!pos) return;
    pos.style.transform = `translate(${Math.round(x)}px, ${Math.round(y + bob)}px)`;
    flip.style.transform = `scaleX(${facing})`;
    if (panel) {
        if (!home) panel.placeToggle(catRect());         // без домика кнопка ходит за котом
        if (panel.bubbleVisible()) panel.placeBubble(catRect());
    }
}

function goFloor() {
    clampX();
    y = floorY();
    bob = 0;
}

function reposition() {
    layoutHome();
    if (!home) inBed = false;
    if (inBed && home) { x = home.x; y = home.y; }
    else { clampX(); if (cur !== 'fly' && !drag) y = floorY(); }
    render();
    updateUI();
}

function anchorRect() {
    if (home && settings.homeEnabled) return { left: home.left, top: home.top, right: home.left + home.w, bottom: home.top + home.h };
    return catRect();
}

function updateUI() {
    if (!panel) return;
    const a = anchorRect();
    if (!a) return;
    panel.placeToggle(a);
    panel.place(a);
}

/* ---------- глаза: моргание и закатывание ---------- */

function scheduleBlink() {
    clearTimeout(blinkTimer);
    blinkTimer = setTimeout(async () => {
        if (!settings.enabled) return;
        const fe = frameEls[cur];
        if (fe && fe.eyes.length) {
            fe.eyes.forEach(e => e.el.classList.add('blink'));
            await sleep(130);
            fe.eyes.forEach(e => e.el.classList.remove('blink'));
        }
        scheduleBlink();
    }, rand(2500, 5500));
}

function setPupils(dx, dy) {
    const fe = frameEls[cur];
    if (!fe) return;
    for (const e of fe.eyes) {
        if (!e.pupil) continue;
        const mx = e.data.w * k * 0.3, my = e.data.h * k * 0.3;
        e.pupil.style.transform = `translate(${dx * mx}px, ${dy * my}px) ${e.pupil._base}`;
    }
}

async function rollEyes(alive) {
    const path = [[0.8, 0], [0.5, -0.9], [0, -1], [-0.5, -0.9], [-0.8, 0], [0, 0]];
    for (let r = 0; r < 2; r++) {
        for (const [dx, dy] of path) {
            if (!alive()) return;
            setPupils(dx, dy);
            await sleep(240);
        }
    }
    setPupils(0, 0);
}

/* ---------- крылья ---------- */

// показать крылья в заданной фазе взмаха (дальнее идёт со сдвигом на одну фазу, чтобы не махали синхронно)
function setWingPhase(i) {
    const fe = frameEls[WING.frame];
    if (!fe || !fe.wings) return;
    for (const set of fe.wings._sets) {
        const cur_ = WING.order[(i + set.shift) % WING.order.length];
        for (const n of Object.keys(set.imgs)) set.imgs[n].classList.toggle('on', n === cur_);
    }
}

function startWings() {
    stopWings();
    const fe = frameEls[WING.frame];
    if (!fe || !fe.wings) return;
    let i = 0;
    setWingPhase(i++);
    wingTimer = setInterval(() => setWingPhase(i++), WING.ms);
}

function stopWings() {
    clearInterval(wingTimer);
    wingTimer = null;
}

/* ---------- движение ---------- */

function moveTo(tx, ty, speed, alive) {
    return new Promise(resolve => {
        let last = performance.now();
        const step = ts => {
            if (!alive()) { resolve(); return; }
            const dt = Math.min(0.05, (ts - last) / 1000);
            last = ts;
            const dx = tx - x, dy = ty - y;
            const dist = Math.hypot(dx, dy);
            const st = speed * dt;
            if (Math.abs(dx) > 3) facing = dx > 0 ? 1 : -1;
            if (dist <= st) { x = tx; y = ty; render(); resolve(); return; }
            x += dx / dist * st;
            y += dy / dist * st;
            bob = Math.sin(ts / 140) * Math.max(1.5, 5 * S());
            render();
            requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    });
}

// короткий перелёт между двумя точками «земли» (tx, ty: якорь наземного кадра)
async function hop(tx, ty, alive) {
    const f = meta.frames.fly;
    const bottom = (f.h - f.ay) * k;            // от якоря летящего кадра до его низа
    const fromY = y;
    y = fromY - bottom;                          // низ спрайта остаётся на той же «земле»
    show('fly'); startWings();
    const lift = Math.min(window.innerHeight * 0.25, 14 * S() + Math.abs(tx - x) * 0.18);
    const sp = Math.max(170, 420 * S());
    await moveTo((x + tx) / 2, Math.min(fromY, ty) - bottom - lift, sp, alive);
    await moveTo(tx, ty - bottom, sp, alive);
    stopWings();
    bob = 0;
    if (alive()) y = ty;
}

async function ensureOut(alive) {
    if (!inBed || !home) return;
    await hop(standX(), floorY(), alive);
    if (alive()) inBed = false;
}

// общее начало поведений: вылезти из лежанки, встать на пол
async function start(alive, stay = false) {
    const keepBed = stay && inBed;          // проснувшегося в лежанке не выгоняем, например при поглаживании
    if (!keepBed) await ensureOut(alive);
    if (!alive()) return false;
    stopWings();
    if (!keepBed) goFloor();
    return true;
}

function pickX(m) {
    const w = window.innerWidth;
    for (let i = 0; i < 12; i++) {
        const v = rand(m, w - m);
        if (!home || v < home.left - m * 0.6) return v;   // не приземляться на домик
    }
    return m;
}

/* ---------- шкалы ---------- */

function stat(delta) {
    if (!stats) return;
    bump(stats, delta);
    if (panel) panel.setStats(stats);
    if (stats.hunger < HUNGRY_BELOW && !hungry) becomeHungry();
    if (Date.now() - lastSave > 15000) { lastSave = Date.now(); saveSettings(); }
}

function startStats() {
    clearInterval(statsTimer);
    statsTimer = setInterval(() => {
        if (!settings.enabled || !stats) return;
        tick(settings, stats, cur === 'sleep' ? 'asleep' : 'awake', 5 / 60);
        if (stats.hunger < HUNGRY_BELOW && !hungry) becomeHungry();
        if (panel) panel.setStats(stats);
        updateBuff();
        if (Date.now() - lastSave > 30000) { lastSave = Date.now(); saveSettings(); }
    }, 5000);
}

/* ---------- поведения ---------- */

function go(fn, arg) {
    const my = ++token;
    const alive = () => my === token && settings.enabled;
    Promise.resolve().then(() => fn(alive, arg)).catch(e => console.error('[Kotik]', e));
}

// ждём ms, но выходим раньше, если котик проголодался
async function wait(ms, alive) {
    const end = performance.now() + ms;
    while (alive() && !hungry && performance.now() < end) await sleep(400);
}

async function bSleep(alive) {
    stopWings();
    if (!inBed && home) {
        await hop(home.x, home.y, alive);
        if (!alive()) return;
    }
    if (home) { x = home.x; y = home.y; inBed = true; }
    else goFloor();
    bob = 0; facing = 1;
    show('sleep');
    await wait(rand(25000, 50000) * sleepFactor(settings), alive);
    if (!alive()) return;
    go(bWakeUp);
}

async function bStretch(alive, then) {
    if (!(await start(alive))) return;
    if (then === 'activity') actLeft = randInt(2, 4);
    show('stretch1'); await sleep(1300); if (!alive()) return;
    show('stretch2'); await sleep(1900); if (!alive()) return;
    show('stretch1'); await sleep(900); if (!alive()) return;
    if (then === 'sleep' && coffeeOn(settings)) { actLeft = randInt(2, 4); go(bActivity); return; }   // кофе: не спит
    go(then === 'sleep' ? bSleep : bActivity);
}

async function bActivity(alive) {
    if (hungry) return go(bHungry);
    const buzzed = coffeeOn(settings);
    if (stats && stats.sleep < TIRED_BELOW && !buzzed) actLeft = 0;     // устал: пора спать (с кофе нет)
    if (actLeft <= 0) {
        if (buzzed) actLeft = randInt(2, 4);
        else return go(bStretch, 'sleep');
    }
    actLeft--;
    if (flyDue()) return go(bFly);                                 // полёты идут по своему расписанию
    // спокойные занятия с весами: сидит и смотрит, лижет лапу (смех теперь только по поводу)
    const pool = [];
    if (hasFrame('sit1')) pool.push([bSit, 0.55]);
    if (hasFrame('lick1') && hasFrame('lick2')) pool.push([bLick, 0.45]);
    if (!pool.length) { actLeft = 0; return go(bStretch, 'sleep'); }
    let r = Math.random() * pool.reduce((a2, p) => a2 + p[1], 0);
    for (const [fn, w] of pool) {
        r -= w;
        if (r <= 0) return go(fn);
    }
    go(pool[0][0]);
}

async function bFly(alive) {
    if (!(await start(alive))) return;
    scheduleFly(false);
    const f = meta.frames.fly;
    const bottom = (f.h - f.ay) * k;
    const ground = floorY() - bottom;
    const w = window.innerWidth, h = window.innerHeight, m = sizePx() * 1.6;
    const sp = () => rand(230, 320) * S();
    y = ground;
    show('fly'); startWings();
    const n = randInt(2, 4);
    for (let i = 0; i < n; i++) {
        await moveTo(rand(m, w - m), rand(h * 0.15, h * 0.55), sp(), alive);
        if (!alive()) { stopWings(); return; }
    }
    await moveTo(pickX(m), ground, sp() * 0.8, alive);
    stopWings();
    bob = 0;
    if (!alive()) return;
    go(bActivity);
}

// играет с клубком, только когда ему его принесли (см. playWith)
async function bPlay(alive) {
    if (!(await start(alive))) return;
    show('ball');
    await wait(rand(9000, 14000), alive);
    if (!alive()) return;
    go(bActivity);
}

async function bLaugh(alive, next) {
    if (!(await start(alive, true))) return;
    show('laugh1');
    stat({ happy: +3 });
    for (let i = 0; i < 12; i++) {
        await sleep(260); if (!alive()) return;
        show(i % 2 ? 'laugh1' : 'laugh2', { pop: false });
    }
    if (!alive()) return;
    typeof next === 'function' ? go(next) : go(bActivity);
}

async function bWake(alive) {      // разбудили или потыкали: злится
    sleepPokes = 0;
    const asleep = cur === 'sleep';
    if (Date.now() - lastAnnoy > 2000) {
        lastAnnoy = Date.now();
        stat({ happy: -6, love: asleep ? -1 : 0, sleep: asleep ? -8 : 0 });
    }
    if (!(await start(alive))) return;
    show('angry'); await sleep(2800); if (!alive()) return;
    show('roll');
    await rollEyes(alive); if (!alive()) return;
    await sleep(500); if (!alive()) return;
    go(bStretch, 'sleep');
}

async function bHungry(alive) {
    if (!(await start(alive))) return;
    show('hungry');
    hint.classList.add('show');
    while (alive() && hungry) {
        await sleep(15000);
        if (!alive() || !hungry) break;
        body.classList.remove('kb-pop'); void body.offsetWidth; body.classList.add('kb-pop');
    }
    hint.classList.remove('show');
}

async function bEat(alive) {
    if (!(await start(alive))) return;
    hint.classList.remove('show');
    show('eat1'); await sleep(700);
    for (let i = 0; i < 3; i++) {
        if (!alive()) return;
        show('eat2', { pop: false }); await sleep(560); if (!alive()) return;
        show('eat3', { pop: false }); await sleep(780); if (!alive()) return;
        show('eat1', { pop: false }); await sleep(520);
    }
    if (!alive()) return;
    spawnCrumbs();
    go(bActivity);
}

// проснулся в лежанке: сел, потёр глаза, посидел и полизал лапу (если есть кадры)
async function lickLoop(alive, ms) {
    const end = performance.now() + ms;
    let i = 0;
    while (alive() && performance.now() < end && !hungry) {
        show(i % 2 ? 'lick2' : 'lick1', { pop: i === 0 });
        await sleep(i % 2 ? 500 : 900);
        i++;
    }
}

async function bWakeUp(alive) {
    if (inBed && hasFrame('wake1') && hasFrame('wake2')) {
        show('wake1'); await sleep(1700); if (!alive()) return;
        show('wake2'); await sleep(1900); if (!alive()) return;
        if (hasFrame('lick1') && hasFrame('lick2')) {
            await lickLoop(alive, rand(4500, 7500));
            if (!alive()) return;
        }
    }
    go(bStretch, 'activity');
}

async function bLick(alive) {
    if (!(await start(alive))) return;
    await lickLoop(alive, rand(7000, 11000));
    if (!alive()) return;
    go(bActivity);
}

// сидит и смотрит: моргает, взгляд скользит по сторонам, голова иногда наклоняется,
// а изредка шевелит ушками. Кадры по семействам наклона (в каждом голова почти не двигается):
//   L: sit2 (мягкий наклон), sit4 (правое ухо прижато), sit6 (левое прижато)
//   R: sit3 (мягкий наклон), sit5 (левое ухо прижато), sit7 (правое прижато)
const SIT_SIDES = { L: ['sit2', 'sit4', 'sit6'], R: ['sit3', 'sit5', 'sit7'] };
const fadeTo = n => show(n, { pop: false, fade: true });

// пружинка тела от лап: вытянулся вверх, чуть недолетел вниз, успокоился.
// amp > 0: сначала тянется вверх (шея вытягивается при наклоне), amp < 0: сначала «садится»;
// lean: небольшой крен в сторону наклона (+1 вправо, -1 влево), ноги остаются на месте
function springBody(amp = 0.055, lean = 0, ms = 600) {
    if (!body || !body.animate) return;
    const frames = [];
    const N = 20;
    for (let i = 0; i <= N; i++) {
        const t = i / N;
        const d = Math.exp(-4.2 * t) * Math.sin(2 * Math.PI * 1.6 * t) / 0.57;     // 0, пик, недолёт, затухание
        const r = Math.exp(-3.5 * t) * Math.sin(2 * Math.PI * 1.1 * t) / 0.51;
        const sy = 1 + amp * d, sx = 1 - amp * 0.4 * d;
        frames.push({
            transform: `rotate(${(lean * 1.3 * r).toFixed(3)}deg) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`,
            offset: t,
        });
    }
    body.animate(frames, { duration: ms, easing: 'linear' });
}

async function sitTilt(alive, side) {
    const [x0, x1, x2] = SIT_SIDES[side].map(n => (hasFrame(n) ? n : null));
    if (!x0) return;
    springBody(0.055, side === 'L' ? 1 : -1);        // шея вытягивается, голова наклоняется
    fadeTo(x0);
    await sleep(rand(380, 650)); if (!alive()) return;
    const r = Math.random();
    if (r < 0.12 && x1) {                          // шевелит одним ухом: прижимает и поднимает, второе наверху
        for (let i = 0; i < 3; i++) {
            springBody(0.012, 0, 360);
            fadeTo(x1); await sleep(210); if (!alive()) return;
            fadeTo(x0); await sleep(210); if (!alive()) return;
        }
        await sleep(rand(500, 900));
    } else if (r < 0.20 && x1 && x2) {             // ушки по очереди: то одно прижато, то другое
        fadeTo(x1); await sleep(260); if (!alive()) return;
        for (let i = 0; i < 3; i++) {
            fadeTo(x2); await sleep(240); if (!alive()) return;
            fadeTo(x1); await sleep(240); if (!alive()) return;
        }
        fadeTo(x0); await sleep(rand(500, 800));
    } else {                                       // просто наклонил голову и смотрит
        await sleep(rand(900, 1800));
    }
    if (!alive()) return;
}

async function bSit(alive) {
    if (!(await start(alive))) return;
    show('sit1');
    const end = performance.now() + rand(10000, 16000);
    let nextMove = performance.now() + rand(1800, 3200);
    while (alive() && performance.now() < end && !hungry) {
        await sleep(450);
        if (!alive()) return;
        if (Math.random() < 0.3) setPupils(rand(-0.6, 0.6), rand(-0.4, 0.3));     // взгляд скользит по сторонам
        if (performance.now() < nextMove) continue;
        nextMove = performance.now() + rand(2400, 4600);
        await sitTilt(alive, Math.random() < 0.5 ? 'L' : 'R');
        if (!alive()) return;
        springBody(-0.03, 0, 480);                   // голова вернулась, шея чуть «села» и успокоилась
        fadeTo('sit1');
    }
    setPupils(0, 0);
    if (!alive()) return;
    go(bActivity);
}

// рука ложится на макушку по центру головы текущего кадра
function placeHand(frameName) {
    const f = frameEls[frameName];
    if (!hand || !f) return;
    const head = f.data.head || { x: f.data.w / 2, y: f.data.h * 0.3 };
    const hw = parseFloat(hand.style.width), hh = parseFloat(hand.style.height);
    const contactY = head.y - meta.R * 0.78;          // чуть ниже макушки
    // рука лежит горизонтально: манжета справа, пальцы влево, ладонь над серединой головы
    hand.style.left = ((-f.data.ax + head.x) * k - hw * 0.38) + 'px';
    hand.style.top = ((-f.data.ay + contactY) * k - hh * 0.78) + 'px';
}

function spawnHeart() {
    const r = catRect();
    if (!r) return;
    const im = document.createElement('img');
    im.src = BASE + 'ui/i_love.png';
    im.className = 'kheart';
    im.style.left = (r.left + r.width * (0.3 + Math.random() * 0.4)) + 'px';
    im.style.top = (r.top + r.height * 0.1) + 'px';
    root.appendChild(im);
    setTimeout(() => im.remove(), 1700);
}

// гладят: появляется рука, водит по голове, кот мурлыкает
async function bPetted(alive) {
    if (!(await start(alive, true))) return;
    const a = hasFrame('pet1') ? 'pet1' : 'laugh1';
    const b = hasFrame('pet2') ? 'pet2' : a;
    let i = 0;
    const setFrame = n => { show(n, { pop: i === 0 }); body.classList.add('kb-purr'); placeHand(n); };
    setFrame(a);
    if (hand) { hand.classList.remove('on'); void hand.offsetWidth; hand.classList.add('on'); }
    const t0 = performance.now();
    while (alive() && performance.now() - t0 < 5200) {
        await sleep(650);
        if (!alive()) break;
        i++;
        setFrame(i % 2 ? b : a);
        spawnHeart();
    }
    if (hand) hand.classList.remove('on');
    body.classList.remove('kb-purr');
    if (!alive()) return;
    go(bActivity);
}

// ---------- кофе ----------

function updateBuff() {
    if (!panel) return;
    const left = (Number(settings.coffeeUntil) || 0) - Date.now();
    panel.setBuff(left > 0 ? t('buff', { n: Math.max(1, Math.ceil(left / 60000)) }) : '');
}

function drinkCoffee() {
    if (!ready || !settings.enabled || !settings.coffeeEnabled) return;
    if (coffeeOn(settings) && (settings.coffeeUntil - Date.now()) > 0.5 * (Number(settings.coffeeMinutes) || 20) * 60000) {
        if (panel) panel.showBubble(tpick('coffee.again'), 3500);
        return;                                          // свежая порция ещё действует
    }
    settings.coffeeUntil = Date.now() + (Number(settings.coffeeMinutes) || 20) * 60000;
    stat({ sleep: +35, happy: +2 });
    saveSettings();
    updateBuff();
    go(bCoffee);
}

function spawnCup() {
    const r = catRect();
    if (!r) return;
    const w = Math.max(18, sizePx() * 0.42);
    const im = document.createElement('img');
    im.src = BASE + 'ui/i_coffee.png';
    im.className = 'kcup';
    im.style.width = w + 'px';
    im.style.height = w + 'px';
    im.style.left = (r.left + r.width * 0.5 + (facing > 0 ? 1 : -1) * r.width * 0.12 - w / 2) + 'px';
    im.style.top = (r.bottom - r.height * 0.42 - w * 0.5) + 'px';
    root.appendChild(im);
    setTimeout(() => im.remove(), 3500);
}

// выпил кофе: просыпается без обиды, чашка, дрожит и глаза бегают, потом занят делами
async function bCoffee(alive) {
    if (!(await start(alive))) return;
    show(hasFrame('sit1') ? 'sit1' : 'angry');
    if (panel) panel.showBubble(tpick('coffee.on'), 4200);
    spawnCup();
    body.classList.add('kb-purr');
    const t0 = performance.now();
    while (alive() && performance.now() - t0 < 3200) {
        setPupils(rand(-0.8, 0.8), rand(-0.5, 0.4));
        await sleep(240);
    }
    body.classList.remove('kb-purr');
    setPupils(0, 0);
    if (!alive()) return;
    actLeft = randInt(2, 4);
    go(bActivity);
}

// кота подняли и отпустили: падает на пол, а если отпустили над домиком, идёт спать
async function bDrop(alive) {
    const f = meta.frames.fly;
    const bottom = (f.h - f.ay) * k;
    clampX();
    await moveTo(x, floorY() - bottom, Math.max(300, 700 * S()), alive);
    stopWings();
    if (!alive()) return;
    bob = 0;
    y = floorY();
    const overHome = home && x > home.left && x < home.left + home.w;
    if (overHome) go(bSleep);
    else go(bActivity);
}

/* ---------- голод, коробка, сыр ---------- */

function becomeHungry() {
    if (!settings.enabled || hungry) return;
    hungry = true;
    // в полёте не прерываем: bActivity подхватит голод после посадки
    if (cur !== 'hungry' && cur !== 'fly' && !drag) go(bHungry);
}

function itemImg(id, cls, m, minW) {
    const ik = k * ITEM;
    let w = m.w * ik;
    if (minW && w < minW) w = minW;
    const hh = w * m.h / m.w;
    const im = document.createElement('img');
    im.id = id;
    im.className = 'kitem ' + (cls || '');
    im.src = BASE + m.file;
    im.draggable = false;
    im.style.width = w + 'px';
    im.style.height = hh + 'px';
    return im;
}

function catRect() {
    const fe = frameEls[cur];
    return fe ? fe.img.getBoundingClientRect() : null;
}

function toggleBox(kind = 'cheese') {
    if (box) {
        const same = box._kind === kind;
        removeBox();
        if (same) return;
    }
    const it = meta.items;
    box = itemImg('kotik-box', 'kotik-ui', it.box_closed);
    box._kind = kind;
    box._open = false;
    const bw = parseFloat(box.style.width), bh = parseFloat(box.style.height);
    const r = catRect();
    let left, top;
    if (settings.boxCxR !== null && settings.boxBottom !== null && settings.boxCxR !== undefined) {
        left = window.innerWidth - settings.boxCxR - bw / 2;            // место, куда её передвинули раньше
        top = window.innerHeight - settings.boxBottom - bh;
    } else {
        left = r ? r.left - bw - 8 : window.innerWidth - bw * 2;
        if (left < 8) left = (r ? r.right : bw) + 8;
        top = floorY() - bh;
    }
    box.style.left = Math.min(Math.max(0, left), Math.max(0, window.innerWidth - bw)) + 'px';
    box.style.top = Math.min(Math.max(0, top), Math.max(0, window.innerHeight - bh)) + 'px';
    box.addEventListener('pointerdown', startBoxDrag);
    root.appendChild(box);
}

// коробку можно двигать за любое место; клик без движения открывает её
function startBoxDrag(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const el = box;
    const r0 = el.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const ox = e.clientX - r0.left, oy = e.clientY - r0.top;
    let moved = false;
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* без захвата указателя тоже работает */ }
    const move = ev => {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
        moved = true;
        const w = el.offsetWidth, hh = el.offsetHeight;
        const nl = Math.min(Math.max(0, ev.clientX - ox), Math.max(0, window.innerWidth - w));
        const nt = Math.min(Math.max(0, ev.clientY - oy), Math.max(0, window.innerHeight - hh));
        const dx = nl - parseFloat(el.style.left), dy = nt - parseFloat(el.style.top);
        el.style.left = nl + 'px';
        el.style.top = nt + 'px';
        if (cheese) {                              // предмет едет вместе с коробкой
            cheese.style.left = (parseFloat(cheese.style.left) + dx) + 'px';
            cheese.style.top = (parseFloat(cheese.style.top) + dy) + 'px';
            cheese._home = [cheese.style.left, cheese.style.top];
        }
    };
    const up = ev => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        try { el.releasePointerCapture(ev.pointerId); } catch (err) { /* ничего страшного */ }
        if (!moved) { openBox(); return; }
        const r = el.getBoundingClientRect();
        settings.boxCxR = Math.round(window.innerWidth - (r.left + r.width / 2));
        settings.boxBottom = Math.round(window.innerHeight - r.bottom);
        saveSettings();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
}

function openBox() {
    if (!box || box._open) return;
    const it = meta.items;
    box._open = true;
    const bw = parseFloat(box.style.width);
    const rc = box.getBoundingClientRect();
    const ow = bw * it.box_open.w / it.box_closed.w;     // открытая коробка того же масштаба
    const oh = ow * it.box_open.h / it.box_open.w;
    box.src = BASE + it.box_open.file;
    box.style.width = ow + 'px';
    box.style.height = oh + 'px';
    box.style.top = Math.max(0, rc.bottom - oh) + 'px';                         // нижняя кромка остаётся на месте
    box.style.left = Math.min(Math.max(0, rc.left + rc.width / 2 - ow / 2), Math.max(0, window.innerWidth - ow)) + 'px';

    const kind = box._kind || 'cheese';
    cheese = itemImg('kotik-cheese', 'kotik-ui', it[kind] || it.cheese, CHEESE_MIN_PX);
    cheese._kind = kind;
    const cw = parseFloat(cheese.style.width), ch = parseFloat(cheese.style.height);
    cheese.style.left = (parseFloat(box.style.left) + ow / 2 - cw / 2) + 'px';
    cheese.style.top = (parseFloat(box.style.top) + oh * 0.28 - ch * 0.5) + 'px';
    cheese._home = [cheese.style.left, cheese.style.top];
    cheese.addEventListener('pointerdown', startItemDrag);
    root.appendChild(cheese);
}

function removeBox() {
    if (box) box.remove();
    if (cheese) cheese.remove();
    box = null; cheese = null;
}

function startItemDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    const el = cheese;
    const ox = e.clientX - parseFloat(el.style.left), oy = e.clientY - parseFloat(el.style.top);
    el.classList.add('drag');
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* без захвата указателя тоже работает */ }
    const move = ev => {
        el.style.left = ev.clientX - ox + 'px';
        el.style.top = ev.clientY - oy + 'px';
    };
    const up = ev => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        try { el.releasePointerCapture(ev.pointerId); } catch (err) { /* ничего страшного */ }
        el.classList.remove('drag');
        const r = catRect();
        const cx = parseFloat(el.style.left) + el.offsetWidth / 2, cy = parseFloat(el.style.top) + el.offsetHeight / 2;
        const pad = 12;
        const onCat = r && cx > r.left - pad && cx < r.right + pad && cy > r.top - pad && cy < r.bottom + pad;
        if (onCat && cur === 'sleep') refuseItem(el);
        else if (onCat) giveItem(el._kind);
        else { el.style.left = el._home[0]; el.style.top = el._home[1]; }
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
}

// спящий кот не берёт ни еду, ни игрушку: предмет возвращается в коробку, а кот просыпается недовольным
function refuseItem(el) {
    el.style.left = el._home[0];
    el.style.top = el._home[1];
    go(bWake);
}

function giveItem(kind) {
    if (cheese) cheese.remove();
    cheese = null;
    if (box) { const b = box; box = null; setTimeout(() => b.remove(), 900); }
    if (kind === 'yarn') playWith();
    else feed();
}

function feed() {
    hungry = false;
    stat({ hunger: +55, happy: +8, love: +4 });
    hungry = stats ? stats.hunger < HUNGRY_BELOW : false;
    go(bEat);
}

function playWith() {
    stat({ happy: +14, love: +3, sleep: -4 });
    go(bPlay);
}

function spawnCrumbs() {
    const r = catRect();
    const old = document.getElementById('kotik-crumbs');
    if (old) old.remove();
    const c = itemImg('kotik-crumbs', '', meta.items.crumbs);
    const cw = parseFloat(c.style.width), ch = parseFloat(c.style.height);
    const cx = r ? (r.left + r.right) / 2 : x;
    c.style.left = cx - cw / 2 + 'px';
    c.style.top = floorY() - ch + 2 + 'px';
    root.appendChild(c);
    setTimeout(() => c.remove(), 4200);
}

/* ---------- клики и перетаскивание ---------- */

function alphaHit(img, key, e, flipped) {
    if (!img) return false;
    const r = img.getBoundingClientRect();
    if (!r.width || e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return false;
    let u = (e.clientX - r.left) / r.width;
    const v = (e.clientY - r.top) / r.height;
    if (flipped) u = 1 - u;
    try {
        let c = hitCanvas[key];
        if (!c) {
            c = document.createElement('canvas');
            c.width = img.naturalWidth; c.height = img.naturalHeight;
            if (!c.width || !c.height) return true;
            c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0);
            hitCanvas[key] = c;
        }
        const px = c.getContext('2d').getImageData(Math.floor(u * c.width), Math.floor(v * c.height), 1, 1).data;
        return px[3] > 40;
    } catch (err) {
        return true;
    }
}

const hitCat = e => !!frameEls[cur] && alphaHit(frameEls[cur].img, cur, e, facing < 0);
const hitHome = e => !!home && settings.homeEnabled && alphaHit(homeEl, '__home', e, false);
const pointerKind = e => (hitCat(e) ? 'cat' : hitHome(e) ? 'home' : null);
const isUiTarget = e => !!(e.target && e.target.closest && e.target.closest('.kotik-ui'));

function onPointerDown(e) {
    if (!ready || !settings.enabled || e.button !== 0 || isUiTarget(e)) return;
    const kind = pointerKind(e);
    if (!kind) return;
    drag = {
        kind, sx: e.clientX, sy: e.clientY, moved: false, ox: x, oy: y,
        hr: Number(settings.homeRight) || 0, hb: Number(settings.homeBottom) || 0,
    };
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerUp, true);
}

function onPointerMove(e) {
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved) {
        if (Math.hypot(dx, dy) < 5) return;
        drag.moved = true;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
        if (drag.kind === 'cat') {
            token++;                                        // останавливаем текущее поведение
            const f = meta.frames.fly;
            const bottom = (f.h - f.ay) * k;
            if (cur !== 'fly') drag.oy = y - bottom;        // якорь летящего кадра выше лап
            inBed = false;
            hint.classList.remove('show');
            show('fly'); startWings();
        }
    }
    if (drag.kind === 'cat') {
        facing = dx > 1 ? 1 : dx < -1 ? -1 : facing;
        x = drag.ox + dx;
        y = drag.oy + dy;
        bob = 0;
        render();
    } else {
        settings.homeRight = drag.hr - dx;
        settings.homeBottom = drag.hb - dy;
        layoutHome();
        if (inBed && home) { x = home.x; y = home.y; }
        else if (cur !== 'fly') y = floorY();
        render();
    }
}

function onPointerUp() {
    window.removeEventListener('pointermove', onPointerMove, true);
    window.removeEventListener('pointerup', onPointerUp, true);
    window.removeEventListener('pointercancel', onPointerUp, true);
    const d = drag;
    drag = null;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    hoverOn = false;
    if (!d || !d.moved) return;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 60);
    if (d.kind === 'cat') go(bDrop);
    else { saveSettings(); reposition(); }
}

function onMouseMove(e) {
    if (drag || !ready || !settings.enabled) return;
    const over = !isUiTarget(e) && !!pointerKind(e);
    if (over !== hoverOn) { hoverOn = over; document.body.style.cursor = over ? 'grab' : ''; }
}

function pet() {
    const now = Date.now();
    if (now - lastPet > 2500) { lastPet = now; stat({ love: +2, happy: +6 }); }
    if (cur === 'sleep') { go(bWake); return; }               // спящего гладить нельзя, он проснётся недовольным
    go(bPetted);
}

function onClick(e) {
    if (!ready || !settings.enabled || isUiTarget(e)) return;
    if (suppressClick) { suppressClick = false; e.stopPropagation(); e.preventDefault(); return; }
    if (!hitCat(e)) return;
    e.stopPropagation();
    e.preventDefault();
    if (['fly', 'angry', 'roll', 'eat1', 'eat2', 'eat3'].includes(cur)) return;
    if (cur === 'sleep') go(bWake);
    else if (cur === 'hungry') toggleBox('cheese');
    else pet();
}

/* ---------- окно тамагочи и чат ---------- */

function onPanelAction(id) {
    if (!ready || !settings.enabled) return;
    if (id === 'feed') toggleBox('cheese');
    else if (id === 'play') toggleBox('yarn');
    else if (id === 'pet') pet();
    else if (id === 'sleep') { settings.coffeeUntil = 0; updateBuff(); if (cur !== 'sleep') go(bStretch, 'sleep'); }
    else if (id === 'coffee') drinkCoffee();
}

// смеётся по поводу (смешное в чате), а не просто так; спящего и занятого не трогаем
function reactLaugh() {
    if (!ready || !settings.enabled || drag) return;
    if (['sleep', 'fly', 'eat1', 'eat2', 'eat3', 'angry', 'roll', 'pet1', 'pet2', 'laugh1', 'laugh2'].includes(cur)) return;
    go(bLaugh, bActivity);
}

// реплики по кругу: спящий отмахивается, на четвёртый раз злится
const nextFrom = key => { const list = tl(key); return list[zzzIdx++ % list.length]; };

async function onPanelSend(text) {
    // спящий кот в чате не отвечает, а отмахивается; после трёх раз просыпается злым
    if (cur === 'sleep') {
        if (Date.now() - lastSleepPoke > 5 * 60000) sleepPokes = 0;
        lastSleepPoke = Date.now();
        sleepPokes++;
        if (sleepPokes > 3) {
            const reply = nextFrom('angry');
            go(bWake);                                   // злится, счастье падает (см. bWake)
            panel.showBubble(t('growl'), 2500);
            return reply;
        }
        const reply = nextFrom('zzz');
        panel.showBubble('Zzz…', 2500);
        return reply;
    }
    sleepPokes = 0;
    stat({ love: +2, happy: +1 });
    const log = panel.getLog();
    const history = log.slice(0, -1);       // последняя реплика уже добавлена окном
    const funny = looksFunny(text);
    const { text: reply, laugh } = await askCat({ settings, stats, history, userText: text, mode: 'chat' });
    panel.showBubble(reply, 6000);
    if (laugh || funny) reactLaugh();
    return reply;
}

function chatKey() {
    try {
        const c = SillyTavern.getContext().chat;
        if (!Array.isArray(c) || !c.length) return '';
        const last = c[c.length - 1];
        return c.length + ':' + ((last && last.mes) || '').length;
    } catch (e) {
        return '';
    }
}

async function maybeComment() {
    if (!ready || !settings.enabled || !settings.commentsEnabled || commentBusy) return;
    const mins = Math.max(1, Number(settings.commentMinutes) || 10);
    if (Date.now() - lastCommentAt < mins * 60000) return;
    const key = chatKey();
    if (cur === 'sleep') return;                     // спящий не комментирует
    if (!key || key === lastCommentKey) return;     // в чате ничего нового
    if (isMainBusy()) return;                        // основная модель занята
    if (Math.random() > 0.7) { lastCommentAt = Date.now() - mins * 60000 * 0.7; return; }   // не каждый раз
    commentBusy = true;
    try {
        const { text, laugh } = await askCat({ settings, stats, history: [], userText: '', mode: 'comment' });
        lastCommentKey = key;
        lastCommentAt = Date.now();
        panel.addMsg('cat', text, { auto: true });
        panel.showBubble(text, 8000);
        stat({ love: +1 });
        if (laugh) reactLaugh();
    } catch (e) {
        console.warn('[Kotik] комментарий не удался', e);
        lastCommentAt = Date.now() - mins * 60000 * 0.8;     // повтор через пятую часть интервала
    } finally {
        commentBusy = false;
    }
}

/* ---------- запуск и выключение ---------- */

function enable() {
    if (!ready) return;
    root.style.display = '';
    layoutHome();
    hungry = !!stats && stats.hunger < HUNGRY_BELOW;
    scheduleBlink();
    startStats();
    scheduleFly(true);
    clearInterval(commentTimer);
    commentTimer = setInterval(maybeComment, 30000);
    if (home) { x = home.x; y = home.y; inBed = true; }
    else { x = window.innerWidth - sizePx() * 2.4; goFloor(); inBed = false; }
    go(bSleep);
    updateUI();
}

function disable() {
    token++;
    stopWings();
    clearTimeout(blinkTimer);
    clearInterval(statsTimer);
    clearInterval(commentTimer);
    removeBox();
    hint.classList.remove('show');
    if (panel) { panel.close(); panel.hideBubble(); }
    root.style.display = 'none';
}

// шестерёнка в окне тамагочи: открыть «Расширения», раскрыть раздел кота, прокрутить к нему и подсветить
function openExtSettings() {
    try {
        const block = document.getElementById('rm_extensions_block');
        const wasOpen = !!block && block.classList.contains('openDrawer');
        if (!wasOpen) {
            const toggle = document.querySelector('#extensions-settings-button .drawer-toggle');
            if (toggle) toggle.click();
        }
        const wrap = document.querySelector('#extensions_settings2 .kset');
        if (!wrap) { console.warn('[Kotik] раздел настроек не найден'); return; }
        const header = wrap.querySelector(':scope > .inline-drawer > .inline-drawer-header');
        const content = wrap.querySelector(':scope > .inline-drawer > .inline-drawer-content');
        // карточка свёрнута, если её содержимое скрыто (надёжнее, чем смотреть на иконку)
        if (header && content && getComputedStyle(content).display === 'none') header.click();
        setTimeout(() => {
            wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
            wrap.classList.remove('kset-flash');
            void wrap.offsetWidth;
            wrap.classList.add('kset-flash');
            setTimeout(() => wrap.classList.remove('kset-flash'), 1300);
        }, wasOpen ? 80 : 450);
    } catch (e) {
        console.warn('[Kotik] не удалось открыть настройки', e);
    }
}

function buildSettingsPanel() {
    const host = document.getElementById('extensions_settings2');
    if (!host) {
        console.warn('[Kotik] нет #extensions_settings2, панель настроек пропущена');
        return;
    }
    settingsUI = buildSettings({
        host,
        base: BASE,
        settings,
        save: saveSettings,
        hooks: {
            setEnabled: v => { v ? enable() : disable(); },
            onName: name => { if (panel) panel.setName(name); },
            onSize: () => { if (ready) { removeBox(); buildFrames(); reposition(); } },
            onHome: () => { if (ready) reposition(); },
            onGlow: () => applyGlow(),
            onUiScale: z => { if (panel) panel.setScale(z); },
            onFly: () => scheduleFly(false),
            onCoffee: v => { if (panel) panel.setCoffee(v); if (!v) { settings.coffeeUntil = 0; saveSettings(); } updateBuff(); },
            flyText: () => {
                const f = Number(settings.flyFreq) || 0;
                return f <= 0
                    ? t('set.beh.flyHintNone')
                    : t('set.beh.flyHint', { n: Math.round(flyIntervalMs() / 60000) });
            },
            resetWindow: () => { if (panel) panel.resetLayout(); },
            debug: {
                box: () => { if (ready && settings.enabled) toggleBox('cheese'); },
                hungry: () => { if (ready && stats) stat({ hunger: -100 }); },
                wake: () => { if (ready && settings.enabled) go(bWake); },
            },
        },
    });
}

async function init() {
    try {
        loadSettings();
        initLang(settings);
        await loadMeta();
        buildDom();
        stats = initStats(settings);
        panel = createPanel({
            ui: BASE + 'ui/',
            root,
            onAction: onPanelAction,
            onSend: onPanelSend,
            onToggle: () => updateUI(),
            getCatRect: () => catRect(),
            onOpenSettings: () => openExtSettings(),
            layout: { z: settings.winScale, right: settings.winRight, bottom: settings.winBottom },
            onLayout: l => {
                Object.assign(settings, { winScale: l.z, winRight: l.right, winBottom: l.bottom });
                if (settingsUI) settingsUI.syncScale(l.z);
            },
            onLogChange: log => { settings.chatLog = log.slice(-30); saveSettings(); },
        });
        panel.setName(catNameOf(settings));
        panel.setCoffee(!!settings.coffeeEnabled);
        updateBuff();
        // вычищаем обрубки и сообщения об ошибках из сохранённого чата
        settings.chatLog = (settings.chatLog || []).filter(m => m && m.text && m.role !== 'sys' && !(m.role === 'cat' && isFragment(m.text)));
        panel.loadLog(settings.chatLog);
        panel.setStats(stats);
        buildFrames();
        ready = true;
        buildSettingsPanel();
        window.addEventListener('pointerdown', onPointerDown, true);
        window.addEventListener('click', onClick, true);
        window.addEventListener('mousemove', onMouseMove, { passive: true });
        window.addEventListener('resize', () => { if (ready) reposition(); });
        globalThis.__kotik = {
            state: () => ({ x, y, cur, inBed, hungry, home, token, drag: !!drag, size: settings.size, stats, standX: standX(), flyInMin: Math.round((nextFlyAt - Date.now()) / 600) / 100 }),
            go, show, becomeHungry, toggleBox, openBox, feed, panel, stat,
            bWake, bFly, bPlay, bLaugh, bEat, bStretch, bSleep, bActivity, bDrop, bPetted, bWakeUp, bLick, bSit, sitTilt, springBody, setWingPhase, startWings, stopWings, bCoffee, drinkCoffee, updateBuff, openExtSettings, giveItem, pet, reactLaugh, onPanelSend,
        };
        if (settings.enabled) enable(); else root.style.display = 'none';
        console.log('[Kotik] v0.6 загружен');
    } catch (e) {
        console.error('[Kotik] ошибка запуска', e);
    }
}

jQuery(init);
