import sys, json, sqlite3, urllib.request

DB_PATH = r'backend\.data\deepsea.db'
INGEST_URL = 'http://localhost:5000/api/sensors/ingest'

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
sensors = conn.execute('SELECT id, name FROM sensors WHERE online=1 LIMIT 3').fetchall()
conn.close()

print(f'Found {len(sensors)} sensors')
for s in sensors:
    sid = s['id']
    sname = s['name']
    data = {
        'sensorId': sid,
        'sensorName': sname,
        'temperature': 3.1,
        'ph': 6.5,
        'salinity': 34.5,
        'oxygen': 2.1,
        'turbidity': 12.0
    }
    payload = json.dumps(data).encode()
    req = urllib.request.Request(INGEST_URL, data=payload, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=3) as resp:
            print(f'  OK: {sname} -> {resp.read().decode()}')
    except Exception as e:
        print(f'  ERR: {e}')
