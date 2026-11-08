// Панель настроек расширения: вкладки, карточки, переключатели, выбор модели для кота.
import { listProfiles, fetchModels, testCat } from './chat.js';
import { t, catNameOf, isDefaultPrompt } from './i18n.js';

const TAB_KEY = 'kotik_settings_tab';

// быстрый старт для собственного API (все четыре адреса OpenAI-совместимые)
const PRESETS = [
    ['OpenAI', 'https://api.openai.com/v1'],
    ['OpenRouter', 'https://openrouter.ai/api/v1'],
    ['LM Studio', 'http://localhost:1234/v1'],
    ['Ollama', 'http://localhost:11434/v1'],
];


function slider(id, label, min, max, step) {
    return `
        <div class="kset-row">
            <label for="${id}">${label}</label>
            <span class="kset-chip" id="${id}_val"></span>
            <input type="range" id="${id}" min="${min}" max="${max}" step="${step}">
        </div>`;
}

function toggle(id, label, hint = '') {
    return `
        <div class="kset-line">
            <div class="kset-line-text"><span>${label}</span>${hint ? `<small>${hint}</small>` : ''}</div>
            <label class="kswitch"><input type="checkbox" id="${id}"><span></span></label>
        </div>`;
}

/**
 * Строит панель в #extensions_settings2.
 * hooks: { setEnabled, onSize, onHome, onUiScale, onFly, flyText, onName, resetWindow, debug: { box, hungry, wake } }
 */
export function buildSettings({ host, base, settings, save, hooks }) {
    const wrap = document.createElement('div');
    wrap.className = 'extension_container kset';
    wrap.innerHTML = `
    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>${t('ext.title')}</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">

            <div class="kset-hero">
                <div class="kset-avatar" style="background-image:url('${base}frames/pet1.png')"></div>
                <div class="kset-hero-main">
                    <input class="text_pole" id="kset_name" maxlength="24" placeholder="${t('set.hero.namePh')}">
                    <small>${t('set.hero.nameHint')}</small>
                </div>
                <label class="kswitch kswitch-big" title="${t('set.hero.enabled')}">
                    <input type="checkbox" id="kset_enabled"><span></span>
                </label>
            </div>

            <div class="kset-tabs" role="tablist">
                <button class="kset-tab" data-tab="look">${t('set.tab.look')}</button>
                <button class="kset-tab" data-tab="behavior">${t('set.tab.behavior')}</button>
                <button class="kset-tab" data-tab="brain">${t('set.tab.brain')}</button>
                <button class="kset-tab" data-tab="debug">${t('set.tab.debug')}</button>
            </div>

            <!-- ВИД -->
            <div class="kset-pane" data-pane="look">
                <section class="kset-card">
                    <h4>${t('set.look.lang')}</h4>
                    <select id="kset_lang" class="text_pole kset-select">
                        <option value="auto">${t('set.look.langAuto')}</option>
                        <option value="ru">Русский</option>
                        <option value="en">English</option>
                    </select>
                    <small class="kset-note">${t('set.look.langNote')}</small>
                </section>
                <section class="kset-card">
                    <h4>${t('set.look.cat')}</h4>
                    ${slider('kset_size', t('set.look.size'), 12, 120, 2)}
                    ${toggle('kset_glow', t('set.look.glow'), t('set.look.glowHint'))}
                </section>
                <section class="kset-card">
                    <h4>${t('set.look.home')}</h4>
                    ${toggle('kset_home_on', t('set.look.homeOn'), t('set.look.homeOnHint'))}
                    ${slider('kset_home_scale', t('set.look.homeScale'), 40, 250, 5)}
                </section>
                <section class="kset-card">
                    <h4>${t('set.look.win')}</h4>
                    ${slider('kset_ui_scale', t('set.look.uiScale'), 60, 240, 5)}
                    <small class="kset-note">${t('set.look.winNote')}</small>
                    <div class="kset-actions"><button type="button" class="kbtn" id="kset_win_reset">${t('set.look.winReset')}</button></div>
                </section>
            </div>

            <!-- ПОВЕДЕНИЕ -->
            <div class="kset-pane" data-pane="behavior">
                <section class="kset-card">
                    <h4>${t('set.beh.fly')}</h4>
                    ${slider('kset_fly', t('set.beh.flyFreq'), 0, 100, 1)}
                    <small class="kset-note" id="kset_fly_hint"></small>
                </section>
                <section class="kset-card">
                    <h4>${t('set.beh.sleep')}</h4>
                    ${slider('kset_sleep', t('set.beh.sleepNeed'), 25, 250, 5)}
                    <small class="kset-note" id="kset_sleep_hint"></small>
                </section>
                <section class="kset-card">
                    <h4>${t('set.beh.coffee')}</h4>
                    ${toggle('kset_coffee', t('set.beh.coffeeBtn'), t('set.beh.coffeeHint'))}
                    ${slider('kset_coffee_min', t('set.beh.coffeeMin'), 5, 60, 5)}
                </section>
                <section class="kset-card">
                    <h4>${t('set.beh.hunger')}</h4>
                    ${slider('kset_hunger', t('set.beh.hungerMin'), 1, 60, 1)}
                </section>
                <section class="kset-card">
                    <h4>${t('set.beh.comments')}</h4>
                    ${toggle('kset_comments', t('set.beh.commentsOn'), t('set.beh.commentsHint'))}
                    ${slider('kset_comment_min', t('set.beh.commentMin'), 1, 60, 1)}
                </section>
            </div>

            <!-- ЧАТ И МОДЕЛЬ -->
            <div class="kset-pane" data-pane="brain">
                <section class="kset-card">
                    <h4>${t('set.brain.who')}</h4>
                    <div class="kseg" id="kset_mode">
                        <button data-mode="main">${t('set.brain.main')}</button>
                        <button data-mode="profile">${t('set.brain.profile')}</button>
                        <button data-mode="custom">${t('set.brain.custom')}</button>
                    </div>
                    <small class="kset-note" id="kset_mode_text"></small>

                    <div class="kset-mode" data-mode-panel="profile">
                        <label for="kset_profile">${t('set.brain.profileLabel')}</label>
                        <div class="kset-inline">
                            <select id="kset_profile" class="text_pole"></select>
                            <button type="button" class="kbtn" id="kset_profile_refresh" title="${t('set.brain.refreshTitle')}">${t('set.brain.refresh')}</button>
                        </div>
                        <small class="kset-note" id="kset_profile_hint"></small>
                    </div>

                    <div class="kset-mode" data-mode-panel="custom">
                        <div class="kset-presets">
                            <span>${t('set.brain.quick')}</span>
                            ${PRESETS.map(([n, u]) => `<button type="button" class="kbtn kbtn-sm kset-preset" data-url="${u}">${n}</button>`).join('')}
                        </div>
                        <label for="kset_url">${t('set.brain.urlLabel')}</label>
                        <input class="text_pole" id="kset_url" placeholder="https://api.openai.com/v1" autocomplete="off" spellcheck="false">
                        <small class="kset-note">${t('set.brain.urlNote')}</small>

                        <label for="kset_key">${t('set.brain.keyLabel')}</label>
                        <div class="kset-inline">
                            <input class="text_pole" id="kset_key" type="password" placeholder="${t('set.brain.keyPh')}" autocomplete="off" spellcheck="false">
                            <button type="button" class="kbtn" id="kset_key_eye" title="${t('set.brain.showTitle')}">${t('set.brain.show')}</button>
                        </div>
                        <small class="kset-note">${t('set.brain.keyNote')}</small>

                        <label for="kset_model">${t('set.brain.modelLabel')}</label>
                        <div class="kset-inline">
                            <input class="text_pole" id="kset_model" list="kset_models" placeholder="${t('set.brain.modelPh')}" autocomplete="off" spellcheck="false">
                            <button type="button" class="kbtn" id="kset_models_btn" title="${t('set.brain.listTitle')}">${t('set.brain.list')}</button>
                        </div>
                        <datalist id="kset_models"></datalist>
                        <small class="kset-note" id="kset_models_hint">${t('set.brain.modelHint')}</small>
                        ${slider('kset_temp', t('set.brain.temp'), 0, 1.5, 0.05)}
                    </div>
                </section>

                <section class="kset-card">
                    <h4>${t('set.brain.test')}</h4>
                    <div class="kset-inline">
                        <button type="button" class="kbtn kbtn-main" id="kset_test">${t('set.brain.testBtn')}</button>
                        <span class="kset-status" id="kset_status"></span>
                    </div>
                </section>

                <section class="kset-card">
                    <h4>${t('set.brain.char')}</h4>
                    <textarea id="kset_prompt" class="text_pole" rows="8"></textarea>
                    <small class="kset-note">${t('set.brain.charNote')}</small>
                    <div class="kset-actions"><button type="button" class="kbtn" id="kset_prompt_reset">${t('set.brain.charReset')}</button></div>
                    ${slider('kset_tokens', t('set.brain.tokens'), 40, 400, 10)}
                    <small class="kset-note">${t('set.brain.tokensNote')}</small>
                    ${slider('kset_ctx', t('set.brain.ctx'), 0, 10, 1)}
                </section>
            </div>

            <!-- ОТЛАДКА -->
            <div class="kset-pane" data-pane="debug">
                <section class="kset-card">
                    <h4>${t('set.dbg.title')}</h4>
                    <div class="kset-actions">
                        <button type="button" class="kbtn" id="kset_dbg_box">${t('set.dbg.box')}</button>
                        <button type="button" class="kbtn" id="kset_dbg_hungry">${t('set.beh.hunger')}</button>
                        <button type="button" class="kbtn" id="kset_dbg_wake">${t('set.dbg.wake')}</button>
                    </div>
                    <small class="kset-note">${t('set.dbg.note')}</small>
                </section>
            </div>

        </div>
    </div>`;
    host.appendChild(wrap);

    const $ = sel => wrap.querySelector(sel);
    const $$ = sel => [...wrap.querySelectorAll(sel)];
    const api = settings.catApi;

    /* ---------- общие помощники ---------- */
    function bindSlider(id, get, set, fmt = v => String(v), after) {
        const el = $('#' + id), out = $('#' + id + '_val');
        el.value = get();
        out.textContent = fmt(Number(get()));
        el.addEventListener('input', () => {
            const v = Number(el.value);
            set(v);
            out.textContent = fmt(v);
            save();
            after && after(v);
        });
        return v => { el.value = v; out.textContent = fmt(Number(v)); };
    }
    function bindSwitch(id, get, set, after) {
        const el = $('#' + id);
        el.checked = !!get();
        el.addEventListener('change', () => { set(el.checked); save(); after && after(el.checked); });
    }

    /* ---------- шапка ---------- */
    $('#kset_name').value = settings.catName;
    $('#kset_name').addEventListener('input', e => {
        settings.catName = e.target.value.trim();
        hooks.onName && hooks.onName(catNameOf(settings));
        save();
    });
    bindSwitch('kset_enabled', () => settings.enabled, v => { settings.enabled = v; }, v => hooks.setEnabled(v));

    /* ---------- язык ---------- */
    $('#kset_lang').value = settings.lang || 'auto';
    $('#kset_lang').addEventListener('change', e => { settings.lang = e.target.value; save(); });

    /* ---------- вкладки ---------- */
    function showTab(name) {
        $$('.kset-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
        $$('.kset-pane').forEach(p => p.classList.toggle('on', p.dataset.pane === name));
        try { localStorage.setItem(TAB_KEY, name); } catch (e) { /* без запоминания тоже работает */ }
    }
    $$('.kset-tab').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); showTab(b.dataset.tab); }));
    let tab = 'look';
    try { tab = localStorage.getItem(TAB_KEY) || 'look'; } catch (e) { /* ничего */ }
    showTab(['look', 'behavior', 'brain', 'debug'].includes(tab) ? tab : 'look');

    /* ---------- вид ---------- */
    bindSlider('kset_size', () => settings.size, v => { settings.size = v; }, v => `${v} px`, () => hooks.onSize());
    bindSwitch('kset_glow', () => settings.glow, v => { settings.glow = v; }, () => hooks.onGlow());
    bindSwitch('kset_home_on', () => settings.homeEnabled, v => { settings.homeEnabled = v; }, () => { hooks.onHome(); syncHomeEnabled(); });
    bindSlider('kset_home_scale', () => settings.homeScale, v => { settings.homeScale = v; }, v => `${v}%`, () => hooks.onHome());
    const syncHomeEnabled = () => $('#kset_home_scale').closest('.kset-row').classList.toggle('off', !settings.homeEnabled);
    syncHomeEnabled();
    const setUiScaleView = bindSlider('kset_ui_scale', () => Math.round(settings.winScale * 100), v => { settings.winScale = v / 100; },
        v => `${v}%`, () => hooks.onUiScale(settings.winScale));
    $('#kset_win_reset').addEventListener('click', () => hooks.resetWindow());

    /* ---------- поведение ---------- */
    const flyHint = () => { $('#kset_fly_hint').textContent = hooks.flyText(); };
    bindSlider('kset_fly', () => settings.flyFreq, v => { settings.flyFreq = v; }, v => (v <= 0 ? t('set.beh.flyNone') : String(v)), () => { hooks.onFly(); flyHint(); });
    flyHint();
    const sleepHint = () => {
        const v = Number(settings.sleepNeed) || 100;
        $('#kset_sleep_hint').textContent = v < 85 ? t('set.beh.sleepLow')
            : v > 115 ? t('set.beh.sleepHigh') : t('set.beh.sleepMid');
    };
    bindSlider('kset_sleep', () => settings.sleepNeed, v => { settings.sleepNeed = v; }, v => `${v}%`, sleepHint);
    sleepHint();
    const syncCoffee = () => $('#kset_coffee_min').closest('.kset-row').classList.toggle('off', !settings.coffeeEnabled);
    bindSwitch('kset_coffee', () => settings.coffeeEnabled, v => { settings.coffeeEnabled = v; }, v => { hooks.onCoffee(v); syncCoffee(); });
    bindSlider('kset_coffee_min', () => settings.coffeeMinutes, v => { settings.coffeeMinutes = v; }, v => t('unit.min', { n: v }));
    syncCoffee();
    bindSlider('kset_hunger', () => settings.hungerMinutes, v => { settings.hungerMinutes = v; }, v => t('unit.min', { n: v }));
    bindSwitch('kset_comments', () => settings.commentsEnabled, v => { settings.commentsEnabled = v; }, v => syncComments());
    bindSlider('kset_comment_min', () => settings.commentMinutes, v => { settings.commentMinutes = v; }, v => t('unit.min', { n: v }));
    const syncComments = () => $('#kset_comment_min').closest('.kset-row').classList.toggle('off', !settings.commentsEnabled);
    syncComments();

    /* ---------- чат и модель ---------- */
    function showMode() {
        const m = settings.catMode || 'main';
        $$('#kset_mode button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
        $$('.kset-mode').forEach(p => p.classList.toggle('on', p.dataset.modePanel === m));
        $('#kset_mode_text').textContent = t('set.brain.mode.' + m);
    }
    $$('#kset_mode button').forEach(b => b.addEventListener('click', () => {
        settings.catMode = b.dataset.mode;
        save();
        showMode();
        setStatus('');
    }));
    showMode();

    // профили Connection Manager
    function fillProfiles() {
        const sel = $('#kset_profile');
        const profiles = listProfiles();
        sel.innerHTML = '';
        const add = (v, t) => { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); };
        if (!profiles.length) add('', t('set.brain.noProfiles'));
        profiles.forEach(p => add(p.id, p.name));
        const known = profiles.some(p => p.id === settings.catProfile);
        if (!known && settings.catProfile && settings.catProfile !== 'main') add(settings.catProfile, t('set.brain.profileMissing', { id: settings.catProfile }));
        sel.value = known || (settings.catProfile && settings.catProfile !== 'main') ? settings.catProfile : (profiles[0] ? profiles[0].id : '');
        if (sel.value && sel.value !== settings.catProfile) { settings.catProfile = sel.value; save(); }
        $('#kset_profile_hint').textContent = profiles.length
            ? t('set.brain.profileHint')
            : t('set.brain.noProfilesHint');
    }
    fillProfiles();
    $('#kset_profile').addEventListener('change', e => { settings.catProfile = e.target.value || 'main'; save(); });
    $('#kset_profile_refresh').addEventListener('click', fillProfiles);

    // свой API
    $('#kset_url').value = api.url;
    $('#kset_url').addEventListener('input', e => { api.url = e.target.value.trim(); save(); });
    $$('.kset-preset').forEach(b => b.addEventListener('click', () => {
        api.url = b.dataset.url;
        $('#kset_url').value = api.url;
        save();
    }));
    $('#kset_key').value = api.key;
    $('#kset_key').addEventListener('input', e => { api.key = e.target.value.trim(); save(); });
    $('#kset_key_eye').addEventListener('click', e => {
        const inp = $('#kset_key');
        const show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        e.currentTarget.textContent = show ? t('set.brain.hide') : t('set.brain.show');
    });
    $('#kset_model').value = api.model;
    $('#kset_model').addEventListener('input', e => { api.model = e.target.value.trim(); save(); });
    bindSlider('kset_temp', () => api.temperature, v => { api.temperature = v; }, v => v.toFixed(2));

    $('#kset_models_btn').addEventListener('click', async e => {
        const btn = e.currentTarget;
        const hint = $('#kset_models_hint');
        btn.classList.add('busy');
        hint.className = 'kset-note';
        hint.textContent = t('set.brain.asking');
        try {
            const ids = await fetchModels(settings);
            const dl = $('#kset_models');
            dl.innerHTML = '';
            ids.forEach(id => { const o = document.createElement('option'); o.value = id; dl.appendChild(o); });
            hint.textContent = t('set.brain.found', { n: ids.length });
            if (!api.model) { $('#kset_model').focus(); }
        } catch (err) {
            hint.className = 'kset-note err';
            hint.textContent = err && err.message ? err.message : String(err);
            console.warn('[Kotik] список моделей', err);
        } finally {
            btn.classList.remove('busy');
        }
    });

    // проверка связи
    function setStatus(text, kind = '') {
        const el = $('#kset_status');
        el.textContent = text;
        el.className = 'kset-status' + (kind ? ' ' + kind : '');
    }
    $('#kset_test').addEventListener('click', async e => {
        const btn = e.currentTarget;
        if (btn.classList.contains('busy')) return;
        btn.classList.add('busy');
        setStatus(t('set.brain.sending'), 'busy');
        try {
            const r = await testCat(settings);
            setStatus(t('set.brain.answers', { text: r.text, sec: (r.ms / 1000).toFixed(1) }), 'ok');
        } catch (err) {
            setStatus(err && err.message ? err.message : String(err), 'err');
            console.warn('[Kotik] проверка связи', err);
        } finally {
            btn.classList.remove('busy');
        }
    });

    // характер
    $('#kset_prompt').value = settings.catPrompt || t('prompt.default');
    $('#kset_prompt').addEventListener('input', e => { settings.catPrompt = isDefaultPrompt(e.target.value) ? '' : e.target.value; save(); });
    $('#kset_prompt_reset').addEventListener('click', () => {
        settings.catPrompt = '';
        $('#kset_prompt').value = t('prompt.default');
        save();
    });
    bindSlider('kset_tokens', () => settings.catMaxTokens, v => { settings.catMaxTokens = v; });
    bindSlider('kset_ctx', () => settings.chatContext, v => { settings.chatContext = v; });

    /* ---------- отладка ---------- */
    $('#kset_dbg_box').addEventListener('click', () => hooks.debug.box());
    $('#kset_dbg_hungry').addEventListener('click', () => hooks.debug.hungry());
    $('#kset_dbg_wake').addEventListener('click', () => hooks.debug.wake());

    return {
        /** окно растянули мышкой: двигаем ползунок масштаба */
        syncScale(z) { setUiScaleView(Math.round(z * 100)); },
    };
}
