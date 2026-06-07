import json
import asyncio
import logging
import aiohttp
import websockets

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

    except Exception as e:
        logger.error(f"Error procesando {topic}: {e}")


async def start_live_client():
    while True:
        try:
            logger.info("Negociando conexión con F1...")
            negotiate_url = "https://livetiming.formula1.com/signalrcore/negotiate?negotiateVersion=1"
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    negotiate_url,
                    headers={"User-Agent": "BestHTTP"},
                ) as r:
                    negotiate = await r.json()

            token = negotiate["connectionToken"]
            ws_url = f"wss://livetiming.formula1.com/signalrcore?id={token}"

            logger.info("Conectando al feed de F1...")
            async with websockets.connect(
                ws_url,
                additional_headers={"User-Agent": "BestHTTP"},
                ping_interval=20,
                ping_timeout=10,
            ) as ws:
                # Handshake
                await ws.send(json.dumps({"protocol": "json", "version": 1}) + "\x1e")
                await ws.recv()

                # Suscribirse a tópicos
                subscribe = {
                    "type": 1,
                    "invocationId": "0",
                    "target": "Subscribe",
                    "arguments": [[
                        "SessionInfo",
                        "SessionData",
                        "TimingData",
                        "TimingAppData",
                        "WeatherData",
                        "RaceControlMessages",
                    ]],
                }
                await ws.send(json.dumps(subscribe) + "\x1e")

                state["connected"] = True
                logger.info("✅ Conectado al feed de F1 — esperando sesión activa")

                async for raw in ws:
                    parts = raw.split("\x1e")
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
                                topic = data.get("target", "")
                                args = data.get("arguments", [])
                                if args:
                                    process_message(topic, args[0])

                        except Exception as e:
                            logger.error(f"Error parseando mensaje: {e}")

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