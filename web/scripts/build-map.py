#!/usr/bin/env python3
"""Build school-map.json from real floor-1 walls and traced floor 2–3 plans."""
import json
import math
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "web/src/data/school-map.json"
POINTS = json.loads((ROOT / "data/points.json").read_text())
WALLS = json.loads((ROOT / "data/map_data.json").read_text())["floors"]["1"]["walls"]

# --- geometry helpers ---

def area(poly):
    a = 0
    for i, (x, y) in enumerate(poly):
        x2, y2 = poly[(i + 1) % len(poly)]
        a += x * y2 - x2 * y
    return abs(a) / 2

def centroid(poly):
    return [round(sum(p[0] for p in poly) / len(poly), 1), round(sum(p[1] for p in poly) / len(poly), 1)]

def pip(x, y, poly):
    inside = False
    for i in range(len(poly)):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % len(poly)]
        if ((y1 > y) != (y2 > y)) and (x < (x2 - x1) * (y - y1) / (y2 - y1 + 1e-12) + x1):
            inside = not inside
    return inside

def inset(poly, pad=4):
    c = centroid(poly)
    out = []
    for x, y in poly:
        dx, dy = c[0] - x, c[1] - y
        dist = math.hypot(dx, dy) or 1
        out.append([round(x + dx / dist * pad, 1), round(y + dy / dist * pad, 1)])
    return out

def rect(x0, y0, x1, y1, pad=5):
    return [
        [x0 + pad, y0 + pad],
        [x1 - pad, y0 + pad],
        [x1 - pad, y1 - pad],
        [x0 + pad, y1 - pad],
    ]

def cluster_map(vals, tol):
    vals = sorted(set(round(float(v), 1) for v in vals))
    groups = []
    for v in vals:
        if not groups or v - groups[-1][-1] > tol:
            groups.append([v])
        else:
            groups[-1].append(v)
    m = {}
    for g in groups:
        c = round(sum(g) / len(g), 1)
        for v in g:
            m[v] = c
    return m

def faces_from_segments(h_lines, v_lines, gap, min_area, max_area):
    """h_lines: (y, x0, x1), v_lines: (x, y0, y1)."""

    def merge(iv):
        iv = sorted(iv)
        out = []
        for a, b in iv:
            if b - a < 4:
                continue
            if not out or a > out[-1][1] + gap:
                out.append([a, b])
            else:
                out[-1][1] = max(out[-1][1], b)
        return [tuple(x) for x in out]

    def snap(lines, tol):
        lines = sorted(lines)
        groups = []
        for pos, a, b in lines:
            if not groups or abs(pos - groups[-1][0][0]) > tol:
                groups.append([(pos, a, b)])
            else:
                groups[-1].append((pos, a, b))
        out = defaultdict(list)
        for g in groups:
            pos = round(sum(p for p, _, _ in g) / len(g), 1)
            for _, a, b in g:
                out[pos].append((a, b))
        return {k: merge(v) for k, v in out.items()}

    hb = snap(h_lines, 6)
    vb = snap(v_lines, 6)
    xs_on_y = defaultdict(set)
    ys_on_x = defaultdict(set)
    for y, iv in hb.items():
        for a, b in iv:
            xs_on_y[y].update([a, b])
    for x, iv in vb.items():
        for a, b in iv:
            ys_on_x[x].update([a, b])
    for y, iv in hb.items():
        for a, b in iv:
            for x, viv in vb.items():
                if a - 2 <= x <= b + 2:
                    for c, d in viv:
                        if c - 2 <= y <= d + 2:
                            xs_on_y[y].add(x)
                            ys_on_x[x].add(y)

    def on_h(y, a, b):
        return any(A - 2 <= a and b <= B + 2 for A, B in hb.get(y, []))

    def on_v(x, a, b):
        return any(A - 2 <= a and b <= B + 2 for A, B in vb.get(x, []))

    edges = set()
    for y, xs in xs_on_y.items():
        xs = sorted(xs)
        for a, b in zip(xs, xs[1:]):
            if b - a >= 4 and on_h(y, a, b):
                edges.add(((round(a, 1), round(y, 1)), (round(b, 1), round(y, 1))))
    for x, ys in ys_on_x.items():
        ys = sorted(ys)
        for a, b in zip(ys, ys[1:]):
            if b - a >= 4 and on_v(x, a, b):
                edges.add(((round(x, 1), round(a, 1)), (round(x, 1), round(b, 1))))

    adj = defaultdict(list)
    for a, b in edges:
        adj[a].append(b)
        adj[b].append(a)
    rot = {}
    for v, nbs in adj.items():
        rot[v] = sorted(set(nbs), key=lambda q: math.atan2(q[1] - v[1], q[0] - v[0]))

    used = set()
    faces = []
    for a, b in edges:
        for s, t in ((a, b), (b, a)):
            if (s, t) in used:
                continue
            poly = []
            prev, cur = s, t
            for _ in range(900):
                used.add((prev, cur))
                poly.append(cur)
                nbs = rot.get(cur)
                if not nbs:
                    break
                try:
                    i = nbs.index(prev)
                except ValueError:
                    break
                nxt = nbs[(i - 1) % len(nbs)]
                prev, cur = cur, nxt
                if len(poly) > 3 and cur == poly[0]:
                    break
            if len(poly) >= 4 and poly[0] == poly[-1]:
                poly = poly[:-1]
            if len(poly) >= 4:
                faces.append(poly)

    good = []
    seen = set()
    for poly in faces:
        ar = area(poly)
        if not (min_area <= ar <= max_area):
            continue
        c = (round(centroid(poly)[0]), round(centroid(poly)[1]))
        if c in seen:
            continue
        seen.add(c)
        good.append(poly)
    wall_segs = []
    for y, iv in hb.items():
        for a, b in iv:
            wall_segs.append([a, y, b, y])
    for x, iv in vb.items():
        for a, b in iv:
            wall_segs.append([x, a, x, b])
    return good, wall_segs


def floor1():
    mx = cluster_map([w["x1"] for w in WALLS] + [w["x2"] for w in WALLS], 10)
    my = cluster_map([w["y1"] for w in WALLS] + [w["y2"] for w in WALLS], 10)

    def nearest(m, x):
        k = min(m, key=lambda k: abs(k - x))
        return m[k]

    h_lines, v_lines = [], []
    for w in WALLS:
        x1, y1 = nearest(mx, w["x1"]), nearest(my, w["y1"])
        x2, y2 = nearest(mx, w["x2"]), nearest(my, w["y2"])
        if abs(x2 - x1) >= abs(y2 - y1):
            if abs(x2 - x1) < 6:
                continue
            a, b = sorted([x1, x2])
            h_lines.append((y1, a, b))
        else:
            if abs(y2 - y1) < 6:
                continue
            a, b = sorted([y1, y2])
            v_lines.append((x1, a, b))
    faces, walls = faces_from_segments(h_lines, v_lines, gap=120, min_area=6000, max_area=450000)
    # screen space: south (larger source y) at the bottom
    ys = [p[1] for f in faces for p in f]
    xs = [p[0] for f in faces for p in f]
    minx, maxx, miny, maxy = min(xs) - 40, max(xs) + 40, min(ys) - 40, max(ys) + 40

    def to_screen(x, y):
        return [round(x - minx, 1), round(y - miny, 1)]

    screen_faces = [[to_screen(*p) for p in poly] for poly in faces]
    screen_walls = []
    for x1, y1, x2, y2 in walls:
        a, b = to_screen(x1, y1), to_screen(x2, y2)
        screen_walls.append([a[0], a[1], b[0], b[1]])

    def ray_box(x, y, span=360):
        def hit_v(direction):
            best = None
            for vx, a, b in v_lines:
                if a - 4 <= y <= b + 4 and ((direction > 0 and vx > x + 3) or (direction < 0 and vx < x - 3)):
                    if best is None or (direction > 0 and vx < best) or (direction < 0 and vx > best):
                        best = vx
            if best is None or abs(best - x) > span:
                best = x + span * direction
            return best

        def hit_h(direction):
            best = None
            for hy, a, b in h_lines:
                if a - 4 <= x <= b + 4 and ((direction > 0 and hy > y + 3) or (direction < 0 and hy < y - 3)):
                    if best is None or (direction > 0 and hy < best) or (direction < 0 and hy > best):
                        best = hy
            if best is None or abs(best - y) > span:
                best = y + span * direction
            return best

        left, right = hit_v(-1), hit_v(1)
        up, down = hit_h(-1), hit_h(1)
        # south entrance opens to the street: cap on the outer wall
        if "вход" in "" :
            pass
        return [[left, up], [right, up], [right, down], [left, down]]

    rooms = []
    used = set()
    for p in POINTS:
        if "лифт" in p["name"].lower():
            continue
        hits = []
        for i, poly in enumerate(faces):
            if pip(p["x"], p["y"], poly):
                hits.append((area(poly), i))
        hits = [h for h in hits if h[0] <= 180000]
        hits.sort()
        poly = None
        if hits and hits[0][1] not in used:
            i = hits[0][1]
            used.add(i)
            poly = inset(screen_faces[i], 3)
        else:
            span = 140 if "охран" in p["name"].lower() or "вход" in p["name"].lower() else 320
            raw = ray_box(p["x"], p["y"], span)
            poly = inset([to_screen(*pt) for pt in raw], 3)
        name, kind, aliases, chips = classify_point(p["name"])
        rooms.append(make_room(slug(p["name"], 1), name, 1, kind, poly, aliases, chips, p["id"]))

    # stairs: compact unlabeled faces
    stair_i = 0
    for i, poly in enumerate(faces):
        if i in used:
            continue
        ar = area(poly)
        if not (9000 <= ar <= 42000):
            continue
        sp = screen_faces[i]
        xs2 = [p[0] for p in sp]
        ys2 = [p[1] for p in sp]
        bw, bh = max(xs2) - min(xs2), max(ys2) - min(ys2)
        if bw < 36 or bh < 36 or bw > 220 or bh > 220:
            continue
        if bw / bh > 2.4 or bh / bw > 2.4:
            continue
        stair_i += 1
        rooms.append(
            make_room(
                f"f1-stairs-{stair_i}",
                f"Лестница {stair_i}",
                1,
                "stairs",
                inset(sp, 2),
                ["лестница"],
                [],
                None,
            )
        )
    vb = [0, 0, round(maxx - minx, 1), round(maxy - miny, 1)]
    return rooms, screen_walls, vb


def classify_point(name):
    n = name.lower()
    if "столов" in n:
        return "Столовая", "zone", ["зал приема пищи", "столовая"], ["Столовая"]
    if "гардероб" in n:
        return name.replace("Гардероб: ", "Гардероб: "), "zone", ["гардероб"], ["Гардероб"]
    if "мед" in n:
        return "Медпункт", "zone", ["медблок", "медпункт"], ["Медпункт"]
    if "санузел" in n or "туалет" in n:
        return name.replace("Санузел", "Туалет"), "toilet", ["туалет", "санузел"], ["Туалет"]
    if "вход" in n:
        return "Главный вход", "zone", ["центральный вход", "главный вход"], []
    if "кух" in n:
        return "Кухня", "zone", ["кухня"], []
    if "лекц" in n:
        return "Лекционный зал", "zone", ["лекционный зал"], []
    if "охран" in n:
        return "Пост охраны", "zone", ["охрана"], []
    if "директор" in n:
        return "Кабинет директора", "zone", ["директор"], []
    if "админ" in n:
        return "Администрация", "zone", ["администрация"], []
    if "прием" in n:
        return "Приемная", "zone", ["приемная"], []
    return name.replace("  ", " "), "classroom", [name.lower().replace("класс ", "")], []


def slug(name, floor):
    t = (
        name.lower()
        .replace("класс ", "")
        .replace(" ", "")
        .replace(":", "")
        .replace("(", "")
        .replace(")", "")
    )
    return f"f{floor}-{t[:18]}"


def make_room(rid, name, floor, kind, poly, aliases, chips, legacy):
    c = centroid(poly)
    room = {
        "id": rid,
        "name": name,
        "label": name,
        "floor": floor,
        "kind": kind,
        "aliases": aliases,
        "chips": chips,
        "polygon": [[round(x, 1), round(y, 1)] for x, y in poly],
        "center": c,
        "door": c,
        "technical": False,
        "hidden": kind == "stairs",
        "exit": "вход" in name.lower() or rid.endswith("exit"),
    }
    if legacy:
        room["legacyId"] = legacy
    return room


def add_manual(rooms, floor, items):
    for rid, name, kind, box, aliases, chips in items:
        poly = rect(*box)
        rooms.append(make_room(rid, name, floor, kind, poly, aliases, chips, None))


def floor2():
    # Coordinates measured on the floor-2 sheet (page 5), south at the bottom.
    rooms = []
    # bottom wing, south row y 1116-1211, equal-ish bays from detected walls
    south = [
        ("f2-b220", "Класс Б220", (134, 1116, 300, 1211), ["б220", "220"]),
        ("f2-b219", "Класс Б219", (300, 1116, 466, 1211), ["б219", "219"]),
        ("f2-b218", "Класс Б218", (466, 1116, 631, 1211), ["б218", "218"]),
        ("f2-b217", "Класс Б217", (631, 1116, 801, 1211), ["б217", "217"]),
        ("f2-a201", "Класс А201", (801, 1116, 1060, 1211), ["а201", "201"]),
        ("f2-v234", "Класс В234", (1131, 1116, 1300, 1211), ["в234", "234"]),
        ("f2-v233", "Класс В233", (1300, 1116, 1466, 1211), ["в233", "233"]),
        ("f2-v232", "Класс В232", (1466, 1116, 1632, 1211), ["в232", "232"]),
        ("f2-v231", "Класс В231", (1632, 1116, 1797, 1211), ["в231", "231"]),
    ]
    north = [
        ("f2-b221", "Класс Б221", (134, 933, 332, 1032), ["б221", "221"]),
        ("f2-b222", "Класс Б222", (383, 933, 549, 1032), ["б222", "222"]),
        ("f2-v228", "Класс В228", (1382, 933, 1632, 1032), ["в228", "228"]),
    ]
    toilets = [
        ("f2-wc-w", "Туалет", (842, 977, 917, 1072), ["туалет", "сан.узел"]),
        ("f2-wc-e", "Туалет", (1200, 977, 1293, 1072), ["туалет", "сан.узел"]),
        ("f2-wc-gym", "Туалет", (863, 692, 943, 825), ["туалет", "сан.узел"]),
    ]
    stairs = [
        ("f2-st-w", "Лестница", (134, 1032, 220, 1116)),
        ("f2-st-c", "Лестница", (917, 933, 1011, 1072)),
        ("f2-st-e", "Лестница", (1632, 1032, 1756, 1116)),
        ("f2-st-n", "Лестница", (496, 458, 580, 546)),
        ("f2-st-hall", "Лестница", (134, 458, 220, 546)),
    ]
    zones = [
        ("f2-assembly", "Актовый зал", "zone", (200, 250, 820, 490), ["актовый зал"], []),
        ("f2-gym", "Спортивный зал", "zone", (1160, 250, 1760, 490), ["спортзал", "спортивный зал"], ["Спортзал"]),
        ("f2-gym-small", "Спортивный зал (малый)", "zone", (1100, 560, 1480, 760), ["спортзал"], ["Спортзал"]),
        ("f2-change", "Раздевалки", "zone", (980, 700, 1100, 860), ["раздевалки"], []),
    ]
    for rid, name, box, aliases in south + north:
        rooms.append(make_room(rid, name, 2, "classroom", rect(*box, 4), aliases, [], None))
    for rid, name, box, aliases in toilets:
        rooms.append(make_room(rid, name, 2, "toilet", rect(*box, 3), aliases, ["Туалет"], None))
    for rid, name, box in stairs:
        rooms.append(make_room(rid, name, 2, "stairs", rect(*box, 3), ["лестница"], [], None))
    for rid, name, kind, box, aliases, chips in zones:
        rooms.append(make_room(rid, name, 2, kind, rect(*box, 6), aliases, chips, None))
    # outer + major walls so the plan reads as architecture
    walls = [
        [134, 223, 1797, 223],
        [134, 223, 134, 1211],
        [1797, 223, 1797, 1211],
        [134, 1211, 1797, 1211],
        [134, 546, 863, 546],
        [1130, 546, 1797, 546],
        [863, 223, 863, 933],
        [1130, 223, 1130, 933],
        [134, 1032, 1797, 1032],
        [134, 1116, 1797, 1116],
    ]
    return rooms, walls, [80, 160, 1780, 1120]


def floor3():
    rooms = []
    x0, x1 = 101, 1781
    step = (x1 - x0) / 10
    names = ["Б317", "Б316", "Б315", "Б314", "А302", "А301", "В330", "В329", "В328", "В327"]
    for i, name in enumerate(names):
        a = x0 + step * i
        b = x0 + step * (i + 1)
        rooms.append(
            make_room(
                f"f3-{name.lower()}",
                f"Класс {name}" if not name.startswith("Б314") else "Б314",
                3,
                "classroom",
                rect(a, 1115, b, 1211, 4),
                [name.lower()],
                [],
                None,
            )
        )
    rooms.append(make_room("f3-b318", "Класс Б318", 3, "classroom", rect(101, 974, 269, 1069, 4), ["б318"], [], None))
    rooms.append(make_room("f3-b319", "Класс Б319", 3, "classroom", rect(269, 974, 467, 1069, 4), ["б319"], [], None))
    rooms.append(make_room("f3-v325", "Класс В325", 3, "classroom", rect(1446, 974, 1614, 1069, 4), ["в325"], [], None))
    rooms.append(make_room("f3-v326", "Класс В326", 3, "classroom", rect(1614, 974, 1781, 1069, 4), ["в326"], [], None))
    rooms.append(make_room("f3-wc-w", "Туалет", 3, "toilet", rect(603, 974, 731, 1069, 3), ["туалет"], ["Туалет"], None))
    rooms.append(make_room("f3-wc-e", "Туалет", 3, "toilet", rect(1279, 974, 1400, 1069, 3), ["туалет"], ["Туалет"], None))
    rooms.append(make_room("f3-library", "Библиотека", 3, "zone", rect(774, 687, 1024, 879, 5), ["библиотека"], [], None))
    rooms.append(make_room("f3-307", "Комната 307", 3, "classroom", rect(686, 879, 800, 974, 3), ["307"], [], None))
    rooms.append(make_room("f3-311", "Комната 311", 3, "classroom", rect(1024, 687, 1154, 787, 3), ["311"], [], None))
    rooms.append(make_room("f3-312", "Комната 312", 3, "classroom", rect(1024, 787, 1154, 879, 3), ["312"], [], None))
    rooms.append(make_room("f3-313", "Комната 313", 3, "classroom", rect(1024, 879, 1154, 974, 3), ["313"], [], None))
    rooms.append(make_room("f3-hall-w", "Зал (запад)", 3, "zone", rect(180, 230, 820, 500, 6), [], [], None))
    rooms.append(make_room("f3-hall-e", "Зал (восток)", 3, "zone", rect(1100, 230, 1720, 500, 6), [], [], None))
    for rid, box in [
        ("f3-st-w", (101, 1069, 200, 1115)),
        ("f3-st-c", (900, 974, 1000, 1069)),
        ("f3-st-e", (1680, 1069, 1781, 1115)),
        ("f3-st-n", (480, 451, 580, 539)),
        ("f3-st-nw", (101, 451, 200, 539)),
    ]:
        rooms.append(make_room(rid, "Лестница", 3, "stairs", rect(*box, 3), ["лестница"], [], None))
    walls = [
        [101, 213, 1781, 213],
        [101, 213, 101, 1211],
        [1781, 213, 1781, 1211],
        [101, 1211, 1781, 1211],
        [101, 539, 848, 539],
        [1108, 539, 1781, 539],
        [101, 1069, 1781, 1069],
        [101, 1115, 1781, 1115],
    ]
    return rooms, walls, [60, 150, 1780, 1120]


def link_graph(rooms):
    nodes = []
    edges = []
    by_floor = defaultdict(list)
    for r in rooms:
        nodes.append({"id": r["id"], "floor": r["floor"], "x": r["center"][0], "y": r["center"][1], "kind": "room", "roomId": r["id"]})
        by_floor[r["floor"]].append(r)
    for fl, rs in by_floor.items():
        # band by y so the path runs along a corridor, not through rooms
        bands = defaultdict(list)
        for r in rs:
            if r["kind"] == "stairs":
                continue
            bands[round(r["center"][1] / 90)].append(r)
        ids = sorted(bands)
        reps = {}
        for b in ids:
            row = sorted(bands[b], key=lambda r: r["center"][0])
            for a, c in zip(row, row[1:]):
                d = math.hypot(a["center"][0] - c["center"][0], a["center"][1] - c["center"][1])
                edges.append({"from": a["id"], "to": c["id"], "w": round(max(d, 8), 1)})
            reps[b] = row[len(row) // 2]
        stairs = [r for r in rs if r["kind"] == "stairs"]
        anchors = list(reps.values()) + stairs
        for stair in stairs:
            nearest = min(anchors, key=lambda r: math.hypot(r["center"][0] - stair["center"][0], r["center"][1] - stair["center"][1]) if r["id"] != stair["id"] else 1e9)
            d = math.hypot(nearest["center"][0] - stair["center"][0], nearest["center"][1] - stair["center"][1])
            edges.append({"from": stair["id"], "to": nearest["id"], "w": round(max(d, 8), 1)})
        for b1, b2 in zip(ids, ids[1:]):
            a, c = reps[b1], reps[b2]
            d = math.hypot(a["center"][0] - c["center"][0], a["center"][1] - c["center"][1])
            edges.append({"from": a["id"], "to": c["id"], "w": round(max(d, 8), 1)})
    # vertical: match stairs across floors by normalized x
    stairs = [r for r in rooms if r["kind"] == "stairs"]
    def nx(r):
        # rough normalize within floor
        mates = [s for s in stairs if s["floor"] == r["floor"]]
        xs = [s["center"][0] for s in mates]
        return (r["center"][0] - min(xs)) / (max(xs) - min(xs) + 1)

    groups = []
    for s in sorted(stairs, key=lambda r: (nx(r), r["floor"])):
        placed = False
        for g in groups:
            if abs(nx(g[0]) - nx(s)) < 0.18 and all(x["floor"] != s["floor"] for x in g):
                g.append(s)
                placed = True
                break
        if not placed:
            groups.append([s])
    for g in groups:
        g.sort(key=lambda r: r["floor"])
        for a, b in zip(g, g[1:]):
            if b["floor"] - a["floor"] > 2:
                continue
            edges.append({"from": a["id"], "to": b["id"], "w": 70, "via": "stairs"})
    # entrances count as exits; also west/east stairs on floor 1
    return nodes, edges


def main():
    r1, w1, vb1 = floor1()
    r2, w2, vb2 = floor2()
    r3, w3, vb3 = floor3()
    rooms = r1 + r2 + r3
    # mark west/east floor-1 stairs as exits if near the bottom wing ends
    f1s = [r for r in r1 if r["kind"] == "stairs"]
    if f1s:
        left = min(f1s, key=lambda r: r["center"][0])
        right = max(f1s, key=lambda r: r["center"][0])
        left["exit"] = True
        right["exit"] = True
    for r in rooms:
        if r["floor"] in (2, 3) and r["kind"] == "stairs" and r["id"].endswith(("st-w", "st-e")):
            r["exit"] = True
    nodes, edges = link_graph(rooms)
    entrance = next(r["id"] for r in rooms if r["name"] == "Главный вход")
    data = {
        "school": {"name": "МБОУ СОШ №1", "city": "Большой Камень", "brand": "ШколаНавигатор"},
        "viewBox": vb1,
        "metersPerUnit": 0.045,
        "defaultFromId": entrance,
        "floors": [
            {"id": 1, "name": "1 этаж", "short": "1", "viewBox": vb1},
            {"id": 2, "name": "2 этаж", "short": "2", "viewBox": vb2},
            {"id": 3, "name": "3 этаж", "short": "3", "viewBox": vb3},
        ],
        "outline": [],
        "corridors": {},
        "walls": {"1": w1, "2": w2, "3": w3},
        "rooms": rooms,
        "nodes": nodes,
        "edges": edges,
        "quickChips": [
            {"id": "canteen", "label": "Столовая", "match": ["Столовая"]},
            {"id": "cloak", "label": "Гардероб", "match": ["Гардероб"]},
            {"id": "gym", "label": "Спортзал", "match": ["Спортзал"]},
            {"id": "toilet", "label": "Туалет", "match": ["Туалет"]},
            {"id": "med", "label": "Медпункт", "match": ["Медпункт"]},
        ],
        "legacyPoints": {r["legacyId"]: r["id"] for r in rooms if r.get("legacyId")},
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print("rooms", len(rooms), "f1", len(r1), "stairs1", sum(1 for r in r1 if r["kind"]=="stairs"))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
