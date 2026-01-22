import sqlite3
import threading
import random
import time
from datetime import datetime, timedelta

DB = "calls.db"
NB_USERS = 20
LEADS_PER_USER = 5

AGENTS_BY_PROJECT = {
    "Colisée": [
        "Hyacinthe", "Yowan", "Lanto Faniry", "Patrick",
        "Sariaka", "Natacha", "Niaina", "Julio",
        "Virginie", "Luisa", "Tsiry", "Angelo",
        "Mira", "Mathieu", "Nardi"
    ],
    "Nohée": [
        "Joy", "Maggy", "Nandrianina", "Boris",
        "Miora", "Aro", "Fazel", "Marielle",
        "Michael"
    ]
}

NON_DEFINITIFS = ["Pas de réponse", "Injoignable", "À rappeler"]
DEFINITIFS = ["Qualifié", "Pas intéressé", "Annulé"]

print_lock = threading.Lock()


def simulate_user(user_id: int):
    conn = sqlite3.connect(
        DB,
        timeout=10,
        check_same_thread=False
    )
    conn.execute("PRAGMA journal_mode=WAL;")
    cursor = conn.cursor()

    for lead_index in range(LEADS_PER_USER):
        now = datetime.now()

        projet = random.choice(list(AGENTS_BY_PROJECT.keys()))
        agent = random.choice(AGENTS_BY_PROJECT[projet])

        lead_key = f"U{user_id}-LEAD-{lead_index}-{int(time.time() * 1000)}"

        try:
            # ===== LEAD =====
            cursor.execute("""
                INSERT INTO leads
                (lead_key, phone, projet, type_lead, lead_created_at, created_at)
                VALUES (?,?,?,?,?,?)
            """, (
                lead_key,
                f"336{random.randint(10000000, 99999999)}",
                projet,
                "Web",
                now.isoformat(),
                now.isoformat()
            ))

            lead_id = cursor.lastrowid

            # ===== APPELS =====
            nb_calls = random.randint(1, 4)
            call_time = now + timedelta(minutes=5)

            for lvl in range(1, nb_calls + 1):
                cursor.execute("""
                    INSERT INTO calls
                    (lead_id, agent, attempt_level, result, priority,
                     next_call_at, done_at, created_at)
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
                call_time += timedelta(minutes=10)

                # écriture concurrente réaliste
                time.sleep(random.uniform(0.05, 0.2))

            # ===== DERNIER STATUT =====
            if random.random() < 0.7:
                # définitif
                cursor.execute("""
                    INSERT INTO calls
                    (lead_id, agent, attempt_level, result, priority,
                     next_call_at, done_at, created_at)
                    VALUES (?,?,?,?,?,?,?,?)
                """, (
                    lead_id,
                    agent,
                    nb_calls + 1,
                    random.choice(DEFINITIFS),
                    "NORMAL",
                    None,
                    datetime.now().isoformat(),
                    now.isoformat()
                ))
            else:
                # planifié
                next_call = now + timedelta(minutes=random.choice([30, 60, 120]))
                cursor.execute("""
                    INSERT INTO calls
                    (lead_id, agent, attempt_level, result, priority,
                     next_call_at, done_at, created_at)
                    VALUES (?,?,?,?,?,?,?,?)
                """, (
                    lead_id,
                    agent,
                    nb_calls + 1,
                    "Planifiée",
                    "P1",
                    next_call.isoformat(),
                    None,
                    now.isoformat()
                ))

            conn.commit()

        except sqlite3.OperationalError as e:
            with print_lock:
                print(f"❌ User {user_id} — SQLite error :", e)

        # pause entre actions utilisateur
        time.sleep(random.uniform(0.1, 0.4))

    conn.close()
    with print_lock:
        print(f"✅ Utilisateur {user_id} terminé")


# ======================
# LANCEMENT CONCURRENT
# ======================

threads = []

for uid in range(1, NB_USERS + 1):
    t = threading.Thread(target=simulate_user, args=(uid,))
    threads.append(t)
    t.start()

for t in threads:
    t.join()

print("🎯 Simulation terminée : 20 utilisateurs simultanés")
