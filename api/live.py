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
                asyncio.create_task(fetch_static_stints(msg))
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
                if number not in state["timing"]:
                    state["timing"][number] = {}
                if "Line" in data:
                    state["timing"][number]["Position"] = str(data["Line"])
                for k, v in data.items():
                    if v is not None and k != "Line":
                        state["timing"][number][k] = v
            notify_listeners("timing", state["timing"])

        elif topic == "TimingDataF1":
            lines = msg.get("Lines", {})
            if not isinstance(lines, dict):
                return
            for number, data in lines.items():
                if not isinstance(data, dict):
                    continue
                if number not in state["timing"]:
                    state["timing"][number] = {}
                if "Line" in data:
                    state["timing"][number]["Position"] = str(data["Line"])
                if "Position" in data:
                    state["timing"][number]["Position"] = str(data["Position"])
                for k, v in data.items():
                    if v is not None and k != "Line":
                        state["timing"][number][k] = v
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
                            state["timing"][number]["Position"] = str(data["Line"])
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

                    # Ping activo cada 30s para mantener la conexión viva
                    async def send_ping():
                        while True:
                            await asyncio.sleep(30)
                            try:
                                await ws.send_str(json.dumps({"type": 6}) + "\x1e")
                            except Exception:
                                break

                    ping_task = asyncio.create_task(send_ping())

                    try:
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
                    finally:
                        ping_task.cancel()

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