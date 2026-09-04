"""
Fix kta_requests.subklasifikasi korup (kode 'BL003' hasil import legacy).

Resolve nama subklasifikasi bener via data-jabatan-kerja.json:
  1. exact match jabatan_kerja (normalized)
  2. match base nama + jenjang (varian "(Level N)" di master)
  3. keyword heuristic (konservatif)
Yang gagal -> dibiarkan, muncul di preview buat review manual.

Juga link subklasifikasiId (FK) utk row yg namanya udah valid tapi FK NULL.

Pemakaian:
  python scripts/fix-subklasifikasi.py            # dry-run, tulis preview CSV
  python scripts/fix-subklasifikasi.py --apply    # eksekusi UPDATE ke prod
"""
import argparse
import csv
import json
import re
import sys
import paramiko

HOST = '103.23.199.5'
PORT = 1126
SSH_USER = 'alvin'
SSH_PASS = 'Vw8Ur/z4slYMnbBs'
MYSQL_USER = 'alvin'
MYSQL_PASS = 'K@tasandi.2026#'
DB = 'gatensi_kta'

JABKER_JSON = 'data-jabatan-kerja.json'
PREVIEW_CSV = 'dry-run-subklasifikasi-preview.csv'

GARBAGE_RE = re.compile(r'^[a-z]{2}0*\d+$', re.I)

# keyword -> nama subklasifikasi (harus persis nama di tabel master subklasifikasi)
KEYWORDS = [
    ('mekanikal', 'Teknik Mekanikal'),
    ('lifting', 'Teknik Lifting'),
    ('gondola', 'Teknik Lifting'),
    ('k3', 'Keselamatan Konstruksi'),
    ('keselamatan', 'Keselamatan Konstruksi'),
    ('kebakaran', 'Proteksi Kebakaran'),
    ('air tanah', 'Air Tanah dan Air Baku'),
    ('pengeboran air', 'Air Tanah dan Air Baku'),
    ('air minum', 'Bangunan Air Minum'),
    ('spam', 'Bangunan Air Minum'),
    ('air limbah', 'Bangunan Air Limbah'),
    ('persampahan', 'Bangunan Persampahan'),
    ('sampah', 'Bangunan Persampahan'),
    ('geoteknik', 'Geoteknik dan Pondasi'),
    ('pondasi', 'Geoteknik dan Pondasi'),
    ('geodesi', 'Geodesi'),
    ('juru ukur', 'Geodesi'),
    ('surveyor', 'Geodesi'),
    ('laboratorium', 'Testing dan Analisis Teknik'),
    ('beton aspal', 'Testing dan Analisis Teknik'),
    ('drainase', 'Drainase Perkotaan'),
    ('irigasi', 'Irigasi dan Rawa'),
    ('bronjong', 'Irigasi dan Rawa'),
    ('pintu air', 'Irigasi dan Rawa'),
    ('bendung', 'Bendung dan Bendungan'),
    ('sungai', 'Sungai dan Pantai'),
    ('pantai', 'Sungai dan Pantai'),
    ('jalan rel', 'Jalan Rel'),
    ('kereta', 'Jalan Rel'),
    ('pelabuhan', 'Bangunan Pelabuhan'),
    ('dermaga', 'Bangunan Pelabuhan'),
    ('leachate', 'Bangunan Persampahan'),
    ('lindi', 'Bangunan Persampahan'),
    ('tpa', 'Bangunan Persampahan'),
    ('landasan', 'Landasan Udara'),
    ('lepas pantai', 'Bangunan Lepas Pantai'),
    ('rangka atap', 'Konstruksi Atap'),
    ('atap baja', 'Konstruksi Atap'),
    ('aspal', 'Jalan'),
    ('jembatan', 'Jembatan'),
    ('jalan', 'Jalan'),
    ('hijau', 'Gedung'),
    ('risha', 'Gedung'),
    ('gedung', 'Gedung'),
    ('tukang', 'Gedung'),
    ('bangunan', 'Gedung'),
]

def norm(s: str) -> str:
    return re.sub(r'[^a-z0-9]', '', (s or '').lower())

def ssh_query(sql: str) -> list[list[str]]:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, port=PORT, username=SSH_USER, password=SSH_PASS, timeout=20)
    esc = sql.replace('\\', '\\\\').replace('"', '\\"').replace('\n', ' ')
    cmd = f'mysql -u{MYSQL_USER} -p"{MYSQL_PASS}" {DB} -e "{esc}" 2>/dev/null'
    _, o, e = c.exec_command(cmd, timeout=120)
    out = o.read().decode()
    err = e.read().decode()
    c.close()
    if err.strip():
        raise RuntimeError(f'mysql error: {err}')
    lines = [l for l in out.split('\n') if l.strip()]
    return [l.split('\t') for l in lines]

def ssh_exec(sql: str) -> None:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, port=PORT, username=SSH_USER, password=SSH_PASS, timeout=20)
    esc = sql.replace('\\', '\\\\').replace('"', '\\"').replace('\n', ' ')
    cmd = f'mysql -u{MYSQL_USER} -p"{MYSQL_PASS}" {DB} -e "{esc}"'
    _, o, e = c.exec_command(cmd, timeout=300)
    out, err = o.read().decode(), e.read().decode()
    c.close()
    print(out)
    if err.strip():
        raise RuntimeError(f'mysql error: {err}')

def apply_batched(plan):
    """Backup tabel, lalu eksekusi semua UPDATE lewat 1 file SQL via SFTP."""
    changed = [p for p in plan if p[5] != p[4] or (p[6] and p[6] != '')]
    print(f'\nAPPLY: {len(changed)} update...')

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, port=PORT, username=SSH_USER, password=SSH_PASS, timeout=20)

    # 1. Backup tabel sebelum diubah
    stamp = __import__('time').strftime('%Y%m%d-%H%M%S')
    remote_bak = f'/tmp/kta_requests_backup_{stamp}.sql'
    cmd = f'mysqldump -u{MYSQL_USER} -p"{MYSQL_PASS}" {DB} kta_requests > {remote_bak} 2>/dev/null && ls -la {remote_bak}'
    _, o, e = c.exec_command(cmd, timeout=300)
    print('backup server:', o.read().decode().strip())
    err = e.read().decode().strip()
    if err:
        c.close()
        raise RuntimeError(f'mysqldump error: {err}')
    sftp = c.open_sftp()
    sftp.get(remote_bak, f'kta_requests_backup_{stamp}.sql')
    print(f'backup lokal: kta_requests_backup_{stamp}.sql')

    # 2. Tulis file SQL batch
    local_sql = f'fix_subklasifikasi_{stamp}.sql'
    with open(local_sql, 'w', encoding='utf-8') as f:
        f.write('START TRANSACTION;\n')
        for rid, _, _, _, _, new_sub, new_fk_id, _ in changed:
            sub_esc = new_sub.replace("'", "''")
            fk_val = f"'{new_fk_id}'" if new_fk_id else 'NULL'
            f.write(f"UPDATE kta_requests SET subklasifikasi='{sub_esc}', subklasifikasiId={fk_val} WHERE id='{rid}';\n")
        f.write('COMMIT;\n')
    remote_sql = f'/tmp/{local_sql}'
    sftp.put(local_sql, remote_sql)
    sftp.close()
    print(f'SQL: {local_sql} ({len(changed)} statement)')

    # 3. Eksekusi
    cmd = f'mysql -u{MYSQL_USER} -p"{MYSQL_PASS}" {DB} < {remote_sql} && echo APPLY_OK'
    _, o, e = c.exec_command(cmd, timeout=600)
    out = o.read().decode().strip()
    err = e.read().decode().strip()
    c.exec_command(f'rm -f {remote_sql}')
    c.close()
    print(out)
    if 'APPLY_OK' not in out:
        raise RuntimeError(f'apply gagal: {err or out}')
    print('selesai.')

def build_indexes():
    data = json.load(open(JABKER_JSON, encoding='utf-8'))['data']
    plain = {}
    base_idx = {}
    for x in data:
        jk = x['jabatan_kerja'] or ''
        m = re.search(r'level\s*(\d+)', jk, re.I)
        if m:
            base = re.sub(r'\(?\s*level\s*\d+\s*\)?', '', jk, flags=re.I).strip()
            base_idx.setdefault(norm(base), {})[m.group(1)] = x['subklasifikasi']
        else:
            plain.setdefault(norm(jk), x['subklasifikasi'])
    return plain, base_idx

def resolve(jk: str, jenjang: str, plain: dict, base_idx: dict):
    n = norm(jk)
    if n in plain:
        return plain[n], 'exact'
    b = base_idx.get(n)
    if b and jenjang in b:
        return b[jenjang], 'level'
    low = jk.lower()
    for kw, target in KEYWORDS:
        if kw in low:
            return target, 'keyword'
    return None, 'miss'

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true', help='eksekusi UPDATE (default: dry-run)')
    args = ap.parse_args()

    plain, base_idx = build_indexes()

    # master FK: nama (normalized) -> id
    master_rows = ssh_query(
        'SELECT id, subklasifikasi FROM subklasifikasi;'
    )[1:]
    fk = {norm(name): (name, mid) for mid, name in master_rows}
    valid_names = {v[0] for v in fk.values()}

    rows = ssh_query(
        'SELECT id, nama, jabatanKerja, jenjang, subklasifikasi, subklasifikasiId '
        'FROM kta_requests;'
    )[1:]
    print(f'total rows: {len(rows)}')

    plan = []  # (id, nama, jk, jenjang, old_sub, new_sub, new_fk_id, method)
    stats = {}
    for rid, nama, jk, jenjang, old_sub, old_fk in rows:
        old_sub = old_sub if old_sub != 'NULL' else ''
        old_fk = old_fk if old_fk != 'NULL' else ''

        new_sub, new_fk_id = old_sub, old_fk
        method = 'skip'

        if GARBAGE_RE.match(old_sub) or not old_sub:
            # korup/kosong: resolve dari jabatanKerja
            target, m = resolve(jk, jenjang, plain, base_idx)
            hit = fk.get(norm(target)) if target else None
            if hit:
                # pakai nama kanonik dari master biar casing konsisten
                new_sub, new_fk_id, method = hit[0], hit[1], m
            else:
                new_sub, new_fk_id, method = (target or ''), '', (m + '_no_master' if target else 'miss')
        elif not old_fk:
            # nama valid tapi FK null: link saja
            hit = fk.get(norm(old_sub))
            if hit:
                new_sub, new_fk_id, method = hit[0], hit[1], 'link_fk'

        stats[method] = stats.get(method, 0) + 1
        plan.append([rid, nama, jk, jenjang, old_sub, new_sub, new_fk_id, method])

    print('\n=== RINGKASAN ===')
    for m, cnt in sorted(stats.items(), key=lambda x: -x[1]):
        print(f'{cnt:6d}  {m}')

    # distribusi hasil akhir
    final = {}
    for _, _, _, _, old_sub, new_sub, _, m in plan:
        key = new_sub if (new_sub and new_sub != old_sub) else None
        if key:
            final[key] = final.get(key, 0) + 1
    print('\n=== ROW YANG BERUBAH, PER SUBKLASIFIKASI BARU ===')
    for name, cnt in sorted(final.items(), key=lambda x: -x[1]):
        print(f'{cnt:6d}  {name}')

    misses = [p for p in plan if p[7] in ('miss', 'keyword_no_master')]
    print(f'\n=== MISS: {len(misses)} row ===')
    agg = {}
    for p in misses:
        agg[(p[2], p[3])] = agg.get((p[2], p[3]), 0) + 1
    for (jk, jen), cnt in sorted(agg.items(), key=lambda x: -x[1])[:30]:
        print(f'{cnt:6d}  [{jen}] {jk}')

    with open(PREVIEW_CSV, 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f)
        w.writerow(['id', 'nama', 'jabatanKerja', 'jenjang', 'subklasifikasi_lama',
                    'subklasifikasi_baru', 'subklasifikasiId_baru', 'metode'])
        w.writerows(plan)
    print(f'\npreview ditulis: {PREVIEW_CSV}')

    if not args.apply:
        print('DRY-RUN ONLY. Jalankan dengan --apply untuk eksekusi.')
        return

    apply_batched(plan)

if __name__ == '__main__':
    main()
