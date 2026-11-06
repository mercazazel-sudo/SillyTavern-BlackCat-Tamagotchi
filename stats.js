// Шкалы тамагочи: голод, счастье, любовь, сон. Все от 0 до 100, полная шкала = хорошо.

export const KEYS = ['hunger', 'happy', 'love', 'sleep'];
export const ICONS = { hunger: 'i_hunger.png', happy: 'i_happy.png', love: 'i_love.png', sleep: 'i_sleep.png' };
export const HUNGRY_BELOW = 30;       // ниже этого котик просит еду
export const TIRED_BELOW = 20;        // ниже этого сам идёт спать

const clamp = v => Math.max(0, Math.min(100, v));

/** Потребность во сне: 1 = обычно; меньше = бодрее, больше = соня. */
export const sleepFactor = settings => Math.max(0.25, Math.min(2.5, (Number(settings.sleepNeed) || 100) / 100));
/** Действует ли кофе. */
export const coffeeOn = settings => (Number(settings.coffeeUntil) || 0) > Date.now();

function applyTime(settings, s, mins, mode) {
    const hungerRate = 70 / Math.max(1, Number(settings.hungerMinutes) || 10);   // пунктов в минуту
    const asleep = mode === 'asleep';
    const off = mode === 'offline';
    s.hunger = clamp(s.hunger - hungerRate * mins * (asleep || off ? 0.4 : 1));
    const hungryPenalty = s.hunger < HUNGRY_BELOW ? 1.5 : 0;
    s.happy = clamp(s.happy - (0.8 + hungryPenalty) * mins * (off ? 0.4 : 1));
    s.love = clamp(s.love - 0.12 * mins * (off ? 0.5 : 1) - (s.hunger < 15 ? 0.3 * mins : 0));
    const f = sleepFactor(settings);
    const drain = 1.5 * f * (coffeeOn(settings) ? 0.25 : 1);       // устаёт быстрее или медленнее; кофе замедляет
    // во сне полная шкала набирается за время сна (он тоже растёт с потребностью), поэтому выспаться хватает всегда
    s.sleep = clamp(asleep ? s.sleep + (100 / (0.6 * f)) * mins : off ? s.sleep + (1 / f) * mins : s.sleep - drain * mins);
}

/** Загружает шкалы из настроек и «проживает» время, пока Таверна была закрыта (не больше 3 часов). */
export function initStats(settings) {
    const now = Date.now();
    let s = settings.stats;
    if (!s || typeof s !== 'object') {
        s = settings.stats = { hunger: 85, happy: 70, love: 40, sleep: 85, t: now };
    }
    for (const k of KEYS) if (typeof s[k] !== 'number' || Number.isNaN(s[k])) s[k] = 60;
    const mins = Math.min(Math.max(0, (now - (s.t || now)) / 60000), 180);
    if (mins > 1) applyTime(settings, s, mins, 'offline');
    s.t = now;
    return s;
}

/** Один тик времени. mode: 'asleep' | 'awake'. */
export function tick(settings, s, mode, mins) {
    applyTime(settings, s, mins, mode);
    s.t = Date.now();
}

/** Изменить шкалы событием: bump(s, { happy: +8, love: +2 }). */
export function bump(s, delta) {
    for (const k of Object.keys(delta)) {
        if (KEYS.includes(k)) s[k] = clamp(s[k] + delta[k]);
    }
}
