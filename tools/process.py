"""Подготовка спрайтов котика для расширения.
Запуск: python process.py <папка_с_исходными_картинками> [папка_assets]
Делает: нормализацию масштаба по голове, отдельные слои глаз (там, где глаза открыты),
точки привязки, крылья (3 фазы), коробки, сыр. Пишет assets/ и frames.json.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

if len(sys.argv) < 2:
    sys.exit("Использование: python process.py <папка_с_исходными_картинками> [папка_assets]")
SRC = sys.argv[1].replace("\\", "/")
OUT = (sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")).replace("\\", "/")
R_OUT = 150.0  # радиус головы в выходных пикселях

FRAMES = {
    "sleep": "sleep.png",
    "angry": "angry.png",
    "stretch1": "awake.png",
    "stretch2": "awake2.png",
    "hungry": "hungry.png",
    "eat1": "eating1.png",
    "eat2": "eating2.png",
    "eat3": "eating3.png",
    "fly": "fly.png",
    "laugh1": "laughing.png",
    "laugh2": "laughing2.png",
    "roll": "rolled eyes.png",
    "ball": "hugging ball.png",
}
FRAMES_OPT = {
    "wake1": "wake1.png", "wake2": "wake2.png",
    "lick1": "lick1.png", "lick2": "lick2.png",
    "pet1": "pet1.png", "pet2": "pet2.png",
    "sit1": "sit1.png", "sit2": "sit2.png", "sit3": "sit3.png", "sit4": "sit4.png",
    "sit5": "sit5.png", "sit6": "sit6.png", "sit7": "sit7.png",
}
for _n, _f in FRAMES_OPT.items():
    for _cand in (_f, _f.replace(".png", " (2).png"), _f.replace(".png", " (1).png")):
        if os.path.exists(f"{SRC}/{_cand}"):
            FRAMES[_n] = _cand
            break
# кадры, где глаза бывают открытыми: их выделяем слоем (тонкие дуги закрытых глаз остаются в картинке)
EYE_FRAMES = {"angry", "fly", "roll", "ball", "wake2", "sit1", "sit2", "sit3", "sit4", "sit5", "sit6", "sit7"}
AIR_FRAMES = {"fly"}
FEET_ANCHOR = {"pet1", "pet2", "sit1", "sit2", "sit3", "sit4", "sit5", "sit6", "sit7"}
R_OVERRIDE = {}  # name -> радиус головы в исходных пикселях, если автоопределение ошиблось

os.makedirs(OUT + "/frames", exist_ok=True)
os.makedirs(OUT + "/eyes", exist_ok=True)
os.makedirs(OUT + "/wings", exist_ok=True)
os.makedirs(OUT + "/items", exist_ok=True)


def load(path):
    return np.asarray(Image.open(path).convert("RGBA")).copy()


def bbox(mask, pad=0, shape=None):
    ys, xs = np.nonzero(mask)
    y0, y1, x0, x1 = ys.min() - pad, ys.max() + 1 + pad, xs.min() - pad, xs.max() + 1 + pad
    if shape is not None:
        y0, x0 = max(0, y0), max(0, x0)
        y1, x1 = min(shape[0], y1), min(shape[1], x1)
    return y0, y1, x0, x1


def lime_mask(a):
    r = a[..., 0].astype(np.float32) / 255
    g = a[..., 1].astype(np.float32) / 255
    b = a[..., 2].astype(np.float32) / 255
    return (g > 0.55) & (r > 0.35) & (r < 0.9) & (b < 0.5) & (g > r * 1.02) & (a[..., 3] > 128)


def extract_eyes(a):
    """Возвращает (a_без_глаз, [глаза]) в исходных координатах."""
    m = lime_mask(a)
    lab, n = ndi.label(m)
    if n == 0:
        return a, []
    sizes = ndi.sum(m, lab, range(1, n + 1))
    order = np.argsort(sizes)[::-1][:2]
    eyes = []
    a2 = a.copy()
    for idx in sorted(order, key=lambda i: ndi.center_of_mass(lab == i + 1)[1]):
        if sizes[idx] < 200:
            continue
        comp = lab == idx + 1
        filled = ndi.binary_fill_holes(comp)
        hole = filled & ~comp
        pup = None
        hl, hn = ndi.label(hole)
        if hn:
            hs = ndi.sum(hole, hl, range(1, hn + 1))
            pm = hl == (np.argmax(hs) + 1)
            ys, xs = np.nonzero(pm)
            if len(xs) > 8:
                cx, cy = xs.mean(), ys.mean()
                cov = np.cov(np.vstack([xs - cx, ys - cy]))
                w_, v_ = np.linalg.eigh(cov)
                major = v_[:, 1]
                ang = float(np.degrees(np.arctan2(major[0], major[1])))  # от вертикали
                pup = dict(cx=float(cx), cy=float(cy),
                           rx=float(2 * np.sqrt(max(w_[0], 0.3))), ry=float(2 * np.sqrt(max(w_[1], 0.3))),
                           ang=ang)
        if ndi.distance_transform_edt(filled).max() < 9:
            continue   # тонкая дуга закрытого глаза: остаётся в картинке
        col = a[comp][:, :3].mean(axis=0)
        spr_mask = ndi.binary_dilation(filled, iterations=1)
        y0, y1, x0, x1 = bbox(spr_mask, pad=2, shape=a.shape)
        mk = Image.fromarray((spr_mask[y0:y1, x0:x1] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
        spr = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
        spr[..., :3] = col.astype(np.uint8)
        spr[..., 3] = np.asarray(mk)
        # стираем глаз с кадра
        region = ndi.binary_dilation(filled, iterations=11)
        ring = ndi.binary_dilation(filled, iterations=20) & ~region & (a[..., 3] > 200) & (a[..., :3].mean(axis=2) < 110)
        body = np.median(a[ring][:, :3], axis=0).astype(np.uint8) if ring.sum() > 20 else np.array([30, 28, 28], np.uint8)
        a2[region, :3] = body
        a2[region, 3] = 255
        eyes.append(dict(spr=spr, x=int(x0), y=int(y0), pupil=None if pup is None else dict(
            cx=pup["cx"] - x0, cy=pup["cy"] - y0, rx=pup["rx"], ry=pup["ry"], ang=pup["ang"])))
    return a2, eyes


def head_radius(a):
    dt = ndi.distance_transform_edt(a[..., 3] > 128)
    hy, hx = np.unravel_index(int(dt.argmax()), dt.shape)
    return float(dt.max()), (float(hx), float(hy))


def resize_rgba(arr, s):
    im = Image.fromarray(arr)
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)


meta = {"R": R_OUT, "frames": {}}

for name, fn in FRAMES.items():
    a = load(f"{SRC}/{fn}")
    R0, head_xy = head_radius(a)
    R = R_OVERRIDE.get(name) or R0
    s = R_OUT / R
    eyes_src = []
    eyes_src = []
    if name in EYE_FRAMES:
        a, eyes_src = extract_eyes(a)
    im = resize_rgba(a, s)
    arr = np.asarray(im)
    y0, y1, x0, x1 = bbox(arr[..., 3] > 8, pad=3, shape=arr.shape)
    crop = arr[y0:y1, x0:x1]
    mask = crop[..., 3] > 128
    opened = ndi.binary_opening(mask, structure=np.ones((9, 9), bool))
    if not opened.any():
        opened = mask
    oy, ox = np.nonzero(opened)
    ax = float(ox.mean())
    if name in FEET_ANCHOR:
        # сидячие кадры: якорь по центру лап, а не по всему силуэту, чтобы наклон головы не сдвигал тело
        low = oy >= oy.max() - 0.12 * (oy.max() - oy.min())
        ax = float(ox[low].mean())
    ay = float(oy.mean()) if name in AIR_FRAMES else float(oy.max() + 1)
    Image.fromarray(crop).save(f"{OUT}/frames/{name}.png", optimize=True)
    eyes_json = []
    for k, e in enumerate(eyes_src):
        sp = resize_rgba(e["spr"], s)
        fname = f"eyes/{name}_{k}.png"
        sp.save(f"{OUT}/{fname}", optimize=True)
        pj = None
        if e["pupil"]:
            p = e["pupil"]
            pj = dict(cx=p["cx"] * s, cy=p["cy"] * s, rx=p["rx"] * s, ry=p["ry"] * s, ang=p["ang"])
        eyes_json.append(dict(file=fname, x=e["x"] * s - x0, y=e["y"] * s - y0, w=sp.width, h=sp.height, pupil=pj))
    meta["frames"][name] = dict(file=f"frames/{name}.png", w=int(crop.shape[1]), h=int(crop.shape[0]),
                                ax=ax, ay=ay, eyes=eyes_json, air=name in AIR_FRAMES,
                                head=dict(x=head_xy[0] * s - x0, y=head_xy[1] * s - y0))
    print(f"{name:9s} R={R:6.1f} s={s:.3f} out={crop.shape[1]}x{crop.shape[0]} anchor=({ax:.0f},{ay:.0f}) eyes={len(eyes_json)}")

# ---------- крылья ----------
w = load(f"{SRC}/wings (2).png")
if (w[..., 3] < 10).mean() < 0.05:  # белый фон вместо альфы
    dist = 255 - w[..., :3].min(axis=2)
    w[..., 3] = np.clip((dist - 20) * 4, 0, 255).astype(np.uint8)
wm = w[..., 3] > 8
lab, n = ndi.label(ndi.binary_dilation(wm, iterations=3))
comps = []
for i in range(1, n + 1):
    area = (wm & (lab == i)).sum()
    if area > 2000:
        cy, cx = ndi.center_of_mass(lab == i)
        comps.append((cx, i))
comps.sort()
print("крыльев найдено:", len(comps))
WS = 1.0
# корни крыльев (середина между левым и правым) в координатах листа, подобраны по картинке
PIVOTS = [(173, 438), (506, 410), (865, 447)]
wmeta = []
for k, nm in enumerate(["up", "mid", "down"]):
    pair = comps[2 * k:2 * k + 2]
    mk = np.zeros(wm.shape, bool)
    for _, i in pair:
        mk |= (lab == i)
    y0, y1, x0, x1 = bbox(mk, pad=2, shape=wm.shape)
    crop = w[y0:y1, x0:x1].copy()
    crop[..., 3] = np.where(mk[y0:y1, x0:x1] & (crop[..., 3] > 8), crop[..., 3], 0)
    im = resize_rgba(crop, WS)
    im.save(f"{OUT}/wings/{nm}.png", optimize=True)
    px, py = PIVOTS[k]
    wmeta.append(dict(name=nm, file=f"wings/{nm}.png", w=im.width, h=im.height,
                      px=(px - x0) * WS, py=(py - y0) * WS))
meta["wings"] = wmeta

# ---------- предметы ----------
def save_item(src, name, width, mask=None, rot=0):
    a = load(src)
    if (a[..., 3] < 10).mean() < 0.05:
        dist = 255 - a[..., :3].min(axis=2)
        a[..., 3] = np.clip((dist - 20) * 4, 0, 255).astype(np.uint8)
    if mask is not None:
        a[..., 3] = np.where(mask, a[..., 3], 0)
    y0, y1, x0, x1 = bbox(a[..., 3] > 8, pad=2, shape=a.shape)
    crop = a[y0:y1, x0:x1]
    if rot:
        crop = np.ascontiguousarray(np.rot90(crop, rot))   # против часовой стрелки
    s = width / crop.shape[1]
    im = resize_rgba(crop, s)
    im.save(f"{OUT}/items/{name}.png", optimize=True)
    return dict(file=f"items/{name}.png", w=im.width, h=im.height), (a, s)


items = {}
items["box_open"], _ = save_item(f"{SRC}/box1.png", "box_open", 460)
items["box_closed"], _ = save_item(f"{SRC}/box2.png", "box_closed", 460)

items["yarn"], _ = save_item(f"{SRC}/ball of yarn.png", "yarn", 200)


def make_hand_placeholder(path):
    """Временная рука (ладонью вниз, пальцы вниз). Заменяется файлом hand.png из папки с картинками."""
    from PIL import ImageDraw
    S = 4
    W, H = 260 * S, 330 * S
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    skin, line, lw = (244, 203, 168, 255), (52, 36, 34, 255), 4 * S
    for x0, yend in zip([64, 100, 136, 172], [250, 285, 275, 245]):
        d.rounded_rectangle([x0 * S, 150 * S, (x0 + 32) * S, yend * S], radius=16 * S, fill=skin, outline=line, width=lw)
    d.rounded_rectangle([56 * S, 50 * S, 206 * S, 190 * S], radius=40 * S, fill=skin, outline=line, width=lw)
    d.rounded_rectangle([20 * S, 118 * S, 78 * S, 215 * S], radius=29 * S, fill=skin, outline=line, width=lw)
    d.rounded_rectangle([62 * S, 0, 202 * S, 60 * S], radius=10 * S, fill=(38, 38, 46, 255), outline=line, width=lw)
    im = im.resize((260, 330), Image.LANCZOS).rotate(-90, expand=True)
    im.save(path, optimize=True)


if os.path.exists(f"{SRC}/hand.png"):
    items["hand"], _ = save_item(f"{SRC}/hand.png", "hand", 320, rot=3)
else:
    make_hand_placeholder(f"{OUT}/items/hand.png")
    items["hand"] = dict(file="items/hand.png", w=330, h=260, placeholder=True)

# сыр: первый слева спрайт целый, правая группа крошки
ch = load(f"{SRC}/cheese1.png")
if (ch[..., 3] < 10).mean() < 0.05:
    dist = 255 - ch[..., :3].min(axis=2)
    ch[..., 3] = np.clip((dist - 20) * 4, 0, 255).astype(np.uint8)
cm = ch[..., 3] > 8
cl, cn = ndi.label(ndi.binary_dilation(cm, iterations=4))
cc = []
for i in range(1, cn + 1):
    if (cm & (cl == i)).sum() > 60:
        cy, cx = ndi.center_of_mass(cl == i)
        cc.append((cx, i, (cm & (cl == i)).sum()))
cc.sort()
print("групп сыра:", [(int(c[0]), int(c[2])) for c in cc])
whole_mask = cl == cc[0][1]
crumb_mask = np.zeros(cm.shape, bool)
for c in cc:
    if c[0] > 780:
        crumb_mask |= (cl == c[1])
tmp = f"{OUT}/items/_t.png"
for nm, mk, wid in [("cheese", whole_mask, 250), ("crumbs", crumb_mask, 120)]:
    a = ch.copy()
    a[..., 3] = np.where(ndi.binary_dilation(mk, iterations=2) & (a[..., 3] > 8), a[..., 3], 0)
    y0, y1, x0, x1 = bbox(a[..., 3] > 8, pad=2, shape=a.shape)
    crop = a[y0:y1, x0:x1]
    im = resize_rgba(crop, wid / crop.shape[1])
    im.save(f"{OUT}/items/{nm}.png", optimize=True)
    items[nm] = dict(file=f"items/{nm}.png", w=im.width, h=im.height)
meta["items"] = items


# ---------- домик (лежанка + будка) ----------
hs = load(f"{SRC}/домик для нуара.png")
print("домик:", hs.shape, "прозрачных %.0f%%" % ((hs[..., 3] < 10).mean() * 100))
if (hs[..., 3] < 10).mean() < 0.05:
    dist = 255 - hs[..., :3].min(axis=2)
    hs[..., 3] = np.clip((dist - 20) * 4, 0, 255).astype(np.uint8)

def clean_outline(a, width=5.0, color=(14, 14, 18)):
    """Чистит край вырезанного спрайта и обводит силуэт одной ровной линией."""
    alpha = a[..., 3].astype(np.float32) / 255
    m = alpha > 0.4
    # убираем мелкий мусор
    lab, n = ndi.label(m)
    if n:
        sizes = ndi.sum(m, lab, range(1, n + 1))
        keep = np.isin(lab, [i + 1 for i, sz in enumerate(sizes) if sz > 150])
        m = keep
    # сглаживаем рваный край
    m = ndi.gaussian_filter(m.astype(np.float32), 1.4) > 0.5
    dist_out = ndi.distance_transform_edt(~m)
    dist_in = ndi.distance_transform_edt(m)
    out = a.copy()
    rgb = out[..., :3].astype(np.float32)
    lum = rgb.mean(axis=2)
    # светлая кайма от вырезания у самой границы становится цветом линии
    fringe = m & (dist_in <= 2.5) & (lum > 150)
    rgb[fringe] = color
    # обводка: внутри 255, снаружи плавный спад на ширине линии
    ring = (~m) & (dist_out <= width + 1)
    rgb[ring] = color
    al = np.zeros_like(alpha)
    al[m] = 1.0
    al[ring] = np.clip(width + 0.5 - dist_out[ring], 0, 1)
    out[..., :3] = rgb.astype(np.uint8)
    out[..., 3] = (al * 255).astype(np.uint8)
    return out


hs = clean_outline(hs)
# якорь кота в исходных координатах картинки: центр лежанки и дно её внутреннего пола
HOME_ANCHOR = (520, 790)
BED_INTERIOR_W = 410
factor = 0.8 * meta["frames"]["sleep"]["w"] / BED_INTERIOR_W
y0, y1, x0, x1 = bbox(hs[..., 3] > 8, pad=2, shape=hs.shape)
crop = hs[y0:y1, x0:x1]
him = resize_rgba(crop, factor)
him.save(f"{OUT}/items/home.png", optimize=True)
meta["home"] = dict(file="items/home.png", w=him.width, h=him.height,
                    ax=(HOME_ANCHOR[0] - x0) * factor, ay=(HOME_ANCHOR[1] - y0) * factor)
print("домик итог:", him.size, meta["home"])

with open(f"{OUT}/frames.json", "w", encoding="utf-8") as f:
    json.dump(meta, f, ensure_ascii=False, indent=1)
print("готово")
