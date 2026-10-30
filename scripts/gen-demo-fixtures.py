#!/usr/bin/env python3
"""Regenerates fixtures/demo/<item>.svg: illustrated sample person plus a category accessory.
Pure string SVG, python3 stdlib only. These are labeled demo placeholders, not real YouCam renders."""
import re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAL = {'green':'#8FAE8B','orange':'#C2692B','brown':'#7B4B2A','beige':'#D8C3A5','black':'#26212E','white':'#F6F4F8','pink':'#E58BB0','gold':'#D4AF37','silver':'#C4C6D0'}
SEED = (ROOT/'src/db/seed.ts').read_text()
rows = re.findall(r"item\('([\w-]+)', '([^']+)', '(\w+)', (\d+), \[([^\]]*)\]", SEED)

def person(top):
    return f'''<rect width="896" height="1152" fill="#E6DEF3"/>
<ellipse cx="448" cy="1010" rx="330" ry="300" fill="{top}"/>
<rect x="392" y="560" width="112" height="150" fill="#D6B096"/>
<ellipse cx="448" cy="400" rx="168" ry="205" fill="#E2BDA3"/>
<path d="M280 380 Q290 190 448 190 Q606 190 616 380 Q580 270 448 262 Q320 270 280 380Z" fill="#3A2846"/>
<circle cx="392" cy="410" r="13" fill="#2A1E36"/><circle cx="504" cy="410" r="13" fill="#2A1E36"/>
<path d="M410 490 Q448 520 486 490" stroke="#96464F" stroke-width="8" fill="none" stroke-linecap="round"/>'''

def accessory(cat, c1, c2):
    if cat=='scarf': return f'<path d="M330 690 Q448 760 566 690 L586 770 Q448 840 310 770Z" fill="{c1}"/><path d="M500 780 L560 960 L490 975 L452 800Z" fill="{c2}"/>'
    if cat=='hat': return f'<path d="M270 330 Q290 140 448 130 Q606 140 626 330 Q448 290 270 330Z" fill="{c1}"/><circle cx="448" cy="118" r="26" fill="{c2}"/><rect x="262" y="318" width="372" height="40" rx="20" fill="{c2}"/>'
    if cat=='bag': return f'<path d="M300 640 L560 1010" stroke="{c2}" stroke-width="14"/><rect x="520" y="900" width="230" height="170" rx="34" fill="{c1}"/><path d="M570 900 Q635 820 700 900" stroke="{c2}" stroke-width="12" fill="none"/>'
    if cat=='earrings': return f'<circle cx="276" cy="470" r="30" fill="none" stroke="{c1}" stroke-width="12"/><circle cx="620" cy="470" r="30" fill="none" stroke="{c1}" stroke-width="12"/>'
    if cat=='necklace': return f'<path d="M352 700 Q448 800 544 700" stroke="{c1}" stroke-width="7" fill="none"/><circle cx="448" cy="782" r="22" fill="{c1}"/>'
    if cat=='ring': return f'<g transform="translate(448 760)"><rect x="-110" y="-60" width="220" height="190" rx="70" fill="#E2BDA3"/>' + ''.join(f'<rect x="{x}" y="-190" width="38" height="170" rx="19" fill="#E2BDA3"/>' for x in (-108,-62,-16,30)) + f'<ellipse cx="-43" cy="-70" rx="26" ry="12" fill="none" stroke="{c1}" stroke-width="10"/></g>'
    if cat=='look': return f'<circle cx="340" cy="470" r="38" fill="{c1}" opacity=".45"/><circle cx="556" cy="470" r="38" fill="{c1}" opacity=".45"/><path d="M410 490 Q448 520 486 490Q448 505 410 490Z" fill="{c1}" stroke="{c1}" stroke-width="8"/>'
    return ''

for iid, name, cat, price, cols in rows:
    colors = re.findall(r"'(\w+)'", cols)
    c1 = PAL.get(colors[0], '#C9BDE3'); c2 = PAL.get(colors[1], c1) if len(colors) > 1 else c1
    top = c1 if cat == 'top' else '#6B5B8A'
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="896" height="1152" viewBox="0 0 896 1152">{person(top)}{accessory(cat, c1, c2)}
<rect y="1026" width="896" height="126" fill="#E6DEF3"/>
<text x="448" y="1078" font-family="Georgia,serif" font-size="40" text-anchor="middle" fill="#1F1633">{name}</text>
<text x="448" y="1116" font-family="sans-serif" font-size="24" text-anchor="middle" fill="#1F1633" opacity=".75">DEMO PREVIEW · illustrated, not a real render</text></svg>'''
    (ROOT/'fixtures/demo'/f'{iid}.svg').write_text(svg)
print(f'wrote {len(rows)} fixtures')
