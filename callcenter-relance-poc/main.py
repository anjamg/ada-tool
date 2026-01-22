from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from datetime import datetime
from zoneinfo import ZoneInfo  # Python 3.9+
import sqlite3
import statistics
import logging

# ================= LOGGING =================
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ================= TIMEZONE =================
PARIS = ZoneInfo("Europe/Paris")

def iso_now():
    # Convention : toutes les dates sont stockées en heure Europe/Paris
    return datetime.now(PARIS).isoformat()

# ================= APP =================
app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

DB = "calls.db"

def db():
    return sqlite3.connect(DB, check_same_thread=False)

# ================= UTILS =================
def validate_pagination(page: int, limit: int) -> tuple[int, int]:
    """Valide et nettoie les paramètres de pagination"""
    try:
        page = max(1, int(page))
        limit = max(1, min(100, int(limit)))  # Max 100 items par page
    except (ValueError, TypeError):
        page = 1
        limit = 20
    return page, limit

def parse_fr_dt(s: str | None):
    if not s:
        return None
    s = s.strip()
    if not s:
        return None
    try:
        # Date issue de Creatio / saisie humaine → heure Paris déjà correcte
        return datetime.strptime(s, "%d/%m/%Y %H:%M").isoformat()
    except Exception:
        return None

def in_business_hours(dt: datetime):
    dow = dt.weekday()  # 0=Mon … 6=Sun
    open_h = 9
    close_h = 18 if dow in (5, 6) else 19
    return open_h <= dt.hour < close_h

def ensure_columns(c, table: str, wanted: dict[str, str]):
    cols = {row[1] for row in c.execute(f"PRAGMA table_info({table})").fetchall()}
    for name, coldef in wanted.items():
        if name not in cols:
            c.execute(f"ALTER TABLE {table} ADD COLUMN {name} {coldef}")

def safe_db_operation(func):
    """Décorateur pour les opérations DB sécurisées"""
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            logger.error(f"Database error in {func.__name__}: {str(e)}")
            return JSONResponse(
                {"error": "Database operation failed"},
                status_code=500
            )
    return wrapper

# ================= DB INIT =================
def init_db():
    c = db()

    c.execute("""
    CREATE TABLE IF NOT EXISTS leads (
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
    CREATE TABLE IF NOT EXISTS calls (
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

    # migrations soft
    ensure_columns(c, "leads", {"phone": "TEXT"})
    ensure_columns(c, "calls", {"done_at": "TEXT"})

    c.commit()

init_db()

# ================= ROUTES =================
@app.get("/")
def index():
    return FileResponse("index.html")

# ---------- LEAD ----------
@app.post("/lead")
async def create_lead(data: dict):
    required = ["lead_key", "projet", "type_lead", "lead_created_at"]
    for k in required:
        if not data.get(k):
            return JSONResponse({"error": f"Missing {k}"}, status_code=400)

    lead_created_at_iso = parse_fr_dt(data["lead_created_at"])
    if not lead_created_at_iso:
        return JSONResponse(
            {"error": "Invalid lead_created_at (DD/MM/YYYY HH:mm)"},
            status_code=400
        )

    c = db()
    c.execute("""
        INSERT OR IGNORE INTO leads
        (lead_key, phone, projet, type_lead, lead_created_at, created_at)
        VALUES (?,?,?,?,?,?)
    """, (
        data["lead_key"].strip(),
        None,
        data["projet"].strip(),
        data["type_lead"].strip(),
        lead_created_at_iso,
        iso_now()
    ))
    c.commit()

    row = c.execute(
        "SELECT id FROM leads WHERE lead_key=?",
        (data["lead_key"].strip(),)
    ).fetchone()

    return {"lead_id": row[0]}

# ---------- ACTION (appel + relance optionnelle) ----------
@app.post("/action")
async def save_action(data: dict):
    required = ["lead_id", "phone", "agent", "attempt_level", "result", "priority"]
    for k in required:
        if not data.get(k):
            return JSONResponse({"error": f"Missing {k}"}, status_code=400)

    lead_id = int(data["lead_id"])
    now = iso_now()

    phone = str(data["phone"]).strip()
    if not phone.isdigit():
        return JSONResponse(
            {"error": "Phone must be digits only (ex: 337XXXXXXXX)"},
            status_code=400
        )

    c = db()

    # Update phone
    c.execute("UPDATE leads SET phone=? WHERE id=?", (phone, lead_id))

    # Appel exécuté
    c.execute("""
        INSERT INTO calls
        (lead_id, agent, attempt_level, result, priority, next_call_at, done_at, created_at)
        VALUES (?,?,?,?,?,?,?,?)
    """, (
        lead_id,
        data["agent"],
        int(data["attempt_level"]),
        data["result"],
        data["priority"],
        None,
        now,
        now
    ))

    # Relance planifiée (optionnelle)
    relance_level = data.get("relance_level")
    relance_at = data.get("relance_at")
    relance_priority = data.get("relance_priority", "NORMAL")

    if relance_level and relance_level != "none":
        if not relance_at:
            return JSONResponse({"error": "Missing relance_at"}, status_code=400)
        try:
            relance_iso = datetime.fromisoformat(relance_at).isoformat()
        except Exception:
            return JSONResponse({"error": "Invalid relance_at"}, status_code=400)

        c.execute("""
            INSERT INTO calls
            (lead_id, agent, attempt_level, result, priority, next_call_at, done_at, created_at)
            VALUES (?,?,?,?,?,?,?,?)
        """, (
            lead_id,
            data["agent"],
            int(relance_level),
            "Planifiée",
            relance_priority,
            relance_iso,
            None,
            now
        ))

    c.commit()
    return {"ok": True}

# ---------- RELANCES ----------
@app.get("/relances")
def relances(projet: str = "", type_lead: str = "", page: int = 1, limit: int = 20):
    try:
        page, limit = validate_pagination(page, limit)
        
        c = db()
        where = ["c.done_at IS NULL", "c.next_call_at IS NOT NULL"]
        params = []

        if projet:
            where.append("l.projet=?")
            params.append(projet)
        if type_lead:
            where.append("l.type_lead=?")
            params.append(type_lead)

        # Compter le total
        total_rows = c.execute(f"""
            SELECT COUNT(*)
            FROM calls c
            JOIN leads l ON l.id=c.lead_id
            WHERE {" AND ".join(where)}
        """, params).fetchone()[0]

        # Récupérer page spécifique
        offset = (page - 1) * limit
        rows = c.execute(f"""
            SELECT
              c.id, l.lead_key, l.phone, l.projet, l.type_lead,
              c.agent, c.attempt_level, c.priority, c.next_call_at
            FROM calls c
            JOIN leads l ON l.id=c.lead_id
            WHERE {" AND ".join(where)}
            ORDER BY c.next_call_at ASC
            LIMIT ? OFFSET ?
        """, params + [limit, offset]).fetchall()

        c.close()

        data = [{
            "call_id": r[0],
            "lead_key": r[1],
            "phone": r[2],
            "projet": r[3],
            "type_lead": r[4],
            "agent": r[5],
            "attempt_level": r[6],
            "priority": r[7],
            "next_call_at": r[8],
        } for r in rows]

        return {
            "data": data,
            "page": page,
            "limit": limit,
            "total": total_rows,
            "pages": (total_rows + limit - 1) // limit
        }
    except Exception as e:
        logger.error(f"Error in relances: {str(e)}")
        return JSONResponse({"error": "Failed to fetch relances"}, status_code=500)

# ---------- CONTEXT RELANCE ----------
@app.get("/relance/{call_id}")
def relance_context(call_id: int):
    c = db()
    row = c.execute("""
        SELECT
          c.id, c.lead_id, c.agent, c.attempt_level, c.priority, c.next_call_at,
          l.lead_key, l.phone, l.projet, l.type_lead, l.lead_created_at
        FROM calls c
        JOIN leads l ON l.id=c.lead_id
        WHERE c.id=?
    """, (call_id,)).fetchone()

    if not row:
        return JSONResponse({"error": "Not found"}, status_code=404)

    return {
        "call_id": row[0],
        "lead_id": row[1],
        "agent": row[2],
        "attempt_level": row[3],
        "priority": row[4],
        "next_call_at": row[5],
        "lead_key": row[6],
        "phone": row[7],
        "projet": row[8],
        "type_lead": row[9],
        "lead_created_at": row[10],
    }

# ---------- COMPLETE RELANCE ----------
@app.post("/relance/{call_id}/complete")
async def complete_relance(call_id: int, data: dict):
    required = ["result", "priority"]
    for k in required:
        if not data.get(k):
            return JSONResponse({"error": f"Missing {k}"}, status_code=400)

    now = iso_now()
    c = db()

    row = c.execute(
        "SELECT lead_id, agent FROM calls WHERE id=?",
        (call_id,)
    ).fetchone()

    if not row:
        return JSONResponse({"error": "Not found"}, status_code=404)

    lead_id, agent = row

    c.execute("""
        UPDATE calls
        SET done_at=?, result=?, priority=?, next_call_at=NULL
        WHERE id=?
    """, (now, data["result"], data["priority"], call_id))

    relance_level = data.get("relance_level")
    relance_at = data.get("relance_at")
    relance_priority = data.get("relance_priority", "NORMAL")

    if relance_level and relance_level != "none":
        if not relance_at:
            return JSONResponse({"error": "Missing relance_at"}, status_code=400)
        try:
            relance_iso = datetime.fromisoformat(relance_at).isoformat()
        except Exception:
            return JSONResponse({"error": "Invalid relance_at"}, status_code=400)

        c.execute("""
            INSERT INTO calls
            (lead_id, agent, attempt_level, result, priority, next_call_at, done_at, created_at)
            VALUES (?,?,?,?,?,?,?,?)
        """, (
            lead_id,
            agent,
            int(relance_level),
            "Planifiée",
            relance_priority,
            relance_iso,
            None,
            now
        ))

    c.commit()
    return {"ok": True}

# ---------- LEADS ----------
@app.get("/leads")
def leads(projet: str = "", type_lead: str = "", page: int = 1, limit: int = 20):
    try:
        page, limit = validate_pagination(page, limit)
        
        c = db()
        where = []
        params = []
        if projet:
            where.append("l.projet=?"); params.append(projet)
        if type_lead:
            where.append("l.type_lead=?"); params.append(type_lead)

        # Compter le total
        total_rows = c.execute(f"""
            SELECT COUNT(*)
            FROM leads l
            {("WHERE " + " AND ".join(where)) if where else ""}
        """, params).fetchone()[0]

        # Récupérer page spécifique
        offset = (page - 1) * limit
        rows = c.execute(f"""
            SELECT
              l.id, l.lead_key, l.phone, l.projet, l.type_lead, l.lead_created_at,
              (SELECT result FROM calls WHERE lead_id=l.id AND done_at IS NOT NULL ORDER BY done_at DESC LIMIT 1),
              (SELECT done_at FROM calls WHERE lead_id=l.id AND done_at IS NOT NULL ORDER BY done_at DESC LIMIT 1),
              (SELECT created_at FROM calls WHERE lead_id=l.id AND done_at IS NOT NULL ORDER BY done_at ASC LIMIT 1),
              (SELECT COUNT(*) FROM calls WHERE lead_id=l.id AND done_at IS NOT NULL)
            FROM leads l
            {("WHERE " + " AND ".join(where)) if where else ""}
            ORDER BY l.lead_created_at DESC
            LIMIT ? OFFSET ?
        """, params + [limit, offset]).fetchall()

        c.close()
        
        out = []
        for r in rows:
            lead_id, lead_key, phone, prj, tl, lead_created_at, last_result, last_done_at, first_call_at, call_count = r

            reactivity_minutes = None
            reactivity_in_scope = 0
            if lead_created_at and first_call_at:
                try:
                    dt_lead = datetime.fromisoformat(lead_created_at).replace(tzinfo=PARIS)
                    if in_business_hours(dt_lead):
                        reactivity_in_scope = 1
                        dt_first = datetime.fromisoformat(first_call_at)
                        reactivity_minutes = int((dt_first - dt_lead).total_seconds() // 60)
                except Exception:
                    pass

            out.append({
                "lead_id": lead_id,
                "lead_key": lead_key,
                "phone": phone,
                "projet": prj,
                "type_lead": tl,
                "lead_created_at": lead_created_at,
                "last_result": last_result,
                "last_done_at": last_done_at,
                "call_count": call_count,
                "reactivity_minutes": reactivity_minutes,
                "reactivity_in_scope": reactivity_in_scope,
            })
        
        return {
            "data": out,
            "page": page,
            "limit": limit,
            "total": total_rows,
            "pages": (total_rows + limit - 1) // limit
        }
    except Exception as e:
        logger.error(f"Error in leads: {str(e)}")
        return JSONResponse({"error": "Failed to fetch leads"}, status_code=500)

# ---------- CALLS ----------
@app.get("/calls")
def calls(projet: str = "", type_lead: str = "", page: int = 1, limit: int = 20):
    try:
        page, limit = validate_pagination(page, limit)
        
        c = db()
        where = ["c.done_at IS NOT NULL"]
        params = []
        if projet:
            where.append("l.projet=?"); params.append(projet)
        if type_lead:
            where.append("l.type_lead=?"); params.append(type_lead)

        # Compter le total
        total_rows = c.execute(f"""
            SELECT COUNT(*)
            FROM calls c
            JOIN leads l ON l.id=c.lead_id
            WHERE {" AND ".join(where)}
        """, params).fetchone()[0]

        # Récupérer page spécifique
        offset = (page - 1) * limit
        rows = c.execute(f"""
            SELECT
              c.id, l.lead_key, l.phone, l.projet, l.type_lead,
              c.agent, c.attempt_level, c.result, c.priority, c.done_at
            FROM calls c
            JOIN leads l ON l.id=c.lead_id
            WHERE {" AND ".join(where)}
            ORDER BY c.done_at DESC
            LIMIT ? OFFSET ?
        """, params + [limit, offset]).fetchall()

        c.close()

        data = [{
            "call_id": r[0],
            "lead_key": r[1],
            "phone": r[2],
            "projet": r[3],
            "type_lead": r[4],
            "agent": r[5],
            "attempt_level": r[6],
            "result": r[7],
            "priority": r[8],
            "done_at": r[9],
        } for r in rows]

        return {
            "data": data,
            "page": page,
            "limit": limit,
            "total": total_rows,
            "pages": (total_rows + limit - 1) // limit
        }
    except Exception as e:
        logger.error(f"Error in calls: {str(e)}")
        return JSONResponse({"error": "Failed to fetch calls"}, status_code=500)

# ---------- DASHBOARD ----------
@app.get("/dashboard")
def dashboard(projet: str = "", type_lead: str = ""):
    response = leads(projet=projet, type_lead=type_lead)
    # Extract data from pagination response
    data = response.get("data", []) if isinstance(response, dict) else response

    total_leads = len(data)
    total_calls = sum(int(l.get("call_count") or 0) for l in data)
    comb = (total_calls / total_leads) if total_leads else 0.0

    reacs = [l["reactivity_minutes"] for l in data if l["reactivity_in_scope"] == 1 and l["reactivity_minutes"] is not None]
    measured = len(reacs)

    mean_reac = round(sum(reacs) / measured, 1) if measured else None
    median_reac = round(statistics.median(reacs), 1) if measured else None
    pct_under_45 = round(100.0 * sum(1 for x in reacs if x <= 45) / measured, 1) if measured else 0.0

    return {
        "leads_total": total_leads,
        "calls_total": total_calls,
        "combativite_calls_per_lead": round(comb, 2),
        "reactivite_mean_minutes": mean_reac,
        "reactivite_median_minutes": median_reac,
        "reactivite_pct_under_45": pct_under_45,
    }
