import fastf1
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="F1 Telemetry API")

# Allow requests from Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

# Cache para no redownloadear datos
fastf1.Cache.enable_cache("cache")


@app.get("/")
def root():
    return {"status": "F1 Telemetry API running"}


@app.get("/session/{year}/{round}/{session}")
def get_session_results(year: int, round: int, session: str):
    """
    Devuelve resultados de una sesión.
    session: 'R' (Race), 'Q' (Qualifying), 'FP1', 'FP2', 'FP3'
    """
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
def get_driver_telemetry(year: int, round: int, driver: str):
    """
    Devuelve telemetría de la vuelta rápida de un piloto en la carrera.
    driver: código de 3 letras, ej: 'VER', 'HAM', 'NOR'
    """
    try:
        s = fastf1.get_session(year, round, "R")
        s.load(telemetry=True, weather=False, messages=False)

        lap = s.laps.pick_drivers(driver).pick_fastest()
        tel = lap.get_telemetry()

        # Reducimos puntos para no enviar demasiados datos
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