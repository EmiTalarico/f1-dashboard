import json
import asyncio
import logging
import aiohttp

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
_current_session_key = None
_http_session: aiohttp.ClientSession | None = None

_position_owner: dict[str, str] = {}

_last_sector_log_at: float = 0
_SECTOR_LOG_INTERVAL = 15  # segundos

# Rastreo de vueltas por piloto para detectar vuelta nueva
_driver_lap_count: dict[str, int] = {}


def _check_position_conflict(num: str, position: str):
    prev_owner = _position_owner.get(position)
    if prev_owner and prev_owner != num:
        logger.warning(
            f"⚠️ CONFLICTO Position={position}: antes #{prev_owner}, ahora #{num}"
        )
    _position_owner[position] = num


def _log_sector_sample():
    global _last_sector_log_at
    import time
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
        summary[f"S{int(s_key)+1}"] = {
            "count": len(segs),
            "keys": seg_keys,
        }
    logger.info(f"🧭 SECTORS líder #{leader_num}: {summary}")


def _reset_driver_sectors(number: str):
    """
    Limpia los segmentos de todos los sectores de un piloto al empezar
    una vuelta nueva. Conserva los tiempos de sector (Value) de la vuelta
    anterior hasta que lleguen los nuevos — así no se ve un flash en blanco.
    """
    driver = state["timing"].get(number)
    if not driver or "Sectors" not in driver:
        return
    for s_key in driver["Sectors"]:
        sector = driver["Sectors"][s_key]
        if isinstance(sector, dict) and "Segments" in sector:
            # Limpiamos los segmentos pero dejamos el tiempo visible
            sector["Segments"] = {}
    logger.debug(f"🔄 Sectores reseteados para piloto #{number}")


def _merge_sectors(prev_sectors: dict, new_sectors: dict) -> dict:
    """
    Merge profundo de sectores acumulando segmentos.

    Reglas:
    - Los segmentos se acumulan — nunca reemplazar el dict entero
    - Status 0 (no pasado aún) NO sobreescribe un status con color ya registrado
    - Los demás campos del sector (Value, OverallFastest, etc.) sí se reemplazan
      porque el feed los manda completos cuando el sector termina
    """
    merged = dict(prev_sectors)

    for s_key, new_sector in new_sectors.items():
        if not isinstance(new_sector, dict):
            merged[s_key] = new_sector
            continue

        prev_sector = merged.get(s_key, {})
        if not isinstance(prev_sector, dict):
            merged[s_key] = new_sector
            continue

        # Merge de campos del sector sin tocar Segments
        merged_sector = {
            **prev_sector,
            **{k: v for k, v in new_sector.items() if k != "Segments"}
        }

        # Merge de segmentos con regla: status 0 no sobreescribe color
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

                # Status 0 = "no pasado aún" — no sobreescribe un color ya pintado
                if new_status == 0 and prev_status != 0:
                    continue

                merged_segs[seg_key] = seg_val

            merged_sector["Segments"] = merged_segs

        elif "Segments" in prev_sector:
            # No llegaron segmentos nuevos — conservar los previos
            merged_sector["Segments"] = prev_sector["Segments"]

        merged[s_key] = merged_sector

    return merged


def _detect_new_lap(number: str, data: dict) -> bool:
    """
    Detecta si el mensaje indica que el piloto empezó una vuelta nueva.
    Señales:
    1. NumberOfLaps incrementó respecto al último conocido
    2. El sector 0 llegó con Segments vacío o con todos en status 0,
       después de haber tenido segmentos con color — indica reset del feed
    """
    # Señal 1: NumberOfLaps por piloto
    if "NumberOfLaps" in data:
        new_laps = data["NumberOfLaps"]
        if isinstance(new_laps, (int, float)):
            prev_laps = _driver_lap_count.get(number, 0)
            if new_laps > prev_laps:
                _driver_lap_count[number] = int(new_laps)
                return True
            _driver_lap_count[number] = int(new_laps)

    # Señal 2: S0 llega con Segments donde todos son status 0,
    # pero el piloto tenía segmentos con color en S0
    if "Sectors" in data and isinstance(data["Sectors"], dict):
        new_s0 = data["Sectors"].get("0")
        if isinstance(new_s0, dict) and "Segments" in new_s0:
            new_segs = new_s0["Segments"]
            if isinstance(new_segs, dict) and len(new_segs) > 0:
                all_zero = all(
                    (v.get("Status", 0) == 0 if isinstance(v, dict) else True)
                    for v in new_segs.values()
                )
                if all_zero:
                    # Verificar que antes había segmentos con color en S0
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
    """
    Aplica una actualización parcial de timing a un piloto con merge
    profundo de Sectors/Segments y detección de vuelta nueva.
    """
    if number not in state["timing"]:
        state["timing"][number] = {}

    driver = state["timing"][number]

    # Detectar vuelta nueva ANTES de aplicar el update
    if _detect_new_lap(number, data):
        logger.debug(f"🔄 Nueva vuelta detectada para piloto #{number}")
        _reset_driver_sectors(number)

    # Posición
    if "Line" in data:
        pos = str(data["Line"])
        _check_position_conflict(number, pos)
        driver["Position"] = pos

    if "Position" in data:
        pos = str(data["Position"])
        _check_position_conflict(number, pos)
        driver["Position"] = pos

    # Resto de campos con merge profundo para Sectors
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
            else:
                logger.warning(f"Stints estáticos no disponibles aún (status {r.status})")
    except Exception as e:
        logger.error(f"Error fetching stints estáticos: {e}")


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
            state["session"] = msg
            notify_listeners("session", msg)

        elif topic == "SessionData":
            if isinstance(msg, dict):
                state["session_data"].update(msg)
            notify_listeners("session_data", state["session_data"])

        elif topic == "TimingData":
            lines = msg.get("Lines", {})
            if not isinstance(lines, dict):
                return
            for number, data in lines.items():
                if not isinstance(data, dict):
                    continue
                _apply_timing_update(number, data)
            notify_listeners("timing", state["timing"])
            _log_sector_sample()

        elif topic == "TimingDataF1":
            lines = msg.get("Lines", {})
            if not isinstance(lines, dict):
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

        elif topic == "WeatherData":
            state["weather"] = msg
            notify_listeners("weather", msg)

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

        elif topic == "LapCount":
            state["session_data"]["LapCount"] = msg
            notify_listeners("session_data", state["session_data"])

        elif topic == "ExtrapolatedClock":
            state["session_data"]["Clock"] = msg
            notify_listeners("session_data", state["session_data"])

        elif topic == "SessionStatus":
            state["session_data"]["Status"] = msg
            notify_listeners("session_data", state["session_data"])

    except Exception as e:
        logger.error(f"Error procesando {topic}: {e}")


async def start_live_client():
    global _http_session

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
                            "Heartbeat",
                            "SessionInfo",
                            "SessionStatus",
                            "SessionData",
                            "TimingData",
                            "TimingDataF1",
                            "TimingAppData",
                            "TimingStats",
                            "TrackStatus",
                            "DriverList",
                            "WeatherData",
                            "RaceControlMessages",
                            "LapCount",
                            "ExtrapolatedClock",
                            "TopThree",
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