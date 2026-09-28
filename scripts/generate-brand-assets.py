"""
Genera los íconos de la app y de las notificaciones a partir del logo de Finn.

Fuente: el símbolo `#finn-mini` de la landing (landingpage Financyai/index.html),
viewBox 200x200. Se dibuja con Pillow (sin dependencias de SVG) a 4x y se reduce
con LANCZOS para bordes suaves.

Uso:  python scripts/generate-brand-assets.py
Salida: assets/images/*  (sobrescribe los íconos de la app)
"""

from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "assets" / "images"

# Paleta de marca (landing: --ink, --sun, --emerald, --mint)
INK = (6, 33, 66, 255)       # #062142
SUN = (255, 162, 66, 255)    # #FFA242
BLUE = (54, 172, 255, 255)   # #36ACFF
MINT = (196, 241, 255, 255)  # #C4F1FF

SS = 4  # supersampling

# Caja del robot en unidades del viewBox (antena incluida)
BOX_X0, BOX_Y0, BOX_X1, BOX_Y1 = 22, 4, 178, 180
BOX_W, BOX_H = BOX_X1 - BOX_X0, BOX_Y1 - BOX_Y0


def _bezier(p0, p1, p2, n=48):
    return [
        (
            (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0],
            (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1],
        )
        for t in (i / n for i in range(n + 1))
    ]


def _stroke(draw, pts, width, fill):
    draw.line(pts, fill=fill, width=int(round(width)), joint="curve")
    r = width / 2
    for x, y in (pts[0], pts[-1]):
        draw.ellipse([x - r, y - r, x + r, y + r], fill=fill)


def draw_finn(size, height_frac, mode="color", shade=False):
    """
    mode="color": robot a color sobre transparente.
    mode="mono":  silueta blanca con visor calado (íconos de notificación / temáticos).
    """
    S = size * SS
    scale = (S * height_frac) / BOX_H
    ox = S / 2 - (BOX_X0 + BOX_W / 2) * scale
    oy = S / 2 - (BOX_Y0 + BOX_H / 2) * scale
    P = lambda x, y: (ox + x * scale, oy + y * scale)  # noqa: E731
    R = lambda v: v * scale  # noqa: E731

    def rrect(d, x, y, w, h, r, fill):
        d.rounded_rectangle([*P(x, y), *P(x + w, y + h)], radius=R(r), fill=fill)

    def ell(d, cx, cy, rx, ry, fill):
        d.ellipse([*P(cx - rx, cy - ry), *P(cx + rx, cy + ry)], fill=fill)

    smile = [P(*p) for p in _bezier((86, 126), (100, 138), (114, 126))]

    if mode == "mono":
        mask = Image.new("L", (S, S), 0)
        d = ImageDraw.Draw(mask)
        _stroke(d, [P(100, 40), P(100, 20)], R(8), 255)
        ell(d, 100, 15, 12, 12, 255)
        rrect(d, 22, 38, 156, 142, 58, 255)
        rrect(d, 42, 66, 116, 80, 36, 0)          # visor calado
        ell(d, 78, 102, 12, 15, 255)
        ell(d, 122, 102, 12, 15, 255)
        _stroke(d, smile, R(8), 255)
        img = Image.new("RGBA", (S, S), (255, 255, 255, 0))
        img.putalpha(mask)
        white = Image.new("RGBA", (S, S), (255, 255, 255, 255))
        white.putalpha(mask)
        img = white
    else:
        img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        _stroke(d, [P(100, 40), P(100, 20)], R(7), INK)
        ell(d, 100, 15, 11, 11, SUN)
        rrect(d, 22, 38, 156, 142, 58, BLUE)
        if shade:
            # Mismo degradado que la landing (#finnShade): luz arriba, sombra abajo
            head = Image.new("L", (S, S), 0)
            rrect(ImageDraw.Draw(head), 22, 38, 156, 142, 58, 255)
            y0, y1 = int(P(0, 38)[1]), int(P(0, 180)[1])
            grad = Image.new("RGBA", (S, S), (0, 0, 0, 0))
            gd = ImageDraw.Draw(grad)
            for y in range(y0, y1 + 1):
                t = (y - y0) / max(1, y1 - y0)
                if t < 0.5:
                    gd.line([(0, y), (S, y)], fill=(255, 255, 255, int(56 * (1 - t * 2))))
                else:
                    gd.line([(0, y), (S, y)], fill=(0, 0, 0, int(31 * (t - 0.5) * 2)))
            clipped = Image.new("RGBA", (S, S), (0, 0, 0, 0))
            clipped.paste(grad, (0, 0), head)
            img = Image.alpha_composite(img, clipped)
            d = ImageDraw.Draw(img)
        rrect(d, 42, 66, 116, 80, 36, INK)
        ell(d, 78, 102, 11, 14, MINT)
        ell(d, 122, 102, 11, 14, MINT)
        _stroke(d, smile, R(6), MINT)

    return img.resize((size, size), Image.LANCZOS)


def on_background(size, height_frac, bg, shape="square", shade=True):
    S = size * SS
    base = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(base)
    if shape == "square":
        d.rectangle([0, 0, S, S], fill=bg)
    elif shape == "circle":
        d.ellipse([0, 0, S - 1, S - 1], fill=bg)
    elif shape == "rounded":
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.24), fill=bg)
    base = base.resize((size, size), Image.LANCZOS)
    return Image.alpha_composite(base, draw_finn(size, height_frac, "color", shade))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    outputs = {
        # iOS / ícono principal: sin transparencia, iOS aplica la máscara
        "icon.png": on_background(1024, 0.62, MINT).convert("RGB"),
        # Android adaptativo: el robot dentro de la zona segura (66dp de 108dp)
        "android-icon-foreground.png": draw_finn(512, 0.46, "color", shade=True),
        "android-icon-background.png": Image.new("RGB", (512, 512), MINT[:3]),
        "android-icon-monochrome.png": draw_finn(432, 0.46, "mono"),
        # Splash: robot solo, el fondo lo pone expo-splash-screen
        "splash-icon.png": draw_finn(1024, 0.86, "color", shade=True),
        "favicon.png": on_background(48, 0.74, MINT, "rounded", shade=False),
        # Notificaciones Android: ícono pequeño (solo blanco + alpha, 24dp @xxxhdpi)
        "notification-icon.png": draw_finn(96, 0.92, "mono"),
        # Notificaciones Android: ícono grande a color (64dp @xxxhdpi)
        "notification-large-icon.png": on_background(256, 0.6, MINT, "circle"),
        # Avatar de Finn para la app (pantalla de permisos, etc.)
        "finn-avatar.png": on_background(512, 0.6, MINT, "circle"),
    }
    for name, img in outputs.items():
        img.save(OUT / name, optimize=True)
        print(f"  {name:32s} {img.size[0]}x{img.size[1]}")


if __name__ == "__main__":
    main()
