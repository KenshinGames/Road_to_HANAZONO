#!/usr/bin/env python3
"""v0.31: 場面の背景（1600×800 の JPEG）をコードで描く。

作者の依頼（2026-11-01「背景画像をもっとちゃんと作りこんで！」）で、SVG の簡単な図形で描いていた場面の背景
（4月・6月・10〜11月の月頭と週の画面、試合月の週の画面、対戦確認、新入生の画面）を、描き込んだ絵に置き換えた。
生成 AI は使わない（Higgsfield は無料枠の透かしで本番に使えない・契約しない決定）。numpy と Pillow だけで、
空・雲・建物・木・芝・ゴールポスト・観客席・照明を、遠近法と光（ぼかし・光のにじみ・周辺減光・粒子）で描く。

  python3 tools/paint_scenes.py [--only stadium,spring] [--out v02/img] [--font <DelaGothicOne_400Regular.ttf>] [--embed]

出力は v02/img/scene-<key>.jpg（1600×800）。乱数は場面ごとに固定のシードなので、同じ環境なら同じ絵になる。
--embed で v02/style.css の .photo-<key>（data URI）を書き換える（無ければ .photo-clubroom の次の行に足す）。
ゲーム側の割り当ては game.js の PHOTO_SCENES・MONTH_PHOTOS・MATCH_PHOTOS。
横断幕の字は Dela Gothic One（OFL。入手は tools/embed_fonts.py と同じ npm パッケージ）。無ければ IPA ゴシックで描く。
"""
import argparse, math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1600, 800
SS = 3                      # 図形のアンチエイリアス（3 倍で描いて縮める）
YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_PATH = None


# ---------------------------------------------------------------- 基本の道具
def C(s):
    """'#rrggbb' → 0..1 の RGB"""
    s = s.lstrip('#')
    return np.array([int(s[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255


def mix(a, b, t):
    t = np.asarray(t, np.float32)
    if t.ndim == 2:
        t = t[..., None]
    return a + (b - a) * t


def sstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def _box1d(a, r, axis):
    pad = [(0, 0)] * a.ndim
    pad[axis] = (r + 1, r)
    p = np.pad(a, pad, mode='edge')
    c = np.cumsum(p, axis=axis, dtype=np.float64)
    n = a.shape[axis]
    hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis)
    lo = np.take(c, np.arange(0, n), axis=axis)
    return ((hi - lo) / (2 * r + 1)).astype(np.float32)


def blur(a, sigma, sy=None):
    """ガウスぼかし（箱ぼかし 3 回で近似）。sy を渡すと縦だけ別の強さ"""
    sy = sigma if sy is None else sy
    rx = int(round((math.sqrt(4 * sigma * sigma + 1) - 1) / 2)) if sigma >= 0.5 else 0
    ry = int(round((math.sqrt(4 * sy * sy + 1) - 1) / 2)) if sy >= 0.5 else 0
    for _ in range(3):
        if ry:
            a = _box1d(a, ry, 0)
        if rx:
            a = _box1d(a, rx, 1)
    return a


def vnoise(rng, cx, cy, w=W, h=H):
    """なめらかな乱数（cx×cy 個の格子を 3 次補間）"""
    g = rng.random((cy + 3, cx + 3)).astype(np.float32)
    bw, bh = int(round(w * (cx + 3) / cx)), int(round(h * (cy + 3) / cy))
    a = np.asarray(Image.fromarray(g, 'F').resize((bw, bh), Image.BICUBIC))
    ox, oy = int(round(w * 1.5 / cx)), int(round(h * 1.5 / cy))
    return a[oy:oy + h, ox:ox + w]


def fbm(rng, cx, cy, octaves=5, gain=0.5, w=W, h=H):
    tot, amp, s = 0, 1.0, 0
    for i in range(octaves):
        tot = tot + (vnoise(rng, cx * 2 ** i, cy * 2 ** i, w, h) - 0.5) * amp
        s += amp
        amp *= gain
    n = tot / s
    return (n - n.mean()) / (n.std() + 1e-6)          # 平均 0・標準偏差 1


class Mask:
    """3 倍で描いて縮める図形の型（値 0..1）"""
    def __init__(self, ss=SS):
        self.s = ss
        self.im = Image.new('L', (W * ss, H * ss), 0)
        self.d = ImageDraw.Draw(self.im)

    def _p(self, pts):
        return [(x * self.s, y * self.s) for x, y in pts]

    def poly(self, pts, v=255):
        self.d.polygon(self._p(pts), fill=v)
        return self

    def ellipse(self, cx, cy, rx, ry, v=255):
        s = self.s
        self.d.ellipse([(cx - rx) * s, (cy - ry) * s, (cx + rx) * s, (cy + ry) * s], fill=v)
        return self

    def rect(self, x0, y0, x1, y1, v=255):
        s = self.s
        self.d.rectangle([x0 * s, y0 * s, x1 * s - 1, y1 * s - 1], fill=v)
        return self

    def line(self, pts, w, v=255):
        self.d.line(self._p(pts), fill=v, width=max(1, int(round(w * self.s))), joint='curve')
        return self

    def text(self, x, y, s, size, v=255, anchor='mm'):
        f = font(size * self.s)
        self.d.text((x * self.s, y * self.s), s, font=f, fill=v, anchor=anchor)
        return self

    def get(self):
        return np.asarray(self.im.resize((W, H), Image.BOX), np.float32) / 255


_fonts = {}


def font(px):
    px = max(4, int(round(px)))
    if px not in _fonts:
        cands = [FONT_PATH] if FONT_PATH else []
        cands += ['/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf', '/usr/share/fonts/truetype/fonts-japanese-gothic.ttf']
        for c in cands:
            if c and os.path.exists(c):
                _fonts[px] = ImageFont.truetype(c, px)
                break
        else:
            _fonts[px] = ImageFont.load_default()
    return _fonts[px]


class Canvas:
    def __init__(self, col=(0, 0, 0)):
        self.c = np.zeros((H, W, 3), np.float32) + np.asarray(col, np.float32)

    def over(self, col, m, a=1.0):
        m = np.clip(m * a, 0, 1)[..., None]
        col = np.asarray(col, np.float32)
        self.c = self.c * (1 - m) + col * m

    def add(self, col, m, k=1.0):
        self.c = self.c + np.asarray(col, np.float32) * (np.asarray(m, np.float32) * k)[..., None]

    def mul(self, col, m, k=1.0):
        m = np.clip(m * k, 0, 1)[..., None]
        self.c = self.c * (1 - m + np.asarray(col, np.float32) * m)


class Cam:
    """地面 Y=0・奥が +Z・右が +X のメートルの世界を、高さ py のカメラで写す（yaw は右向きが正）"""
    def __init__(self, pos, yaw, f, hz, cx=W / 2):
        self.px, self.py, self.pz = pos
        th = math.radians(yaw)
        self.cs, self.sn = math.cos(th), math.sin(th)
        self.f, self.hz, self.cx = f, hz, cx

    def cam(self, X, Y, Z):
        dx, dz = X - self.px, Z - self.pz
        return dx * self.cs - dz * self.sn, Y - self.py, dx * self.sn + dz * self.cs

    def p(self, X, Y, Z):
        xc, yc, zc = self.cam(X, Y, Z)
        zc = max(zc, 0.05)
        return (self.cx + self.f * xc / zc, self.hz - self.f * yc / zc)

    def depth(self, X, Y, Z):
        return self.cam(X, Y, Z)[2]

    def ray(self):
        dxc = (XX - self.cx) / self.f
        dyc = -(YY - self.hz) / self.f
        return dxc * self.cs + self.sn, dyc, -dxc * self.sn + self.cs

    def ground(self, Y0=0.0):
        """各画素が地面（Y=Y0）のどこを見ているか（X, Z, 距離）。地平線より上は遠くに飛ばす"""
        dX, dY, dZ = self.ray()
        t = np.where(dY < -1e-4, (Y0 - self.py) / np.minimum(dY, -1e-4), 1e5)
        t = np.minimum(t, 1e5)
        return self.px + t * dX, self.pz + t * dZ, t

    def quad(self, m, pts3, v=255):
        """3D の多角形を描く（カメラの後ろに回る点は手前で切る）"""
        cp = [self.cam(*q) for q in pts3]
        out, n = [], len(cp)
        near = 0.3
        for i in range(n):
            a, b = cp[i], cp[(i + 1) % n]
            ina, inb = a[2] >= near, b[2] >= near
            if ina:
                out.append(a)
            if ina != inb:
                t = (near - a[2]) / (b[2] - a[2])
                out.append(tuple(a[k] + (b[k] - a[k]) * t for k in range(3)))
        if len(out) >= 3:
            m.poly([(self.cx + self.f * x / z, self.hz - self.f * y / z) for x, y, z in out], v)
        return m


def radial(cx, cy, r, ry=None):
    ry = r if ry is None else ry
    d = np.sqrt(((XX - cx) / r) ** 2 + ((YY - cy) / ry) ** 2)
    return d


def glow(cx, cy, r, ry=None, power=2.0):
    d = radial(cx, cy, r, ry)
    return 1 / (1 + d ** power)


def finish(cv, rng, exposure=1.0, bloom_thr=0.85, bloom=((8, 0.35), (24, 0.25), (70, 0.2)), vignette=0.35,
           grain=0.012, lift=0.0, sat=1.0, tint=None):
    c = cv.c * exposure
    # 光のにじみ（明るいところだけを何段かぼかして足す）
    lum = c @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    br = c * sstep(bloom_thr, bloom_thr + 0.35, lum)[..., None]
    acc = np.zeros_like(c)
    for s, k in bloom:
        acc += blur(br, s) * k
    c = c + acc
    # 彩度
    if sat != 1.0:
        g = (c @ np.array([0.2126, 0.7152, 0.0722], np.float32))[..., None]
        c = g + (c - g) * sat
    if tint is not None:
        c = c * np.asarray(tint, np.float32)
    # 周辺減光
    if vignette:
        d = np.sqrt(((XX - W / 2) / (W * 0.62)) ** 2 + ((YY - H * 0.48) / (H * 0.7)) ** 2)
        c = c * (1 - vignette * sstep(0.45, 1.25, d) ** 1.4)[..., None]
    # やわらかい頭打ち
    k = 0.82
    c = np.where(c > k, k + (1 - k) * (1 - np.exp(-(c - k) / (1 - k))), c)
    c = c + lift
    # 粒子
    if grain:
        n = rng.standard_normal((H, W)).astype(np.float32) * grain * 0.5   # 粒子は控えめ（JPEG の容量を抑える）
        c = c + n[..., None]
    return np.clip(c, 0, 1)


def save(arr, key, out):
    im = Image.fromarray((arr * 255 + 0.5).astype(np.uint8), 'RGB')
    path = os.path.join(out, 'scene-' + key + '.jpg')
    im.save(path, quality=80, optimize=True, progressive=True, subsampling=2)
    print('wrote', path, os.path.getsize(path) // 1024, 'KB')
    return path


# ---------------------------------------------------------------- 共通の部品
def sky(cv, top, mid, bot, hz, mid_at=0.55):
    t = np.clip(YY / max(hz, 1), 0, 1)
    a = mix(np.broadcast_to(C(top), (H, W, 3)), np.broadcast_to(C(mid), (H, W, 3)), sstep(0, mid_at, t))
    a = mix(a, np.broadcast_to(C(bot), (H, W, 3)), sstep(mid_at, 1.0, t))
    cv.c = a.astype(np.float32)


def cumulus(cv, rng, blobs, light=(-0.6, -0.8), lit='#ffffff', shade='#9fb2cc', rim=0.0, detail=0.55, soft=0.12,
            base_flat=True, alpha=1.0, warm=None):
    """もくもくした雲。blobs=[(cx, cy, rx, ry)] を重ねた形に乱数でふちを崩し、光の向きで明暗をつける"""
    dens = np.full((H, W), -10.0, np.float32)
    for cx, cy, rx, ry in blobs:
        d = 1 - radial(cx, cy, rx, ry)
        dens = np.maximum(dens, d)
    n = fbm(rng, 24, 12, 6, 0.55)
    dens = dens + n * detail * 0.25
    if base_flat:
        bottoms = max(b[1] + b[3] * 0.55 for b in blobs)
        dens = dens * sstep(bottoms + 6, bottoms - 10, YY)
    a = sstep(0.0, soft, dens) * alpha
    # 光の向きにずらした濃さとの差で、日の当たる側を明るく
    lx, ly = light
    sh = np.roll(np.roll(dens, int(round(-ly * 14)), 0), int(round(-lx * 14)), 1)
    lighting = np.clip(0.55 + (dens - sh) * 2.2, 0, 1)
    ys = np.clip((YY - min(b[1] - b[3] for b in blobs)) / max(1, (max(b[1] + b[3] for b in blobs) - min(b[1] - b[3] for b in blobs))), 0, 1)
    lighting = np.clip(lighting * (1.1 - ys * 0.6), 0, 1)
    col = mix(np.broadcast_to(C(shade), (H, W, 3)), np.broadcast_to(C(lit), (H, W, 3)), lighting)
    if warm is not None:
        col = mix(col, np.broadcast_to(C(warm), (H, W, 3)), (1 - lighting) * 0.0 + sstep(0.5, 1, lighting) * 0.35)
    if rim:
        edge = a * (1 - sstep(0.02, 0.18, dens))
        col = col + rim * edge[..., None]
    cv.over(col, a)
    return a


def grass_field(cv, cam, rng, base='#3f8f4a', light='#5cae5e', dark='#2f7a3d', stripe=5.0, stripe_axis='X',
                stripe_k=0.10, far_haze='#9fc6a6', haze_dist=160, wet=0.0, tint_far=None, gold=0.0):
    X, Z, dist = cam.ground()
    m = YY > cam.hz
    t = np.clip(dist / 120, 0, 1)
    col = mix(np.broadcast_to(C(light), (H, W, 3)), np.broadcast_to(C(base), (H, W, 3)), sstep(0, 0.6, t))
    # 刈り込みの縞
    q = X if stripe_axis == 'X' else Z
    band = np.sin(q / stripe * math.pi)
    band = np.clip(band * 6, -1, 1)
    col = col * (1 + stripe_k * band * sstep(200, 20, dist))[..., None]
    # 芝の手触り（近いほど粗く、縦に細長い）
    n1 = vnoise(rng, 700, 60)
    n2 = vnoise(rng, 260, 120)
    nn = (n1 - 0.5) * sstep(cam.hz + 140, H, YY) + (n2 - 0.5) * 0.6
    col = col * (1 + nn * 0.22)[..., None]
    patch = fbm(rng, 10, 6, 4)
    col = mix(col, np.broadcast_to(C(dark), (H, W, 3)), np.clip(patch * 0.18 + 0.08, 0, 0.35))
    if gold:
        col = mix(col, np.broadcast_to(C('#c9a646'), (H, W, 3)), np.clip(patch * 0.2 + 0.25, 0, 1) * gold)
    # 遠くはかすむ
    col = mix(col, np.broadcast_to(C(far_haze), (H, W, 3)), sstep(haze_dist * 0.25, haze_dist, dist) * 0.65)
    cv.c = np.where(m[..., None], col, cv.c)
    return X, Z, dist


def field_lines(cam, m, lines, width=0.12):
    """地面の線（[(x0, z0, x1, z1)]）を描く"""
    for x0, z0, x1, z1 in lines:
        dx, dz = x1 - x0, z1 - z0
        L = math.hypot(dx, dz)
        nx, nz = -dz / L * width / 2, dx / L * width / 2
        cam.quad(m, [(x0 + nx, 0, z0 + nz), (x1 + nx, 0, z1 + nz), (x1 - nx, 0, z1 - nz), (x0 - nx, 0, z0 - nz)])
    return m


def dashed(x0, z0, x1, z1, on=1.5, off=1.5):
    L = math.hypot(x1 - x0, z1 - z0)
    out, s = [], 0.0
    while s < L:
        e = min(L, s + on)
        out.append((x0 + (x1 - x0) * s / L, z0 + (z1 - z0) * s / L, x0 + (x1 - x0) * e / L, z0 + (z1 - z0) * e / L))
        s += on + off
    return out


def rugby_pitch_lines(xs=(-50, 50), zs=(0, 70), dashes=True):
    x0, x1 = xs
    z0, z1 = zs
    L = [(x0, z0, x1, z0), (x0, z1, x1, z1)]                     # タッチライン
    for x in (x0, x1, -28 if x0 < -27 else None, 28 if x1 > 27 else None, 0 if x0 < 0 < x1 else None):
        if x is not None:
            L.append((x, z0, x, z1))
    L.append((x0 - 8, z0, x0 - 8, z1)) if x0 < -40 else None
    L.append((x1 + 8, z0, x1 + 8, z1)) if x1 > 40 else None
    L.append((x0 - 8, z0, x0, z0)); L.append((x0 - 8, z1, x0, z1))
    L.append((x1, z0, x1 + 8, z0)); L.append((x1, z1, x1 + 8, z1))
    if dashes:
        for x in (-10, 10):
            if x0 < x < x1:
                L += dashed(x, z0, x, z1, 2, 2)
        for z in (z0 + 5, z0 + 15, z1 - 5, z1 - 15):
            L += dashed(x0, z, x1, z, 1, 6)
    return L


def goal_posts(cv, cam, X, Zc, rng, height=15.0, gap=5.6, bar=3.0, pad='#1d3d8f', pad2='#f4f4f4', post='#f7f7f2',
               light_dir=-1, shadow=None, shade_k=0.30, glow_k=0.0, along_x=False, shadow_col='#4a5a48', shadow_k=0.55,
               reflect=None, shadow_w=None):
    """H のゴールポスト（土台のパッドつき）。along_x=True なら横木が X の向き（正面から見える H）。
    shadow=(dx, dz) で地面に影（高さ 1m あたりのずれ）"""
    w = 0.16

    def P(a, y, b):                                   # a = 奥行きの向きのずれ、b = 横木の向きのずれ
        return (X + b, y, Zc + a) if along_x else (X + a, y, Zc + b)

    ends = (-gap / 2, gap / 2)
    if shadow is not None:
        sdx, sdz = shadow
        ms = Mask()
        for b in ends:
            bx, _, bz = P(0, 0, b)
            for o in (-w / 2, w / 2):
                pass
            sw = (shadow_w or w) / 2
            q0 = P(-sw, 0, b - sw)
            q1 = P(sw, 0, b + sw)
            cam.quad(ms, [(q0[0], 0, q0[2]), (q1[0], 0, q1[2]), (q1[0] + sdx * height, 0, q1[2] + sdz * height), (q0[0] + sdx * height, 0, q0[2] + sdz * height)])
        c0, c1 = P(0, 0, ends[0]), P(0, 0, ends[1])
        cam.quad(ms, [(c0[0] + sdx * (bar - 0.1), 0, c0[2] + sdz * (bar - 0.1)), (c1[0] + sdx * (bar - 0.1), 0, c1[2] + sdz * (bar - 0.1)),
                      (c1[0] + sdx * (bar + 0.12), 0, c1[2] + sdz * (bar + 0.12)), (c0[0] + sdx * (bar + 0.12), 0, c0[2] + sdz * (bar + 0.12))])
        sm = blur(ms.get(), 1.4)
        cv.mul(C(shadow_col), sm, shadow_k)
    mp = Mask()
    for b in ends:
        cam.quad(mp, [P(0, 0, b - w / 2), P(0, height, b - w / 2), P(0, height, b + w / 2), P(0, 0, b + w / 2)])
        cam.quad(mp, [P(-w / 2, 0, b), P(-w / 2, height, b), P(w / 2, height, b), P(w / 2, 0, b)])
    cam.quad(mp, [P(0, bar - 0.08, ends[0]), P(0, bar + 0.08, ends[0]), P(0, bar + 0.08, ends[1]), P(0, bar - 0.08, ends[1])])
    cam.quad(mp, [P(-0.08, bar, ends[0]), P(0.08, bar, ends[0]), P(0.08, bar, ends[1]), P(-0.08, bar, ends[1])])
    m = mp.get()
    if reflect is not None:
        # 水たまりに映る逆さのポスト（reflect = 水たまりのマスク）
        mr = Mask()
        for b in ends:
            cam.quad(mr, [P(0, 0, b - w / 2), P(0, -height, b - w / 2), P(0, -height, b + w / 2), P(0, 0, b + w / 2)])
        cam.quad(mr, [P(0, -bar + 0.08, ends[0]), P(0, -bar - 0.08, ends[0]), P(0, -bar - 0.08, ends[1]), P(0, -bar + 0.08, ends[1])])
        rm = blur(mr.get(), 1.5) * reflect
        cv.over(C('#d9dde0'), rm, 0.45)
    cv.over(C(post), m)
    # 片側に陰
    ms = Mask()
    for b in ends:
        bb = b + light_dir * w * 0.1
        cam.quad(ms, [P(-w / 2, 0, bb), P(-w / 2, height, bb), P(-w / 2, height, bb + w * 0.45), P(-w / 2, 0, bb + w * 0.45)])
    cv.mul(C('#8b97a6'), ms.get() * m, shade_k * 2)
    if glow_k:
        cv.add(C('#ffffff'), blur(m, 3), glow_k)
    # パッド
    for b in ends:
        r = 0.45
        mm = Mask()
        cam.quad(mm, [P(0, 0, b - r), P(0, 2.0, b - r), P(0, 2.0, b + r), P(0, 0, b + r)])
        cam.quad(mm, [P(-r, 0, b), P(-r, 2.0, b), P(r, 2.0, b), P(r, 0, b)])
        pm = mm.get()
        cv.over(C(pad), pm)
        mb = Mask()
        cam.quad(mb, [P(0, 1.25, b - r), P(0, 1.55, b - r), P(0, 1.55, b + r), P(0, 1.25, b + r)])
        cam.quad(mb, [P(-r, 1.25, b), P(-r, 1.55, b), P(r, 1.55, b), P(r, 1.25, b)])
        cv.over(C(pad2), mb.get() * pm)
        # パッドの丸み（端を暗く）
        xs = [cam.p(*P(0, 1, b - r))[0], cam.p(*P(0, 1, b + r))[0], cam.p(*P(-r, 1, b))[0], cam.p(*P(r, 1, b))[0]]
        xa, xb = min(xs), max(xs)
        cx, hw = (xa + xb) / 2, max(1, (xb - xa) / 2)
        rnd = np.clip(np.abs(XX - cx - hw * 0.25 * light_dir) / hw, 0, 1)
        cv.mul(C('#000000'), pm * rnd ** 2, 0.45)
    return m


def ball(cv, x, y, s, rot=-18, col='#f5f3ec', stripe='#1d3d8f', shadow_k=0.45, ground=True, light=(-0.5, -0.7)):
    """楕円のラグビーボール（白地に紺の模様）。s = 横の半径（px）"""
    if ground:
        sm = Mask().ellipse(x + s * 0.15, y + s * 0.55, s * 1.1, s * 0.26).get()
        cv.mul(C('#000000'), blur(sm, s * 0.08 + 1), shadow_k)
    th = math.radians(rot)
    ca, sa = math.cos(th), math.sin(th)
    u = ((XX - x) * ca + (YY - y) * sa) / s
    v = (-(XX - x) * sa + (YY - y) * ca) / (s * 0.6)
    r = u * u + v * v
    m = sstep(1.0, 0.97 - 1.5 / s, r)
    base = np.broadcast_to(C(col), (H, W, 3)).copy()
    # 模様：両端寄りの紺の帯と中央の細い帯
    band = (sstep(0.08, 0.0, np.abs(np.abs(u) - 0.62)) * sstep(0.95, 0.6, np.abs(v)))
    band2 = sstep(0.05, 0.0, np.abs(u - 0.05)) * 0.0
    base = mix(base, np.broadcast_to(C(stripe), (H, W, 3)), np.clip(band + band2, 0, 1))
    # 陰影
    lx, ly = light
    sh = np.clip(0.75 - (u * lx + v * ly) * 0.35 - r * 0.25, 0.2, 1.1)
    spec = sstep(0.12, 0.0, (u + 0.3) ** 2 + (v + 0.55) ** 2) * 0.35
    base = base * sh[..., None] + spec[..., None]
    cv.over(base, m)
    return m


def people_rows(cv, cam, rng, area, lit=1.0, colors=None, seat='#b8323a', fill=0.92, head='#2a211c', team=None):
    """傾いた観客席の面に、席と人を描く（遠近つき）。area=(x0, x1, zf, yf, zb, yb)：手前の段と奥の段の (Z, Y)"""
    x0, x1, zf, yf, zb, yb = area
    dX, dY, dZ = cam.ray()
    # 面 Y = yf + (Z - zf) * k と視線の交点
    k = (yb - yf) / (zb - zf)
    den = dY - dZ * k
    t = (yf + (cam.pz - zf) * k - cam.py) / np.where(np.abs(den) < 1e-6, 1e-6, den)
    Xw = cam.px + t * dX
    Zw = cam.pz + t * dZ
    inside = (t > 0) & (Xw >= x0) & (Xw <= x1) & (Zw >= zf) & (Zw <= zb)
    # 2 倍の細かさで計算して縮める（遠くの人がちらつかないように）
    return Xw, Zw, inside


def crowd(cv, cam, rng, area, palette, seat_col='#a8323a', fill=0.9, row_d=0.85, seat_w=0.55, light=1.0,
          shade_top=0.4, block=None, sections=None, swap=False):
    """観客（席の段に並ぶ人）。2 倍の解像度で人の形を作ってから縮める。swap=True は段が X の向きに上がる（ゴール裏）"""
    x0, x1, zf, yf, zb, yb = area
    S2 = 2
    yy2, xx2 = np.mgrid[0:H * S2, 0:W * S2].astype(np.float32)
    xx2 = (xx2 + 0.5) / S2 - 0.5
    yy2 = (yy2 + 0.5) / S2 - 0.5
    dxc = (xx2 - cam.cx) / cam.f
    dyc = -(yy2 - cam.hz) / cam.f
    dX = dxc * cam.cs + cam.sn
    dZ = -dxc * cam.sn + cam.cs
    k = (yb - yf) / (zb - zf)
    dR, dA, pR, pA = (dX, dZ, cam.px, cam.pz) if swap else (dZ, dX, cam.pz, cam.px)
    den = dyc - dR * k
    t = (yf + (pR - zf) * k - cam.py) / np.where(np.abs(den) < 1e-6, 1e-6, den)
    Xw = pA + t * dA                                 # 席の並ぶ向き
    Zw = pR + t * dR                                 # 段の上がる向き
    inside = (t > 0) & (Xw >= x0) & (Xw <= x1) & (Zw >= min(zf, zb)) & (Zw <= max(zf, zb))
    zr = np.abs(Zw - zf)
    row = np.floor(zr / row_d)
    u = zr / row_d - row                             # 0=段の手前 1=奥
    colf = (Xw - x0) / seat_w
    col = np.floor(colf)
    v = colf - col
    # 席ごとの乱数
    hsh = (np.sin(row * 127.1 + col * 311.7) * 43758.5453) % 1.0
    hsh2 = (np.sin(row * 269.5 + col * 183.3) * 24634.6345) % 1.0
    hsh3 = (np.sin(row * 419.2 + col * 371.9) * 17143.1371) % 1.0
    occ = hsh < fill
    # 人の形：段の奥寄りに胴、その上に頭（段の面に立つ人を、手前の段から見た形）
    lean = (hsh3 - 0.5) * 0.25
    torso = (np.abs(v - 0.5 - lean * 0.3) < 0.36) & (u > 0.45)
    headm = ((v - 0.5 - lean) ** 2 * 4 + (u - 0.25) ** 2 * 9) < 0.55
    pal = np.array([C(p) for p in palette], np.float32)
    idx = (hsh2 * len(pal)).astype(int) % len(pal)
    if sections is not None:
        # 区画ごとに同じ色の応援団（[(x0, x1, palette)]）
        for sx0, sx1, spal in sections:
            sp = np.array([C(p) for p in spal], np.float32)
            inn = (Xw >= sx0) & (Xw < sx1)
            idx = np.where(inn, 1000 + (hsh2 * len(sp)).astype(int) % len(sp), idx)
        allpal = np.concatenate([pal] + [np.array([C(p) for p in s[2]], np.float32) for s in sections])
        # 1000 番台を区画のパレットへ並べ直す
        offs = [len(pal)]
        for s in sections[:-1]:
            offs.append(offs[-1] + len(s[2]))
        idx2 = idx.copy()
        for si, (sx0, sx1, spal) in enumerate(sections):
            inn = (Xw >= sx0) & (Xw < sx1)
            idx2 = np.where(inn, offs[si] + (hsh2 * len(spal)).astype(int) % len(spal), idx2)
        idx = idx2
        pal = allpal
    shirt = pal[np.clip(idx, 0, len(pal) - 1)]
    skin = np.where((hsh3 > 0.5)[..., None], C('#d9a882'), C('#c08a66'))
    hair = C('#1e1814')
    seat = C(seat_col)
    step = C('#6b6f78')
    img = np.where(((u < 0.25) | (u > 0.9))[..., None], step * 0.8, seat * (0.75 + 0.25 * u)[..., None])
    person = occ & (torso | headm)
    face = headm & (u > 0.22) & ((v - 0.5 - lean) ** 2 * 4 + (u - 0.3) ** 2 * 9 < 0.3)
    pc = np.where(headm[..., None], np.where(face[..., None], skin, hair), shirt * (1.05 - 0.35 * u)[..., None])
    img = np.where(person[..., None], pc, img)
    # 顔に当たる照明の明るい点
    img = img + (face & occ)[..., None] * 0.12
    # 段ごとの陰（上の段ほど屋根の陰で暗く）
    depth_t = np.clip(zr / abs(zb - zf), 0, 1)
    img = img * (light * (1 - shade_top * depth_t))[..., None]
    a = inside.astype(np.float32)
    small = lambda q: np.asarray(Image.fromarray(q.astype(np.float32), 'F').resize((W, H), Image.BOX))
    img_s = np.stack([small(img[..., i] * a) for i in range(3)], -1)
    a_s = small(a)
    img_s = blur(img_s, 0.55)
    a_s = blur(a_s, 0.55)
    cv.c = cv.c * (1 - a_s[..., None]) + img_s
    return a_s


# ---------------------------------------------------------------- 学校のグラウンドの部品
class Layer:
    """色（あらかじめ不透明度を掛けた値）と不透明度を持つ重ね用の層。ぼかしやかすみをかけてから重ねる"""
    def __init__(self):
        self.c = np.zeros((H, W, 3), np.float32)
        self.a = np.zeros((H, W), np.float32)

    def over(self, col, m, a=1.0, box=None):
        if box is None:
            y0, x0 = 0, 0
            y1, x1 = H, W
        else:
            y0, x0 = box
            y1, x1 = y0 + m.shape[0], x0 + m.shape[1]
        mm = np.clip(m * a, 0, 1)
        col = np.asarray(col, np.float32)
        sl = (slice(y0, y1), slice(x0, x1))
        self.c[sl] = self.c[sl] * (1 - mm)[..., None] + col * mm[..., None]
        self.a[sl] = self.a[sl] * (1 - mm) + mm

    def mul(self, col, m, k=1.0):
        mm = np.clip(m * k, 0, 1)[..., None]
        self.c = self.c * (1 - mm + np.asarray(col, np.float32) * mm)

    def comp(self, cv, blur_s=0.0, haze=None, haze_k=0.0, k=1.0):
        c, a = self.c, self.a
        if blur_s:
            c, a = blur(c, blur_s), blur(a, blur_s)
        if haze is not None and haze_k:
            c = c + (C(haze) * a[..., None] - c) * haze_k
        a = a * k
        c = c * k
        cv.c = cv.c * (1 - a)[..., None] + c


def ramp(stops, t):
    """色の段階（[(位置, '#色')]）を t（0..1）で引く"""
    t = np.clip(t, 0, 1)
    out = np.zeros(t.shape + (3,), np.float32) + C(stops[0][1])
    for (p0, c0), (p1, c1) in zip(stops[:-1], stops[1:]):
        f = np.clip((t - p0) / max(p1 - p0, 1e-6), 0, 1)
        sel = (t >= p0)[..., None]
        out = np.where(sel, C(c0) + (C(c1) - C(c0)) * f[..., None], out)
    return out


def branch_tree(mk, rng, x, y, ang, length, width, depth, ends, spread=0.55, shrink=0.72, droop=0.0):
    """枝分かれ（画面の座標。ang はラジアンで上が π/2）。枝先を ends に入れる"""
    x2 = x + math.cos(ang) * length
    y2 = y - math.sin(ang) * length + droop * length * 0.3
    nx, ny = -math.sin(ang), -math.cos(ang)
    w2 = width * 0.68
    mk.poly([(x + nx * width / 2, y + ny * width / 2), (x2 + nx * w2 / 2, y2 + ny * w2 / 2),
             (x2 - nx * w2 / 2, y2 - ny * w2 / 2), (x - nx * width / 2, y - ny * width / 2)])
    if depth <= 0 or length < 3:
        ends.append((x2, y2, length))
        return
    kids = 2 if rng.random() < 0.6 else 3
    for i in range(kids):
        da = (i - (kids - 1) / 2) * spread * 2 / max(kids - 1, 1) + rng.uniform(-0.18, 0.18)
        na = min(max(ang + da, 0.25), math.pi - 0.25)
        branch_tree(mk, rng, x2, y2, na, length * rng.uniform(shrink - 0.08, shrink + 0.06), w2, depth - 1, ends,
                    spread, shrink, droop)
    if depth <= 2:
        ends.append((x2, y2, length))


def crown(lay, rng, cx, cy, rw, rh, stops, nf, nm, light=(-0.6, -0.8), pts=None, n=26, cl=(0.2, 0.34), detail=1.0,
          edge=0.07, speck=0.35, thr=0.55, bottom_dark=0.35, alpha=1.0):
    """木の葉・花のかたまり。pts（枝先の点）があればそこに集め、なければ楕円の中に散らす"""
    centers = []
    if pts:
        for (px, py, L) in pts:
            centers.append((px, py, min(max(L, 4) * rng.uniform(0.45, 0.75), (rw + rh) * 0.2)))
    for i in range(n):
        ang = rng.uniform(0, 2 * math.pi)
        rad = math.sqrt(rng.uniform(0.0, 1.0)) * 0.72
        centers.append((cx + math.cos(ang) * rad * rw, cy + math.sin(ang) * rad * rh * 0.85,
                        rng.uniform(*cl) * (rw + rh) / 2))
    x0 = int(max(0, min(px - 2.6 * r for px, py, r in centers)))
    x1 = int(min(W, max(px + 2.6 * r for px, py, r in centers)))
    y0 = int(max(0, min(py - 2.6 * r for px, py, r in centers)))
    y1 = int(min(H, max(py + 2.6 * r for px, py, r in centers)))
    if x1 - x0 < 2 or y1 - y0 < 2:
        return
    ly, lx = YY[y0:y1, x0:x1], XX[y0:y1, x0:x1]
    keep = np.ones(ly.shape, np.float32)             # 重なりは「どれかに含まれる」で合わせる（足すと飽和する）
    lump = np.zeros(ly.shape, np.float32)
    for px, py, r in centers:
        g = np.exp(-((lx - px) ** 2 + (ly - py) ** 2) / (2 * r * r))
        keep *= 1 - g
        lump += g
    dens = 1 - keep
    lump = lump / (np.percentile(lump, 99) + 1e-6)
    fine = nf[y0:y1, x0:x1]
    med = nm[y0:y1, x0:x1]
    d2 = dens + med * detail * 0.2 + fine * detail * 0.14
    a = sstep(thr - edge, thr + edge, d2) * alpha
    lx_, ly_ = light
    shx, shy = int(round(-lx_ * max(2, rw * 0.05))), int(round(-ly_ * max(2, rh * 0.05)))
    sh = np.roll(np.roll(lump, shy, 0), shx, 1)
    li = 0.5 + (lump - sh) * 1.5 + (dens - 0.5) * 0.3 + (cy - ly) / max(rh, 1) * 0.2 - sstep(cy, cy + rh, ly) * bottom_dark
    li = li + fine * speck * 0.5
    col = ramp(stops, li)
    lay.over(col, a, box=(y0, x0))


def tree(lay, rng, x, y, h, w, stops, nf, nm, trunk='#4a3a33', light=(-0.6, -0.8), depth=4, n=18, detail=1.0,
         spread=0.5, crown_y=0.6, branch_k=1.0, thr=0.55, edge=0.07, speck=0.35, cl=(0.2, 0.34)):
    """1 本の木（幹と枝、その上に葉・花）。x, y = 根元、h = 高さ、w = 枝の広がり（すべて px）"""
    mk = Mask()
    ends = []
    tw = max(1.5, w * 0.07)
    trunk_len = h * (1 - crown_y) * 0.95
    mk.poly([(x - tw / 2, y), (x - tw * 0.32, y - trunk_len), (x + tw * 0.32, y - trunk_len), (x + tw / 2, y)])
    for i in range(3 if w > 60 else 2):
        a0 = math.pi / 2 + (i - 1) * spread * 0.9 + rng.uniform(-0.15, 0.15)
        branch_tree(mk, rng, x, y - trunk_len, a0, h * 0.26 * branch_k, tw * 0.62, depth, ends, spread, 0.74)
    lay.over(C(trunk), mk.get())
    cy = y - h * crown_y - h * 0.05
    pts = [(ex, ey, L) for ex, ey, L in ends if abs(ex - x) < w * 0.75]
    crown(lay, rng, x, cy, w * 0.5, h * 0.38, stops, nf, nm, light, pts=pts[::max(1, len(pts) // 28)], n=n,
          detail=detail, thr=thr, edge=edge, speck=speck, cl=cl)
    return ends


def school_building(cv, cam, rng, X0, X1, Z, floors=4, fh=3.6, wall='#ece7dc', wall_dk='#c4beb2', glass=('#cfe2ef', '#6f8da6'),
                    tower=None, clock=True, roof_fence=True, curtains=0.18, lit=1.0, warm=None, win_dark=0.0):
    """鉄筋の校舎（正面）。tower = 階段室の X（時計つき）"""
    top = floors * fh + 1.0
    lay = Layer()
    m = Mask()
    cam.quad(m, [(X0, 0, Z), (X0, top, Z), (X1, top, Z), (X1, 0, Z)])
    fm = m.get()
    _, yb = cam.p((X0 + X1) / 2, 0, Z)
    _, yt = cam.p((X0 + X1) / 2, top, Z)
    wcol = mix(np.broadcast_to(C(wall), (H, W, 3)), np.broadcast_to(C(wall_dk), (H, W, 3)), sstep(yt, yb, YY) * 0.6)
    lay.over(wcol * lit, fm)
    # 窓（各階の帯。1 区画 4m に 2 枚）
    gm, cm = Mask(), Mask()
    frac = np.zeros((H, W), np.float32)
    for i in range(floors):
        yb0, yb1 = i * fh + 0.9, i * fh + fh - 0.45
        _, ya = cam.p((X0 + X1) / 2, yb1, Z)
        _, yb_ = cam.p((X0 + X1) / 2, yb0, Z)
        band = (YY >= ya - 1) & (YY <= yb_ + 1)
        frac = np.where(band, np.clip((YY - ya) / max(yb_ - ya, 1), 0, 1), frac)
        x = X0 + 0.8
        while x + 3.4 <= X1 - 0.6:
            for k in range(2):
                wx0 = x + k * 1.7
                q = [(wx0, yb0, Z - 0.05), (wx0, yb1, Z - 0.05), (wx0 + 1.58, yb1, Z - 0.05), (wx0 + 1.58, yb0, Z - 0.05)]
                if rng.random() < curtains:
                    cam.quad(cm, q)
                else:
                    cam.quad(gm, q)
            x += 4.0
    gmm, cmm = gm.get(), cm.get()
    gcol = ramp([(0, glass[0]), (0.55, glass[1]), (1.0, glass[1])], frac)
    gcol = gcol * (1 - win_dark) + C('#1f2a36') * win_dark
    lay.over(gcol * lit, gmm)
    lay.over(ramp([(0, '#f2ead8'), (1, '#cdbf9f')], frac) * lit, cmm)
    # 窓の枠（縦の桟と横の桟）と手すり
    fr = Mask()
    for i in range(floors):
        yb0, yb1 = i * fh + 0.9, i * fh + fh - 0.45
        x = X0 + 0.8
        while x + 3.4 <= X1 - 0.6:
            for k in range(2):
                wx0 = x + k * 1.7
                fr.line([cam.p(wx0 + 0.79, yb0, Z - 0.06), cam.p(wx0 + 0.79, yb1, Z - 0.06)], 0.9)
            x += 4.0
        fr.line([cam.p(X0 + 0.6, yb0 + 1.0, Z - 0.3), cam.p(X1 - 0.6, yb0 + 1.0, Z - 0.3)], 1.0)
        fr.line([cam.p(X0 + 0.6, yb1 - 0.55, Z - 0.06), cam.p(X1 - 0.6, yb1 - 0.55, Z - 0.06)], 0.7)
    lay.over(C('#9aa3a8') * lit, fr.get(), 0.85)
    # 各階のひさし（明るい帯）とその下の影
    sl, sd = Mask(), Mask()
    for i in range(1, floors + 1):
        ys = i * fh - 0.45
        cam.quad(sl, [(X0, ys, Z - 0.6), (X0, ys + 0.42, Z - 0.6), (X1, ys + 0.42, Z - 0.6), (X1, ys, Z - 0.6)])
        cam.quad(sd, [(X0, ys - 0.5, Z - 0.1), (X0, ys, Z - 0.1), (X1, ys, Z - 0.1), (X1, ys - 0.5, Z - 0.1)])
    lay.mul(C('#5d6670'), blur(sd.get(), 1.2), 0.35)
    lay.over(C('#f7f4ee') * lit, sl.get())
    # 屋上のフェンス
    if roof_fence:
        rf = Mask()
        x = X0
        while x <= X1:
            rf.line([cam.p(x, top, Z), cam.p(x, top + 1.6, Z)], 0.9)
            x += 2.0
        rf.line([cam.p(X0, top + 1.6, Z), cam.p(X1, top + 1.6, Z)], 1.0)
        lay.over(C('#5f7f6a') * lit, rf.get(), 0.75)
    # 階段室と時計
    if tower is not None:
        tx0, tx1 = tower - 3.6, tower + 3.6
        tt = top + 4.2
        tm = Mask()
        cam.quad(tm, [(tx0, 0, Z - 0.8), (tx0, tt, Z - 0.8), (tx1, tt, Z - 0.8), (tx1, 0, Z - 0.8)])
        lay.over(C(wall) * lit * 1.02, tm.get())
        vg = Mask()
        cam.quad(vg, [(tower - 0.9, 1.0, Z - 0.85), (tower - 0.9, top - 0.4, Z - 0.85), (tower + 0.9, top - 0.4, Z - 0.85), (tower + 0.9, 1.0, Z - 0.85)])
        lay.over(mix(np.broadcast_to(C(glass[0]), (H, W, 3)), np.broadcast_to(C(glass[1]), (H, W, 3)), sstep(yt, yb, YY)) * lit, vg.get())
        if clock:
            ccx, ccy = cam.p(tower, top + 2.0, Z - 0.9)
            r = abs(cam.p(tower, top + 3.6, Z - 0.9)[1] - ccy)
            lay.over(C('#3a4250') * lit, Mask().ellipse(ccx, ccy, r * 1.08, r * 1.08).get())
            lay.over(C('#fbfaf6') * lit, Mask().ellipse(ccx, ccy, r * 0.94, r * 0.94).get())
            hm = Mask().line([(ccx, ccy), (ccx + r * 0.05, ccy - r * 0.72)], max(1.0, r * 0.1)).line([(ccx, ccy), (ccx + r * 0.5, ccy + r * 0.1)], max(1.0, r * 0.13))
            lay.over(C('#222831'), hm.get())
    if warm is not None:
        lay.c = lay.c + (C(warm) * lay.a[..., None] - lay.c) * 0.0
    return lay


def gymnasium(cv, cam, X0, X1, Z, h=9.0, roof='#5f8f8c', wall='#e3ded2', lit=1.0):
    lay = Layer()
    m = Mask()
    cam.quad(m, [(X0, 0, Z), (X0, h, Z), (X1, h, Z), (X1, 0, Z)])
    lay.over(C(wall) * lit, m.get())
    # かまぼこ屋根（正面から見た弧）
    pts = []
    for i in range(25):
        t = i / 24
        xx = X0 + (X1 - X0) * t
        yy = h + 4.2 * math.sin(math.pi * t)
        pts.append(cam.p(xx, yy, Z))
    pts += [cam.p(X1, h - 0.2, Z), cam.p(X0, h - 0.2, Z)]
    rm = Mask().poly(pts).get()
    _, yt = cam.p(X0, h + 4.2, Z)
    _, yb = cam.p(X0, h, Z)
    lay.over(mix(np.broadcast_to(C(roof), (H, W, 3)) * 1.15, np.broadcast_to(C(roof), (H, W, 3)) * 0.8, sstep(yt, yb, YY)) * lit, rm)
    # 高い窓の列
    wm = Mask()
    x = X0 + 1.5
    while x + 2.2 < X1 - 1:
        cam.quad(wm, [(x, h - 3.2, Z - 0.05), (x, h - 0.9, Z - 0.05), (x + 2.2, h - 0.9, Z - 0.05), (x + 2.2, h - 3.2, Z - 0.05)])
        x += 3.4
    lay.over(C('#7d93a3') * lit, wm.get())
    return lay


def net_fence(lay, cam, X0, X1, Z, h, pole='#6f7a72', net='#3f4f45', step=8.0, net_a=0.22, mesh=0.6):
    pm = Mask()
    x = X0
    while x <= X1 + 0.1:
        pm.line([cam.p(x, 0, Z), cam.p(x, h, Z)], max(1.0, 260 / max(cam.depth(x, 0, Z), 1)))
        x += step
    pm.line([cam.p(X0, h, Z), cam.p(X1, h, Z)], 1.2)
    nm = Mask()
    _, yb = cam.p((X0 + X1) / 2, 0, Z)
    _, yt = cam.p((X0 + X1) / 2, h, Z)
    yy = yt
    while yy < yb:
        nm.line([(cam.p(X0, 0, Z)[0], yy), (cam.p(X1, 0, Z)[0], yy)], 0.5)
        yy += max(1.6, (yb - yt) / (h / mesh))
    x = X0
    while x <= X1:
        nm.line([cam.p(x, 0, Z), cam.p(x, h, Z)], 0.5)
        x += mesh * 1.0
    lay.over(C(net), nm.get(), net_a)
    lay.over(C(pole), pm.get())


def tackle_bag(cv, cam, X, Z, col='#1d3d8f', band='#f2f2f2', h=1.25, r=0.42, lying=False, light=-1):
    if lying:
        x0, y0 = cam.p(X - h / 2, r, Z)
        x1, y1 = cam.p(X + h / 2, r, Z)
        rr = abs(cam.p(X, 2 * r, Z)[1] - cam.p(X, 0, Z)[1]) / 2
        sm = Mask().ellipse((x0 + x1) / 2, (y0 + y1) / 2 + rr * 0.9, abs(x1 - x0) / 2 + rr, rr * 0.35).get()
        cv.mul(C('#000000'), blur(sm, 3), 0.4)
        m = Mask().line([(x0, y0), (x1, y1)], rr * 2).ellipse(x0, y0, rr, rr).ellipse(x1, y1, rr, rr).get()
        cv.over(C(col), m)
        b = Mask().line([((x0 * 0.62 + x1 * 0.38), y0 - rr), ((x0 * 0.62 + x1 * 0.38), y0 + rr)], rr * 0.35).get()
        cv.over(C(band), b * m)
        cv.mul(C('#000000'), m * sstep(y0 - rr * 0.2, y0 + rr, YY), 0.45)
        cv.add(C('#ffffff'), m * sstep(y0 - rr * 0.2, y0 - rr, YY), 0.12)
        return
    bx, by = cam.p(X, 0, Z)
    tx, ty = cam.p(X, h, Z)
    rw = abs(cam.p(X + r, 0, Z)[0] - bx)
    sm = Mask().ellipse(bx + rw * 0.8, by, rw * 2.2, rw * 0.45).get()
    cv.mul(C('#000000'), blur(sm, 3), 0.4)
    m = Mask().rect(bx - rw, ty, bx + rw, by).ellipse(bx, by, rw, rw * 0.3).ellipse(bx, ty, rw, rw * 0.3).get()
    cv.over(C(col), m)
    bm = Mask().rect(bx - rw, ty + (by - ty) * 0.3, bx + rw, ty + (by - ty) * 0.42).get()
    cv.over(C(band), bm * m)
    rnd = np.clip(np.abs(XX - bx + rw * 0.35 * light) / max(rw, 1), 0, 1)
    cv.mul(C('#000000'), m * rnd ** 2, 0.55)
    cv.add(C('#ffffff'), m * sstep(0.6, 0.0, np.abs(XX - bx + rw * 0.45 * light) / max(rw, 1)) * sstep(ty, ty + 6, YY), 0.1)


def cone(cv, cam, X, Z, col='#f2762e', h=0.32, r=0.17):
    bx, by = cam.p(X, 0, Z)
    tx, ty = cam.p(X, h, Z)
    rw = max(2.0, abs(cam.p(X + r, 0, Z)[0] - bx))
    cv.mul(C('#000000'), blur(Mask().ellipse(bx + rw * 0.5, by, rw * 1.5, rw * 0.35).get(), 2), 0.35)
    m = Mask().poly([(bx - rw, by), (tx - rw * 0.12, ty), (tx + rw * 0.12, ty), (bx + rw, by)]).ellipse(bx, by, rw, rw * 0.28).get()
    cv.over(C(col), m)
    cv.over(C('#ffffff'), m * sstep(0.04, 0.0, np.abs((YY - ty) / max(by - ty, 1) - 0.5) - 0.06), 0.9)
    cv.mul(C('#000000'), m * np.clip((XX - bx) / rw, 0, 1), 0.35)


def particles(lay_or_cv, rng, n, box, size, cols, aspect=0.55, blur_s=0.0, alpha=1.0, k_mask=None, ang=None):
    """花びら・葉・雪などの小片（回転した楕円）。box=(x0, y0, x1, y1)"""
    x0, y0, x1, y1 = box
    groups = [Mask() for _ in cols]
    for i in range(n):
        x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
        s = rng.uniform(*size)
        th = rng.uniform(0, math.pi) if ang is None else ang + rng.uniform(-0.4, 0.4)
        ca, sa = math.cos(th), math.sin(th)
        pts = [(x + math.cos(t) * s * ca - math.sin(t) * s * aspect * sa, y + math.cos(t) * s * sa + math.sin(t) * s * aspect * ca)
               for t in np.linspace(0, 2 * math.pi, 10, endpoint=False)]
        groups[int(rng.integers(len(cols)))].poly(pts)
    for g, c in zip(groups, cols):
        m = g.get()
        if blur_s:
            m = blur(m, blur_s)
        if k_mask is not None:
            m = m * k_mask
        lay_or_cv.over(C(c), m, alpha)


# ---------------------------------------------------------------- 場面：ナイターの競技場（県予選）
def stadium_stand(cv, cam, rng, SX0, SX1, SZ0, RY, lower_pal, upper_pal, sections, banners, seat1='#4a2a33', seat2='#3a2430',
                  roof_lit='#3a4566', roof_dark='#121827', lamp_row=True, lit=1.0, wall_leds=True, d=1, back_col='#10172a', roof=True,
                  mid_col='#1a2033', edge_col='#1a2135', wall_col='#0e1424', beam_col='#0b101c'):
    """屋根つきの 2 層スタンド（手前の段の前ふち Z=SZ0。d=-1 なら段が -Z へ上がる）"""
    T1 = (SZ0, 0.9, SZ0 + d * 15, 9.2)
    T2 = (SZ0 + d * 17, 11.4, SZ0 + d * 34, 23.5)
    BZ = SZ0 + d * 36
    back = Mask()
    cam.quad(back, [(SX0, 0, SZ0), (SX0, RY, BZ), (SX1, RY, BZ), (SX1, 0, SZ0)])
    cv.over(C(back_col), back.get())
    # 柱（屋根を支える）
    cols = Mask()
    for bx_ in (np.arange(SX0 + 10, SX1, 26.0) if roof else []):
        cam.quad(cols, [(bx_ - 0.35, 0, BZ - d), (bx_ - 0.35, RY, BZ - d), (bx_ + 0.35, RY, BZ - d), (bx_ + 0.35, 0, BZ - d)])
    cv.over(C('#0a0e1b'), cols.get(), 0.9)
    crowd(cv, cam, rng, (SX0, SX1) + T1, lower_pal, seat_col=seat1, fill=0.94, light=1.05 * lit, shade_top=0.18, sections=sections)
    mid = Mask()
    cam.quad(mid, [(SX0, T1[3], T1[2]), (SX0, T2[1], T2[0]), (SX1, T2[1], T2[0]), (SX1, T1[3], T1[2])])
    cv.over(C(mid_col), mid.get())
    crowd(cv, cam, rng, (SX0, SX1) + T2, upper_pal, seat_col=seat2, fill=0.86, light=0.82 * lit, shade_top=0.5)
    # 横断幕（2 層目の手すり）
    for bx_, txt, bg, fg in banners:
        bw = 3.0 + 1.25 * len(txt)
        bm = Mask()
        z0, z1 = T2[0] - 0.6 * d, T2[0]
        cam.quad(bm, [(bx_, T1[3] + 0.05, z0), (bx_, T2[1] + 0.2, z1), (bx_ + bw, T2[1] + 0.2, z1), (bx_ + bw, T1[3] + 0.05, z0)])
        g = bm.get()
        cv.over(C(bg), g)
        (x0_, y0_), (x1_, y1_) = cam.p(bx_, (T1[3] + T2[1]) / 2 + 0.1, (z0 + z1) / 2), cam.p(bx_ + bw, (T1[3] + T2[1]) / 2 + 0.1, (z0 + z1) / 2)
        hh = abs(cam.p(bx_, T2[1] + 0.2, z1)[1] - cam.p(bx_, T1[3] + 0.05, z0)[1])
        tm = Mask().text((x0_ + x1_) / 2, (y0_ + y1_) / 2, txt, hh * 0.7)
        cv.over(C(fg), tm.get() * g)
    if roof:
        # 屋根の裏（照明の照り返しで前ふちが明るい）
        under = Mask()
        cam.quad(under, [(SX0 - 3, RY, SZ0 - d * 7), (SX0 - 3, RY - 0.6, BZ + 2 * d), (SX1 + 3, RY - 0.6, BZ + 2 * d), (SX1 + 3, RY, SZ0 - d * 7)])
        um = under.get()
        _, ry0 = cam.p((SX0 + SX1) / 2, RY, SZ0 - d * 7)
        _, ry1 = cam.p((SX0 + SX1) / 2, RY - 0.6, BZ + 2 * d)
        ug = sstep(ry0, ry1, YY)
        cv.over(mix(np.broadcast_to(C(roof_lit), (H, W, 3)), np.broadcast_to(C(roof_dark), (H, W, 3)), ug), um)
        beams = Mask()
        for bx_ in np.arange(SX0, SX1 + 1, 6.5):
            cam.quad(beams, [(bx_ - 0.22, RY - 0.1, SZ0 - d * 7), (bx_ + 0.22, RY - 0.1, SZ0 - d * 7), (bx_ + 0.22, RY - 0.7, BZ + 2 * d), (bx_ - 0.22, RY - 0.7, BZ + 2 * d)])
        cv.over(C(beam_col), beams.get() * um, 0.75)
        edge = Mask()
        cam.quad(edge, [(SX0 - 3, RY - 0.1, SZ0 - d * 7), (SX0 - 3, RY + 1.8, SZ0 - d * 7), (SX1 + 3, RY + 1.8, SZ0 - d * 7), (SX1 + 3, RY - 0.1, SZ0 - d * 7)])
        cv.over(C(edge_col), edge.get())
    if lamp_row and roof:
        lamps = Mask()
        for lx in np.arange(SX0, SX1 + 0.1, 3.2):
            px, py = cam.p(lx, RY - 0.35, SZ0 - d * 7.2)
            dz = cam.depth(lx, RY, SZ0 - d * 7)
            r = max(1.6, 300 / dz)
            lamps.ellipse(px, py, r, r * 0.75)
        lm = lamps.get()
        cv.add(C('#fffaf0'), lm, 3.0)
        cv.add(C('#ffecc8'), blur(lm, 5), 2.4)
        cv.add(C('#ffdcaa'), blur(lm, 22), 2.0)
        cv.add(C('#c9b8ff'), blur(lm, 70), 0.9)
    # 客席の前の壁（電光の広告板）
    wall = Mask()
    cam.quad(wall, [(SX0 - 6, 0, SZ0 - d * 1.5), (SX0 - 6, 1.25, SZ0 - d * 0.2), (SX1 + 6, 1.25, SZ0 - d * 0.2), (SX1 + 6, 0, SZ0 - d * 1.5)])
    cv.over(C(wall_col), wall.get())
    if wall_leds:
        led_cols = ['#2f6cf5', '#13a06a', '#e9eef8', '#f0b429', '#2f6cf5', '#e8453c', '#0f2a6b']
        lc = np.zeros((H, W, 3), np.float32)
        la = np.zeros((H, W), np.float32)
        for i, lx in enumerate(np.arange(SX0 - 4, SX1 + 4, 8.0)):
            mm = Mask()
            cam.quad(mm, [(lx, 0.2, SZ0 - d * 1.3), (lx, 1.05, SZ0 - d * 0.35), (lx + 7.6, 1.05, SZ0 - d * 0.35), (lx + 7.6, 0.2, SZ0 - d * 1.3)])
            g = mm.get()
            lc += g[..., None] * C(led_cols[i % len(led_cols)])
            la = np.maximum(la, g)
        pat = 0.8 + 0.2 * np.sin(XX * 0.35 + YY * 0.2)
        cv.over(lc * pat[..., None] / np.maximum(la, 1e-3)[..., None], la)
        cv.add(C('#9fb8ff'), blur(la, 10), 0.35)
    return T1, T2


def light_tower(cv, cam, TX, TZ, TH, rows=4, cols=7, flare=1.0):
    tm = Mask()
    bx, by = cam.p(TX, 0, TZ)
    tx, ty = cam.p(TX, TH, TZ)
    sc = 1180 / max(cam.depth(TX, TH, TZ), 1)
    w0, w1 = 3.2 * sc, 1.2 * sc
    tm.poly([(bx - w0 / 2, by), (tx - w1 / 2, ty), (tx + w1 / 2, ty), (bx + w0 / 2, by)])
    cv.over(C('#090d1d'), tm.get())
    hw, hh = 5.5 * sc, 3.3 * sc
    cv.over(C('#121a33'), Mask().rect(tx - hw, ty - hh, tx + hw, ty + 0.4 * sc).get())
    lamps = Mask()
    for r in range(rows):
        for c in range(cols):
            lx = tx - hw + 0.8 * sc + c * (2 * hw - 1.6 * sc) / (cols - 1)
            ly = ty - hh + 0.7 * sc + r * (hh - 0.6 * sc) / (rows - 1) * 0.95
            lamps.ellipse(lx, ly, 0.36 * sc, 0.3 * sc)
    lm = lamps.get()
    cy = ty - hh / 2
    cv.add(C('#fff8ea'), lm, 3.0)
    cv.add(C('#fff1d0'), blur(lm, 8), 2.6)
    cv.add(C('#ffe7bd'), glow(tx, cy, 90, 70, 1.8), 0.7 * flare)
    cv.add(C('#d9c8ff'), glow(tx, cy, 380, 300, 2.0), 0.18 * flare)
    st = np.exp(-np.abs(YY - cy) / 1.2) * np.exp(-np.abs(XX - tx) / 260)
    st += np.exp(-np.abs(XX - tx) / 1.2) * np.exp(-np.abs(YY - cy) / 140)
    d1 = (XX - tx + (YY - cy)) / 1.414
    d2 = (XX - tx - (YY - cy)) / 1.414
    st += 0.5 * np.exp(-np.abs(d1) / 1.0) * np.exp(-np.abs(d2) / 90) + 0.5 * np.exp(-np.abs(d2) / 1.0) * np.exp(-np.abs(d1) / 90)
    cv.add(C('#fff3dc'), st, 0.55 * flare)
    return tx, cy


def scene_stadium(rng):
    cv = Canvas()
    hz = 330
    cam = Cam((12, 9.0, -24), 13, 1180, hz)
    sky(cv, '#050a1c', '#0e1b42', '#2a3d75', hz, 0.62)
    stars = (rng.random((H, W)) > 0.9992).astype(np.float32) * sstep(220, 30, YY)
    cv.add(C('#cfd8ff'), blur(stars, 0.6) * 3.0, 0.9)
    haze = fbm(rng, 6, 4, 4)
    cv.add(C('#22306a'), sstep(-0.6, 1.6, haze) * sstep(20, 300, YY), 0.35)
    # 照明塔（スタンドの後ろから頭を出す）
    towers = [light_tower(cv, cam, 22, 128, 44), light_tower(cv, cam, 112, 124, 46)]
    # 芝と線
    X, Z, dist = grass_field(cv, cam, rng, base='#2c7a3e', light='#47a056', dark='#21672f', stripe=5.0, stripe_axis='X',
                             stripe_k=0.085, far_haze='#2f5f45', haze_dist=240)
    lit = sstep(-90, 20, X) * sstep(140, 30, X) * sstep(95, 20, Z)
    cv.c = cv.c * (0.72 + 0.36 * lit)[..., None]
    apron = sstep(72.6, 73.2, Z) * (YY > hz)
    cv.mul(C('#7f8f84'), apron, 0.6)
    lm = field_lines(cam, Mask(), rugby_pitch_lines((-50, 50), (0, 70))).get()
    cv.over(C('#f2f5ef'), lm, 0.92)
    # スタンド
    stadium_stand(cv, cam, rng, -95, 190, 75, 27.0,
                  ['#1d2f6e', '#f2f2f2', '#2a4ba0', '#c9d6f2', '#203a7c', '#f2f2f2', '#d93d3d', '#ffd54d', '#3d6e3d'],
                  ['#1d2f6e', '#f2f2f2', '#d93d3d', '#c9d6f2', '#5a5f6e', '#f2f2f2', '#2a4ba0', '#e7a33a'],
                  [(-30, 6, ['#1d2f6e', '#f4f4f4', '#22397f', '#1d2f6e']), (40, 78, ['#b3262e', '#f2f2f2', '#b3262e', '#ffd54d'])],
                  [(-44, '必勝', '#f4f1e6', '#1d2f6e'), (-30, '桜丘', '#1d2f6e', '#ffffff'), (-12, '一意専心', '#f4f1e6', '#b3262e'),
                   (12, '闘魂', '#b3262e', '#ffffff'), (32, '青春', '#f4f1e6', '#2e7d4f'), (50, '全員ラグビー', '#1d2f6e', '#ffd54d'),
                   (82, '前進', '#f4f1e6', '#1d2f6e')])
    # ゴールポスト（右の 22m の先）と影（両側の照明塔から）
    goal_posts(cv, cam, 50, 35, rng, height=16, pad='#1d3d8f', light_dir=1, shadow=(-0.16, -0.5), shade_k=0.35, glow_k=0.2)
    # 手前の芝の上のボールとキッキングティー
    bx, by = 540, 700
    tee = Mask().poly([(bx - 30, by + 30), (bx + 30, by + 30), (bx + 18, by + 6), (bx - 18, by + 6)]).get()
    cv.mul(C('#000000'), blur(Mask().ellipse(bx + 20, by + 34, 70, 14).get(), 6), 0.55)
    cv.over(C('#f26a1b'), tee)
    cv.mul(C('#000000'), tee * sstep(by + 6, by + 30, YY), 0.35)
    ball(cv, bx, by - 22, 54, rot=-62, shadow_k=0.0, ground=False)
    # 夜の空気（照明のもや）
    for tx, ty in towers:
        cv.add(C('#8394c9'), glow(tx, ty + 180, 560, 420, 2.2), 0.09)
    cv.add(C('#8ea4d8'), sstep(hz - 200, hz + 40, YY) * sstep(hz + 220, hz + 10, YY), 0.045)
    return finish(cv, rng, exposure=1.0, bloom_thr=0.8, vignette=0.42, grain=0.013)



# ---------------------------------------------------------------- 場面：花園（冬の昼・全国大会。ゴール裏から）
def ridge(cv, rng, y0, amp, col, cells=8, octv=5, x_off=0, sharp=1.0, alpha=1.0, base=None):
    """山並みのシルエット（上のふちを乱数でぎざぎざに）。戻り値はマスク"""
    n = fbm(rng, cells, 1, octv, 0.55, w=W, h=1)[0]
    if sharp != 1.0:
        n = np.sign(n) * np.abs(n) ** sharp
    top = y0 - amp * (n - n.min()) / (np.ptp(n) + 1e-6)
    m = sstep(top[None, :] - 0.8, top[None, :] + 0.8, YY)
    if base is not None:
        m = m * (YY < base)
    cv.over(C(col) if isinstance(col, str) else col, m, alpha)
    return m, top


def scene_hanazono(rng):
    cv = Canvas()
    hz = 352
    cam = Cam((-84, 8.5, 35), 90, 1180, hz)
    # 冬の澄んだ空
    sky(cv, '#1b56b8', '#4f8fdc', '#cfe5f4', hz, 0.62)
    cir = fbm(rng, 5, 10, 5, 0.6)
    cir_m = sstep(0.5, 1.6, cir) * sstep(40, 140, YY) * sstep(330, 170, YY)
    cv.over(C('#ffffff'), blur(cir_m, 6, 1.5), 0.35)
    # 太陽（右の屋根の上）
    sx, sy = 1290, 96
    cv.add(C('#fffaf0'), glow(sx, sy, 16, 16, 2.6), 1.6)
    cv.add(C('#fff0cf'), glow(sx, sy, 90, 90, 2.0), 0.35)
    cv.add(C('#ffe7b8'), glow(sx, sy, 300, 240, 1.8), 0.12)
    # 山並み（生駒のような低い山・電波塔）
    m1, top1 = ridge(cv, rng, hz - 8, 46, '#9bb8d6', cells=5, octv=5, alpha=1.0)
    m2, top2 = ridge(cv, rng, hz + 6, 34, '#6f90b0', cells=7, octv=5, alpha=1.0)
    towers = Mask()
    for tx_ in (860, 902, 930, 1012):
        ty_ = top1[int(tx_)] + 2
        hh = rng.uniform(26, 44)
        towers.line([(tx_, ty_), (tx_, ty_ - hh)], 1.6)
    cv.over(C('#7d8fa6'), towers.get())
    rb = Mask()
    for tx_ in (860, 902, 930, 1012):
        ty_ = top1[int(tx_)] + 2
        rb.rect(tx_ - 1.2, ty_ - 38, tx_ + 1.2, ty_ - 33)
    cv.over(C('#d0534a'), rb.get(), 0.7)
    # 芝（冬の芝。手前ほど濃い）と線
    X, Z, dist = grass_field(cv, cam, rng, base='#3f8c45', light='#58a557', dark='#2f753a', stripe=5.0, stripe_axis='X',
                             stripe_k=0.11, far_haze='#a9c7a6', haze_dist=260)
    lm = field_lines(cam, Mask(), rugby_pitch_lines((-50, 50), (0, 70))).get()
    cv.over(C('#f6f7f2'), lm, 0.95)
    # 向こうのゴール裏：低いスタンド（観客）と大きな画面
    back_e = Mask()
    cam.quad(back_e, [(70, 0, -40), (86, 11, -40), (86, 11, 110), (70, 0, 110)])
    cv.over(C('#3a4458'), back_e.get())
    crowd(cv, cam, rng, (-40, 110, 70, 0.6, 86, 10.6), ['#1d2f6e', '#f2f2f2', '#d93d3d', '#c9d6f2', '#5b3a8e', '#f2f2f2', '#e7a33a', '#3d6e3d'],
          seat_col='#2c4f86', fill=0.8, light=1.1, shade_top=0.2, swap=True)
    frame = Mask()
    cam.quad(frame, [(86.5, 9, 19), (86.5, 19, 19), (86.5, 19, 51), (86.5, 9, 51)])
    cv.over(C('#151a24'), frame.get())
    legs = Mask()
    for zz in (22, 48):
        cam.quad(legs, [(86.5, 0, zz - 0.4), (86.5, 9, zz - 0.4), (86.5, 9, zz + 0.4), (86.5, 0, zz + 0.4)])
    cv.over(C('#151a24'), legs.get())
    scr = Mask()
    cam.quad(scr, [(86.4, 9.6, 20), (86.4, 18.4, 20), (86.4, 18.4, 50), (86.4, 9.6, 50)])
    scm = scr.get()
    (sx0_, sy0_), (sx1_, sy1_) = cam.p(86.4, 18.4, 50), cam.p(86.4, 9.6, 20)
    scol = mix(np.broadcast_to(C('#0d2a6e'), (H, W, 3)), np.broadcast_to(C('#1d56c4'), (H, W, 3)), sstep(sy0_, sy1_, YY))
    cv.over(scol, scm)
    th = abs(sy1_ - sy0_)
    cv.over(C('#ffffff'), Mask().text((sx0_ + sx1_) / 2, sy0_ + th * 0.42, '花園', th * 0.5).get() * scm)
    cv.over(C('#ffd54d'), Mask().text((sx0_ + sx1_) / 2, sy0_ + th * 0.82, 'KICK OFF 14:10', th * 0.16).get() * scm)
    cv.add(C('#7fa6ff'), blur(scm, 6), 0.25)
    # 両側の大スタンド（左＝日なた、右＝日かげ）
    banners_l = [(-44, '全国制覇', '#f4f1e6', '#b3262e'), (-24, '桜丘', '#1d2f6e', '#ffffff'), (-8, '必勝', '#f4f1e6', '#1d2f6e'),
                 (6, '花園', '#b3262e', '#ffffff'), (20, '感謝', '#f4f1e6', '#2e7d4f'), (34, '飛翔', '#1d2f6e', '#ffd54d'),
                 (48, '不撓不屈', '#f4f1e6', '#5b3a8e')]
    banners_r = [(-46, '北辰', '#5b3a8e', '#ffffff'), (-30, '結束', '#f4f1e6', '#5b3a8e'), (-14, '日本一', '#f4f1e6', '#b3262e'),
                 (2, '闘志', '#2e7d4f', '#ffffff'), (16, '前へ', '#f4f1e6', '#1d2f6e'), (30, '一丸', '#d97b16', '#ffffff')]
    pal_l = ['#1d2f6e', '#f2f2f2', '#2a4ba0', '#c9d6f2', '#203a7c', '#f2f2f2', '#d93d3d', '#ffd54d', '#3d6e3d', '#7a4b2a']
    pal_r = ['#5b3a8e', '#f2f2f2', '#2a4ba0', '#d93d3d', '#c9d6f2', '#3d6e3d', '#f2f2f2', '#e7a33a', '#29303f']
    stadium_stand(cv, cam, rng, -82, 72, 76, 27.5, pal_l, pal_l,
                  [(-40, -4, ['#1d2f6e', '#f4f4f4', '#22397f', '#1d2f6e', '#ffffff'])], banners_l,
                  seat1='#3a6fb0', seat2='#3a6fb0', roof_lit='#7f8a9b', roof_dark='#3f4858', lamp_row=False, lit=1.35,
                  d=1, back_col='#4a5568', mid_col='#8c97a8', edge_col='#d9dfe7', wall_col='#2b3346', beam_col='#363f4e')
    stadium_stand(cv, cam, rng, -82, 72, -6, 26.0, pal_r, pal_r,
                  [(-20, 18, ['#5b3a8e', '#f4f4f4', '#5b3a8e', '#ffd54d'])], banners_r,
                  seat1='#2c4f86', seat2='#2c4f86', roof_lit='#5d6878', roof_dark='#2c3442', lamp_row=False, lit=0.62,
                  d=-1, back_col='#232a38', mid_col='#3a4252', edge_col='#9aa6b5', wall_col='#1d2433', beam_col='#262d3a', roof=False)
    # 右のスタンドの屋根の影（芝の右側が日かげ）
    shade = sstep(14.5, 13.0, Z) * (YY > hz)
    cv.mul(C('#7f93b8'), shade, 0.62)
    # ゴールポスト（手前・中央）
    goal_posts(cv, cam, -50, 35, rng, height=16, pad='#1d3d8f', light_dir=-1, shadow=(0.10, 0.62), shade_k=0.3)
    goal_posts(cv, cam, 50, 35, rng, height=16, pad='#1d3d8f', light_dir=-1, shade_k=0.3)
    # ゴールラインの上のボール
    bx, by = cam.p(-55.5, 0, 35.6)
    ball(cv, bx, by - 18, 50, rot=-10, shadow_k=0.55, light=(0.6, -0.7))
    # 冬の光（右上からの淡いにじみと、全体の澄んだ寒色）
    cv.add(C('#fff0d0'), glow(sx, sy, 520, 420, 2.0), 0.08)
    return finish(cv, rng, exposure=1.0, bloom_thr=0.92, bloom=((6, 0.3), (20, 0.2), (60, 0.12)), vignette=0.32, grain=0.011, sat=0.93)


# ---------------------------------------------------------------- 場面：4月（桜の咲く校庭）
SAKURA = [(0.0, '#c98aa2'), (0.3, '#e8b0c2'), (0.55, '#f6cbd8'), (0.8, '#fde4ec'), (1.0, '#fff8fa')]


def scene_spring(rng):
    cv = Canvas()
    hz = 448
    cam = Cam((0, 1.6, -4), 4, 1180, hz)
    nf = fbm(rng, 260, 130, 3)
    nm = fbm(rng, 70, 35, 3)
    sky(cv, '#4f97e0', '#9ccaf0', '#eef6fb', hz, 0.6)
    cumulus(cv, rng, [(1010, 150, 150, 60), (1120, 120, 120, 70), (1230, 160, 140, 55), (900, 180, 110, 40)],
            lit='#ffffff', shade='#c4d6ea', detail=0.7, soft=0.16, alpha=0.95)
    cumulus(cv, rng, [(560, 250, 120, 34), (650, 236, 90, 40), (730, 258, 110, 30)], lit='#ffffff', shade='#cbdcee',
            detail=0.7, soft=0.2, alpha=0.8)
    cv.add(C('#fff8e8'), glow(300, 40, 500, 300, 2.0), 0.18)
    ridge(cv, rng, hz - 26, 40, '#a7c1d2', cells=4, octv=5)
    ridge(cv, rng, hz - 6, 26, '#8fb0a6', cells=7, octv=5)
    # 校舎と体育館
    gymnasium(cv, cam, -112, -66, 160, roof='#4f8a86', lit=1.0).comp(cv, 0.5, '#d9e8f2', 0.28)
    school_building(cv, cam, rng, -58, 70, 150, floors=4, tower=10, curtains=0.2).comp(cv, 0.4, '#dfeaf2', 0.22)
    # 奥の植え込み（濃い緑）
    hedge = Layer()
    for i in range(40):
        X = -160 + i * 8.5 + rng.uniform(-2, 2)
        bx, by = cam.p(X, 0, 118)
        sc = 1180 / cam.depth(X, 0, 118)
        crown(hedge, rng, bx, by - 2.2 * sc, 4.6 * sc, 2.4 * sc, [(0, '#2f5a3a'), (0.5, '#4f7d4c'), (1, '#86a86a')], nf, nm, n=8)
    hedge.comp(cv, 0.6, '#cfe0e6', 0.2)
    # 桜並木（フェンスの向こう）
    row = Layer()
    xs = np.arange(-150, 160, 13.5)
    for X in xs:
        X = X + rng.uniform(-2.5, 2.5)
        Z = 108 + rng.uniform(-3, 3)
        bx, by = cam.p(X, 0, Z)
        sc = 1180 / cam.depth(X, 0, Z)
        tree(row, rng, bx, by, 10.5 * sc, 12.5 * sc, SAKURA, nf, nm, trunk='#4a3a3d', depth=3, n=22, spread=0.55,
             crown_y=0.55, thr=0.52, cl=(0.16, 0.3))
    row.comp(cv, 0.5, '#f4e6ee', 0.1)
    # 防球ネット
    fence = Layer()
    net_fence(fence, cam, -160, 170, 100, 9.0, step=9.0, net_a=0.18)
    fence.comp(cv, 0.3)
    # 校庭（芝）と線・地面に散った花びら
    X, Z, dist = grass_field(cv, cam, rng, base='#5a9446', light='#6fa851', dark='#47803a', stripe=6.0, stripe_axis='Z',
                             stripe_k=0.05, far_haze='#b9d2a6', haze_dist=150)
    dirt = sstep(0.6, 1.4, fbm(rng, 9, 6, 4)) * sstep(12, 30, Z) * sstep(90, 60, Z) * (YY > hz)
    cv.over(C('#b39a74'), dirt, 0.35)
    lm = field_lines(cam, Mask(), [(-40, 20, 70, 20), (-40, 20, -40, 92), (70, 20, 70, 92), (15, 20, 15, 92), (-40, 92, 70, 92)], 0.11).get()
    cv.over(C('#f4f4ee'), lm, 0.75)
    gp = (YY > hz + 4).astype(np.float32)
    particles(cv, rng, 900, (0, hz + 6, W, H), (1.2, 3.2), ['#fbd3df', '#f6b8cb', '#ffffff'], aspect=0.45, k_mask=gp)
    # ゴールポスト（正面向き）と練習の道具
    goal_posts(cv, cam, -15, 44, rng, height=12, along_x=True, light_dir=-1, shadow=(0.22, -0.18), shadow_k=0.35,
               shade_k=0.45, post='#f4f4f0')
    for X, Z in ((-7, 38), (-4.8, 37.4)):
        tackle_bag(cv, cam, X, Z)
    tackle_bag(cv, cam, -2.2, 35, lying=True)
    for i in range(6):
        cone(cv, cam, -4 + i * 3.4, 34)
    ball(cv, 520, 690, 46, rot=-22, shadow_k=0.45, light=(-0.6, -0.7))
    # 手前の大きな桜（右の上から枝がかかる）の木陰
    shade = Mask().ellipse(1330, 760, 420, 70).get() * (fbm(rng, 30, 14, 3) > -0.2)
    cv.mul(C('#5c7f6a'), blur(shade, 10), 0.35)
    big = Layer()
    mk = Mask()
    ends = []
    mk.poly([(1505, 820), (1540, 420), (1590, 420), (1650, 820)])
    for a0, L, w0 in ((2.45, 240, 30), (2.85, 230, 22), (2.0, 200, 24), (1.55, 170, 20)):
        branch_tree(mk, rng, 1565, 430, a0, L, w0, 4, ends, 0.42, 0.72)
    tm = mk.get()
    big.over(C('#47373a'), tm)
    bark = 0.75 + 0.5 * sstep(1520, 1610, XX) * 0 + 0.25 * fbm(rng, 40, 120, 3)
    big.mul(C('#1d1517'), tm * sstep(1560, 1640, XX), 0.5)
    pts = [(ex, ey, L) for ex, ey, L in ends]
    nf2 = fbm(rng, 110, 55, 3)
    nm2 = fbm(rng, 36, 18, 3)
    crown(big, rng, 1400, 95, 250, 140, SAKURA, nf2, nm2, light=(-0.7, -0.7), pts=pts, n=10, detail=0.75, thr=0.48,
          edge=0.05, cl=(0.1, 0.2), speck=0.5, bottom_dark=0.2)
    big.comp(cv)
    # 舞う花びら（中景はくっきり、手前の大きいものはぼかす）
    air = sstep(250, 700, XX) * 1.0 + 0.0
    particles(cv, rng, 140, (380, 60, W, hz + 120), (2.5, 4.5), ['#ffd9e6', '#fbc6d6', '#ffffff'], aspect=0.5, k_mask=air)
    particles(cv, rng, 10, (700, 120, W, H), (10, 18), ['#ffd3e1', '#ffe6ee'], aspect=0.55, blur_s=5, alpha=0.75)
    cv.add(C('#fff4e6'), glow(1250, 60, 700, 400, 2.0), 0.08)
    return finish(cv, rng, exposure=1.02, bloom_thr=0.92, vignette=0.28, grain=0.01, sat=0.92, tint=(1.01, 1.0, 1.0))



def flower_head(lay, rng, x, y, r, stops, cell=0.2, light=(-0.6, -0.8), lobes=4, gap='#2a2550', nm=None):
    """小花が集まった丸い房（紫陽花）。cell = 小花の大きさ（房の半径に対する比）"""
    x0, x1 = int(max(0, x - r * 1.3)), int(min(W, x + r * 1.3))
    y0, y1 = int(max(0, y - r * 1.3)), int(min(H, y + r * 1.3))
    if x1 - x0 < 2 or y1 - y0 < 2:
        return
    ly, lx = YY[y0:y1, x0:x1], XX[y0:y1, x0:x1]
    d = np.sqrt(((lx - x) / r) ** 2 + ((ly - y) / (r * 0.88)) ** 2)
    if nm is not None:
        d = d + nm[y0:y1, x0:x1] * 0.06
    a = sstep(1.0, 0.9, d)
    c = r * cell
    gx, gy = np.floor(lx / c), np.floor(ly / c)
    best = np.full(lx.shape, 1e9, np.float32)
    bx = np.zeros(lx.shape, np.float32)
    by = np.zeros(lx.shape, np.float32)
    bh = np.zeros(lx.shape, np.float32)
    for oy in (-1, 0, 1):
        for ox in (-1, 0, 1):
            cx_, cy_ = gx + ox, gy + oy
            h1 = (np.sin(cx_ * 127.1 + cy_ * 311.7) * 43758.5453) % 1.0
            h2 = (np.sin(cx_ * 269.5 + cy_ * 183.3) * 24634.6345) % 1.0
            px, py = (cx_ + 0.2 + h1 * 0.6) * c, (cy_ + 0.2 + h2 * 0.6) * c
            dd = (lx - px) ** 2 + (ly - py) ** 2
            sel = dd < best
            best = np.where(sel, dd, best)
            bx = np.where(sel, px, bx)
            by = np.where(sel, py, by)
            bh = np.where(sel, h1, bh)
    dist = np.sqrt(best)
    th = np.arctan2(ly - by, lx - bx)
    rho = c * 0.62 * (0.62 + 0.38 * np.abs(np.cos(lobes / 2 * (th - bh * 6.283))))
    pet = sstep(rho, rho * 0.8, dist)
    lxv, lyv = light
    li = 0.62 - ((lx - x) * lxv + (ly - y) * lyv) / r * 0.0 - ((lx - x) / r * lxv * -0.35 + (ly - y) / r * lyv * -0.4)
    li = li - sstep(0.4, 1.0, d) * 0.25 + (bh - 0.5) * 0.25 + (1 - dist / max(rho.max(), 1e-3)) * 0.1
    col = ramp(stops, li)
    col = col * (0.55 + 0.45 * pet)[..., None] + C(gap) * (1 - pet)[..., None] * 0.45
    lay.over(col, a, box=(y0, x0))


def leaf(lay, x, y, L, w, ang, col='#2f5a36', hi='#5e8f55', dark='#1d3a24'):
    ca, sa = math.cos(ang), math.sin(ang)
    pts = []
    for t in np.linspace(0, 1, 16):
        pts.append((x + ca * L * t - sa * w * math.sin(math.pi * t) ** 0.8, y + sa * L * t + ca * w * math.sin(math.pi * t) ** 0.8))
    for t in np.linspace(1, 0, 16):
        pts.append((x + ca * L * t + sa * w * math.sin(math.pi * t) ** 0.8, y + sa * L * t - ca * w * math.sin(math.pi * t) ** 0.8))
    m = Mask().poly(pts).get()
    side = ((XX - x) * -sa + (YY - y) * ca) > 0
    lay.over(np.where(side[..., None], C(col), C(dark)), m)
    rib = Mask().line([(x, y), (x + ca * L * 0.9, y + sa * L * 0.9)], max(1.0, w * 0.08)).get()
    lay.over(C(hi), rib * m, 0.6)


# ---------------------------------------------------------------- 場面：6月（梅雨の校庭）
AJISAI = [(0.0, '#3b3f8f'), (0.35, '#5a64c4'), (0.65, '#8b8fe0'), (0.85, '#b9a4e8'), (1.0, '#e2d6f6')]
AJISAI2 = [(0.0, '#4a3a8a'), (0.4, '#8a62c8'), (0.7, '#b48ae0'), (1.0, '#ecdcf8')]
LEAF = [(0.0, '#1f3d27'), (0.4, '#2f5a36'), (0.75, '#4d7d48'), (1.0, '#7ea56a')]


def rain(cv, rng, n, length, width, alpha, ang=0.18, box=(0, 0, W, H), blur_s=0.0, col='#e8eef5'):
    m = Mask()
    x0, y0, x1, y1 = box
    for i in range(n):
        x, y = rng.uniform(x0 - 60, x1), rng.uniform(y0 - length, y1)
        L = length * rng.uniform(0.6, 1.3)
        m.line([(x, y), (x + math.sin(ang) * L, y + math.cos(ang) * L)], width * rng.uniform(0.7, 1.2))
    mm = m.get()
    if blur_s:
        mm = blur(mm, blur_s)
    cv.add(C(col), mm, alpha)


def scene_tsuyu(rng):
    cv = Canvas()
    hz = 430
    cam = Cam((0, 1.5, -4), -6, 1180, hz)
    nf = fbm(rng, 260, 130, 3)
    nm = fbm(rng, 70, 35, 3)
    # 低い雨雲（層になった灰色）
    sky(cv, '#7d8a99', '#a9b4bf', '#d3d9de', hz, 0.6)
    st = fbm(rng, 4, 8, 6, 0.6)
    st2 = fbm(rng, 3, 12, 5, 0.55)
    cloud = sstep(-0.4, 1.4, st) * sstep(hz, 60, YY)
    cv.over(C('#6c7886'), cloud, 0.45)
    cv.over(C('#dfe4e8'), sstep(0.6, 1.8, st2) * sstep(hz, 120, YY), 0.35)
    ridge(cv, rng, hz - 20, 34, '#9aa6ad', cells=4, octv=5)
    # 雨にかすむ校舎と体育館
    gymnasium(cv, cam, -100, -58, 150, roof='#566e70', lit=0.82).comp(cv, 1.0, '#b8c2c9', 0.45)
    school_building(cv, cam, rng, -50, 78, 140, floors=4, tower=18, curtains=0.12, lit=0.86, win_dark=0.25,
                    glass=('#b9c7d1', '#55687a')).comp(cv, 1.0, '#bcc6cc', 0.42)
    # 青々とした並木と植え込み
    row = Layer()
    for X in np.arange(-150, 170, 12.0):
        X = X + rng.uniform(-2, 2)
        Z = 112 + rng.uniform(-3, 3)
        bx, by = cam.p(X, 0, Z)
        sc = 1180 / cam.depth(X, 0, Z)
        tree(row, rng, bx, by, 11 * sc, 11 * sc, LEAF, nf, nm, trunk='#2e2a26', depth=3, n=22, thr=0.5, cl=(0.18, 0.32))
    row.comp(cv, 1.2, '#aab6b9', 0.38)
    fence = Layer()
    net_fence(fence, cam, -160, 170, 100, 9.0, step=9.0, net_a=0.14, pole='#5d6863')
    fence.comp(cv, 0.6, '#b0babd', 0.2)
    # ぬれた芝と水たまり
    X, Z, dist = grass_field(cv, cam, rng, base='#3f7340', light='#4f8a4a', dark='#2f5e33', stripe=6.0, stripe_axis='Z',
                             stripe_k=0.04, far_haze='#9fb0a8', haze_dist=120)
    wet = fbm(rng, 14, 9, 5)
    # 地面の座標で水たまりの形を決める（遠いほど細長く見える）
    pud_n = vnoise(rng, 9, 4, 1, 1)
    gx = np.clip((X + 80) / 200 * 64, 0, 63.99)
    gz = np.clip(Z / 100 * 48, 0, 47.99)
    pud_field = np.asarray(Image.fromarray(rng.random((50, 66)).astype(np.float32), 'F').resize((66 * 8, 50 * 8), Image.BICUBIC))
    pv = pud_field[np.clip((gz * 8).astype(int), 0, 50 * 8 - 1), np.clip((gx * 8).astype(int), 0, 66 * 8 - 1)]
    pud = sstep(0.80, 0.83, pv) * (YY > hz + 3) * sstep(5, 10, Z) * sstep(48, 30, Z)
    pud = blur(pud, 0.8)
    rim = np.clip(blur(pud, 5) * 1.7 - pud, 0, 1)
    cv.mul(C('#3f3d30'), rim, 0.6)
    # 水たまりは上の景色を逆さに映す（地平線で折り返す。少し暗く、波でゆらす）
    yy_ref = np.clip(2 * hz - YY + 6 + (nf * 2.0), 0, hz - 1).astype(int)
    xx_ref = np.clip(XX + nf * 2.5, 0, W - 1).astype(int)
    refl = cv.c[yy_ref, xx_ref] * 0.82 + C('#3a4552') * 0.1
    refl = blur(refl, 0.9)
    cv.over(refl, pud, 0.95)
    # ぬれた芝の照り
    cv.add(C('#c9d6dc'), sstep(0.3, 1.6, wet) * (YY > hz) * sstep(hz, hz + 200, YY), 0.06)
    lm = field_lines(cam, Mask(), [(-60, 18, 70, 18), (-60, 18, -60, 92), (5, 18, 5, 92), (-60, 92, 70, 92)], 0.11).get()
    cv.over(C('#e9ece6'), lm * (1 - pud), 0.6)
    # ゴールポスト（水たまりに映る）と道具
    goal_posts(cv, cam, 18, 54, rng, height=13, along_x=True, light_dir=-1, shadow=None, reflect=pud, post='#eef0ee')
    for X, Z in ((7, 47), (9.5, 46.5)):
        tackle_bag(cv, cam, X, Z, col='#22356f')
    tackle_bag(cv, cam, 12.5, 44, lying=True, col='#22356f')
    for i in range(5):
        cone(cv, cam, -18 + i * 3.4, 30)
    ball(cv, 980, 664, 48, rot=-30, shadow_k=0.25, light=(-0.4, -0.8))
    # 波紋
    rip = Mask()
    for i in range(140):
        x, y = rng.uniform(0, W), rng.uniform(hz + 10, H)
        if pud[int(y), int(x)] < 0.5:
            continue
        r = rng.uniform(4, 14) * (y - hz) / 300
        rip.d.ellipse([(x - r) * SS, (y - r * 0.32) * SS, (x + r) * SS, (y + r * 0.32) * SS], outline=255, width=SS)
    cv.add(C('#ffffff'), rip.get() * pud, 0.35)
    # 手前の紫陽花（左下と右下）
    def bush(xs, ys, rs, heads, blur_s=0.0):
        lay = Layer()
        for i in range(len(xs) * 3):
            j = i % len(xs)
            leaf(lay, xs[j] + rng.uniform(-rs, rs), ys[j] + rng.uniform(-rs * 0.2, rs * 0.9), rng.uniform(rs * 0.7, rs * 1.2),
                 rng.uniform(rs * 0.22, rs * 0.32), rng.uniform(-2.8, -0.3), col=['#2f5a36', '#355f3a', '#2a5232'][i % 3])
        for (hx, hy, hr, pal) in heads:
            flower_head(lay, rng, hx, hy, hr, pal, cell=0.24, nm=nm)
        lay.comp(cv, blur_s)
    heads = []
    for i in range(9):
        heads.append((rng.uniform(-10, 330), rng.uniform(590, 790), rng.uniform(42, 64), AJISAI if i % 3 else AJISAI2))
    heads.sort(key=lambda t: t[1])
    bush([40, 150, 260, 330], [700, 740, 760, 790], 70, heads)
    heads2 = [(1500, 700, 56, AJISAI2), (1585, 660, 62, AJISAI), (1560, 770, 60, AJISAI2)]
    bush([1480, 1580, 1540], [740, 720, 800], 70, heads2, blur_s=1.2)
    # 雨（遠くは細かく、手前は長くぼかす）
    rain(cv, rng, 2200, 26, 0.7, 0.10, box=(0, 0, W, H))
    rain(cv, rng, 500, 60, 1.1, 0.14, box=(0, 0, W, H), blur_s=0.6)
    rain(cv, rng, 70, 160, 2.2, 0.10, box=(0, 0, W, H), blur_s=1.8)
    # 湿った空気（全体に薄いもや）
    cv.over(C('#c7cfd5'), sstep(hz + 120, hz - 60, YY) * sstep(hz - 220, hz - 40, YY), 0.18)
    return finish(cv, rng, exposure=1.0, bloom_thr=0.95, vignette=0.32, grain=0.012, sat=0.9, tint=(0.98, 1.0, 1.02))



def worley(u, v, jitter=0.7):
    """升目ごとにずらした点までの最短距離（升目 1 の単位）と、その点の乱数"""
    gu, gv = np.floor(u), np.floor(v)
    best = np.full(u.shape, 9.0, np.float32)
    bh = np.zeros(u.shape, np.float32)
    for ov in (-1, 0, 1):
        for ou in (-1, 0, 1):
            cu, cv_ = gu + ou, gv + ov
            h1 = (np.sin(cu * 127.1 + cv_ * 311.7) * 43758.5453) % 1.0
            h2 = (np.sin(cu * 269.5 + cv_ * 183.3) * 24634.6345) % 1.0
            pu = cu + 0.5 + (h1 - 0.5) * jitter
            pv = cv_ + 0.5 + (h2 - 0.5) * jitter
            dd = np.sqrt((u - pu) ** 2 + (v - pv) ** 2)
            sel = dd < best
            best = np.where(sel, dd, best)
            bh = np.where(sel, h1, bh)
    return best, bh


# ---------------------------------------------------------------- 場面：10〜11月（秋の夕方の校庭）
ICHO = [(0.0, '#8a5a12'), (0.35, '#d19a1c'), (0.65, '#f2c43a'), (0.88, '#ffe27a'), (1.0, '#fff2b8')]
MOMIJI = [(0.0, '#5e1a14'), (0.35, '#a8321f'), (0.65, '#dc5a2a'), (0.88, '#f39242'), (1.0, '#ffc477')]


def scene_autumn(rng):
    cv = Canvas()
    hz = 452
    cam = Cam((0, 1.6, -4), 3, 1180, hz)
    nf = fbm(rng, 260, 130, 3)
    nm = fbm(rng, 70, 35, 3)
    sxs, sys_ = 1215, 392
    # 夕方の空：上は群青、地平と太陽のまわりは金色
    sky(cv, '#27407e', '#9a7a9a', '#ffc77a', hz, 0.55)
    d = radial(sxs, sys_, 900, 520)
    cv.add(C('#ffb35a'), np.clip(1 - d, 0, 1) ** 1.6, 0.55)
    # うろこ雲（空の面に並ぶ小さな雲。遠い＝地平に近いほど小さく詰まる）
    K = 9000.0
    hz0 = hz + 60
    vv = K / np.maximum(hz0 - YY, 1)
    uu = (XX - W / 2) * vv * 9.5 / K
    wd, wh = worley(uu + nm * 0.25, vv * 0.9 + nf * 0.12)
    mf = fbm(rng, 7, 5, 4)
    band = sstep(-0.5, 0.7, mf + (XX / W - 0.5) * 0.8) * sstep(20, 110, YY) * sstep(400, 280, YY)
    puff = sstep(0.52, 0.18, wd + (wh - 0.5) * 0.15) * band
    toward = np.clip(1 - radial(sxs, sys_, 1150, 760), 0, 1)
    core = sstep(0.45, 0.05, wd)
    ccol = ramp([(0.0, '#7d6c9c'), (0.35, '#d6939f'), (0.7, '#ffbd88'), (1.0, '#fff1cc')], toward * 0.95 + core * 0.08)
    cv.over(ccol, blur(puff, 0.8), 0.8)
    # 太陽（木立の上にかかる低い太陽）
    cv.add(C('#fff6dc'), glow(sxs, sys_, 26, 26, 2.6), 1.4)
    cv.add(C('#ffcf80'), glow(sxs, sys_, 150, 110, 1.8), 0.55)
    ridge(cv, rng, hz - 22, 40, '#8f7a96', cells=4, octv=5)
    ridge(cv, rng, hz - 6, 24, '#6f6680', cells=7, octv=5)
    # 校舎（夕日を横から受ける）
    sch = school_building(cv, cam, rng, -120, -10, 150, floors=4, tower=-62, curtains=0.22, lit=0.8,
                          glass=('#ffd9a0', '#7d6a6a'))
    sch.c = sch.c * C('#ffdcb8')
    sch.comp(cv, 0.4, '#d7a98f', 0.22)
    # 銀杏と紅葉の並木（右から光）
    row = Layer()
    for i, X in enumerate(np.arange(-150, 170, 11.5)):
        X = X + rng.uniform(-2, 2)
        Z = 108 + rng.uniform(-3, 3)
        bx, by = cam.p(X, 0, Z)
        sc = 1180 / cam.depth(X, 0, Z)
        pal = ICHO if (i % 3) != 1 else MOMIJI
        tree(row, rng, bx, by, (12 if pal is ICHO else 9) * sc, (8.5 if pal is ICHO else 11) * sc, pal, nf, nm, trunk='#3a2a22',
             light=(0.75, -0.4), depth=3, n=22, thr=0.5, cl=(0.18, 0.32), speck=0.45)
    row.comp(cv, 0.5, '#e6b080', 0.12)
    fence = Layer()
    net_fence(fence, cam, -160, 170, 100, 9.0, step=9.0, net_a=0.14, pole='#5a4d48', net='#3a302c')
    fence.comp(cv, 0.4)
    # 芝（少し枯れた色）と夕日の照り
    X, Z, dist = grass_field(cv, cam, rng, base='#6a8a3c', light='#86a046', dark='#55702f', stripe=6.0, stripe_axis='Z',
                             stripe_k=0.05, far_haze='#d8b07a', haze_dist=150, gold=0.55)
    sun_on = np.clip(1 - radial(sxs, hz + 40, 900, 260), 0, 1)
    cv.add(C('#ffb45a'), sun_on * (YY > hz), 0.25)
    lm = field_lines(cam, Mask(), [(-60, 18, 70, 18), (-60, 18, -60, 92), (5, 18, 5, 92), (-60, 92, 70, 92)], 0.11).get()
    cv.over(C('#f6eedf'), lm, 0.7)
    # 並木の長い影（右奥の太陽から手前左へ）
    shadow = Mask()
    for X in np.arange(-150, 170, 11.5):
        cam.quad(shadow, [(X - 2.8, 0, 100), (X + 2.8, 0, 100), (X - 9, 0, 40), (X - 17, 0, 40)])
    cv.mul(C('#6a5a7a'), blur(shadow.get(), 3) * (YY > hz), 0.35)
    # 落ち葉
    gp = (YY > hz + 4).astype(np.float32)
    particles(cv, rng, 700, (0, hz + 6, W, H), (1.4, 3.6), ['#f2c43a', '#e9a12a', '#d85a28', '#b8361f'], aspect=0.6, k_mask=gp)
    # ゴールポスト（中央の左。長い影が手前へ伸びる）と道具
    goal_posts(cv, cam, -14, 52, rng, height=13, along_x=True, light_dir=-1, shadow=(-0.3, -2.4), shadow_col='#4a3d5a',
               shadow_k=0.55, post='#fff4e2', shadow_w=0.34)
    for X, Z in ((-27, 46), (-24.5, 45.5)):
        tackle_bag(cv, cam, X, Z, light=1)
    tackle_bag(cv, cam, -21.5, 43, lying=True)
    ball(cv, 1010, 676, 48, rot=-16, shadow_k=0.45, light=(0.7, -0.5))
    # ポストと道具の右側に夕日のふち
    cv.add(C('#ffb060'), glow(sxs, sys_, 1400, 600, 2.0) * (YY > hz - 220), 0.06)
    # 舞う葉（手前は大きくぼかす）
    air = sstep(300, 800, XX)
    particles(cv, rng, 34, (420, 300, W, hz + 200), (3.0, 6.0), ['#f2c43a', '#ffd25a', '#e07a2a', '#c8402a'], aspect=0.55, k_mask=air)
    particles(cv, rng, 8, (700, 140, W, H), (12, 20), ['#f2c43a', '#e07a2a'], aspect=0.55, blur_s=5, alpha=0.8)
    # 光の筋（太陽から）
    ang = np.arctan2(YY - sys_, XX - sxs)
    rays = (0.5 + 0.5 * np.sin(ang * 22 + 1.3)) ** 6 * np.clip(1 - radial(sxs, sys_, 900, 700), 0, 1) ** 2
    cv.add(C('#ffe2a8'), rays * sstep(hz + 30, hz - 60, YY), 0.16)
    return finish(cv, rng, exposure=1.0, bloom_thr=0.85, vignette=0.38, grain=0.012, sat=1.0)


SCENES = {
    'stadium': (scene_stadium, 3101),
    'hanazono': (scene_hanazono, 3102),
    'spring': (scene_spring, 3103),
    'tsuyu': (scene_tsuyu, 3104),
    'autumn': (scene_autumn, 3105),
}


def embed(keys, out):
    """v02/style.css の .photo-<key> 行を、描いた JPEG の data URI で書き換える（無ければ部室の行の次に足す）"""
    import base64
    css_path = os.path.join(ROOT, 'v02', 'style.css')
    lines = open(css_path, encoding='utf-8').read().split('\n')
    last = [i for i, l in enumerate(lines) if l.startswith('.photo-clubroom {')][0]
    for k in keys:
        b64 = base64.b64encode(open(os.path.join(out, 'scene-' + k + '.jpg'), 'rb').read()).decode('ascii')
        line = '.photo-' + k + ' { background-image: url("data:image/jpeg;base64,' + b64 + '"); }'
        idx = [i for i, l in enumerate(lines) if l.startswith('.photo-' + k + ' {')]
        if idx:
            lines[idx[0]] = line
            last = max(last, idx[0])
        else:
            lines.insert(last + 1, line)
            last += 1
        print('embedded', k)
    open(css_path, 'w', encoding='utf-8').write('\n'.join(lines))


def main():
    global FONT_PATH
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='')
    ap.add_argument('--out', default=os.path.join(ROOT, 'v02', 'img'))
    ap.add_argument('--font', default='')
    ap.add_argument('--embed', action='store_true')
    a = ap.parse_args()
    FONT_PATH = a.font or None
    keys = [k for k in a.only.split(',') if k] or list(SCENES)
    os.makedirs(a.out, exist_ok=True)
    for k in keys:
        fn, seed = SCENES[k]
        arr = fn(np.random.default_rng(seed))
        save(arr, k, a.out)
    if a.embed:
        embed(keys, a.out)


if __name__ == '__main__':
    main()
