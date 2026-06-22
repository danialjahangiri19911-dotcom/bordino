# -*- coding: utf-8 -*-
import psycopg2
from psycopg2.extras import register_uuid
import uuid, sys
register_uuid()

conn = psycopg2.connect(host="127.0.0.1", port=5432, dbname="lottery", user="postgres", password="postgres", client_encoding='UTF8')
cur = conn.cursor()

lottery_id = uuid.UUID("75b60391-8fc4-429c-9487-e54e4b8ffb13")
name = "قرعه‌کشی بزرگ خرداد"
cur.execute("UPDATE lottery_lottery SET name = %s WHERE id = %s", (name, lottery_id))
conn.commit()

# بررسی با encode امن
cur.execute("SELECT name, length(name) FROM lottery_lottery WHERE id = %s", (lottery_id,))
row = cur.fetchone()
sys.stdout.buffer.write(("name length: " + str(row[1]) + "\n").encode('utf-8'))
sys.stdout.buffer.write(("name: " + row[0] + "\n").encode('utf-8'))
sys.stdout.buffer.flush()
conn.close()
