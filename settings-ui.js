// Панель настроек расширения: вкладки, карточки, переключатели, выбор модели для кота.
import { listProfiles, fetchModels, testCat, DEFAULT_CAT_PROMPT } from './chat.js';

const TAB_KEY = 'kotik_settings_tab';

// быстрый старт для собственного API (все четыре адреса OpenAI-совместимые)
const PRESETS = [
    ['OpenAI', 'https://api.openai.com/v1'],
    ['OpenRouter', 'https://openrouter.ai/api/v1'],
    ['LM Studio', 'http://localhost:1234/v1'],
    ['Ollama', 'http://localhost:11434/v1'],
];

const MODE_TEXT = {
    main: 'Та же модель, что выбрана в Таверне. Ничего настраивать не нужно.',
    profile: 'Профиль подключения из расширения Connection Manager.',
    custom: 'Любой OpenAI-совместимый API: адрес, ключ и модель только для кота.',
};

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
            <b>Котик-тамагочи</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">

            <div class="kset-hero">
                <div class="kset-avatar" style="background-image:url('${base}frames/pet1.png')"></div>
                <div class="kset-hero-main">
                    <input class="text_pole" id="kset_name" maxlength="24" placeholder="Имя кота">
                    <small>Имя в заголовке окна и в характере кота</small>
                </div>
                <label class="kswitch kswitch-big" title="Показывать котика на экране">
                    <input type="checkbox" id="kset_enabled"><span></span>
                </label>
            </div>

            <div class="kset-tabs" role="tablist">
                <button class="kset-tab" data-tab="look">Вид</button>
                <button class="kset-tab" data-tab="behavior">Поведение</button>
                <button class="kset-tab" data-tab="brain">Чат и модель</button>
                <button class="kset-tab" data-tab="debug">Отладка</button>
            </div>

            <!-- ВИД -->
            <div class="kset-pane" data-pane="look">
                <section class="kset-card">
                    <h4>Котик</h4>
                    ${slider('kset_size', 'Размер (диаметр головы)', 12, 120, 2)}
                </section>
                <section class="kset-card">
                    <h4>Домик</h4>
                    ${toggle('kset_home_on', 'Показывать домик', 'Лежанка и будка; без домика кот спит на полу')}
                    ${slider('kset_home_scale', 'Размер домика', 40, 250, 5)}
                </section>
                <section class="kset-card">
                    <h4>Окно тамагочи</h4>
                    ${slider('kset_ui_scale', 'Масштаб окна, облачка и кнопки', 60, 240, 5)}
                    <small class="kset-note">Окно двигается за заголовок и тянется за правый нижний угол. Котика, домик и коробку можно перетаскивать мышкой.</small>
                    <div class="kset-actions"><button type="button" class="kbtn" id="kset_win_reset">Сбросить окно</button></div>
                </section>
            </div>

            <!-- ПОВЕДЕНИЕ -->
            <div class="kset-pane" data-pane="behavior">
                <section class="kset-card">
                    <h4>Полёты по экрану</h4>
                    ${slider('kset_fly', 'Частота', 0, 100, 1)}
                    <small class="kset-note" id="kset_fly_hint"></small>
                </section>
                <section class="kset-card">
                    <h4>Сон</h4>
                    ${slider('kset_sleep', 'Потребность во сне', 25, 250, 5)}
                    <small class="kset-note" id="kset_sleep_hint"></small>
                </section>
                <section class="kset-card">
                    <h4>Кофе</h4>
                    ${toggle('kset_coffee', 'Кнопка «Кофе» в окне', 'Если хочется поболтать подольше: кот меньше спит и дольше бодрствует. Не нравится? Выключи, кнопка исчезнет')}
                    ${slider('kset_coffee_min', 'Сколько действует (мин)', 5, 60, 5)}
                </section>
                <section class="kset-card">
                    <h4>Голод</h4>
                    ${slider('kset_hunger', 'Из сытого в голодного за (мин)', 1, 60, 1)}
                </section>
                <section class="kset-card">
                    <h4>Комментарии к чату</h4>
                    ${toggle('kset_comments', 'Комментировать чат самому', 'Кот сам вставляет реплику про последнее сообщение; тратит токены выбранной модели')}
                    ${slider('kset_comment_min', 'Не чаще, чем раз в (мин)', 1, 60, 1)}
                </section>
            </div>

            <!-- ЧАТ И МОДЕЛЬ -->
            <div class="kset-pane" data-pane="brain">
                <section class="kset-card">
                    <h4>Кто отвечает коту</h4>
                    <div class="kseg" id="kset_mode">
                        <button data-mode="main">Основная</button>
                        <button data-mode="profile">Профиль</button>
                        <button data-mode="custom">Свой API</button>
                    </div>
                    <small class="kset-note" id="kset_mode_text"></small>

                    <div class="kset-mode" data-mode-panel="profile">
                        <label for="kset_profile">Профиль подключения</label>
                        <div class="kset-inline">
                            <select id="kset_profile" class="text_pole"></select>
                            <button type="button" class="kbtn" id="kset_profile_refresh" title="Обновить список">Обновить</button>
                        </div>
                        <small class="kset-note" id="kset_profile_hint"></small>
                    </div>

                    <div class="kset-mode" data-mode-panel="custom">
                        <div class="kset-presets">
                            <span>Быстрый старт:</span>
                            ${PRESETS.map(([n, u]) => `<button type="button" class="kbtn kbtn-sm kset-preset" data-url="${u}">${n}</button>`).join('')}
                        </div>
                        <label for="kset_url">Адрес API</label>
                        <input class="text_pole" id="kset_url" placeholder="https://api.openai.com/v1" autocomplete="off" spellcheck="false">
                        <small class="kset-note">Адрес с /v1, без /chat/completions.</small>

                        <label for="kset_key">Ключ API</label>
                        <div class="kset-inline">
                            <input class="text_pole" id="kset_key" type="password" placeholder="sk-…  (для локальных моделей можно пусто)" autocomplete="off" spellcheck="false">
                            <button type="button" class="kbtn" id="kset_key_eye" title="Показать или скрыть ключ">Показать</button>
                        </div>
                        <small class="kset-note">Ключ хранится в настройках Таверны на этом компьютере и уходит только на указанный адрес.</small>

                        <label for="kset_model">Модель</label>
                        <div class="kset-inline">
                            <input class="text_pole" id="kset_model" list="kset_models" placeholder="например, gpt-4o-mini" autocomplete="off" spellcheck="false">
                            <button type="button" class="kbtn" id="kset_models_btn" title="Спросить у API список моделей">Список</button>
                        </div>
                        <datalist id="kset_models"></datalist>
                        <small class="kset-note" id="kset_models_hint">Впиши название или нажми «Список».</small>
                        ${slider('kset_temp', 'Температура (разброс ответов)', 0, 1.5, 0.05)}
                    </div>
                </section>

                <section class="kset-card">
                    <h4>Проверка связи</h4>
                    <div class="kset-inline">
                        <button type="button" class="kbtn kbtn-main" id="kset_test">Проверить связь</button>
                        <span class="kset-status" id="kset_status"></span>
                    </div>
                </section>

                <section class="kset-card">
                    <h4>Характер кота</h4>
                    <textarea id="kset_prompt" class="text_pole" rows="8"></textarea>
                    <small class="kset-note">{{cat}} в тексте заменяется именем кота.</small>
                    <div class="kset-actions"><button type="button" class="kbtn" id="kset_prompt_reset">Сбросить характер</button></div>
                    ${slider('kset_tokens', 'Длина ответа (токенов)', 40, 400, 10)}
                    <small class="kset-note">Ограничивает длину реплики. Запас токенов на размышления модели добавляется сам.</small>
                    ${slider('kset_ctx', 'Сообщений чата в контексте', 0, 10, 1)}
                </section>
            </div>

            <!-- ОТЛАДКА -->
            <div class="kset-pane" data-pane="debug">
                <section class="kset-card">
                    <h4>Быстрые действия</h4>
                    <div class="kset-actions">
                        <button type="button" class="kbtn" id="kset_dbg_box">Коробка</button>
                        <button type="button" class="kbtn" id="kset_dbg_hungry">Голод</button>
                        <button type="button" class="kbtn" id="kset_dbg_wake">Разбудить</button>
                    </div>
                    <small class="kset-note">Нужны, чтобы быстро посмотреть сцены, не дожидаясь их по расписанию.</small>
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
        settings.catName = e.target.value.trim() || 'Нуар';
        hooks.onName && hooks.onName(settings.catName);
        save();
    });
    bindSwitch('kset_enabled', () => settings.enabled, v => { settings.enabled = v; }, v => hooks.setEnabled(v));

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
    bindSwitch('kset_home_on', () => settings.homeEnabled, v => { settings.homeEnabled = v; }, () => { hooks.onHome(); syncHomeEnabled(); });
    bindSlider('kset_home_scale', () => settings.homeScale, v => { settings.homeScale = v; }, v => `${v}%`, () => hooks.onHome());
    const syncHomeEnabled = () => $('#kset_home_scale').closest('.kset-row').classList.toggle('off', !settings.homeEnabled);
    syncHomeEnabled();
    const setUiScaleView = bindSlider('kset_ui_scale', () => Math.round(settings.winScale * 100), v => { settings.winScale = v / 100; },
        v => `${v}%`, () => hooks.onUiScale(settings.winScale));
    $('#kset_win_reset').addEventListener('click', () => hooks.resetWindow());

    /* ---------- поведение ---------- */
    const flyHint = () => { $('#kset_fly_hint').textContent = hooks.flyText(); };
    bindSlider('kset_fly', () => settings.flyFreq, v => { settings.flyFreq = v; }, v => (v <= 0 ? 'не летает' : String(v)), () => { hooks.onFly(); flyHint(); });
    flyHint();
    const sleepHint = () => {
        const v = Number(settings.sleepNeed) || 100;
        $('#kset_sleep_hint').textContent = v < 85 ? 'Бодрячок: спит коротко и устаёт нескоро.'
            : v > 115 ? 'Соня: спит долго и быстро устаёт.' : 'Обычно: средний сон и средняя усталость.';
    };
    bindSlider('kset_sleep', () => settings.sleepNeed, v => { settings.sleepNeed = v; }, v => `${v}%`, sleepHint);
    sleepHint();
    const syncCoffee = () => $('#kset_coffee_min').closest('.kset-row').classList.toggle('off', !settings.coffeeEnabled);
    bindSwitch('kset_coffee', () => settings.coffeeEnabled, v => { settings.coffeeEnabled = v; }, v => { hooks.onCoffee(v); syncCoffee(); });
    bindSlider('kset_coffee_min', () => settings.coffeeMinutes, v => { settings.coffeeMinutes = v; }, v => `${v} мин`);
    syncCoffee();
    bindSlider('kset_hunger', () => settings.hungerMinutes, v => { settings.hungerMinutes = v; }, v => `${v} мин`);
    bindSwitch('kset_comments', () => settings.commentsEnabled, v => { settings.commentsEnabled = v; }, v => syncComments());
    bindSlider('kset_comment_min', () => settings.commentMinutes, v => { settings.commentMinutes = v; }, v => `${v} мин`);
    const syncComments = () => $('#kset_comment_min').closest('.kset-row').classList.toggle('off', !settings.commentsEnabled);
    syncComments();

    /* ---------- чат и модель ---------- */
    function showMode() {
        const m = settings.catMode || 'main';
        $$('#kset_mode button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
        $$('.kset-mode').forEach(p => p.classList.toggle('on', p.dataset.modePanel === m));
        $('#kset_mode_text').textContent = MODE_TEXT[m];
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
        if (!profiles.length) add('', 'Профилей нет');
        profiles.forEach(p => add(p.id, p.name));
        const known = profiles.some(p => p.id === settings.catProfile);
        if (!known && settings.catProfile && settings.catProfile !== 'main') add(settings.catProfile, `Профиль не найден (${settings.catProfile})`);
        sel.value = known || (settings.catProfile && settings.catProfile !== 'main') ? settings.catProfile : (profiles[0] ? profiles[0].id : '');
        if (sel.value && sel.value !== settings.catProfile) { settings.catProfile = sel.value; save(); }
        $('#kset_profile_hint').textContent = profiles.length
            ? 'Профили создаются и настраиваются в расширении Connection Manager.'
            : 'Профилей пока нет. Включи расширение Connection Manager и создай профиль, либо выбери «Свой API» рядом.';
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
        e.currentTarget.textContent = show ? 'Скрыть' : 'Показать';
    });
    $('#kset_model').value = api.model;
    $('#kset_model').addEventListener('input', e => { api.model = e.target.value.trim(); save(); });
    bindSlider('kset_temp', () => api.temperature, v => { api.temperature = v; }, v => v.toFixed(2));

    $('#kset_models_btn').addEventListener('click', async e => {
        const btn = e.currentTarget;
        const hint = $('#kset_models_hint');
        btn.classList.add('busy');
        hint.className = 'kset-note';
        hint.textContent = 'Спрашиваю список моделей…';
        try {
            const ids = await fetchModels(settings);
            const dl = $('#kset_models');
            dl.innerHTML = '';
            ids.forEach(id => { const o = document.createElement('option'); o.value = id; dl.appendChild(o); });
            hint.textContent = `Нашлось моделей: ${ids.length}. Начни вводить название или выбери из подсказки.`;
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
        setStatus('Отправляю запрос…', 'busy');
        try {
            const r = await testCat(settings);
            setStatus(`Отвечает: «${r.text}» · ${(r.ms / 1000).toFixed(1)} с`, 'ok');
        } catch (err) {
            setStatus(err && err.message ? err.message : String(err), 'err');
            console.warn('[Kotik] проверка связи', err);
        } finally {
            btn.classList.remove('busy');
        }
    });

    // характер
    $('#kset_prompt').value = settings.catPrompt;
    $('#kset_prompt').addEventListener('input', e => { settings.catPrompt = e.target.value; save(); });
    $('#kset_prompt_reset').addEventListener('click', () => {
        settings.catPrompt = DEFAULT_CAT_PROMPT;
        $('#kset_prompt').value = settings.catPrompt;
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
