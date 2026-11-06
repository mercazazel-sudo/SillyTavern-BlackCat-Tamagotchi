// Чат с котиком. Три режима модели:
//   main    - основная модель Таверны;
//   profile - профиль из расширения Connection Manager;
//   custom  - свой OpenAI-совместимый API (адрес, ключ, модель), запрос идёт через сервер Таверны, поэтому без проблем с CORS.

const LAUGH_TAG = /\[\s*(?:СМЕХ|смех|LAUGH)\s*\]/i;

/** Явный смех в сообщении хозяина: кот смеётся, даже если модель метку не поставила. */
export function looksFunny(text) {
    return /(?:ха){2,}|хах|ахах|ржу|лол|кек|\blol\b|\blmao\b|😂|🤣/i.test(String(text || ''));
}

export const DEFAULT_CAT_PROMPT =
    'Ты — {{cat}}, маленький чёрный крылатый кот-проказник. Живёшь в уголке экрана у хозяина, в своём домике с лежанкой. ' +
    'Любишь сыр, клубки и поспать. Характер: ленивый, ироничный, немного нахальный, но по-своему привязан к хозяину. ' +
    'Ты не аналитик и не помощник: ты комментируешь происходящее, шутишь, ворчишь и просишь еду. ' +
    'Пиши коротко и по-русски.';

function cleanReply(text, catName, maxChars = 320) {
    let t = String(text || '').trim();
    t = t.replace(new RegExp('^\\s*' + catName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[:\\-—]\\s*', 'i'), '');
    t = t.replace(/\*[^*]{0,80}\*/g, '').replace(/^["«„]+|["»“]+$/g, '').replace(/\s{2,}/g, ' ').trim();
    if (t.length > maxChars) {
        const cut = t.slice(0, maxChars);
        const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
        t = end > maxChars * 0.5 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '…';
    }
    return t;
}

/** Обрубок: у модели с «рассуждениями» бюджет уходит на мысли, и от ответа остаётся пара токенов. */
export function isFragment(t) {
    const s2 = String(t || '').trim();
    const letters = (s2.match(/[A-Za-zА-Яа-яЁё]/g) || []).length;
    if (letters < 2) return true;
    // длинный английский текст без единой русской буквы: утечка рассуждений модели (кот говорит по-русски)
    if (letters >= 8 && !/[А-Яа-яЁё]/.test(s2)) return true;
    return s2.length < 14 && !/[.!?…)"»]$/.test(s2);
}

function recentChat(ctx, n) {
    const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
    return chat.filter(m => m && !m.is_system && typeof m.mes === 'string' && m.mes.trim())
        .slice(-Math.max(0, n))
        .map(m => `${m.name || (m.is_user ? 'Хозяин' : 'Персонаж')}: ${m.mes.replace(/\s+/g, ' ').trim().slice(0, 400)}`)
        .join('\n');
}

/** Список профилей Connection Manager: [{ id, name }]. Пусто, если расширение выключено. */
export function listProfiles() {
    try {
        const { ConnectionManagerRequestService } = SillyTavern.getContext();
        return ConnectionManagerRequestService.getSupportedProfiles().map(p => ({ id: p.id, name: p.name || p.id }));
    } catch (e) {
        return [];
    }
}

/** Заголовок авторизации для собственного API (YAML-строка, которую понимает сервер Таверны). */
export function headerYaml(key) {
    const k = String(key || '').trim();
    return k ? `Authorization: ${JSON.stringify('Bearer ' + k)}` : '';
}

function customUrl(settings) {
    const url = String((settings.catApi && settings.catApi.url) || '').trim().replace(/\/+$/, '');
    if (!url) throw new Error('Не указан адрес API');
    return url;
}

/** Модели своего API (GET <адрес>/models через сервер Таверны). Возвращает массив id. */
export async function fetchModels(settings) {
    const ctx = SillyTavern.getContext();
    const api = settings.catApi || {};
    const res = await fetch('/api/backends/chat-completions/status', {
        method: 'POST',
        headers: ctx.getRequestHeaders(),
        body: JSON.stringify({
            chat_completion_source: 'custom',
            custom_url: customUrl(settings),
            custom_include_headers: headerYaml(api.key),
        }),
    });
    if (!res.ok) throw new Error(`Сервер не смог получить список моделей (код ${res.status}). Проверь адрес и ключ.`);
    const json = await res.json();
    const raw = Array.isArray(json) ? json : Array.isArray(json && json.data) ? json.data : Array.isArray(json && json.data && json.data.data) ? json.data.data : [];
    const ids = raw.map(m => (typeof m === 'string' ? m : m && (m.id || m.name))).filter(Boolean);
    if (!ids.length) throw new Error('API ответил, но списка моделей не прислал. Введи название модели вручную.');
    return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

/** Один запрос к выбранной модели. Возвращает сырой текст ответа. */
async function callModel(settings, msgs, maxTokens, catName) {
    const ctx = SillyTavern.getContext();
    const mode = settings.catMode || 'main';

    if (mode === 'custom') {
        const api = settings.catApi || {};
        if (!String(api.model || '').trim()) throw new Error('Не указана модель');
        const res = await ctx.ChatCompletionService.processRequest({
            stream: false,
            messages: msgs,
            model: String(api.model).trim(),
            max_tokens: maxTokens,
            temperature: Number.isFinite(Number(api.temperature)) ? Number(api.temperature) : 0.9,
            chat_completion_source: 'custom',
            custom_url: customUrl(settings),
            custom_include_headers: headerYaml(api.key),
        }, {}, true);
        return typeof res === 'string' ? res : res && res.content;
    }

    if (mode === 'profile' && settings.catProfile && settings.catProfile !== 'main') {
        const { ConnectionManagerRequestService: CMRS } = ctx;
        const prompt = CMRS.constructPrompt(msgs, settings.catProfile);
        try {
            const res = await CMRS.sendRequest(settings.catProfile, prompt, maxTokens);
            return typeof res === 'string' ? res : res && res.content;
        } catch (e) {
            const why = e && e.cause && e.cause.message ? e.cause.message : (e && e.message) || String(e);
            throw new Error('Профиль не ответил: ' + why);
        }
    }

    // основная модель: промпт одной строкой, чтобы не зависеть от типа API
    const system = msgs.filter(m => m.role === 'system')[0];
    const dialog = msgs.filter(m => m.role !== 'system').map(m =>
        (m.role === 'assistant' ? `${catName}: ` : m.role === 'user' ? 'Хозяин: ' : '') + m.content).join('\n');
    const extra = msgs.filter(m => m.role === 'system').slice(1).map(m => m.content).join('\n');
    return await ctx.generateRaw({
        prompt: (extra ? extra + '\n\n' : '') + dialog + `\n${catName}:`,
        systemPrompt: system ? system.content : '',
        responseLength: maxTokens,
    });
}

/**
 * Спросить котика.
 * mode 'chat': обычный диалог, userText обязателен.
 * mode 'comment': короткая реплика о последних сообщениях в чате Таверны.
 * Возвращает { text, laugh }.
 */
export async function askCat({ settings, stats, history, userText, mode }) {
    const ctx = SillyTavern.getContext();
    const catName = settings.catName || 'Нуар';
    const base = String(settings.catPrompt || DEFAULT_CAT_PROMPT).replace(/\{\{cat\}\}/g, catName);
    const state = `Твоё состояние сейчас: сытость ${Math.round(stats.hunger)}%, счастье ${Math.round(stats.happy)}%, ` +
        `любовь к хозяину ${Math.round(stats.love)}%, бодрость ${Math.round(stats.sleep)}%. ` +
        'Если голоден или хочешь спать, это должно чувствоваться в тоне.';
    const rules = 'Отвечай по-русски, одной-двумя короткими фразами, без звёздочек и кавычек. Не рассуждай, сразу говори. ' +
        'Если действительно смешно, начни реплику с [СМЕХ].';
    const system = `${base}\n\n${state}\n${rules}`;
    const chatCtx = recentChat(ctx, Number(settings.chatContext) || 0);

    const msgs = [{ role: 'system', content: system }];
    if (mode === 'comment') {
        msgs.push({
            role: 'user',
            content: `Вот последние сообщения из чата хозяина:\n${chatCtx || '(пусто)'}\n\n` +
                'Вставь свой короткий комментарий про последнее сообщение, как будто подсматриваешь через плечо.',
        });
    } else {
        if (chatCtx) msgs.push({ role: 'system', content: `Для контекста, что сейчас происходит в чате хозяина:\n${chatCtx}` });
        // обрубки прошлых ответов в историю не берём: модель иначе подражает им и отвечает так же коротко
        const clean = (history || []).filter(h => h && h.text && (h.role === 'you' || (h.role === 'cat' && !isFragment(h.text))));
        for (const h of clean.slice(-8)) {
            if (h.role === 'cat') msgs.push({ role: 'assistant', content: h.text });
            else if (h.role === 'you') msgs.push({ role: 'user', content: h.text });
        }
        msgs.push({ role: 'user', content: userText });
    }

    // «Длина ответа» ограничивает текст реплики, а не бюджет запроса: модели с рассуждениями иначе
    // тратят все токены на мысли и отдают обрубок вроде «Настро». Запас берём большой, ответ всё равно короткий.
    const wanted = Number(settings.catMaxTokens) || 120;
    const maxChars = Math.min(500, Math.max(120, Math.round(wanted * 3.3)));
    const budget = Math.max(wanted * 5, 1024);
    let out = '', laugh = false;
    for (let attempt = 0; attempt < 2; attempt++) {
        const raw = String((await callModel(settings, msgs, attempt ? budget * 2 : budget, catName)) || '');
        console.debug('[Kotik] ответ модели (попытка ' + (attempt + 1) + ', бюджет ' + (attempt ? budget * 2 : budget) + '):', JSON.stringify(raw).slice(0, 300));
        laugh = LAUGH_TAG.test(raw);
        out = cleanReply(raw.replace(new RegExp(LAUGH_TAG.source, 'gi'), ''), catName, maxChars);
        if (!isFragment(out)) break;
        out = '';
    }
    if (!out) {
        throw new Error('Модель отдала обрубок (похоже, тратит ответ на «размышления»). Выбери модель без рассуждений или другую в настройках.');
    }
    return { text: out, laugh };
}

/** Проверка связи с выбранной моделью: короткий запрос. Возвращает { text, ms }. */
export async function testCat(settings) {
    const t0 = performance.now();
    const raw = await callModel(settings, [
        { role: 'system', content: 'Ты кот. Ответь одним коротким словом по-русски, без пояснений.' },
        { role: 'user', content: 'Мяу?' },
    ], 400, settings.catName || 'Нуар');
    const text = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!text) throw new Error('Модель ответила пустой строкой');
    if (isFragment(text)) throw new Error('Ответ-обрубок: «' + text + '». Похоже, модель «размышляет» и не успевает ответить.');
    return { text: text.slice(0, 80), ms: Math.round(performance.now() - t0) };
}

/** Таверна сейчас что-то генерирует в основном чате? Тогда котик не лезет с комментарием. */
export function isMainBusy() {
    try {
        const stop = document.getElementById('mes_stop');
        return !!stop && getComputedStyle(stop).display !== 'none' && stop.offsetParent !== null;
    } catch (e) {
        return false;
    }
}
