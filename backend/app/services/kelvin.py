"""Kelvin — safety assistant intent router.

Architecture: simple keyword/pattern intent matcher — NOT an autonomous LLM agent.
The deterministic backend is the sole source of truth; Kelvin only phrases results.

Safety-critical design rationale:
- Kelvin NEVER calls FortyGuard directly
- Kelvin NEVER computes its own numbers
- Kelvin only phrases pre-computed results from backend functions
- All answers are also shown as on-screen text (required fallback)
"""

import re
from typing import Optional


def match_intent(user_input: str) -> dict:
    """Match user input to a known intent and extract parameters.
    
    Returns: {"intent": str, "params": dict, "confidence": float}
    """
    text = user_input.lower().strip()

    # Pattern 1: "Is site [X] safe right now?"
    safe_match = re.search(r"is\s+(?:site\s+)?(\S+)\s+safe", text)
    if safe_match:
        return {"intent": "site_safety", "params": {"site_id": safe_match.group(1)}, "confidence": 0.9}

    # Pattern 2: "Which site is riskiest right now?"
    if any(word in text for word in ["riskiest", "most dangerous", "highest risk", "worst site"]):
        return {"intent": "riskiest_site", "params": {}, "confidence": 0.95}

    # Pattern 3: Route requests —多种 phrasings
    route_match = re.search(r"(?:coolest|best|hottest|fastest|shortest|quickest)\s+route\s+(?:from|between)\s+(.+?)\s+(?:to|and)\s+(.+?)(?:\?|$)", text)
    if route_match:
        return {"intent": "coolest_route", "params": {"origin": route_match.group(1).strip(), "destination": route_match.group(2).strip()}, "confidence": 0.85}

    # Pattern 3b: "I want to go from A to B", "get me from A to B", "take me from A to B", "go from A to B"
    go_match = re.search(r"(?:i\s+(?:want|need|would like)\s+to\s+)?(?:go|get|take|send|route|drive|walk|head)\s+(?:me\s+)?(?:from\s+)?(.+?)\s+(?:to|->|\\u2192)\s+(.+?)(?:\?|$)", text)
    if go_match:
        return {"intent": "coolest_route", "params": {"origin": go_match.group(1).strip(), "destination": go_match.group(2).strip()}, "confidence": 0.8}

    # Pattern 3c: "plan route from A to B"
    plan_match = re.search(r"plan\s+(?:a\s+)?(?:route|trip|path)\s+(?:from|between)\s+(.+?)\s+(?:to|and)\s+(.+?)(?:\?|$)", text)
    if plan_match:
        return {"intent": "coolest_route", "params": {"origin": plan_match.group(1).strip(), "destination": plan_match.group(2).strip()}, "confidence": 0.85}

    # Pattern 4: "What did heat cost us today?"
    if any(word in text for word in ["cost", "expense", "p&l", "financial", "money", "dollars"]):
        return {"intent": "heat_cost", "params": {}, "confidence": 0.9}

    # Pattern 5: "What's the temperature at [site]?"
    temp_match = re.search(r"(?:temperature|temp|heat)\s+(?:at|for|in)\s+(\S+)", text)
    if temp_match:
        return {"intent": "site_temperature", "params": {"site_id": temp_match.group(1)}, "confidence": 0.85}

    # Pattern 6: "How many sites are critical/high/etc?"
    count_match = re.search(r"how\s+many\s+sites?\s+(?:are|in|with)\s+(critical|high|medium|low)", text)
    if count_match:
        return {"intent": "risk_count", "params": {"bucket": count_match.group(1).upper()}, "confidence": 0.9}

    # Pattern 7: General help
    if any(word in text for word in ["help", "what can you do", "commands", "options"]):
        return {"intent": "help", "params": {}, "confidence": 0.95}

    return {"intent": "unknown", "params": {"raw": user_input}, "confidence": 0.0}


def phrase_response(intent: str, data: dict, user_input: str = "") -> str:
    """Phrase a backend result into natural language for Kelvin.
    
    This is a pure formatting function — it never computes new numbers.
    """
    if intent == "site_safety":
        site_id = data.get("site_id", "unknown")
        risk = data.get("risk_bucket", "UNKNOWN")
        temp = data.get("temperature_c", "N/A")
        if risk in ("LOW", "MEDIUM"):
            return f"Site {site_id} is currently {risk} risk at {temp}°C. Standard protocols apply."
        elif risk == "HIGH":
            return f"Attention: Site {site_id} is HIGH risk at {temp}°C. Increase rest frequency and deploy cooling stations."
        else:
            return f"ALERT: Site {site_id} is CRITICAL at {temp}°C. Halt outdoor work during peak hours immediately."

    elif intent == "riskiest_site":
        site = data.get("site_id", "unknown")
        risk = data.get("risk_bucket", "UNKNOWN")
        temp = data.get("temperature_c", "N/A")
        return f"The riskiest site right now is {site} at {risk} risk ({temp}°C). It requires immediate attention."

    elif intent == "coolest_route":
        origin = data.get("origin_name", data.get("origin", "origin"))
        dest = data.get("dest_name", data.get("destination", "destination"))
        temp_delta = data.get("temp_delta_f", "N/A")
        time_delta = data.get("time_delta_min", "N/A")
        has_action = "action" in data
        if has_action:
            return f"Got it! Routing from {origin} to {dest}. The coolest route is about {temp_delta}°F cooler than the fastest. Opening the Route Planner now — you'll see both paths on the map with the pegman at your starting point."
        return f"The coolest route from {origin} to {dest} is about {temp_delta}°F cooler but {time_delta} minutes longer than the fastest route."

    elif intent == "heat_cost":
        total = data.get("total_cost", 0)
        return f"Today, heat cost this portfolio's operations ${total:,.2f}. This includes hazard pay, productivity loss, and delay claim evidence value."

    elif intent == "site_temperature":
        site_id = data.get("site_id", "unknown")
        temp = data.get("temperature_c", "N/A")
        heat_index = data.get("heat_index", "N/A")
        return f"Site {site_id} is currently {temp}°C with a heat index of {heat_index}°C."

    elif intent == "risk_count":
        bucket = data.get("bucket", "UNKNOWN")
        count = data.get("count", 0)
        return f"There {('is' if count == 1 else 'are')} {count} {bucket} risk site{'s' if count != 1 else ''} in the portfolio."

    elif intent == "help":
        return (
            "I'm Kelvin, your heat safety assistant. You can ask me:\n"
            "- 'Is site [ID] safe right now?' — risk status for a site\n"
            "- 'Which site is riskiest?' — highest-risk site in the fleet\n"
            "- 'What's the coolest route from [A] to [B]?' — heat-optimized routing\n"
            "- 'What did heat cost us today?' — Heat P&L summary\n"
            "- 'How many sites are critical?' — risk count\n"
            "I always show the same answer on screen as I say out loud."
        )

    else:
        return "I'm not sure how to answer that. Try asking about a specific site's safety, the riskiest site, route planning, or today's heat cost."
