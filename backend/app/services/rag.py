"""
RAG (Retrieval-Augmented Generation) Knowledge Base
OSHA heat safety regulations, NIOSH guidelines, and FortyGuard domain knowledge.
"""

import re
import math
from typing import List, Dict, Tuple
from collections import Counter


# ─── Knowledge Base Documents ────────────────────────────────────────────────

KNOWLEDGE_DOCS: List[Dict] = [
    {
        "id": "osha-1",
        "title": "OSHA Heat Illness Prevention Campaign",
        "category": "regulation",
        "content": "OSHA's Heat Illness Prevention campaign emphasizes three key words: Water, Rest, Shade. Employers must provide access to clean drinking water (1 quart per employee per hour), rest breaks in shaded areas, and acclimatization periods for new workers. OSHA can issue citations under the General Duty Clause (Section 5(a)(1)) when employers fail to protect workers from heat hazards. The Safeway distribution center in Tracy, CA received an $182,000 Cal/OSHA citation for heat violations in 2024.",
        "keywords": ["osha", "heat illness", "water", "rest", "shade", "general duty", "citation", "tracy", "safeway", "prevention"]
    },
    {
        "id": "osha-2",
        "title": "OSHA Temperature Thresholds",
        "category": "threshold",
        "content": "OSHA recommends action when heat index reaches: 80°F (26.7°C) implement heat safety measures, provide water and shade. 91°F (32.8°C) mandatory rest breaks every hour, buddy system required. 103°F (39.4°C) consider stopping outdoor work, enhanced monitoring. 115°F (46.1°C) stop all outdoor work, emergency cooling procedures. The Wet Bulb Globe Temperature (WBGT) is preferred over heat index for occupational settings. OSHA uses WBGT thresholds from NIOSH: Action Level 26.7°C, Exposure Limit 28°C for acclimated workers.",
        "keywords": ["temperature", "threshold", "heat index", "wbgt", "wet bulb", "action level", "exposure limit", "80f", "91f", "103f"]
    },
    {
        "id": "osha-3",
        "title": "Cal/OSHA Heat Regulations (California)",
        "category": "regulation",
        "content": "California's Cal/OSHA has the nation's strictest heat illness prevention standard (T8 CCR 3395): Indoor heat when temperatures reach 82°F (27.8°C) employers must provide cool-down areas. Outdoor heat when temperatures reach 80°F (26.7°C) water/shade/rest required. High heat procedures when temperatures reach 95°F (35°C) additional measures mandatory. Mandatory training all employees must receive heat illness prevention training. Emergency response written heat illness prevention plan required. Cal/OSHA penalties can reach $156,259 for willful violations.",
        "keywords": ["california", "cal/osha", "indoor", "outdoor", "training", "penalty", "willful", "82f", "80f", "95f", "cal"]
    },
    {
        "id": "osha-4",
        "title": "NIOSH Heat Stress Guidelines",
        "category": "regulation",
        "content": "NIOSH Recommended Exposure Limits (REL) for heat stress: Acclimated workers WBGT 28°C (82.4°F) for light work, 25°C for moderate, 23°C for heavy. Unacclimated workers WBGT 26.7°C (80°F) for light work. Work-rest cycles based on workload and WBGT. Metabolic rate categories: Light (<234 W), Moderate (234-360 W), Heavy (360-469 W), Very Heavy (>469 W). NIOSH criteria document (DHHS NIOSH Publication No. 86-122) establishes the framework used by OSHA.",
        "keywords": ["niosh", "rel", "wbgt", "acclimated", "unacclimated", "metabolic", "work rest", "criteria", "light", "moderate", "heavy"]
    },
    {
        "id": "financial-1",
        "title": "Heat-Related Financial Impact",
        "category": "financial",
        "content": "Heat-related costs for employers include: Hazard pay $15-50/hour additional for outdoor workers during heat events. Productivity loss 20-50% reduction in output when WBGT exceeds 30°C. Workers compensation average claim $40,000 for heat-related illness. Schedule delays construction projects average $5,000-10,000/day in delay claims. Equipment downtime heat stress reduces machinery efficiency by 10-15%. Insurance premiums can increase 15-30% in high-heat regions. The SF Federal Reserve estimates heat costs the US economy $100 billion annually.",
        "keywords": ["cost", "financial", "hazard pay", "productivity", "workers comp", "delay", "insurance", "economic", "claim", "dollar"]
    },
    {
        "id": "financial-2",
        "title": "OSHA Penalty Structure",
        "category": "financial",
        "content": "OSHA penalty amounts (2024): Serious violation up to $16,131 per violation. Other-than-serious up to $16,131 per violation. Willful violation up to $161,323 per violation. Repeat violation up to $161,323 per violation. Failure to abate up to $16,131 per day. Heat illness citations are typically classified as Serious or Willful. Cal/OSHA penalties can be higher due to state multiplier.",
        "keywords": ["penalty", "fine", "citation", "violation", "willful", "serious", "dollar", "amount", "osha"]
    },
    {
        "id": "route-1",
        "title": "Heat-Safe Route Planning",
        "category": "operations",
        "content": "When planning routes for worker safety in heat conditions: Urban heat island effect temperatures can be 5-10°F higher in urban areas vs rural. Coastal routes are typically cooler due to marine layer influence. Inland valleys trap heat, especially afternoon hours (2-6 PM). Shaded routes reduce solar radiation exposure by 30-50%. Route timing matters early morning (6-10 AM) is safest for outdoor work. FortyGuard's 20m resolution data enables hyperlocal route optimization that standard weather APIs cannot provide.",
        "keywords": ["route", "planning", "urban heat", "coastal", "inland", "shaded", "timing", "morning", "afternoon", "resolution"]
    },
    {
        "id": "health-1",
        "title": "Heat-Related Health Effects",
        "category": "health",
        "content": "Worker heat exposure health effects by severity: Heat cramps muscle pain/spasms, salt depletion, treat with fluids and rest. Heat exhaustion heavy sweating, weakness, nausea, headache, body temp <104°F. Heat stroke body temp >104°F, confusion, seizures, medical emergency (life-threatening). Risk factors: age >65, obesity, medications (diuretics, beta-blockers), dehydration, lack of acclimatization, cardiovascular disease, alcohol use. OSHA estimates 38 heat-related worker deaths per year in the US (likely underreported).",
        "keywords": ["health", "cramps", "exhaustion", "stroke", "symptoms", "risk factors", "dehydration", "death", "medical", "emergency"]
    },
    {
        "id": "compliance-1",
        "title": "Heat Illness Prevention Plan Requirements",
        "category": "compliance",
        "content": "Required elements of a Heat Illness Prevention Plan: 1. Procedures for providing water, rest, and shade. 2. Acclimatization procedures for new and returning workers. 3. Emergency response procedures for heat illness. 4. Training requirements for all employees and supervisors. 5. Communication procedures (signs, buddy system). 6. Monitoring for symptoms of heat illness. 7. Post-incident review procedures. Plans must be in writing and available at the worksite.",
        "keywords": ["plan", "prevention", "compliance", "acclimatization", "emergency", "training", "written", "supervisor", "monitoring", "procedure"]
    },
    {
        "id": "fortyguard-1",
        "title": "FortyGuard Temperature Data Platform",
        "category": "technology",
        "content": "FortyGuard provides hyperlocal temperature data: Resolution 20 meters (vs ~11km for typical weather stations). Coverage Global, with focus on urban and industrial areas. Parameters Temperature (2m/20m height), heat index, humidity, solar irradiance, AQI. API RESTful with async task-based pattern (submit, poll, result). Heatmaps Polygon-based temperature visualization. Historical data enables trend analysis and predictive modeling. The 20m resolution captures microclimate variations that affect worker safety but are invisible to standard weather data.",
        "keywords": ["fortyguard", "resolution", "20m", "temperature", "api", "heatmap", "microclimate", "data", "platform", "hyperlocal"]
    },
]


# ─── Site name matching ─────────────────────────────────────────────────────

SITE_ALIASES = {
    "sf": "SF Waterfront Warehouse",
    "waterfront": "SF Waterfront Warehouse",
    "sf waterfront": "SF Waterfront Warehouse",
    "tracy": "Tracy Logistics Hub",
    "logistics": "Tracy Logistics Hub",
    "tracy logistics": "Tracy Logistics Hub",
    "oakland": "Oakland Port Construction",
    "port": "Oakland Port Construction",
    "oakland port": "Oakland Port Construction",
    "livermore": "Livermore Solar Farm",
    "solar": "Livermore Solar Farm",
    "the solar farm": "Livermore Solar Farm",
    "solar farm": "Livermore Solar Farm",
    "livermore solar": "Livermore Solar Farm",
    "fairfield": "Fairfield Route Hub",
    "route hub": "Fairfield Route Hub",
    "fairfield route": "Fairfield Route Hub",
    "concord": "Concord Distribution Center",
    "distribution": "Concord Distribution Center",
    "concord distribution": "Concord Distribution Center",
    "san jose": "San Jose Data Center Build",
    "data center": "San Jose Data Center Build",
    "san jose data": "San Jose Data Center Build",
    "berkeley": "Berkeley Transit Depot",
    "transit": "Berkeley Transit Depot",
    "berkeley transit": "Berkeley Transit Depot",
}


def _detect_site_from_query(query: str, assessments: List[Dict]) -> str | None:
    """Detect if the user is asking about a specific site.
    Returns the matched site name, or None if asking about all sites.
    """
    query_lower = query.lower()

    # First try site IDs (e.g., "WH-SF-01")
    for a in assessments:
        site_id = a.get("site_id", "").lower()
        if site_id and site_id in query_lower:
            return a.get("name")

    # Then try aliases (check longer matches first to avoid partial matches)
    sorted_aliases = sorted(SITE_ALIASES.keys(), key=len, reverse=True)
    for alias in sorted_aliases:
        if alias in query_lower:
            return SITE_ALIASES[alias]

    # Try matching full site names from assessments
    for a in assessments:
        name = a.get("name", "").lower()
        name_words = name.split()
        for word in name_words:
            if len(word) > 3 and word in query_lower:
                return a.get("name")

    return None


# ─── TF-IDF Vectorizer ──────────────────────────────────────────────────────

def _tokenize(text: str) -> List[str]:
    text = text.lower()
    tokens = re.findall(r'[a-z0-9]+', text)
    return tokens


def _build_idf(docs: List[List[str]]) -> Dict[str, float]:
    n_docs = len(docs)
    doc_freq = Counter()
    for doc_tokens in docs:
        for token in set(doc_tokens):
            doc_freq[token] += 1
    idf = {}
    for token, freq in doc_freq.items():
        idf[token] = math.log((n_docs + 1) / (freq + 1)) + 1
    return idf


def _tfidf_vector(tokens: List[str], idf: Dict[str, float]) -> Dict[str, float]:
    tf = Counter(tokens)
    total = len(tokens) if tokens else 1
    return {token: (count / total) * idf.get(token, 1.0) for token, count in tf.items()}


def _cosine_sim(v1: Dict[str, float], v2: Dict[str, float]) -> float:
    common = set(v1.keys()) & set(v2.keys())
    if not common:
        return 0.0
    dot = sum(v1[k] * v2[k] for k in common)
    mag1 = math.sqrt(sum(v ** 2 for v in v1.values()))
    mag2 = math.sqrt(sum(v ** 2 for v in v2.values()))
    if mag1 == 0 or mag2 == 0:
        return 0.0
    return dot / (mag1 * mag2)


# ─── Vector Store ────────────────────────────────────────────────────────────

class VectorStore:
    def __init__(self, documents: List[Dict]):
        self.documents = documents
        self.doc_tokens = [_tokenize(doc["content"] + " " + doc["title"] + " " + " ".join(doc.get("keywords", []))) for doc in documents]
        self.idf = _build_idf(self.doc_tokens)
        self.doc_vectors = [_tfidf_vector(tokens, self.idf) for tokens in self.doc_tokens]

    def search(self, query: str, top_k: int = 3, min_score: float = 0.1) -> List[Tuple[Dict, float]]:
        query_tokens = _tokenize(query)
        query_vector = _tfidf_vector(query_tokens, self.idf)
        results = []
        for i, doc_vector in enumerate(self.doc_vectors):
            score = _cosine_sim(query_vector, doc_vector)
            if score >= min_score:
                results.append((self.documents[i], score))
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]


# ─── RAG Pipeline ────────────────────────────────────────────────────────────

_vector_store: VectorStore | None = None


def get_vector_store() -> VectorStore:
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStore(KNOWLEDGE_DOCS)
    return _vector_store


def retrieve_context(query: str, top_k: int = 3) -> List[Dict]:
    store = get_vector_store()
    results = store.search(query, top_k=top_k)
    return [{"document": doc, "relevance_score": score} for doc, score in results]


def generate_response(query: str, context_docs: List[Dict], site_data: Dict | None = None) -> Dict:
    query_lower = query.lower()

    # Check if a specific site is mentioned — override intent to risk_assessment
    assessments = site_data.get("assessments", []) if site_data else []
    site_mentioned = _detect_site_from_query(query, assessments) if assessments else None

    intent = _classify_intent(query_lower)
    if site_mentioned and intent not in ("financial", "route_advice", "route_plan", "heat_illness_prevention"):
        intent = "risk_assessment"

    if intent == "route_plan":
        response = _generate_route_plan_response(query, context_docs, site_data)
    elif intent == "heat_illness_prevention":
        response = _generate_heat_illness_prevention_response(query, context_docs, site_data)
    elif intent == "risk_assessment":
        response = _generate_risk_response(query, context_docs, site_data)
    elif intent == "financial":
        response = _generate_financial_response(query, context_docs, site_data)
    elif intent == "route_advice":
        response = _generate_route_response(query, context_docs, site_data)
    elif intent == "compliance":
        response = _generate_compliance_response(query, context_docs, site_data)
    elif intent == "health":
        response = _generate_health_response(query, context_docs, site_data)
    elif intent == "threshold":
        response = _generate_threshold_response(query, context_docs, site_data)
    else:
        response = _generate_general_response(query, context_docs, site_data)

    result = {
        "answer": response["answer"],
        "intent": intent,
        "confidence": response.get("confidence", 0.85),
        "sources": [
            {"id": ctx["document"]["id"], "title": ctx["document"]["title"], "score": round(ctx["relevance_score"], 3)}
            for ctx in context_docs
        ],
        "suggestions": response.get("suggestions", []),
    }
    # Pass through navigation metadata if present
    if "navigate_to" in response:
        result["navigate_to"] = response["navigate_to"]
    if "route_params" in response:
        result["route_params"] = response["route_params"]
    return result


def _classify_intent(query: str) -> str:
    # Route planning navigation — detect "plan a route from X to Y"
    if any(w in query for w in ["plan a route", "plan route", "route from", "navigate to", "how do i get to", " directions to", "take me to"]):
        return "route_plan"
    # Heat illness prevention — detect questions about outdoor safety
    if any(w in query for w in ["heat illness", "heat stroke", "heat exhaustion", "heat cramp",
                                  "prevention", "prevent", "safe to work", "safe to do",
                                  "can i work", "should i work", "is it safe outdoors",
                                  "is it safe to be outside", "outdoor work today",
                                  "how hot is it", "worker safety"]):
        return "heat_illness_prevention"
    # Risk assessment keywords (broadened)
    risk_words = ["safe", "risk", "danger", "critical", "high", "low", "assess", "dangerous",
                   "hottest", "coldest", "warmest", "coolest", "site", "sites", "doing",
                   "status", "condition", "conditions", "exposure", "hazard"]
    if any(w in query for w in risk_words):
        return "risk_assessment"
    if any(w in query for w in ["cost", "dollar", "money", "pay", "fine", "penalty", "financial", "expense", "budget"]):
        return "financial"
    if any(w in query for w in ["route", "path", "drive", "walk", "navigate", "direction", "travel", "commute"]):
        return "route_advice"
    if any(w in query for w in ["compliance", "osha", "regulation", "rule", "law", "require", "plan", "report"]):
        return "compliance"
    if any(w in query for w in ["health", "symptom", "illness", "stroke", "exhaustion", "cramp", "medical", "death"]):
        return "health"
    if any(w in query for w in ["temperature", "threshold", "degree", "celsius", "fahrenheit", "how hot", "how warm"]):
        return "threshold"
    return "general"


# ─── Risk Response (with site filtering) ─────────────────────────────────────

def _generate_risk_response(query: str, context: List[Dict], site_data: Dict | None) -> Dict:
    answer = "🔍 **Heat Risk Assessment**\n\n"

    if site_data and "assessments" in site_data:
        assessments = site_data["assessments"]

        if not assessments:
            answer += "No assessment data available yet. Run a fleet assessment first.\n"
            return {"answer": answer, "confidence": 0.5, "suggestions": ["Run a fleet assessment from the Dashboard"]}

        # Detect if user is asking about a specific site
        target_site = _detect_site_from_query(query, assessments)

        if target_site:
            # Site-specific response
            site_assessments = [a for a in assessments if a.get("name") == target_site]
            if site_assessments:
                a = site_assessments[0]
                bucket = a.get("risk_bucket", "LOW")
                temp = a.get("temperature_c", "N/A")
                hi = a.get("heat_index", "N/A")
                persist = a.get("persistence_hours", 0)
                exceed = a.get("exceedance_hours", 0)
                rec = a.get("recommendation", "")

                risk_emoji = {"LOW": "🟢", "MEDIUM": "🟡", "HIGH": "🟠", "CRITICAL": "🔴"}.get(bucket, "⚪")

                answer += f"**{target_site}**\n\n"
                answer += f"Risk Level: {risk_emoji} **{bucket}**\n"
                answer += f"Temperature: {temp}°C | Heat Index: {hi}°C\n"
                answer += f"Exceedance: {exceed}h | Persistence: {persist}h\n\n"

                if rec:
                    answer += f"**Recommended Action:** {rec}\n\n"

                if bucket == "CRITICAL":
                    answer += "⚠️ **Immediate action required.** Halt heavy outdoor work during peak hours (12:00-15:00). Deploy mobile cooling units.\n"
                    answer += "OSHA General Duty Clause applies — employers must protect workers from known heat hazards.\n"
                elif bucket == "HIGH":
                    answer += "🟠 **Enhanced monitoring needed.** Mandatory rest breaks every 30 minutes. Activate buddy system.\n"
                elif bucket == "MEDIUM":
                    answer += "🟡 **Standard precautions.** Increase rest frequency. Provide shade structures. Monitor workers for heat symptoms.\n"
                else:
                    answer += "🟢 **Conditions manageable.** Continue standard heat safety protocols. Ensure water and shade available.\n"

                suggestions = [f"View {target_site} details on the Dashboard"]
                if bucket in ("CRITICAL", "HIGH"):
                    suggestions.append("Check Route Planner for coolest paths to this site")
            else:
                answer += f"Couldn't locate **{target_site}** in the latest assessment.\n"
                suggestions = ["View Fleet Dashboard for all site assessments"]
        else:
            # Fleet-wide response
            critical = [a for a in assessments if a.get("risk_bucket") == "CRITICAL"]
            high = [a for a in assessments if a.get("risk_bucket") == "HIGH"]
            medium = [a for a in assessments if a.get("risk_bucket") == "MEDIUM"]
            low = [a for a in assessments if a.get("risk_bucket") == "LOW"]

            answer += f"**Portfolio Summary:** {len(assessments)} sites assessed\n\n"

            if critical:
                answer += f"🔴 **{len(critical)} CRITICAL** — immediate action required:\n"
                for a in critical:
                    answer += f"  • {a.get('name', 'Unknown')}: {a.get('temperature_c', 'N/A')}°C (heat index {a.get('heat_index', 'N/A')}°C)\n"
                answer += "\n"

            if high:
                answer += f"🟠 **{len(high)} HIGH** — enhanced monitoring needed:\n"
                for a in high:
                    answer += f"  • {a.get('name', 'Unknown')}: {a.get('temperature_c', 'N/A')}°C\n"
                answer += "\n"

            if medium:
                answer += f"🟡 **{len(medium)} MEDIUM** — standard precautions\n"

            if low:
                answer += f"🟢 **{len(low)} LOW** — conditions manageable\n"

            answer += "\n**OSHA requires:** Water, Rest, Shade for all workers when heat index exceeds 80°F (26.7°C).\n"

            suggestions = [
                "Ask about a specific site (e.g., 'Is Tracy safe?')",
                "View Fleet Dashboard for real-time risk map",
                "Check Route Planner for safest paths",
            ]
    else:
        answer += "Based on NIOSH/OSHA guidelines from our knowledge base:\n"
        suggestions = ["Run a fleet assessment to see site-specific risks"]

    for ctx in context[:1]:
        doc = ctx["document"]
        answer += f"\n📖 {doc['title']}: {doc['content'].strip()}\n"

    return {
        "answer": answer,
        "confidence": 0.88 if target_site else 0.85,
        "suggestions": suggestions if 'suggestions' in dir() else ["View Fleet Dashboard"],
    }


# ─── Other Response Generators ───────────────────────────────────────────────

def _generate_financial_response(query: str, context: List[Dict], site_data: Dict | None) -> Dict:
    answer = "💰 **Heat Cost Analysis**\n\n"
    if site_data and "heat_pl" in site_data:
        hpl = site_data["heat_pl"]
        answer += f"Today's estimated portfolio cost: **${hpl.get('total_cost', 0):,.0f}**\n"
        for line in hpl.get("lines", []):
            label = line.get("label", "")
            amount = line.get("amount", 0)
            if "hazard" in label.lower():
                answer += f"  • Hazard pay: ${amount:,.0f}\n"
            elif "productivity" in label.lower():
                answer += f"  • Productivity impact: ${amount:,.0f}\n"
            elif "delay" in label.lower():
                answer += f"  • Schedule delays: ${amount:,.0f}\n"
        answer += "\n"
    answer += "Key financial insights:\n"
    for ctx in context[:2]:
        doc = ctx["document"]
        answer += f"• {doc['content'].strip()}\n"
    return {"answer": answer, "confidence": 0.85, "suggestions": ["View Heat P&L for detailed breakdown", "Adjust company policy in Settings"]}


def _generate_route_response(query: str, context: List[Dict], site_data: Dict | None) -> Dict:
    answer = "🗺️ **Route Planning Advice**\n\nFor heat-safe routing:\n"
    for ctx in context[:2]:
        doc = ctx["document"]
        answer += f"• {doc['content'].strip()}\n"
    suggestions = ["Use Route Planner to compare fastest vs coolest routes", "Schedule outdoor travel before 10 AM"]
    result = {"answer": answer, "confidence": 0.82, "suggestions": suggestions}
    # If query mentions specific route, trigger navigation
    if any(w in query.lower() for w in ["plan", "route from", "drive from", "go from"]):
        result["navigate_to"] = "routes"
    return result


def _generate_compliance_response(query: str, context: List[Dict], site_data: Dict | None) -> Dict:
    answer = "📋 **OSHA Compliance Information**\n\n"
    for ctx in context[:3]:
        doc = ctx["document"]
        answer += f"**{doc['title']}**:\n{doc['content'].strip()}\n\n"
    return {"answer": answer, "confidence": 0.90, "suggestions": ["Generate compliance report from Reports page", "Review Heat Illness Prevention Plan in Settings"]}


def _generate_health_response(query: str, context: List[Dict], site_data: Dict | None) -> Dict:
    answer = "🏥 **Heat-Related Health Information**\n\n⚠️ **Important**: This is informational only. For medical emergencies, call 911.\n\n"
    for ctx in context[:2]:
        doc = ctx["document"]
        answer += f"• {doc['content'].strip()}\n"
    return {"answer": answer, "confidence": 0.92, "suggestions": ["Monitor site temperatures for worker safety", "Ensure first aid supplies are available"]}


def _generate_threshold_response(query: str, context: List[Dict], site_data: Dict | None) -> Dict:
    answer = "🌡️ **Temperature Thresholds**\n\n"
    for ctx in context[:2]:
        doc = ctx["document"]
        answer += f"**{doc['title']}**:\n{doc['content'].strip()}\n\n"
    return {"answer": answer, "confidence": 0.91, "suggestions": ["View site temperatures on Dashboard", "Set up alerts for critical thresholds"]}


def _generate_general_response(query: str, context: List[Dict], site_data: Dict | None) -> Dict:
    answer = "💡 **Here's what I found:**\n\n"
    for ctx in context[:3]:
        doc = ctx["document"]
        score = ctx["relevance_score"]
        answer += f"**{doc['title']}** (relevance: {score:.0%}):\n{doc['content'].strip()}\n\n"
    if not context:
        answer += "I couldn't find specific information about that topic.\nTry asking about: heat risk, OSHA regulations, costs, routes, compliance, or health effects."
    return {"answer": answer, "confidence": context[0]["relevance_score"] if context else 0.3, "suggestions": ["Ask about heat risk assessment", "Learn about OSHA compliance", "Explore heat cost analysis"]}


def _generate_route_plan_response(query: str, context: List[Dict], site_data: Dict | None) -> Dict:
    """Handle route planning requests — detect origin/destination and trigger navigation."""
    import re
    query_lower = query.lower()

    # Try to extract origin and destination from common patterns
    origin = None
    dest = None

    # Pattern: "plan a route from X to Y" / "route from X to Y"
    match = re.search(r'(?:from|origin:?\s*)(.+?)\s+(?:to|destination:?\s*)(.+?)(?:\s+please|\s+in|\s*$)', query_lower)
    if match:
        origin = match.group(1).strip().rstrip(',').strip()
        dest = match.group(2).strip().rstrip(',').strip()

    if not origin or not dest:
        # Fallback: try "X to Y"
        match2 = re.search(r'(.+?)\s+to\s+(.+?)(?:\s+please|\s+in|\s+by|\s*$)', query_lower)
        if match2:
            origin = match2.group(1).strip().rstrip(',').strip()
            dest = match2.group(2).strip().rstrip(',').strip()

    # Try to match to known sites
    if site_data and 'assessments' in site_data:
        assessments = site_data['assessments']
        if origin:
            origin_site = _detect_site_from_query(origin, assessments)
        else:
            origin_site = None
        if dest:
            dest_site = _detect_site_from_query(dest, assessments)
        else:
            dest_site = None
    else:
        origin_site = None
        dest_site = None

    answer = "🗺️ **Route Planning**\n\n"
    navigate_to_routes = False

    if origin_site and dest_site:
        answer += f"I'll plan a route from **{origin_site}** to **{dest_site}**.\n\n"
        answer += "Opening the Route Planner with these locations...\n\n"
        navigate_to_routes = True
    elif origin and dest:
        answer += f"I'll plan a route from **{origin.title()}** to **{dest.title()}**.\n\n"
        answer += "Opening the Route Planner...\n\n"
        navigate_to_routes = True
    elif origin:
        answer += f"I detected **{origin.title()}** as your origin. Where is your destination?\n\n"
    elif dest:
        answer += f"I detected **{dest.title()}** as your destination. Where are you starting from?\n\n"
    else:
        answer += "I can plan a heat-safe route for you. Where are you starting and where are you going?\n\n"
        answer += "For example: **'Plan a route from Oakland to Tracy'**\n"

    # Add route advice from knowledge base
    for ctx in context[:1]:
        doc = ctx["document"]
        answer += f"\n📖 {doc['title']}: {doc['content'].strip()}\n"

    suggestions = []
    if navigate_to_routes:
        suggestions.append("Navigate to Route Planner")
    suggestions.extend(["Schedule outdoor travel before 10 AM", "Compare fastest vs coolest routes"])

    result = {
        "answer": answer,
        "confidence": 0.90 if (origin_site and dest_site) else 0.75,
        "suggestions": suggestions,
    }
    # Add navigation metadata for frontend
    if navigate_to_routes:
        result["navigate_to"] = "routes"
        result["route_params"] = {
            "origin": origin_site or origin or "",
            "destination": dest_site or dest or "",
        }
    return result


def _generate_heat_illness_prevention_response(query: str, context: List[Dict], site_data: Dict | None) -> Dict:
    """Generate human-friendly heat illness prevention advice with real-time prediction."""
    query_lower = query.lower()

    # Run heat illness prediction using current conditions
    try:
        from app.services.heat_illness import predict_heat_illness, EnvironmentalConditions
        from app.routers.assessment import get_latest_assessments

        assessments = get_latest_assessments()
        if assessments:
            # Use average conditions across all sites as default
            avg_temp = sum(a.get('temperature_c', 30) for a in assessments) / len(assessments)
            avg_hi = sum(a.get('heat_index', 33) for a in assessments) / len(assessments)
            avg_humidity = 50.0  # Default

            env = EnvironmentalConditions(
                temperature_c=avg_temp,
                heat_index_c=avg_hi,
                humidity_percent=avg_humidity,
            )
            prediction = predict_heat_illness(env)
            prediction_dict = {
                'probability': prediction.probability_percent,
                'risk_level': prediction.risk_level,
                'wbgt': prediction.wbgt_c,
                'advice': prediction.advice_human,
                'actions': prediction.advice_actions,
                'work_rest': prediction.work_rest_recommendation,
            }
        else:
            prediction_dict = None
    except Exception:
        prediction_dict = None

    answer = "🛡️ **Heat Illness Prevention Guide**\n\n"

    # Determine if asking about outdoor safety specifically
    is_outdoor_question = any(w in query_lower for w in [
        'safe to work', 'safe to do', 'can i work', 'should i work',
        'outdoor work', 'outside', 'outdoors'
    ])

    if prediction_dict:
        risk = prediction_dict['risk_level']
        prob = prediction_dict['probability']
        wbgt = prediction_dict['wbgt']

        if is_outdoor_question:
            # Direct answer to safety question
            if risk == 'LOW':
                answer += f"**Yes, it's safe to work outdoors** right now.\n\n"
                answer += f"The current heat index is around {prediction_dict.get('wbgt', 30):.0f}°C with a {risk} risk level ({prob:.0f}% chance of heat illness).\n\n"
                answer += "**What you should do:**\n"
                answer += "• Stay hydrated — drink water every 15-20 minutes\n"
                answer += "• Take shade breaks if working more than 2 hours\n"
                answer += "• Best hours: early morning (6-10 AM)\n"
                answer += "• Watch for: excessive thirst, heavy sweating, fatigue\n\n"
                answer += "*Bottom line: Go ahead with outdoor work, but stay smart about hydration and rest.*"
            elif risk == 'MODERATE':
                answer += f"**Work with caution outdoors.**\n\n"
                answer += f"The heat index is elevated ({prob:.0f}% risk). Heat cramps and exhaustion are possible.\n\n"
                answer += "**What you should do:**\n"
                answer += "• Mandatory rest breaks every 30-45 minutes\n"
                answer += "• Drink water every 15 minutes — no waiting until you're thirsty\n"
                answer += "• Reschedule heavy tasks to before 10 AM or after 4 PM\n"
                answer += "• Use the buddy system — check on each other\n"
                answer += "• Have cooling towels and ice packs ready\n\n"
                answer += "*Bottom line: You can work, but take it easy and don't push through fatigue.*"
            elif risk in ('HIGH', 'VERY_HIGH'):
                answer += f"**Limit outdoor exposure — conditions are risky.**\n\n"
                answer += f"The heat index is high ({prob:.0f}% risk). Heat exhaustion is likely with prolonged work.\n\n"
                answer += "**What you should do:**\n"
                answer += "• STOP heavy outdoor work from 12:00-3:00 PM\n"
                answer += "• If you must work: 15 min rest every 30 min of work\n"
                answer += "• Safety buddy assigned to every worker\n"
                answer += "• Emergency cooling station within 50 feet\n"
                answer += "• If anyone feels dizzy, nauseous, or stops sweating — STOP and get help\n\n"
                answer += "*Bottom line: Avoid outdoor work during peak hours. If you must, follow strict rest schedules.*"
            else:  # EXTREME
                answer += f"**🚨 DO NOT work outdoors right now.**\n\n"
                answer += f"The heat index is extreme ({prob:.0f}% risk). Heat stroke is highly likely and can be fatal.\n\n"
                answer += "**Immediate actions:**\n"
                answer += "• Move ALL workers to cool/shaded areas now\n"
                answer += "• Provide cold water and ice immediately\n"
                answer += "• If anyone shows confusion, hot/dry skin, or seizures — call 911\n"
                answer += "• Monitor every worker for 2 hours after leaving the heat\n\n"
                answer += "*Bottom line: This is a life-safety situation. No outdoor work until conditions improve.*"
        else:
            # General heat illness prevention advice
            answer += f"**Current risk level: {risk}** ({prob:.0f}% probability of heat illness)\n\n"
            answer += prediction_dict['advice'] + "\n\n"
            answer += f"**Recommended work schedule:** {prediction_dict['work_rest']}\n\n"
    else:
        # Fallback — use knowledge base only
        answer += "Based on OSHA and NIOSH guidelines:\n\n"

    # Add knowledge base context
    for ctx in context[:2]:
        doc = ctx["document"]
        answer += f"\n📖 **{doc['title']}**: {doc['content'].strip()}\n"

    answer += "\n\n---\n*For emergencies, call 911. This guidance is based on NIOSH/OSHA standards. Always consult your site safety officer.*"

    return {
        "answer": answer,
        "confidence": 0.93 if prediction_dict else 0.85,
        "suggestions": [
            "Check specific site temperatures on Dashboard",
            "View Heat P&L for financial impact",
            "Set up heat alerts in Settings",
            "Generate OSHA compliance report",
        ],
    }
