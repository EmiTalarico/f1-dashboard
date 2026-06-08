import json
import asyncio
import logging
import aiohttp

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Estado global
state = {
    "connected": False,
    "session": {},
    "timing": {},
    "tyres": {},
    "weather": {},
    "race_control": [],
    "session_data": {},
}

listeners = []


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


def process_message(topic: str, msg: dict):
    try:
        if topic == "SessionInfo":
            state["session"] = msg
            notify_listeners("session", msg)

        elif topic == "SessionData":
            state["session_data"] = msg
            notify_listeners("session_data", msg)

        elif topic == "TimingData":
            lines = msg.get("Lines", {})
            for number, data in lines.items():
                if number not in state["timing"]:
                    state["timing"][number] = {}
                state["timing"][number].update(data)
            notify_listeners("timing", state["timing"])

        elif topic == "TimingAppData":
            lines = msg.get("Lines", {})
            for number, data in lines.items():
                if number not in state["tyres"]:
                    state["tyres"][number] = {}
                state["tyres"][number].update(data)
            notify_listeners("tyres", state["tyres"])

        elif topic == "WeatherData":
            state["weather"] = msg
            notify_listeners("weather", msg)

        elif topic == "RaceControlMessages":
            messages = msg.get("Messages", {})
            for _, m in messages.items():
                if m not in state["race_control"]:
                    state["race_control"].append(m)
            state["race_control"] = state["race_control"][-10:]
            notify_listeners("race_control", state["race_control"])

        elif topic == "DriverList":
             for number, data in msg.items():
                 if isinstance(data, dict):
                      if number not in state["timing"]:
                          state["timing"][number] = {}
                      if "Line" in data:
                          state["timing"][number]["Position"] = str(data["Line"])
                      if "TeamColour" in data:
                          state["timing"][number]["TeamColour"] = data["TeamColour"]
                      if "Tla" in data:
                          state["timing"][number]["Tla"] = data["Tla"]
                      if "FullName" in data:
                          state["timing"][number]["FullName"] = data["FullName"]
                      if "TeamName" in data:
                          state["timing"][number]["TeamName"] = data["TeamName"]
             notify_listeners("timing", state["timing"])

        elif topic == "TimingDataF1":
            lines = msg.get("Lines", {})
            for number, data in lines.items():
                if number not in state["timing"]:
                    state["timing"][number] = {}
                if "Position" in data:
                    state["timing"][number]["Position"] = str(data["Position"])
                state["timing"][number].update(data)
            notify_listeners("timing", state["timing"])

        elif topic == "LapCount":
            state["session_data"]["LapCount"] = msg
            notify_listeners("session_data", state["session_data"])

        elif topic == "ExtrapolatedClock":
            state["session_data"]["Clock"] = msg
            notify_listeners("session_data", state["session_data"])

    except Exception as e:
        logger.error(f"Error procesando {topic}: {e}")


async def start_live_client():
    while True:
        try:
            logger.info("Negociando conexión con F1...")

            async with aiohttp.ClientSession() as http:
                # Negotiate y connect en la misma sesión para minimizar latencia
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
                    heartbeat=20,
                    timeout=aiohttp.ClientTimeout(total=None),
                ) as ws:
                    # Handshake
                    await ws.send_str(json.dumps({"protocol": "json", "version": 1}) + "\x1e")
                    await ws.receive()

                    # Pedir estado completo primero
                    get_all = {
                        "type": 1,
                        "invocationId": "0",
                        "target": "Start",
                        "arguments": [[
                            "SessionInfo",
                            "SessionData", 
                            "TimingData",
                            "TimingDataF1",
                            "TimingAppData",
                            "WeatherData",
                            "RaceControlMessages",
                            "DriverList",
                            ], []],
                        }
                    await ws.send_str(json.dumps(get_all) + "\x1e")

                    response = await ws.receive()                    

                    # Suscribirse a tópicos
                    subscribe = {
                        "type": 1,
                        "invocationId": "0",
                        "target": "Subscribe",
                        "arguments": [[
                            "SessionInfo",
                            "SessionData",
                            "TimingData",
                            "TimingDataF1",
                            "TimingAppData",
                            "WeatherData",
                            "RaceControlMessages",
                            "DriverList",
                            "LapCount",
                            "ExtrapolatedClock",
                        ]],
                    }
                    await ws.send_str(json.dumps(subscribe) + "\x1e")

                    state["connected"] = True
                    logger.info("✅ Conectado al feed de F1")

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
                                    if data.get("type") == 6:
                                        continue
                                    if data.get("type") == 1:
                                        target = data.get("target", "")
                                        args = data.get("arguments", [])
                                        if target == "feed" and len(args) >= 2:
                                            topic = args[0]
                                            payload = args[1]
                                            process_message(topic, payload)
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

        logger.info("Reintentando en 15 segundos...")
        await asyncio.sleep(15)


def get_full_state() -> dict:
    return {
        "connected": state["connected"],
        "session": state["session"],
        "timing": state["timing"],
        "tyres": state["tyres"],
        "weather": state["weather"],
        "race_control": state["race_control"],
        "session_data": state["session_data"],
    }