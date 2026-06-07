import json
import asyncio
import urllib.request
import websockets

async def test():
    negotiate_url = "https://livetiming.formula1.com/signalrcore/negotiate?negotiateVersion=1"
    req = urllib.request.Request(
        negotiate_url,
        data=b"",
        headers={"User-Agent": "BestHTTP"},
        method="POST"
    )
    with urllib.request.urlopen(req) as r:
        negotiate = json.loads(r.read())

    token = negotiate["connectionToken"]
    ws_url = f"wss://livetiming.formula1.com/signalrcore?id={token}"

    async with websockets.connect(ws_url, additional_headers={"User-Agent": "BestHTTP"}) as ws:
        print("Conectado!")
        await ws.send(json.dumps({"protocol": "json", "version": 1}) + "\x1e")
        
        for _ in range(10):
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=5)
                print("Recibido:", msg[:200])
            except asyncio.TimeoutError:
                print("Sin mensajes (no hay sesión activa)")
                break

asyncio.run(test())