import json
import asyncio
import logging
import aiohttp
import os
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SAVE_INTERVAL = 10
REDIS_KEY = "f1:live_state"
REDIS_SESSIONS_INDEX = "f1:sessions"
MAX_HISTORY_EVENTS = 80000  # ~40MB máx por sesión

# Tipos de sesión que grabamos (filtramos prácticas)
RECORD_SESSION_TYPES = {"Qualifying", "Race"}

# Topics que grabamos para el replay (excluimos Heartbeat y TopThree)
RECORD_TOPICS = {
    "SessionInfo", "SessionData", "SessionStatus",
    "TimingData", "TimingDataF1", "TimingAppData",
    "TimingStats", "TrackStatus", "DriverList",
    "WeatherData", "RaceControlMessages", "LapCount",
    "ExtrapolatedClock",
}

_redis = None
_recording = False          # True si estamos grabando esta sesión
_current_session_key = None
_http_session: aiohttp.ClientSession | None = None
_position_owner: dict[str, str] = {}
_driver_lap_count: dict[str, int] = {}
_last_sector_log_at: float = 0
_last_save_at: float = 0
_SECTOR_LOG_INTERVAL = 15

state = {
    "connected": False,
    "session": {},
    "timing": {},
    "tyres": {},
    "weather": {},
    "race_control": [],
    "session_data": {},
    "track_status": {},
    "timing_stats": {},
}

listeners = []


# ── Redis ──────────────────────────────────────────────────────────────────────

async def init_redis():
    global _redis
    redis_url = os.environ.get("REDIS_URL")
    if not redis_url:
        logger.warning("REDIS_URL no encontrada — estado no será persistido")
        return
    try:
        import redis.asyncio as aioredis
        _redis = aioredis.from_url(redis_url, decode_responses=True)
        await _redis.ping()
        logger.info("✅ Redis conectado")
    except Exception as e:
        logger.warning(f"Redis no disponible: {e} — continuando sin persistencia")
        _redis = None


# ── Grabación de historial ─────────────────────────────────────────────────────

async def record_event(topic: str, data):
    """Guarda un evento en la lista de historial de la sesión actual."""
    global _recording
    if not _redis or not _recording or not _current_session_key:
        return
    if topic not in RECORD_TOPICS:
        return
    try:
        history_key = f"f1:history:{_current_session_key}"
        # Verificar que no superamos el límite
        count = await _redis.llen(history_key)
        if count >= MAX_HISTORY_EVENTS:
            return
        event = json.dumps({
            "ts": time.time(),
            "topic": topic,
            "data": data,
        })
        await _redis.rpush(history_key, event)
        # TTL de 30 días para el historial
        if count == 0:
            await _redis.expire(history_key, 86400 * 30)
    except Exception as e:
        logger.warning(f"Error grabando evento: {e}")


async def start_recording(session_key: int, session_info: dict):
    """Inicia la grabación de una nueva sesión."""
    global _recording
    if not _redis:
        return

    session_type = session_info.get("Name", "")
    session_name = session_info.get("Name", "")
    meeting_name = session_info.get("Meeting", {}).get("Name", "")
    start_date = session_info.get("StartDate", "")

    if session_type not in RECORD_SESSION_TYPES:
        logger.info(f"Sesión '{session_type}' no se graba (no es qualy o carrera)")
        _recording = False
        return

    _recording = True
    logger.info(f"🔴 Iniciando grabación: {meeting_name} — {session_name} (key: {session_key})")

    # Registrar en el índice de sesiones
    try:
        session_meta = json.dumps({
            "key": session_key,
            "type": session_type,
            "name": session_name,
            "meeting": meeting_name,
            "date": start_date,
            "recorded_at": time.time(),
        })
        await _redis.hset(REDIS_SESSIONS_INDEX, str(session_key), session_meta)
        await _redis.expire(REDIS_SESSIONS_INDEX, 86400 * 30)
    except Exception as e:
        logger.warning(f"Error registrando sesión en índice: {e}")


# ── Persistencia estado actual ─────────────────────────────────────────────────

async def save_state_async():
    global _last_save_at
    now = time.time()
    if now - _last_save_at < SAVE_INTERVAL:
        return
    _last_save_at = now
    if not _redis:
        return
    try:
        data = {
            "session": state["session"],
            "timing": state["timing"],
            "tyres": state["tyres"],
            "weather": state["weather"],
            "race_control": state["race_control"],
            "session_data": state["session_data"],
            "track_status": state["track_status"],
            "timing_stats": state["timing_stats"],
        }
        await _redis.set(REDIS_KEY, json.dumps(data), ex=86400 * 7)
    except Exception as e:
        logger.warning(f"Error guardando en Redis: {e}")


def save_state():
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(save_state_async())
    except Exception:
        pass


async def load_state():
    if not _redis:
        logger.info("Sin Redis — arrancando con estado vacío")
        return
    try:
        raw = await _redis.get(REDIS_KEY)
        if not raw:
            logger.info("No hay estado previo en Redis")
            return
        data = json.loads(raw)
        for key in ("session", "timing", "tyres", "weather", "race_control",
                    "session_data", "track_status", "timing_stats"):
            if key in data:
                state[key] = data[key]
        logger.info(f"✅ Estado previo cargado desde Redis — {len(state['timing'])} pilotos, sesión: {state['session'].get('Name', 'desconocida')}")
    except Exception as e:
        logger.warning(f"Error cargando estado desde Redis: {e}")


# ── Helpers timing ─────────────────────────────────────────────────────────────

def _check_position_conflict(num: str, position: str):
    prev_owner = _position_owner.get(position)
    if prev_owner and prev_owner != num:
        logger.warning(f"⚠️ CONFLICTO Position={position}: antes #{prev_owner}, ahora #{num}")
    _position_owner[position] = num


def _log_sector_sample():
    global _last_sector_log_at
    now = time.time()
    if now - _last_sector_log_at < _SECTOR_LOG_INTERVAL:
        return
    _last_sector_log_at = now
    leader_num = _position_owner.get("1")
    if not leader_num:
        return
    driver = state["timing"].get(leader_num)
    if not driver or "Sectors" not in driver:
        return
    summary = {}
    for s_key, sector in driver["Sectors"].items():
        segs = sector.get("Segments", {})
        seg_keys = sorted(segs.keys(), key=lambda x: int(x))
        summary[f"S{int(s_key)+1}"] = {"count": len(segs), "keys": seg_keys}
    logger.info(f"🧭 SECTORS líder #{leader_num}: {summary}")


def _reset_driver_sectors(number: str):
    driver = state["timing"].get(number)
    if not driver or "Sectors" not in driver:
        return
    for s_key in driver["Sectors"]:
        sector = driver["Sectors"][s_key]
        if isinstance(sector, dict) and "Segments" in sector:
            sector["Segments"] = {}


def _merge_sectors(prev_sectors: dict, new_sectors: dict) -> dict:
    merged = dict(prev_sectors)
    for s_key, new_sector in new_sectors.items():
        if not isinstance(new_sector, dict):
            merged[s_key] = new_sector
            continue
        prev_sector = merged.get(s_key, {})
        if not isinstance(prev_sector, dict):
            merged[s_key] = new_sector
            continue
        merged_sector = {
            **prev_sector,
            **{k: v for k, v in new_sector.items() if k != "Segments"}
        }
        if "Segments" in new_sector and isinstance(new_sector["Segments"], dict):
            prev_segs = prev_sector.get("Segments", {})
            if not isinstance(prev_segs, dict):
                prev_segs = {}
            merged_segs = dict(prev_segs)
            for seg_key, seg_val in new_sector["Segments"].items():
                if not isinstance(seg_val, dict):
                    merged_segs[seg_key] = seg_val
                    continue
                new_status = seg_val.get("Status", 0)
                prev_status = prev_segs.get(seg_key, {}).get("Status", 0) if isinstance(prev_segs.get(seg_key), dict) else 0
                if new_status == 0 and prev_status != 0:
                    continue
                merged_segs[seg_key] = seg_val
            merged_sector["Segments"] = merged_segs
        elif "Segments" in prev_sector:
            merged_sector["Segments"] = prev_sector["Segments"]
        merged[s_key] = merged_sector
    return merged


def _detect_new_lap(number: str, data: dict) -> bool:
    if "NumberOfLaps" in data:
        new_laps = data["NumberOfLaps"]
        if isinstance(new_laps, (int, float)):
            prev_laps = _driver_lap_count.get(number, 0)
            if new_laps > prev_laps:
                _driver_lap_count[number] = int(new_laps)
                return True
            _driver_lap_count[number] = int(new_laps)

    if "Sectors" in data and isinstance(data["Sectors"], dict):
        new_s0 = data["Sectors"].get("0")
        if isinstance(new_s0, dict) and "Segments" in new_s0:
            new_segs = new_s0["Segments"]
            if isinstance(new_segs, dict) and len(new_segs) >= 4:
                all_zero = all(
                    (v.get("Status", 0) == 0 if isinstance(v, dict) else True)
                    for v in new_segs.values()
                )
                if all_zero:
                    prev_driver = state["timing"].get(number, {})
                    prev_s0 = prev_driver.get("Sectors", {}).get("0", {})
                    prev_segs = prev_s0.get("Segments", {}) if isinstance(prev_s0, dict) else {}
                    had_color = any(
                        (v.get("Status", 0) not in (0,) if isinstance(v, dict) else False)
                        for v in prev_segs.values()
                    )
                    if had_color:
                        return True
    return False


def _apply_timing_update(number: str, data: dict):
    if number not in state["timing"]:
        state["timing"][number] = {}
    driver = state["timing"][number]
    if _detect_new_lap(number, data):
        _reset_driver_sectors(number)
    if "Line" in data:
        pos = str(data["Line"])
        _check_position_conflict(number, pos)
        driver["Position"] = pos
    if "Position" in data:
        pos = str(data["Position"])
        _check_position_conflict(number, pos)
        driver["Position"] = pos
    for k, v in data.items():
        if v is None or k in ("Line", "Position"):
            continue
        if k == "Sectors" and isinstance(v, dict):
            prev_sectors = driver.get("Sectors", {})
            if not isinstance(prev_sectors, dict):
                prev_sectors = {}
            driver["Sectors"] = _merge_sectors(prev_sectors, v)
        else:
            driver[k] = v


def notify_listeners(topic: str, data):
    message = json.dumps({"topic": topic, "data": data})
    dead = []
    for q in listeners:
        try:
            q.put_nowait(message)
        except Exception:
            dead.append(q)
    for q in dead:
        listeners.remove(q)


def reset_session_state():
    state["timing"] = {}
    state["tyres"] = {}
    state["race_control"] = []
    state["session_data"] = {}
    state["track_status"] = {}
    state["timing_stats"] = {}
    _position_owner.clear()
    _driver_lap_count.clear()
    logger.info("Estado de sesión reseteado")


async def fetch_static_stints(session_info: dict):
    global _http_session
    if not _http_session:
        return
    try:
        path = session_info.get("Path", "")
        if not path:
            return
        url = f"https://livetiming.formula1.com/static/{path}TimingAppData.json"
        logger.info(f"Fetching stints estáticos: {url}")
        async with _http_session.get(url) as r:
            if r.status == 200:
                data = await r.json(content_type=None)
                lines = data.get("Lines", {})
                if not isinstance(lines, dict):
                    return
                for number, driver_data in lines.items():
                    if not isinstance(driver_data, dict):
                        continue
                    if number not in state["tyres"]:
                        state["tyres"][number] = {}
                    if "Stints" in driver_data:
                        if "Stints" not in state["tyres"][number]:
                            state["tyres"][number]["Stints"] = {}
                        stints = driver_data["Stints"]
                        if isinstance(stints, dict):
                            for stint_key, stint_data in stints.items():
                                if not isinstance(stint_data, dict):
                                    continue
                                if stint_key not in state["tyres"][number]["Stints"]:
                                    state["tyres"][number]["Stints"][stint_key] = {}
                                for k, v in stint_data.items():
                                    if k not in state["tyres"][number]["Stints"][stint_key]:
                                        state["tyres"][number]["Stints"][stint_key][k] = v
                notify_listeners("tyres", state["tyres"])
                logger.info(f"✅ Stints estáticos cargados para {len(lines)} pilotos")
    except Exception as e:
        logger.error(f"Error fetching stints estáticos: {e}")


# ── Procesamiento de mensajes ──────────────────────────────────────────────────

def process_message(topic: str, msg):
    global _current_session_key
    try:
        if not isinstance(msg, dict):
            return

        if topic == "SessionInfo":
            new_key = msg.get("Key") or msg.get("Meeting", {}).get("Key")
            if new_key and new_key != _current_session_key:
                logger.info(f"Nueva sesión detectada: {new_key}")
                _current_session_key = new_key
                reset_session_state()
                # Iniciar grabación si corresponde
                asyncio.ensure_future(start_recording(new_key, msg))
            state["session"] = msg
            notify_listeners("session", msg)
            save_state()

        elif topic == "SessionData":
            if isinstance(msg, dict):
                state["session_data"].update(msg)
            notify_listeners("session_data", state["session_data"])

        elif topic == "TimingData":
            lines = msg.get("Lines", {})
            if not isinstance(lines, dict):
                if isinstance(lines, list):
                    logger.warning("TimingData Lines llegó como lista, ignorando")
                return
            for number, data in lines.items():
                if not isinstance(data, dict):
                    continue
                _apply_timing_update(number, data)
            notify_listeners("timing", state["timing"])
            _log_sector_sample()
            save_state()

        elif topic == "TimingDataF1":
            lines = msg.get("Lines", {})
            if not isinstance(lines, dict):
                if isinstance(lines, list):
                    logger.warning("TimingDataF1 Lines llegó como lista, ignorando")
                return
            for number, data in lines.items():
                if not isinstance(data, dict):
                    continue
                _apply_timing_update(number, data)
            notify_listeners("timing", state["timing"])

        elif topic == "TimingAppData":
            lines = msg.get("Lines", {})
            if not isinstance(lines, dict):
                return
            for number, data in lines.items():
                if not isinstance(data, dict):
                    continue
                if number not in state["tyres"]:
                    state["tyres"][number] = {}
                if "Stints" in data:
                    if "Stints" not in state["tyres"][number]:
                        state["tyres"][number]["Stints"] = {}
                    stints = data["Stints"]
                    if isinstance(stints, dict):
                        for stint_key, stint_data in stints.items():
                            if not isinstance(stint_data, dict):
                                continue
                            if stint_key not in state["tyres"][number]["Stints"]:
                                state["tyres"][number]["Stints"][stint_key] = {}
                            state["tyres"][number]["Stints"][stint_key].update(stint_data)
                for k, v in data.items():
                    if k != "Stints" and v is not None:
                        state["tyres"][number][k] = v
            notify_listeners("tyres", state["tyres"])
            save_state()

        elif topic == "WeatherData":
            state["weather"] = msg
            notify_listeners("weather", msg)
            save_state()

        elif topic == "RaceControlMessages":
            messages = msg.get("Messages", {})
            if isinstance(messages, dict):
                for _, m in messages.items():
                    if isinstance(m, dict) and m not in state["race_control"]:
                        state["race_control"].append(m)
            elif isinstance(messages, list):
                for m in messages:
                    if isinstance(m, dict) and m not in state["race_control"]:
                        state["race_control"].append(m)
            state["race_control"] = state["race_control"][-20:]
            notify_listeners("race_control", state["race_control"])
            save_state()

        elif topic == "DriverList":
            if not isinstance(msg, dict):
                return
            for number, data in msg.items():
                if not isinstance(data, dict):
                    continue
                if number not in state["timing"]:
                    state["timing"][number] = {}
                for field in ("Line", "RacingNumber", "Tla", "FullName",
                              "TeamName", "TeamColour", "CountryCode"):
                    if field in data:
                        if field == "Line":
                            pos = str(data["Line"])
                            _check_position_conflict(number, pos)
                            state["timing"][number]["Position"] = pos
                        else:
                            state["timing"][number][field] = data[field]
            notify_listeners("timing", state["timing"])
            save_state()

        elif topic == "TrackStatus":
            state["track_status"] = msg
            notify_listeners("track_status", msg)

        elif topic == "TimingStats":
            lines = msg.get("Lines", {})
            if not isinstance(lines, dict):
                return
            for number, data in lines.items():
                if not isinstance(data, dict):
                    continue
                if number not in state["timing_stats"]:
                    state["timing_stats"][number] = {}
                state["timing_stats"][number].update(data)
            notify_listeners("timing_stats", state["timing_stats"])
            save_state()

        elif topic == "LapCount":
            state["session_data"]["LapCount"] = msg
            notify_listeners("session_data", state["session_data"])

        elif topic == "ExtrapolatedClock":
            state["session_data"]["Clock"] = msg
            notify_listeners("session_data", state["session_data"])

        elif topic == "SessionStatus":
            state["session_data"]["Status"] = msg
            notify_listeners("session_data", state["session_data"])

        # Grabar el evento en Redis si estamos grabando
        if _recording and topic in RECORD_TOPICS:
            asyncio.ensure_future(record_event(topic, msg))

    except Exception as e:
        logger.error(f"Error procesando {topic}: {e}")


# ── Funciones de historial (llamadas desde main.py) ───────────────────────────

async def get_sessions_index() -> list:
    """Devuelve el índice de sesiones grabadas."""
    if not _redis:
        return []
    try:
        raw = await _redis.hgetall(REDIS_SESSIONS_INDEX)
        sessions = []
        for key, val in raw.items():
            try:
                sessions.append(json.loads(val))
            except Exception:
                pass
        return sorted(sessions, key=lambda s: s.get("recorded_at", 0), reverse=True)
    except Exception as e:
        logger.error(f"Error leyendo índice de sesiones: {e}")
        return []


async def get_session_history(session_key: int) -> list:
    """Devuelve todos los eventos grabados de una sesión."""
    if not _redis:
        return []
    try:
        history_key = f"f1:history:{session_key}"
        raw_events = await _redis.lrange(history_key, 0, -1)
        return [json.loads(e) for e in raw_events]
    except Exception as e:
        logger.error(f"Error leyendo historial: {e}")
        return []


async def delete_session_history(session_key: int):
    """Borra el historial de una sesión de Redis."""
    if not _redis:
        return
    try:
        history_key = f"f1:history:{session_key}"
        await _redis.delete(history_key)
        await _redis.hdel(REDIS_SESSIONS_INDEX, str(session_key))
        logger.info(f"Historial de sesión {session_key} eliminado")
    except Exception as e:
        logger.error(f"Error borrando historial: {e}")


async def get_history_size(session_key: int) -> dict:
    """Devuelve el tamaño del historial de una sesión."""
    if not _redis:
        return {"events": 0, "size_kb": 0}
    try:
        history_key = f"f1:history:{session_key}"
        count = await _redis.llen(history_key)
        # Estimación: ~500 bytes por evento
        return {"events": count, "estimated_size_kb": round(count * 0.5)}
    except Exception:
        return {"events": 0, "estimated_size_kb": 0}


# ── Cliente WebSocket F1 ───────────────────────────────────────────────────────

async def start_live_client():
    global _http_session

    await init_redis()
    await load_state()

    while True:
        try:
            logger.info("Negociando conexión con F1...")
            async with aiohttp.ClientSession() as http:
                _http_session = http
                async with http.post(
                    "https://livetiming.formula1.com/signalrcore/negotiate?negotiateVersion=1",
                    headers={"User-Agent": "BestHTTP"},
                ) as r:
                    negotiate = await r.json()

                token = negotiate["connectionToken"]
                ws_url = f"wss://livetiming.formula1.com/signalrcore?id={token}"

                logger.info("Conectando al feed de F1...")
                async with http.ws_connect(
                    ws_url,
                    headers={"User-Agent": "BestHTTP"},
                    heartbeat=30,
                    timeout=aiohttp.ClientTimeout(total=None, connect=10),
                ) as ws:
                    await ws.send_str(json.dumps({"protocol": "json", "version": 1}) + "\x1e")
                    await ws.receive()

                    subscribe = {
                        "type": 1,
                        "invocationId": "0",
                        "target": "Subscribe",
                        "arguments": [[
                            "Heartbeat", "SessionInfo", "SessionStatus",
                            "SessionData", "TimingData", "TimingDataF1",
                            "TimingAppData", "TimingStats", "TrackStatus",
                            "DriverList", "WeatherData", "RaceControlMessages",
                            "LapCount", "ExtrapolatedClock", "TopThree",
                        ]],
                    }
                    await ws.send_str(json.dumps(subscribe) + "\x1e")

                    state["connected"] = True
                    logger.info("✅ Conectado al feed de F1 — esperando sesión activa")

                    async for msg in ws:
                        if msg.type == aiohttp.WSMsgType.TEXT:
                            parts = msg.data.split("\x1e")
                            for part in parts:
                                part = part.strip()
                                if not part:
                                    continue
                                try:
                                    data = json.loads(part)
                                    msg_type = data.get("type")
                                    if msg_type == 6:
                                        continue
                                    if msg_type == 1:
                                        target = data.get("target", "")
                                        args = data.get("arguments", [])
                                        if target == "feed" and len(args) >= 2:
                                            process_message(args[0], args[1])
                                        elif target and args:
                                            process_message(target, args[0])
                                except Exception as e:
                                    logger.error(f"Error parseando: {e}")
                        elif msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                            logger.warning(f"WebSocket cerrado: {msg.type}")
                            break

        except Exception as e:
            logger.error(f"Desconectado: {e}")
            state["connected"] = False
            _http_session = None

        logger.info("Reintentando en 5 segundos...")
        await asyncio.sleep(5)


def get_full_state() -> dict:
    return {
        "connected": state["connected"],
        "session": state["session"],
        "timing": state["timing"],
        "tyres": state["tyres"],
        "weather": state["weather"],
        "race_control": state["race_control"],
        "session_data": state["session_data"],
        "track_status": state["track_status"],
        "timing_stats": state["timing_stats"],
    }