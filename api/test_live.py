import asyncio
from live import start_live_client, state

async def main():
    print("Iniciando cliente F1...")
    task = asyncio.create_task(start_live_client())
    await asyncio.sleep(30)
    print("Estado actual:", state)
    task.cancel()

asyncio.run(main())