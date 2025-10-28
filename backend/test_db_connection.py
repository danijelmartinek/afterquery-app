import asyncio
from app.database import ASYNC_ENGINE

from app.database import get_database_url

url = get_database_url()
print("🔍 Effective DATABASE_URL:", repr(url))

async def test_connection():
    try:
        async with ASYNC_ENGINE.begin() as conn:
            print("✅ Connected to Supabase successfully!")
    except Exception as e:
        print("❌ Connection failed:")
        print(e)

asyncio.run(test_connection())
