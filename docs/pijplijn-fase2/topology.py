"""
Topologie-engine voor naadloze kaartvereenvoudiging.

Werkt zoals TopoJSON: gedeelde grenzen tussen buurgemeenten worden als EEN arc
opgeslagen en EEN keer vereenvoudigd. Daardoor kunnen er geen witte naden
ontstaan tussen aangrenzende vlakken.
"""
from collections import defaultdict
import math


def _ring_points(ring):
    """Sluitpunt weghalen; ring als open lijst van tuples."""
    pts = [(round(x, 3), round(y, 3)) for x, y in ring]
    if pts[0] == pts[-1]:
        pts = pts[:-1]
    return pts


def douglas_peucker(points, eps):
    """Vereenvoudig een lijn; begin- en eindpunt blijven altijd staan."""
    n = len(points)
    if n <= 2:
        return list(points)
    keep = [False] * n
    keep[0] = keep[n - 1] = True
    stack = [(0, n - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        ax, ay = points[i]
        bx, by = points[j]
        dx, dy = bx - ax, by - ay
        seg2 = dx * dx + dy * dy
        maxd, idx = -1.0, -1
        for k in range(i + 1, j):
            px, py = points[k]
            if seg2 == 0.0:
                d = math.hypot(px - ax, py - ay)
            else:
                t = ((px - ax) * dx + (py - ay) * dy) / seg2
                if t < 0.0:
                    t = 0.0
                elif t > 1.0:
                    t = 1.0
                d = math.hypot(px - (ax + t * dx), py - (ay + t * dy))
            if d > maxd:
                maxd, idx = d, k
        if maxd > eps:
            keep[idx] = True
            stack.append((i, idx))
            stack.append((idx, j))
    return [points[i] for i in range(n) if keep[i]]


class Topology:
    """Bouwt een gedeelde-arc topologie uit vlakken met identieke randcoordinaten."""

    def __init__(self):
        self.arcs = []                 # lijst van puntenlijsten
        self._arc_index = {}           # canonieke sleutel -> arc-id
        self.shapes = {}               # naam -> lijst van ringen, elke ring = [(arc_id, omgekeerd)]

    # ---------- opbouw ----------

    def add_shapes(self, shapes):
        """shapes: dict naam -> MultiPolygon-coordinaten (GeoJSON-structuur)."""
        # 1. lidmaatschap per punt bepalen: welke vlakken raken dit punt?
        membership = defaultdict(set)
        prepared = {}
        for name, multipoly in shapes.items():
            rings = []
            for poly in multipoly:
                for ring in poly:
                    pts = _ring_points(ring)
                    rings.append(pts)
                    for p in pts:
                        membership[p].add(name)
            prepared[name] = rings

        # 2. elke ring knippen op knooppunten (waar het lidmaatschap wisselt)
        for name, rings in prepared.items():
            shape_rings = []
            for pts in rings:
                shape_rings.append(self._split_ring(pts, membership))
            self.shapes[name] = shape_rings

    def _split_ring(self, pts, membership):
        n = len(pts)
        m = [frozenset(membership[p]) for p in pts]
        junctions = [i for i in range(n)
                     if m[i] != m[(i - 1) % n] or m[i] != m[(i + 1) % n]]

        if not junctions:
            # hele ring heeft uniform lidmaatschap -> een gesloten arc.
            # Deterministisch startpunt zodat beide eigenaren dezelfde arc krijgen.
            start = min(range(n), key=lambda i: pts[i])
            seq = pts[start:] + pts[:start] + [pts[start]]
            return [self._add_arc(seq)]

        out = []
        for a, b in zip(junctions, junctions[1:] + [junctions[0]]):
            if b > a:
                seq = pts[a:b + 1]
            else:
                seq = pts[a:] + pts[:b + 1]
            out.append(self._add_arc(seq))
        return out

    def _add_arc(self, seq):
        """Voeg arc toe (of hergebruik). Retourneert (arc_id, omgekeerd)."""
        rev = seq[::-1]
        canonical = seq if seq <= rev else rev
        reversed_flag = canonical is not seq
        key = tuple(canonical)
        if key not in self._arc_index:
            self._arc_index[key] = len(self.arcs)
            self.arcs.append(list(canonical))
        return (self._arc_index[key], reversed_flag)

    # ---------- vereenvoudiging ----------

    def simplify(self, eps):
        """Vereenvoudig elke arc een keer. Gedeelde randen blijven identiek."""
        self.arcs = [douglas_peucker(a, eps) for a in self.arcs]

    # ---------- uitlezen ----------

    def arc_points(self, arc_id, reversed_flag):
        a = self.arcs[arc_id]
        return a[::-1] if reversed_flag else a

    def rings(self, name):
        """Herbouw de ringen van een vlak als puntenlijsten."""
        out = []
        for ring in self.shapes[name]:
            pts = []
            for arc_id, rev in ring:
                seg = self.arc_points(arc_id, rev)
                pts.extend(seg[:-1] if pts or len(ring) > 1 else seg)
            if pts and pts[0] != pts[-1]:
                pts.append(pts[0])
            out.append(pts)
        return out

    def owners(self):
        """arc_id -> set van vlaknamen die deze arc gebruiken."""
        own = defaultdict(set)
        for name, rings in self.shapes.items():
            for ring in rings:
                for arc_id, _ in ring:
                    own[arc_id].add(name)
        return own

    def boundary_arcs(self):
        """Arcs met maar een eigenaar: die vormen de buitenrand."""
        return [aid for aid, names in self.owners().items() if len(names) == 1]

    def stats(self):
        return {
            "arcs": len(self.arcs),
            "punten": sum(len(a) for a in self.arcs),
            "vlakken": len(self.shapes),
        }


def chain_arcs(topo, arc_ids):
    """Rijg losse arcs aan elkaar tot gesloten ringen (voor de silhouetrand)."""
    ends = defaultdict(list)
    for aid in arc_ids:
        pts = topo.arcs[aid]
        ends[pts[0]].append((aid, False))
        ends[pts[-1]].append((aid, True))

    unused = set(arc_ids)
    rings = []
    while unused:
        start = next(iter(unused))
        unused.discard(start)
        chain = topo.arcs[start][:]
        while True:
            tail = chain[-1]
            nxt = None
            for aid, rev in ends.get(tail, []):
                if aid in unused:
                    nxt = (aid, rev)
                    break
            if nxt is None:
                break
            aid, rev = nxt
            unused.discard(aid)
            seg = topo.arcs[aid][::-1] if rev else topo.arcs[aid]
            chain.extend(seg[1:])
            if chain[-1] == chain[0]:
                break
        rings.append(chain)
    return rings
