"""Doppelte und fast gleiche Sätze archivieren (Prüfliste vom 23.10.2026, vom Nutzer entschieden).

sources/sentence-merge.tsv  je Zeile: sentence_id (fällt weg), keep_id (bleibt), Art, beide Texte
Die wegfallenden Sätze kommen – wie die fehlerhaften aus sentence-archive.tsv – zu den archivierten Sätzen:
Text und Aufnahme bleiben unverändert, bestehende Wiederholungen und Favoriten bleiben erhalten, neu gelernt
wird nur noch der bleibende Satz. Im Lernpfad rückt der bleibende Satz an die Stelle des wegfallenden (steht er
in derselben Lektion schon, fällt der wegfallende nur heraus).

build_full_deck.py ruft merge_duplicates() nach apply_corrections() auf, damit ein Neubau sie wieder archiviert.
`python3 archive_duplicates.py` wendet die Liste auf den jetzigen Bestand an (mehrfach ausführbar).
"""
import csv, json, re
from pathlib import Path

ROOT = Path(__file__).parent
TSV = ROOT / 'sources' / 'sentence-merge.tsv'
PATHS = ROOT / 'dist' / 'learning-path-data.mjs'
KIND = {'doppelung': 'Doppelung', 'gleiche_woerter': 'gleiche Übersetzung, gleiche Wörter',
        'nur_pronomen': 'gleiche Übersetzung, nur ein Pronomen anders'}


def merges():
    lines = [l for l in TSV.read_text(encoding='utf-8').splitlines() if l and not l.startswith('#')]
    return [{**r, 'sentence_id': int(r['sentence_id']), 'keep_id': int(r['keep_id'])} for r in csv.DictReader(lines, delimiter='\t')]


def merge_duplicates(cards, archived):
    rows = merges(); byid = {s['id']: s for s in cards}
    drop = {}
    for r in rows:
        sid, keep = r['sentence_id'], r['keep_id']
        assert keep in byid, ('bleibender Satz fehlt', keep)
        if sid not in byid:   # schon archiviert
            assert any(s['id'] == sid for s in archived), ('Satz fehlt', sid)
            continue
        assert byid[sid]['text'] == r['text'] and byid[keep]['text'] == r['keep_text'], (sid, keep)
        s = byid[sid]; s['archive_reason'] = f"{KIND[r['kind']]}: zusammengelegt mit {keep}"; s['merged_into'] = keep
        drop[sid] = s
    assert not (set(drop) & {r['keep_id'] for r in rows}), 'ein bleibender Satz fällt selbst weg'
    return [s for s in cards if s['id'] not in drop], archived + [drop[k] for k in sorted(drop)]


def update_paths():
    text = PATHS.read_text(encoding='utf-8'); moved = removed = 0
    def lesson(m):
        nonlocal moved, removed
        ids = [int(x) for x in m.group(1).split(',') if x.strip()]
        out = []
        for i in ids:
            j = keep.get(i, i)
            if j != i and (j in out or j in ids or j in used):
                removed += 1; continue
            if j != i: moved += 1
            out.append(j)
        used.update(out)
        return '"ids":[' + ','.join(map(str, out)) + ']'
    keep = {r['sentence_id']: r['keep_id'] for r in merges()}
    used = set(int(x) for x in re.findall(r'"ids":\[([0-9,]*)\]', text) for x in x.split(',') if x and int(x) not in keep)
    new = re.sub(r'"ids":\[([0-9,]*)\]', lesson, text)
    PATHS.write_text(new, encoding='utf-8')
    return moved, removed


if __name__ == '__main__':
    from slim_deck import FULL, write_outputs
    deck = json.loads(FULL.read_text(encoding='utf-8'))
    before = len(deck['sentences'])
    deck['sentences'], deck['archived_sentences'] = merge_duplicates(deck['sentences'], deck['archived_sentences'])
    write_outputs(deck)
    moved, removed = update_paths()
    print(f'archiviert: {before - len(deck["sentences"])} · aktiv: {len(deck["sentences"])} · archiviert gesamt: {len(deck["archived_sentences"])}')
    print(f'Lernpfad: {moved} ersetzt, {removed} herausgenommen (bleibender Satz stand schon im Pfad)')
