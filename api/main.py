import asyncio
import json
import os
import fastf1
import pandas as pd
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from live import (
    start_live_client, get_full_state, listeners,
    get_sessions_index, get_session_history,
    delete_session_history, get_history_size,
)
import io


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(start_live_client())
    yield
    task.cancel()


app = FastAPI(title="F1 Telemetry API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "DELETE"],
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


# ── Endpoints de historial ─────────────────────────────────────────────────────

@app.get("/history/sessions")
async def history_sessions():
    """Lista todas las sesiones grabadas."""
    sessions = await get_sessions_index()
    return {"sessions": sessions}


@app.get("/history/{session_key}/size")
async def history_size(session_key: int):
    """Devuelve el tamaño del historial de una sesión."""
    return await get_history_size(session_key)


@app.get("/history/{session_key}/export")
async def history_export(session_key: int, delete: bool = False):
    """
    Exporta el historial completo de una sesión como JSON descargable.
    Parámetro opcional: ?delete=true para borrar de Redis después de exportar.
    """
    events = await get_session_history(session_key)
    if not events:
        raise HTTPException(status_code=404, detail="No hay historial para esta sesión")

    # Metadata de la sesión
    sessions = await get_sessions_index()
    meta = next((s for s in sessions if s.get("key") == session_key), {})

    output = {
        "session": meta,
        "total_events": len(events),
        "events": events,
    }

    json_bytes = json.dumps(output, ensure_ascii=False).encode("utf-8")
    filename = f"f1_history_{session_key}_{meta.get('type', 'session').replace(' ', '_')}.json"

    if delete:
        await delete_session_history(session_key)

    return StreamingResponse(
        io.BytesIO(json_bytes),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@app.delete("/history/{session_key}")
async def history_delete(session_key: int):
    """Borra el historial de una sesión de Redis."""
    await delete_session_history(session_key)
    return {"deleted": session_key}


# ── FastF1 ─────────────────────────────────────────────────────────────────────

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