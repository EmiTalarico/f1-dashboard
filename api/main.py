import asyncio
import json
import os
import fastf1
import pandas as pd
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from live import start_live_client, get_full_state, listeners


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(start_live_client())
    yield
    task.cancel()


app = FastAPI(title="F1 Telemetry API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

os.makedirs("cache", exist_ok=True)
fastf1.Cache.enable_cache("cache")


@app.get("/")
def root():
    return {"status": "F1 Telemetry API running"}


@app.get("/live/state")
def live_state():
    return get_full_state()


@app.websocket("/ws/live")
async def websocket_live(websocket: WebSocket):
    await websocket.accept()

    await websocket.send_text(json.dumps({
        "topic": "snapshot",
        "data": get_full_state()
    }))

    queue = asyncio.Queue()
    listeners.append(queue)

    try:
        while True:
            try:
                message = await asyncio.wait_for(queue.get(), timeout=30)
                await websocket.send_text(message)
            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({"topic": "ping"}))
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        if queue in listeners:
            listeners.remove(queue)


@app.get("/session/{year}/{round}/{session}")
def get_session_results(year: int, round: int, session: str):
    try:
        s = fastf1.get_session(year, round, session)
        s.load(telemetry=False, weather=False, messages=False)

        results = []
        for _, row in s.results.iterrows():
            results.append({
                "position": int(row.get("Position", 0)) if pd.notna(row.get("Position")) else None,
                "driver": row.get("Abbreviation", ""),
                "fullName": f"{row.get('FirstName', '')} {row.get('LastName', '')}".strip(),
                "team": row.get("TeamName", ""),
                "teamColor": f"#{row.get('TeamColor', 'ffffff')}",
                "time": str(row.get("Time", "")) if pd.notna(row.get("Time")) else None,
                "status": row.get("Status", ""),
                "points": float(row.get("Points", 0)) if pd.notna(row.get("Points")) else 0,
            })

        return {
            "year": year,
            "round": round,
            "session": session,
            "event": s.event["EventName"],
            "results": results,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/telemetry/{year}/{round}/{driver}")
def get_driver_telemetry(year: int, round: int, driver: str, session: str = "R"):
    try:
        s = fastf1.get_session(year, round, session)
        s.load(telemetry=True, weather=False, messages=False)

        lap = s.laps.pick_drivers(driver).pick_fastest()
        tel = lap.get_telemetry()

        step = max(1, len(tel) // 300)
        tel = tel.iloc[::step]

        return {
            "driver": driver,
            "lapTime": str(lap["LapTime"]),
            "telemetry": {
                "distance": tel["Distance"].tolist(),
                "speed": tel["Speed"].tolist(),
                "throttle": tel["Throttle"].tolist(),
                "brake": tel["Brake"].tolist(),
                "gear": tel["nGear"].tolist(),
                "drs": tel["DRS"].tolist(),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))