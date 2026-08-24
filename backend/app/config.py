import os
from dotenv import load_dotenv

# Load .env from project root (same location as database.py)
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

FORTYGUARD_API_KEY = os.getenv("FORTYGUARD_API_KEY", "")
FORTYGUARD_BASE_URL = os.getenv("FORTYGUARD_BASE_URL", "https://api.fortyguard.com")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
