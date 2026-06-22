# -*- coding: utf-8 -*-
import psycopg2, urllib.request, json, sys
from psycopg2.extras import register_uuid
register_uuid()

conn = psycopg2.connect(host="127.0.0.1", port=5432, dbname="lottery", user="postgres", password="postgres")
cur = conn.cursor()
cur.execute("""
    SELECT t.token FROM token_blacklist_outstandingtoken t
    LEFT JOIN token_blacklist_blacklistedtoken b ON b.token_id = t.id
    JOIN users_user u ON u.id = t.user_id::uuid
    WHERE u.phone_number = '9128007728' AND b.id IS NULL
    ORDER BY t.created_at DESC LIMIT 1
""")
refresh_token = cur.fetchone()[0]
conn.close()

body = json.dumps({"refresh": refresh_token}).encode()
req = urllib.request.Request("http://127.0.0.1:8000/token/refresh/", data=body, headers={"Content-Type": "application/json"}, method="POST")
with urllib.request.urlopen(req) as resp:
    access = json.loads(resp.read())["result"]["access"]

req2 = urllib.request.Request("http://127.0.0.1:8000/api/v1/lotteries/", headers={"Authorization": f"Bearer {access}"})
with urllib.request.urlopen(req2) as resp:
    data = json.loads(resp.read())
    lottery = data["result"]["results"][0]
    sys.stdout.buffer.write(("id: " + lottery["id"] + "\n").encode('utf-8'))
    sys.stdout.buffer.write(("name: " + lottery["name"] + "\n").encode('utf-8'))
    sys.stdout.buffer.write(("status: " + lottery["status"] + "\n").encode('utf-8'))
    sys.stdout.buffer.flush()
