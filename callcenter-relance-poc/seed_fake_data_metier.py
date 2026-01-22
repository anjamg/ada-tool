import os
import sqlite3
from datetime import datetime, timedelta
import random

DB = "calls.db"

# =====================
# RESET DB
# =====================
if os.path.exists(DB):
    os.remove(DB)
    print("🧹 calls.db supprimée")

conn = sqlite3.connect(DB)
c = conn.cursor()

# =====================
# SCHEMA (identique prod)
# =====================
c.execute("""
CREATE TABLE leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_key TEXT UNIQUE NOT NULL,
    phone TEXT,
    projet TEXT NOT NULL,
    type_lead TEXT NOT NULL,
    lead_created_at TEXT NOT NULL,
    created_at TEXT NOT NULL
)
""")

c.execute("""
CREATE TABLE calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL,
    agent TEXT NOT NULL,
    attempt_level INTEGER NOT NULL,
    result TEXT NOT NULL,
    priority TEXT NOT NULL,
    next_call_at TEXT,
    done_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (lead_id) REFERENCES leads(id)
)
""")

conn.commit()

# =====================
# PARAMÈTRES MÉTIER
# =====================
agents = ["Hyacinthe", "Patrick", "Luisa"]
projets = ["Colisée", "Nohée"]

NON_DEFINITIFS = ["Pas de réponse", "Injoignable", "À rappeler"]
DEFINITIFS = ["Qualifié", "Pas intéressé", "Annulé"]

now = datetime.now().replace(hour=14, minute=0, second=0, microsecond=0)

# =====================
# 10 LEADS MÉTIER
# =====================
for i in range(1, 1000):
    lead_key = f"FAKE-LEAD-{i}"
    lead_created = now.replace(hour=10) - timedelta(minutes=i * 10)

    c.execute("""
        INSERT INTO leads
        (lead_key, phone, projet, type_lead, lead_created_at, created_at)
        VALUES (?,?,?,?,?,?)
    """, (
        lead_key,
        f"336000000{i}",
        projets[i % 2],
        "Web",
        lead_created.isoformat(),
        now.isoformat()
    ))

    lead_id = c.lastrowid
    agent = random.choice(agents)

    # =====================
    # CAS 1 — lead clos dès le 1er appel
    # =====================
    if i in (1, 2):
        first_call = lead_created + timedelta(minutes=20)
        c.execute("""
            INSERT INTO calls
            (lead_id, agent, attempt_level, result, priority, next_call_at, done_at, created_at)
            VALUES (?,?,?,?,?,?,?,?)
        """, (
            lead_id,
            agent,
            1,
            random.choice(DEFINITIFS),
            "NORMAL",
            None,
            first_call.isoformat(),
            now.isoformat()
        ))
        continue

    # =====================
    # CAS 2 — lead avec plusieurs appels, dernier définitif
    # =====================
    if i in (3, 4, 5, 6):
        nb_calls = random.choice([3, 4, 5])
        call_time = lead_created + timedelta(minutes=15)

        for lvl in range(1, nb_calls):
            c.execute("""
                INSERT INTO calls
                (lead_id, agent, attempt_level, result, priority, next_call_at, done_at, created_at)
                VALUES (?,?,?,?,?,?,?,?)
            """, (
                lead_id,
                agent,
                lvl,
                random.choice(NON_DEFINITIFS),
                "NORMAL",
                None,
                call_time.isoformat(),
                now.isoformat()
            ))
            call_time += timedelta(minutes=20)

        # dernier appel définitif
        c.execute("""
            INSERT INTO calls
            (lead_id, agent, attempt_level, result, priority, next_call_at, done_at, created_at)
            VALUES (?,?,?,?,?,?,?,?)
        """, (
            lead_id,
            agent,
            nb_calls,
            random.choice(DEFINITIFS),
            "NORMAL",
            None,
            call_time.isoformat(),
            now.isoformat()
        ))
        continue

    # =====================
    # CAS 3 — lead en cours (non définitif)
    # =====================
    nb_calls = random.choice([1, 2, 3])
    call_time = lead_created + timedelta(minutes=15)

    for lvl in range(1, nb_calls + 1):
        c.execute("""
            INSERT INTO calls
            (lead_id, agent, attempt_level, result, priority, next_call_at, done_at, created_at)
            VALUES (?,?,?,?,?,?,?,?)
        """, (
            lead_id,
            agent,
            lvl,
            random.choice(NON_DEFINITIFS),
            "NORMAL",
            None,
            call_time.isoformat(),
            now.isoformat()
        ))
        call_time += timedelta(minutes=20)

    # relance planifiée
    next_call = now + timedelta(minutes=random.choice([30, 60, 120]))
    c.execute("""
        INSERT INTO calls
        (lead_id, agent, attempt_level, result, priority, next_call_at, done_at, created_at)
        VALUES (?,?,?,?,?,?,?,?)
    """, (
        lead_id,
        agent,
        nb_calls + 1,
        "Planifiée",
        "P1" if i % 3 == 0 else "NORMAL",
        next_call.isoformat(),
        None,
        now.isoformat()
    ))

conn.commit()
conn.close()

print("✅ Seed métier terminé : appels réalistes, statuts cohérents")
