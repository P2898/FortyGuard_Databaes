"""
RAG (Retrieval-Augmented Generation) Knowledge Base
OSHA heat safety regulations, NIOSH guidelines, and FortyGuard domain knowledge.

This module provides:
1. Document chunks with metadata
2. TF-IDF vectorization for embeddings
3. Cosine similarity retrieval
4. Context-aware response generation
"""

import re
import math
from typing import List, Dict, Tuple
from collections import Counter


# ─── Knowledge Base Documents ────────────────────────────────────────────────

KNOWLEDGE_DOCS: List[Dict] = [
    # OSHA Regulations
    {
        "id": "osha-1",
        "title": "OSHA Heat Illness Prevention Campaign",
        "category": "regulation",
        "content": """
        OSHA's Heat Illness Prevention campaign emphasizes three key words: Water, Rest, Shade.
        Employers must provide access to clean drinking water (1 quart per employee per hour),
        rest breaks in shaded areas, and acclimatization periods for new workers.
        OSHA can issue citations under the General Duty Clause (Section 5(a)(1)) when employers
        fail to protect workers from heat hazards. The Safeway distribution center in Tracy, CA
        received an $182,000 Cal/OSHA citation for heat violations in 2024.
        """,
        "keywords": ["osha", "heat illness", "water", "rest", "shade", "general duty", "citation", "tracy", "safeway", "prevention"]
    },
    {
        "id": "osha-2",
        "title": "OSHA Temperature Thresholds",
        "category": "threshold",
        "content": """
        OSHA recommends action when heat index reaches:
        - 80°F (26.7°C): Implement heat safety measures, provide water and shade
        - 91°F (32.8°C): Mandatory rest breaks every hour, buddy system required
        - 103°F (39.4°C): Consider stopping outdoor work, enhanced monitoring
        - 115°F (46.1°C): Stop all outdoor work, emergency cooling procedures
        
        The Wet Bulb Globe Temperature (WBGT) is preferred over heat index for occupational settings.
        OSHA uses WBGT thresholds from NIOSH: Action Level 26.7°C, Exposure Limit 28°C for acclimated workers.
        """,
        "keywords": ["temperature", "threshold", "heat index", "wbgt", "wet bulb", "action level", "exposure limit", "80f", "91f", "103f"]
    },
    {
        "id": "osha-3",
        "title": "Cal/OSHA Heat Regulations (California)",
        "category": "regulation",
        "content": """
        California's Cal/OSHA has the nation's strictest heat illness prevention standard (T8 CCR 3395):
        - Indoor heat: When temperatures reach 82°F (27.8°C), employers must provide cool-down areas
        - Outdoor heat: When temperatures reach 80°F (26.7°C), water/shade/rest required
        - High heat procedures: When temperatures reach 95°F (35°C), additional measures mandatory
        - Mandatory training: All employees must receive heat illness prevention training
        - Emergency response: Written heat illness prevention plan required
        
        Cal/OSHA penalties can reach $156,259 for willful violations. Repeat violations can result in criminal charges.
        """,
        "keywords": ["california", "cal/osha", "indoor", "outdoor", "training", "penalty", "willful", "82f", "80f", "95f", "cal"]
    },
    {
        "id": "osha-4",
        "title": "NIOSH Heat Stress Guidelines",
        "category": "regulation",
        "content": """
        NIOSH Recommended Exposure Limits (REL) for heat stress:
        - Acclimated workers: WBGT 28°C (82.4°F) for light work, 25°C for moderate, 23°C for heavy
        - Unacclimated workers: WBGT 26.7°C (80°F) for light work
        - Work-rest cycles: Based on workload and WBGT
        - Metabolic rate categories: Light (<234 W), Moderate (234-360 W), Heavy (360-469 W), Very Heavy (>469 W)
        
        NIOSH criteria document (DHHS NIOSH Publication No. 86-122) establishes the framework used by OSHA
        for evaluating heat stress in occupational settings.
        """,
        "keywords": ["niosh", "rel", "wbgt", "acclimated", "unacclimated", "metabolic", "work rest", "criteria", "light", "moderate", "heavy"]
    },
    {
        "id": "financial-1",
        "title": "Heat-Related Financial Impact",
        "category": "financial",
        "content": """
        Heat-related costs for employers include:
        - Hazard pay: $15-50/hour additional for outdoor workers during heat events
        - Productivity loss: 20-50% reduction in output when WBGT exceeds 30°C
        - Workers' compensation: Average claim $40,000 for heat-related illness
        - Schedule delays: Construction projects average $5,000-10,000/day in delay claims
        - Equipment downtime: Heat stress reduces machinery efficiency by 10-15%
        - Insurance premiums: Can increase 15-30% in high-heat regions
        
        The SF Federal Reserve estimates heat costs the US economy $100 billion annually.
        """,
        "keywords": ["cost", "financial", "hazard pay", "productivity", "workers comp", "delay", "insurance", "economic", "claim", "dollar"]
    },
    {
        "id": "financial-2",
        "title": "OSHA Penalty Structure",
        "category": "financial",
        "content": """
        OSHA penalty amounts (2024):
        - Serious violation: Up to $16,131 per violation
        - Other-than-serious: Up to $16,131 per violation
        - Willful violation: Up to $161,323 per violation
        - Repeat violation: Up to $161,323 per violation
        - Failure to abate: Up to $16,131 per day
        
        Heat illness citations are typically classified as Serious or Willful.
        Cal/OSHA penalties can be higher due to state multiplier.
        """,
        "keywords": ["penalty", "fine", "citation", "violation", "willful", "serious", "dollar", "amount", "osha"]
    },
    {
        "id": "route-1",
        "title": "Heat-Safe Route Planning",
        "category": "operations",
        "content": """
        When planning routes for worker safety in heat conditions:
        - Urban heat island effect: Temperatures can be 5-10°F higher in urban areas vs rural
        - Coastal routes are typically cooler due to marine layer influence
        - Inland valleys trap heat, especially afternoon hours (2-6 PM)
        - Shaded routes reduce solar radiation exposure by 30-50%
        - Route timing matters: Early morning (6-10 AM) is safest for outdoor work
        
        FortyGuard's 20m resolution data enables hyperlocal route optimization
        that standard weather APIs cannot provide. A city-average temperature
        can miss 25°F differences within a single metro area.
        """,
        "keywords": ["route", "planning", "urban heat", "coastal", "inland", "shaded", "timing", "morning", "afternoon", "resolution"]
    },
    {
        "id": "health-1",
        "title": "Heat-Related Health Effects",
        "category": "health",
        "content": """
        Worker heat exposure health effects by severity:
        - Heat cramps: Muscle pain/spasms, salt depletion, treat with fluids and rest
        - Heat exhaustion: Heavy sweating, weakness, nausea, headache, body temp <104°F
        - Heat stroke: Body temp >104°F, confusion, seizures, medical emergency (life-threatening)
        
        Risk factors: age >65, obesity, medications (diuretics, beta-blockers), dehydration,
        lack of acclimatization, cardiovascular disease, alcohol use.
        
        OSHA estimates 38 heat-related worker deaths per year in the US (likely underreported).
        """,
        "keywords": ["health", "cramps", "exhaustion", "stroke", "symptoms", "risk factors", "dehydration", "death", "medical", "emergency"]
    },
    {
        "id": "compliance-1",
        "title": "Heat Illness Prevention Plan Requirements",
        "category": "compliance",
        "content": """
        Required elements of a Heat Illness Prevention Plan:
        1. Procedures for providing water, rest, and shade
        2. Acclimatization procedures for new and returning workers
        3. Emergency response procedures for heat illness
        4. Training requirements for all employees and supervisors
        5. Communication procedures (signs, buddy system)
        6. Monitoring for symptoms of heat illness
        7. Post-incident review procedures
        
        Plans must be in writing and available at the worksite.
        Supervisors must be trained to recognize and respond to heat illness symptoms.
        """,
        "keywords": ["plan", "prevention", "compliance", "acclimatization", "emergency", "training", "written", "supervisor", "monitoring", "procedure"]
    },
    {
        "id": "fortyguard-1",
        "title": "FortyGuard Temperature Data Platform",
        "category": "technology",
        "content": """
        FortyGuard provides hyperlocal temperature data:
        - Resolution: 20 meters (vs ~11km for typical weather stations)
        - Coverage: Global, with focus on urban and industrial areas
        - Parameters: Temperature (2m/20m height), heat index, humidity, solar irradiance, AQI
        - API: RESTful with async task-based pattern (submit → poll → result)
        - Heatmaps: Polygon-based temperature visualization
        - Historical data: Enables trend analysis and predictive modeling
        
        The 20m resolution captures microclimate variations that affect worker safety
        but are invisible to standard weather data. A 25°F difference can exist
        between two points 1 mile apart in the same city.
        """,
        "keywords": ["fortyguard", "resolution", "20m", "temperature", "api", "heatmap", "microclimate", "data", "platform", "hyperlocal"]
    },
]


# ─── TF-IDF Vectorizer (lightweight, no external deps) ──────────────────────

def _tokenize(text: str) -> List[str]:
    """Simple whitespace + punctuation tokenizer."""
    text = text.lower()
    tokens = re.findall(r'[a-z0-9]+', text)
    return tokens


def _build_idf(docs: List[List[str]]) -> Dict[str, float]:
    """Compute IDF scores across document corpus."""
    n_docs = len(docs)
    doc_freq = Counter()
    for doc_tokens in docs:
        unique = set(doc_tokens)
        for token in unique:
            doc_freq[token] += 1
    
    idf = {}
    for token, freq in doc_freq.items():
        idf[token] = math.log((n_docs + 1) / (freq + 1)) + 1
    return idf


def _tfidf_vector(tokens: List[str], idf: Dict[str, float]) -> Dict[str, float]:
    """Compute TF-IDF vector for a token list."""
    tf = Counter(tokens)
    total = len(tokens) if tokens else 1
    vector = {}
    for token, count in tf.items():
        tf_val = count / total
        idf_val = idf.get(token, 1.0)
        vector[token] = tf_val * idf_val
    return vector


def _cosine_sim(v1: Dict[str, float], v2: Dict[str, float]) -> float:
    """Compute cosine similarity between two sparse vectors."""
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
    """In-memory vector store using TF-IDF embeddings."""
    
    def __init__(self, documents: List[Dict]):
        self.documents = documents
        self.doc_tokens = [_tokenize(doc["content"] + " " + doc["title"] + " " + " ".join(doc.get("keywords", []))) for doc in documents]
        self.idf = _build_idf(self.doc_tokens)
        self.doc_vectors = [_tfidf_vector(tokens, self.idf) for tokens in self.doc_tokens]
    
    def search(self, query: str, top_k: int = 3, min_score: float = 0.1) -> List[Tuple[Dict, float]]:
        """Search for most relevant documents. Returns list of (doc, score) tuples."""
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

# Global vector store (initialized once)
_vector_store: VectorStore | None = None


def get_vector_store() -> VectorStore:
    """Get or initialize the vector store."""
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStore(KNOWLEDGE_DOCS)
    return _vector_store


def retrieve_context(query: str, top_k: int = 3) -> List[Dict]:
    """RAG Step 1: Retrieve relevant documents from knowledge base."""
    store = get_vector_store()
    results = store.search(query, top_k=top_k)
    return [{"document": doc, "relevance_score": score} for doc, score in results]


def generate_response(query: str, context_docs: List[Dict], site_data: Dict | None = None) -> Dict:
    """RAG Step 2: Generate a structured response using retrieved context."""
    query_lower = query.lower()
    
    # Determine intent from query
    intent = _classify_intent(query_lower)
    
    # Build context string for response
    context_strings = []
    for ctx in context_docs:
        doc = ctx["document"]
        context_strings.append(f"[{doc['category'].upper()}] {doc['title']}: {doc['content'].strip()}")
    
    # Generate response based on intent + context
    if intent == "risk_assessment":
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
    
    return {
        "answer": response["answer"],
        "intent": intent,
        "confidence": response.get("confidence", 0.85),
        "sources": [
            {"id": ctx["document"]["id"], "title": ctx["document"]["title"], "score": round(ctx["relevance_score"], 3)}
            for ctx in context_docs
        ],
        "suggestions": response.get("suggestions", []),
    }


def _classify_intent(query: str) -> str:
    """Classify user query intent."""
    if any(w in query for w in ["safe", "risk", "danger", "critical", "high", "low", "assess", "dangerous"]):
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


def _generate_risk_response(query: str, context: List[Dict], site_data: Dict | None) -> Dict:
    answer = "🔍 **Heat Risk Assessment**\n\n"
    
    if site_data and "assessments" in site_data:
        assessments = site_data["assessments"]
        critical = [a for a in assessments if a.get("risk_bucket") == "CRITICAL"]
        high = [a for a in assessments if a.get("risk_bucket") == "HIGH"]
        
        if critical:
            answer += f"⚠️ **{len(critical)} sites are CRITICAL risk** — immediate action required:\n"
            for a in critical[:3]:
                answer += f"  • {a.get('site_name', 'Unknown')}: {a.get('temperature', 'N/A')}°C\n"
            answer += "\n"
        
        if high:
            answer += f"🟠 **{len(high)} sites are HIGH risk** — enhanced monitoring needed.\n\n"
        
        answer += "According to OSHA guidelines:\n"
    else:
        answer += "Based on NIOSH/OSHA guidelines from our knowledge base:\n"
    
    for ctx in context[:2]:
        doc = ctx["document"]
        answer += f"• {doc['title']}: {doc['content'].strip()[:200]}...\n"
    
    return {
        "answer": answer,
        "confidence": 0.88,
        "suggestions": ["View Fleet Dashboard for real-time risk map", "Check Route Planner for safest paths"],
    }


def _generate_financial_response(query: str, context: List[Dict], site_data: Dict | None) -> Dict:
    answer = "💰 **Heat Cost Analysis**\n\n"
    
    if site_data and "heat_pl" in site_data:
        hpl = site_data["heat_pl"]
        answer += f"Today's estimated portfolio cost: **${hpl.get('total_cost', 0):,.0f}**\n"
        answer += f"  • Hazard pay: ${hpl.get('hazard_pay_owed', 0):,.0f}\n"
        answer += f"  • Productivity impact: ${hpl.get('productivity_cost', 0):,.0f}\n"
        answer += f"  • Schedule delays: ${hpl.get('delay_claim_value', 0):,.0f}\n\n"
    
    answer += "Key financial insights from our knowledge base:\n"
    for ctx in context[:2]:
        doc = ctx["document"]
        answer += f"• {doc['content'].strip()[:200]}...\n"
    
    return {
        "answer": answer,
        "confidence": 0.85,
        "suggestions": ["View Heat P&L for detailed breakdown", "Adjust company policy in Settings"],
    }


def _generate_route_response(query: str, context: List[Dict], site_data: Dict | None) -> Dict:
    answer = "🗺️ **Route Planning Advice**\n\n"
    answer += "For heat-safe routing:\n"
    
    for ctx in context[:2]:
        doc = ctx["document"]
        answer += f"• {doc['content'].strip()[:200]}...\n"
    
    return {
        "answer": answer,
        "confidence": 0.82,
        "suggestions": ["Use Route Planner to compare fastest vs coolest routes", "Schedule outdoor travel before 10 AM"],
    }


def _generate_compliance_response(query: str, context: List[Dict], site_data: Dict | None) -> Dict:
    answer = "📋 **OSHA Compliance Information**\n\n"
    
    for ctx in context[:3]:
        doc = ctx["document"]
        answer += f"**{doc['title']}**:\n{doc['content'].strip()[:300]}\n\n"
    
    return {
        "answer": answer,
        "confidence": 0.90,
        "suggestions": ["Generate compliance report from Reports page", "Review Heat Illness Prevention Plan in Settings"],
    }


def _generate_health_response(query: str, context: List[Dict], site_data: Dict | None) -> Dict:
    answer = "🏥 **Heat-Related Health Information**\n\n"
    answer += "⚠️ **Important**: This is informational only. For medical emergencies, call 911.\n\n"
    
    for ctx in context[:2]:
        doc = ctx["document"]
        answer += f"• {doc['content'].strip()[:250]}...\n"
    
    return {
        "answer": answer,
        "confidence": 0.92,
        "suggestions": ["Monitor site temperatures for worker safety", "Ensure first aid supplies are available"],
    }


def _generate_threshold_response(query: str, context: List[Dict], site_data: Dict | None) -> Dict:
    answer = "🌡️ **Temperature Thresholds**\n\n"
    
    for ctx in context[:2]:
        doc = ctx["document"]
        answer += f"**{doc['title']}**:\n{doc['content'].strip()[:300]}\n\n"
    
    return {
        "answer": answer,
        "confidence": 0.91,
        "suggestions": ["View site temperatures on Dashboard", "Set up alerts for critical thresholds"],
    }


def _generate_general_response(query: str, context: List[Dict], site_data: Dict | None) -> Dict:
    answer = "💡 **Here's what I found:**\n\n"
    
    for ctx in context[:3]:
        doc = ctx["document"]
        score = ctx["relevance_score"]
        answer += f"**{doc['title']}** (relevance: {score:.0%}):\n"
        answer += f"{doc['content'].strip()[:250]}...\n\n"
    
    if not context:
        answer += "I couldn't find specific information about that topic in my knowledge base.\n"
        answer += "Try asking about: heat risk, OSHA regulations, costs, routes, compliance, or health effects."
    
    return {
        "answer": answer,
        "confidence": context[0]["relevance_score"] if context else 0.3,
        "suggestions": ["Ask about heat risk assessment", "Learn about OSHA compliance", "Explore heat cost analysis"],
    }
