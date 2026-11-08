// Локализация расширения: русский и английский.
// Язык берётся из Таверны (getCurrentLocale), русский для ru*, английский для всего остального.
// В настройках можно задать вручную: auto / ru / en.
//
// Localization: Russian and English. The language follows SillyTavern's own locale
// (Russian for ru*, English for everything else); it can be overridden in the settings.

const RU = {
    'name.default': 'Нуар',
    'ext.title': 'Котик-тамагочи',

    // шкалы и кнопки действий
    'stat.hunger': 'Голод', 'stat.happy': 'Счастье', 'stat.love': 'Любовь', 'stat.sleep': 'Сон',
    'act.feed': 'Кормить', 'act.play': 'Играть', 'act.pet': 'Гладить', 'act.sleep': 'Спать', 'act.coffee': 'Кофе',

    // окно тамагочи
    'panel.gear': 'Настройки расширения',
    'panel.placeholder': 'Сказать коту…',
    'panel.send': 'Отправить',
    'panel.grip': 'Потяни, чтобы изменить масштаб окна',
    'chat.fail': 'Мяу? Не вышло: {msg}',
    'hint.feed': 'Покормить',
    'buff': 'бодр ещё {n} мин',
    'unit.min': '{n} мин',

    // реплики кота
    'coffee.on': ['Кофе! Ну всё, теперь я не усну…', 'О-о-о… лапы трясутся. Я готов болтать!', 'Бодрость 100. Сон — для слабых.'],
    'coffee.again': ['Мне уже хватит, я и так вибрирую.', 'Второй кофе? Я сейчас взлечу без крыльев.'],
    'zzz': ['Zzz…', 'Zzzz… ммр… отстань…', 'Хррр… zzz…', '…zzz… ещё пять минуточек…', 'Zzzzz…'],
    'angry': ['Всё. Я проснулся. Доволен? Теперь я злой.', 'Я СПАЛ! Ты слово «zzz» вообще понимаешь?!', 'Ну всё, хозяин. Сам напросился.'],
    'growl': 'Ррр!',

    // запросы к модели
    'chat.owner': 'Хозяин',
    'chat.character': 'Персонаж',
    'prompt.default':
        'Ты — {{cat}}, маленький чёрный крылатый кот-проказник. Живёшь в уголке экрана у хозяина, в своём домике с лежанкой. ' +
        'Любишь сыр, клубки и поспать. Характер: ленивый, ироничный, немного нахальный, но по-своему привязан к хозяину. ' +
        'Ты не аналитик и не помощник: ты комментируешь происходящее, шутишь, ворчишь и просишь еду. ' +
        'Пиши коротко и по-русски.',
    'ai.state': 'Твоё состояние сейчас: сытость {hunger}%, счастье {happy}%, любовь к хозяину {love}%, бодрость {sleep}%. ' +
        'Если голоден или хочешь спать, это должно чувствоваться в тоне.',
    'ai.rules': 'Отвечай по-русски, одной-двумя короткими фразами, без звёздочек и кавычек. Не рассуждай, сразу говори. ' +
        'Если действительно смешно, начни реплику с [СМЕХ].',
    'ai.commentAsk': 'Вот последние сообщения из чата хозяина:\n{chat}\n\n' +
        'Вставь свой короткий комментарий про последнее сообщение, как будто подсматриваешь через плечо.',
    'ai.empty': '(пусто)',
    'ai.ctx': 'Для контекста, что сейчас происходит в чате хозяина:\n{chat}',
    'test.system': 'Ты кот. Ответь одним коротким словом по-русски, без пояснений.',
    'test.user': 'Мяу?',

    // ошибки
    'err.noUrl': 'Не указан адрес API',
    'err.models': 'Сервер не смог получить список моделей (код {code}). Проверь адрес и ключ.',
    'err.noModelsList': 'API ответил, но списка моделей не прислал. Введи название модели вручную.',
    'err.noModel': 'Не указана модель',
    'err.profile': 'Профиль не ответил: {why}',
    'err.fragment': 'Модель отдала обрубок (похоже, тратит ответ на «размышления»). Выбери модель без рассуждений или другую в настройках.',
    'err.empty': 'Модель ответила пустой строкой',
    'err.fragmentTest': 'Ответ-обрубок: «{text}». Похоже, модель «размышляет» и не успевает ответить.',

    // настройки: шапка и вкладки
    'set.hero.namePh': 'Имя кота',
    'set.hero.nameHint': 'Имя в заголовке окна и в характере кота',
    'set.hero.enabled': 'Показывать котика на экране',
    'set.tab.look': 'Вид', 'set.tab.behavior': 'Поведение', 'set.tab.brain': 'Чат и модель', 'set.tab.debug': 'Отладка',

    // вид
    'set.look.lang': 'Язык',
    'set.look.langAuto': 'Авто (как в Таверне)',
    'set.look.langNote': 'Язык интерфейса и реплик кота. Применится после обновления страницы (F5).',
    'set.look.cat': 'Котик',
    'set.look.size': 'Размер (диаметр головы)',
    'set.look.glow': 'Подсветка кота',
    'set.look.glowHint': 'Светлый ободок вокруг силуэта, чтобы чёрный кот был виден на тёмной теме',
    'set.look.home': 'Домик',
    'set.look.homeOn': 'Показывать домик',
    'set.look.homeOnHint': 'Лежанка и будка; без домика кот спит на полу',
    'set.look.homeScale': 'Размер домика',
    'set.look.win': 'Окно тамагочи',
    'set.look.uiScale': 'Масштаб окна, облачка и кнопки',
    'set.look.winNote': 'Окно двигается за заголовок и тянется за правый нижний угол. Котика, домик и коробку можно перетаскивать мышкой.',
    'set.look.winReset': 'Сбросить окно',

    // поведение
    'set.beh.fly': 'Полёты по экрану',
    'set.beh.flyFreq': 'Частота',
    'set.beh.flyNone': 'не летает',
    'set.beh.flyHintNone': 'Не летает вообще. Из лежанки и обратно он перелетает всегда.',
    'set.beh.flyHint': 'Примерно раз в {n} мин. 100 = раз в 5 минут.',
    'set.beh.sleep': 'Сон',
    'set.beh.sleepNeed': 'Потребность во сне',
    'set.beh.sleepLow': 'Бодрячок: спит коротко и устаёт нескоро.',
    'set.beh.sleepHigh': 'Соня: спит долго и быстро устаёт.',
    'set.beh.sleepMid': 'Обычно: средний сон и средняя усталость.',
    'set.beh.coffee': 'Кофе',
    'set.beh.coffeeBtn': 'Кнопка «Кофе» в окне',
    'set.beh.coffeeHint': 'Если хочется поболтать подольше: кот меньше спит и дольше бодрствует. Не нравится? Выключи, кнопка исчезнет',
    'set.beh.coffeeMin': 'Сколько действует (мин)',
    'set.beh.hunger': 'Голод',
    'set.beh.hungerMin': 'Из сытого в голодного за (мин)',
    'set.beh.comments': 'Комментарии к чату',
    'set.beh.commentsOn': 'Комментировать чат самому',
    'set.beh.commentsHint': 'Кот сам вставляет реплику про последнее сообщение; тратит токены выбранной модели',
    'set.beh.commentMin': 'Не чаще, чем раз в (мин)',

    // чат и модель
    'set.brain.who': 'Кто отвечает коту',
    'set.brain.main': 'Основная', 'set.brain.profile': 'Профиль', 'set.brain.custom': 'Свой API',
    'set.brain.mode.main': 'Та же модель, что выбрана в Таверне. Ничего настраивать не нужно.',
    'set.brain.mode.profile': 'Профиль подключения из расширения Connection Manager.',
    'set.brain.mode.custom': 'Любой OpenAI-совместимый API: адрес, ключ и модель только для кота.',
    'set.brain.profileLabel': 'Профиль подключения',
    'set.brain.refresh': 'Обновить',
    'set.brain.refreshTitle': 'Обновить список',
    'set.brain.noProfiles': 'Профилей нет',
    'set.brain.profileMissing': 'Профиль не найден ({id})',
    'set.brain.profileHint': 'Профили создаются и настраиваются в расширении Connection Manager.',
    'set.brain.noProfilesHint': 'Профилей пока нет. Включи расширение Connection Manager и создай профиль, либо выбери «Свой API» рядом.',
    'set.brain.quick': 'Быстрый старт:',
    'set.brain.urlLabel': 'Адрес API',
    'set.brain.urlNote': 'Адрес с /v1, без /chat/completions.',
    'set.brain.keyLabel': 'Ключ API',
    'set.brain.keyPh': 'sk-…  (для локальных моделей можно пусто)',
    'set.brain.show': 'Показать', 'set.brain.hide': 'Скрыть',
    'set.brain.showTitle': 'Показать или скрыть ключ',
    'set.brain.keyNote': 'Ключ хранится в настройках Таверны на этом компьютере и уходит только на указанный адрес.',
    'set.brain.modelLabel': 'Модель',
    'set.brain.modelPh': 'например, gpt-4o-mini',
    'set.brain.list': 'Список',
    'set.brain.listTitle': 'Спросить у API список моделей',
    'set.brain.modelHint': 'Впиши название или нажми «Список».',
    'set.brain.asking': 'Спрашиваю список моделей…',
    'set.brain.found': 'Нашлось моделей: {n}. Начни вводить название или выбери из подсказки.',
    'set.brain.temp': 'Температура (разброс ответов)',
    'set.brain.test': 'Проверка связи',
    'set.brain.testBtn': 'Проверить связь',
    'set.brain.sending': 'Отправляю запрос…',
    'set.brain.answers': 'Отвечает: «{text}» · {sec} с',
    'set.brain.char': 'Характер кота',
    'set.brain.charNote': '{{cat}} в тексте заменяется именем кота.',
    'set.brain.charReset': 'Сбросить характер',
    'set.brain.tokens': 'Длина ответа (токенов)',
    'set.brain.tokensNote': 'Ограничивает длину реплики. Запас токенов на размышления модели добавляется сам.',
    'set.brain.ctx': 'Сообщений чата в контексте',

    // отладка
    'set.dbg.title': 'Быстрые действия',
    'set.dbg.box': 'Коробка', 'set.dbg.hungry': 'Голод', 'set.dbg.wake': 'Разбудить',
    'set.dbg.note': 'Нужны, чтобы быстро посмотреть сцены, не дожидаясь их по расписанию.',
};

const EN = {
    'name.default': 'Noir',
    'ext.title': 'Cat Tamagotchi',

    'stat.hunger': 'Hunger', 'stat.happy': 'Happiness', 'stat.love': 'Love', 'stat.sleep': 'Sleep',
    'act.feed': 'Feed', 'act.play': 'Play', 'act.pet': 'Pet', 'act.sleep': 'Sleep', 'act.coffee': 'Coffee',

    'panel.gear': 'Extension settings',
    'panel.placeholder': 'Say something to the cat…',
    'panel.send': 'Send',
    'panel.grip': 'Drag to scale the window',
    'chat.fail': "Meow? That didn't work: {msg}",
    'hint.feed': 'Feed me',
    'buff': 'awake {n} min left',
    'unit.min': '{n} min',

    'coffee.on': ["Coffee! Great, now I'll never fall asleep…", "Ooh… my paws are shaking. I'm ready to chat!", 'Energy 100. Sleep is for the weak.'],
    'coffee.again': ["I've had enough, I'm already vibrating.", "Another coffee? I'll take off without wings."],
    'zzz': ['Zzz…', 'Zzzz… mmrr… go away…', 'Hrrr… zzz…', '…zzz… five more minutes…', 'Zzzzz…'],
    'angry': ["That's it. I'm awake. Happy now? Now I'm grumpy.", 'I WAS ASLEEP! Do you even understand the word "zzz"?!', 'Alright, human. You asked for it.'],
    'growl': 'Grrr!',

    'chat.owner': 'Owner',
    'chat.character': 'Character',
    'prompt.default':
        "You are {{cat}}, a small black winged mischievous cat. You live in a corner of the owner's screen, in your own little house with a bed. " +
        'You love cheese, balls of yarn and naps. Personality: lazy, ironic, a bit cheeky, but in your own way attached to the owner. ' +
        'You are not an analyst or an assistant: you comment on what is happening, joke, grumble and beg for food. ' +
        'Write briefly, in English.',
    'ai.state': 'Your current state: fullness {hunger}%, happiness {happy}%, love for the owner {love}%, energy {sleep}%. ' +
        'If you are hungry or sleepy, it should show in your tone.',
    'ai.rules': "Reply in English, in one or two short sentences, without asterisks or quotation marks. Don't deliberate, just speak. " +
        'If something is genuinely funny, start your reply with [LAUGH].',
    'ai.commentAsk': "Here are the latest messages from the owner's chat:\n{chat}\n\n" +
        'Add a short comment about the last message, as if you were peeking over their shoulder.',
    'ai.empty': '(empty)',
    'ai.ctx': "For context, here is what is going on in the owner's chat:\n{chat}",
    'test.system': 'You are a cat. Reply with one short word, no explanations.',
    'test.user': 'Meow?',

    'err.noUrl': 'API address is not set',
    'err.models': 'The server could not fetch the model list (code {code}). Check the address and the key.',
    'err.noModelsList': 'The API replied but sent no model list. Enter the model name manually.',
    'err.noModel': 'Model is not set',
    'err.profile': 'The profile did not respond: {why}',
    'err.fragment': 'The model returned a cut-off fragment (it seems to spend its answer on "thinking"). Pick a non-reasoning model or another one in settings.',
    'err.empty': 'The model replied with an empty string',
    'err.fragmentTest': 'Cut-off reply: "{text}". The model seems to be "thinking" and runs out of tokens before answering.',

    'set.hero.namePh': 'Cat name',
    'set.hero.nameHint': "Name in the window title and in the cat's personality",
    'set.hero.enabled': 'Show the cat on screen',
    'set.tab.look': 'Look', 'set.tab.behavior': 'Behavior', 'set.tab.brain': 'Chat & model', 'set.tab.debug': 'Debug',

    'set.look.lang': 'Language',
    'set.look.langAuto': 'Auto (as in SillyTavern)',
    'set.look.langNote': "Language of the interface and of the cat's replies. Applies after a page refresh (F5).",
    'set.look.cat': 'Cat',
    'set.look.size': 'Size (head diameter)',
    'set.look.glow': 'Cat glow',
    'set.look.glowHint': 'A light rim around the silhouette so the black cat stays visible on dark themes',
    'set.look.home': 'House',
    'set.look.homeOn': 'Show the house',
    'set.look.homeOnHint': 'Bed and doghouse; without it the cat sleeps on the floor',
    'set.look.homeScale': 'House size',
    'set.look.win': 'Tamagotchi window',
    'set.look.uiScale': 'Scale of the window, bubble and button',
    'set.look.winNote': 'Drag the window by its title and resize it by the bottom-right corner. You can also drag the cat, the house and the box with the mouse.',
    'set.look.winReset': 'Reset window',

    'set.beh.fly': 'Flights across the screen',
    'set.beh.flyFreq': 'Frequency',
    'set.beh.flyNone': 'no flying',
    'set.beh.flyHintNone': 'Does not fly at all. He still flies to and from his bed.',
    'set.beh.flyHint': 'About once every {n} min. 100 = once every 5 minutes.',
    'set.beh.sleep': 'Sleep',
    'set.beh.sleepNeed': 'Need for sleep',
    'set.beh.sleepLow': 'Energetic: sleeps briefly and tires slowly.',
    'set.beh.sleepHigh': 'Sleepyhead: sleeps long and tires fast.',
    'set.beh.sleepMid': 'Normal: average sleep and average tiredness.',
    'set.beh.coffee': 'Coffee',
    'set.beh.coffeeBtn': '"Coffee" button in the window',
    'set.beh.coffeeHint': "Want to chat for longer? The cat sleeps less and stays awake longer. Don't like it? Turn it off and the button disappears",
    'set.beh.coffeeMin': 'How long it lasts (min)',
    'set.beh.hunger': 'Hunger',
    'set.beh.hungerMin': 'From full to hungry in (min)',
    'set.beh.comments': 'Chat comments',
    'set.beh.commentsOn': 'Comment on the chat on his own',
    'set.beh.commentsHint': 'The cat adds a remark about the latest message by himself; uses tokens of the selected model',
    'set.beh.commentMin': 'No more often than every (min)',

    'set.brain.who': 'Who answers the cat',
    'set.brain.main': 'Main', 'set.brain.profile': 'Profile', 'set.brain.custom': 'Own API',
    'set.brain.mode.main': 'The same model that is selected in SillyTavern. Nothing to configure.',
    'set.brain.mode.profile': 'A connection profile from the Connection Manager extension.',
    'set.brain.mode.custom': 'Any OpenAI-compatible API: address, key and model just for the cat.',
    'set.brain.profileLabel': 'Connection profile',
    'set.brain.refresh': 'Refresh',
    'set.brain.refreshTitle': 'Refresh the list',
    'set.brain.noProfiles': 'No profiles',
    'set.brain.profileMissing': 'Profile not found ({id})',
    'set.brain.profileHint': 'Profiles are created and configured in the Connection Manager extension.',
    'set.brain.noProfilesHint': 'There are no profiles yet. Enable the Connection Manager extension and create one, or choose "Own API" next to it.',
    'set.brain.quick': 'Quick start:',
    'set.brain.urlLabel': 'API address',
    'set.brain.urlNote': 'The address ending in /v1, without /chat/completions.',
    'set.brain.keyLabel': 'API key',
    'set.brain.keyPh': 'sk-…  (may be empty for local models)',
    'set.brain.show': 'Show', 'set.brain.hide': 'Hide',
    'set.brain.showTitle': 'Show or hide the key',
    'set.brain.keyNote': "The key is stored in SillyTavern's settings on this computer and is sent only to the address you specify.",
    'set.brain.modelLabel': 'Model',
    'set.brain.modelPh': 'e.g. gpt-4o-mini',
    'set.brain.list': 'List',
    'set.brain.listTitle': 'Ask the API for its model list',
    'set.brain.modelHint': 'Type a name or press "List".',
    'set.brain.asking': 'Asking for the model list…',
    'set.brain.found': 'Models found: {n}. Start typing a name or pick one from the suggestions.',
    'set.brain.temp': 'Temperature (variety of replies)',
    'set.brain.test': 'Connection test',
    'set.brain.testBtn': 'Test connection',
    'set.brain.sending': 'Sending a request…',
    'set.brain.answers': 'Replies: "{text}" · {sec} s',
    'set.brain.char': "Cat's personality",
    'set.brain.charNote': "{{cat}} in the text is replaced with the cat's name.",
    'set.brain.charReset': 'Reset personality',
    'set.brain.tokens': 'Reply length (tokens)',
    'set.brain.tokensNote': "Limits the length of the reply. A token reserve for the model's reasoning is added automatically.",
    'set.brain.ctx': 'Chat messages in context',

    'set.dbg.title': 'Quick actions',
    'set.dbg.box': 'Box', 'set.dbg.hungry': 'Hunger', 'set.dbg.wake': 'Wake up',
    'set.dbg.note': 'Handy for seeing scenes right away instead of waiting for them on schedule.',
};

const DICTS = { ru: RU, en: EN };
let lang = 'en';

/** Язык по Таверне: ru* -> ru, всё остальное -> en. */
export function detectLang() {
    let loc = '';
    try { loc = String(SillyTavern.getContext().getCurrentLocale() || ''); } catch (e) { /* нет контекста */ }
    if (!loc) {
        try { loc = localStorage.getItem('language') || ''; } catch (e) { /* нет хранилища */ }
    }
    if (!loc) loc = (typeof navigator !== 'undefined' && (navigator.language || navigator.userLanguage)) || 'en';
    return loc.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

/** Выбирает язык: settings.lang = 'auto' | 'ru' | 'en'. */
export function initLang(settings) {
    const v = settings && settings.lang;
    lang = v === 'ru' || v === 'en' ? v : detectLang();
    return lang;
}

export const getLang = () => lang;

function fill(text, params) {
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (m, k) => (Object.hasOwn(params, k) ? String(params[k]) : m));
}

/** Строка по ключу. Подстановки: t('buff', { n: 5 }). Нет перевода: берём русский, иначе сам ключ. */
export function t(key, params) {
    const raw = DICTS[lang][key] ?? RU[key] ?? key;
    return fill(Array.isArray(raw) ? raw[0] : raw, params);
}

/** Список строк по ключу (реплики кота). */
export function tl(key) {
    const raw = DICTS[lang][key] ?? RU[key] ?? [key];
    return Array.isArray(raw) ? raw : [raw];
}

/** Случайная реплика из списка. */
export const tpick = key => {
    const list = tl(key);
    return list[Math.floor(Math.random() * list.length)];
};

/** Имя кота: заданное пользователем или имя по умолчанию для языка. */
export const catNameOf = settings => ((settings && settings.catName) || '').trim() || t('name.default');

/** Совпадает ли текст характера с одним из стандартных (тогда его храним пустым и берём по языку). */
export const isDefaultPrompt = text => {
    const s = String(text || '').trim();
    return !s || s === RU['prompt.default'] || s === EN['prompt.default'];
};
