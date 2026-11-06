"""Генератор пиксель-арт интерфейса котика: рамки, кнопки, иконки.
Запуск: python -I make_ui.py <out_dir>
Палитра взята у самого котика: уголь, лайм глаз, розовый рот, жёлтый сыр.
"""
import sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

OUT = sys.argv[1]

PAL = {
    "K": (11, 11, 16),      # контур
    "1": (23, 23, 29),      # фон панели
    "2": (38, 38, 46),      # тело кота
    "3": (58, 58, 72),      # блик
    "G": (180, 224, 60),    # лайм глаз
    "g": (111, 174, 42),    # тёмный лайм
    "d": (63, 111, 30),     # очень тёмный лайм
    "P": (224, 112, 140),   # розовый рот
    "p": (168, 72, 95),
    "Y": (240, 200, 74),    # сыр
    "y": (196, 146, 40),
    "W": (232, 240, 208),   # крем
    "L": (201, 208, 255),   # луна
    "l": (130, 138, 200),
    "B": (122, 78, 44),     # кофе
    "S": (214, 222, 240),   # пар
}


def rgba(h, w):
    return np.zeros((h, w, 4), np.uint8)


def put(a, mask, key):
    a[mask] = PAL[key] + (255,)


def erode(m, n=1):
    for _ in range(n):
        m = ndi.binary_erosion(m, structure=ndi.generate_binary_structure(2, 1), border_value=0)
    return m


def save(a, name):
    Image.fromarray(a, "RGBA").save(f"{OUT}/{name}", optimize=True)


def cut_rect(h, w, cut):
    """Прямоугольник со ступенчато срезанными углами."""
    m = np.ones((h, w), bool)
    for i in range(cut):
        for j in range(cut - i):
            m[i, j] = m[i, w - 1 - j] = m[h - 1 - i, j] = m[h - 1 - i, w - 1 - j] = False
    return m


# ---------- рамки (9-slice) ----------
def frame(name, size, cut, rings, fill):
    m = cut_rect(size, size, cut)
    a = rgba(size, size)
    layers = [m]
    for _ in range(len(rings)):
        layers.append(erode(layers[-1]))
    for i, key in enumerate(rings):
        put(a, layers[i] & ~layers[i + 1], key)
    put(a, layers[len(rings)], fill)
    save(a, name)
    return a


frame("panel.png", 24, 3, ["K", "G", "K", "3"], "1")        # окно: лайм-кайма
frame("panel_pink.png", 24, 3, ["K", "P", "K", "3"], "1")   # реплики игрока
frame("inset.png", 12, 1, ["K", "3"], "K")                  # вдавленное поле
frame("btn.png", 16, 2, ["K", "g", "K"], "2")
frame("btn_hot.png", 16, 2, ["K", "G", "K"], "3")
frame("btn_down.png", 16, 2, ["K", "d", "K"], "1")
frame("bubble.png", 16, 2, ["K", "G"], "1")
frame("bubble_you.png", 16, 2, ["K", "P"], "1")


# ---------- иконки ----------
def icon(name, draw_fn, size=14):
    """draw_fn(layers) рисует маски на сетке 12x12 (со сдвигом 1px под контур)."""
    S = 12
    layers = {}

    def shape(key, fn):
        im = Image.new("L", (S, S), 0)
        fn(ImageDraw.Draw(im))
        layers.setdefault(key, np.zeros((S, S), bool))
        layers[key] |= np.asarray(im) > 0

    draw_fn(shape)
    a = rgba(size, size)
    union = np.zeros((size, size), bool)
    for key, m in layers.items():
        pad = np.zeros((size, size), bool)
        pad[1:1 + S, 1:1 + S] = m
        layers[key] = pad
        union |= pad
    outline = ndi.binary_dilation(union, structure=ndi.generate_binary_structure(2, 1)) & ~union
    put(a, outline, "K")
    for key, m in layers.items():
        put(a, m, key)
    save(a, name)


def paw(shape, c="G"):
    shape(c, lambda d: d.ellipse([2, 6, 9, 11], fill=1))      # подушечка
    shape(c, lambda d: d.ellipse([0, 2, 2, 5], fill=1))       # крайние пальцы
    shape(c, lambda d: d.ellipse([9, 2, 11, 5], fill=1))
    shape(c, lambda d: d.ellipse([3, 0, 5, 3], fill=1))       # средние пальцы
    shape(c, lambda d: d.ellipse([6, 0, 8, 3], fill=1))


def paw_lime(shape):
    paw(shape)


def heart(shape):
    shape("P", lambda d: d.ellipse([0, 1, 5, 6], fill=1))
    shape("P", lambda d: d.ellipse([6, 1, 11, 6], fill=1))
    shape("P", lambda d: d.polygon([(0, 4), (11, 4), (5.5, 11)], fill=1))
    shape("W", lambda d: d.point([(2, 2), (3, 2)], fill=1))


def cheese(shape):
    shape("Y", lambda d: d.polygon([(0, 4), (11, 1), (11, 10), (0, 10)], fill=1))
    shape("y", lambda d: d.point([(3, 6), (4, 6), (7, 4), (8, 7), (9, 8), (5, 8)], fill=1))
    shape("W", lambda d: d.line([(1, 4), (10, 2)], fill=1))


def smile(shape):
    shape("G", lambda d: d.ellipse([0, 0, 11, 11], fill=1))
    shape("K", lambda d: d.point([(3, 4), (8, 4), (3, 5), (8, 5)], fill=1))
    shape("K", lambda d: d.point([(2, 7), (3, 8), (4, 9), (5, 9), (6, 9), (7, 9), (8, 8), (9, 7)], fill=1))


def moon_icon():
    S = 12
    base = Image.new("L", (S, S), 0)
    ImageDraw.Draw(base).ellipse([0, 0, 11, 11], fill=1)
    cutm = Image.new("L", (S, S), 0)
    ImageDraw.Draw(cutm).ellipse([4, -2, 15, 9], fill=1)
    m = (np.asarray(base) > 0) & ~(np.asarray(cutm) > 0)
    size = 14
    a = rgba(size, size)
    pad = np.zeros((size, size), bool)
    pad[1:1 + S, 1:1 + S] = m
    outline = ndi.binary_dilation(pad, structure=ndi.generate_binary_structure(2, 1)) & ~pad
    put(a, outline, "K")
    put(a, pad, "L")
    # звёздочка
    for (x, y) in [(10, 3), (11, 3), (10, 2), (10, 4)]:
        a[y, x] = PAL["W"] + (255,)
    save(a, "i_sleep.png")


def cross(shape):
    shape("P", lambda d: d.line([(1, 1), (10, 10)], fill=1, width=2))
    shape("P", lambda d: d.line([(10, 1), (1, 10)], fill=1, width=2))


def chat_icon(shape):
    shape("G", lambda d: d.rectangle([0, 1, 11, 8], fill=1))
    shape("G", lambda d: d.polygon([(2, 8), (6, 8), (2, 11)], fill=1))
    shape("K", lambda d: d.point([(3, 4), (6, 4), (9, 4)], fill=1))


def coffee_cup(shape):
    shape("W", lambda d: d.rectangle([1, 4, 8, 10], fill=1))      # чашка
    shape("W", lambda d: d.rectangle([9, 5, 11, 6], fill=1))      # ручка
    shape("W", lambda d: d.rectangle([10, 5, 11, 9], fill=1))
    shape("W", lambda d: d.rectangle([8, 8, 11, 9], fill=1))
    shape("B", lambda d: d.rectangle([2, 4, 7, 5], fill=1))       # кофе сверху
    shape("S", lambda d: d.point([(3, 2), (4, 1), (3, 0), (6, 2), (7, 1), (6, 0)], fill=1))


GEAR = [
    ".....GG.....",
    "..GG.GG.GG..",
    "..GGGGGGGG..",
    ".GGGGGGGGGG.",
    ".GGGGGGGGGG.",
    "GGGGGkkGGGGG",
    "GGGGGkkGGGGG",
    ".GGGGGGGGGG.",
    ".GGGGGGGGGG.",
    "..GGGGGGGG..",
    "..GG.GG.GG..",
    ".....GG.....",
]


def gear(shape):
    g = [(x, y) for y, row in enumerate(GEAR) for x, ch in enumerate(row) if ch == "G"]
    k = [(x, y) for y, row in enumerate(GEAR) for x, ch in enumerate(row) if ch == "k"]
    shape("G", lambda d: d.point(g, fill=1))
    shape("K", lambda d: d.point(k, fill=1))


icon("i_gear.png", gear)
icon("i_coffee.png", coffee_cup)
icon("i_paw.png", paw)
icon("i_paw_dim.png", lambda sh: paw(sh, "d"))
icon("i_hunger.png", cheese)
icon("i_happy.png", smile)
icon("i_love.png", heart)
moon_icon()
icon("i_close.png", cross)
icon("i_chat.png", chat_icon)

# хвостик облачка (10x6, остриём вниз): лаймовый контур, тёмная начинка
tail = rgba(6, 10)
rows = ["..........", ".GIIIIIIG.", "..GIIIIG..", "...GIIG...", "....GG...."]
tail_pal = {"G": PAL["G"], "I": PAL["1"]}
for r, row in enumerate(rows):
    for c, ch in enumerate(row):
        if ch in tail_pal:
            tail[r, c] = tail_pal[ch] + (255,)
save(tail, "bubble_tail.png")
# ручка изменения размера окна (8x8, диагональные линии)
grip = rgba(8, 8)
for c, key in ((7, "g"), (10, "g"), (13, "G")):
    for xx in range(8):
        yy = c - xx
        if 0 <= yy < 8:
            grip[yy, xx] = PAL[key] + (255,)
save(grip, "grip.png")
print("ok")
