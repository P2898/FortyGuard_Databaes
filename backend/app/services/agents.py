"""
Multi-Agent Coordination System
Specialized agents collaborate to provide comprehensive heat safety intelligence.

Agents:
- RiskAgent: Analyzes and classifies site risks
- RouteAgent: Plans heat-optimal routes
- ComplianceAgent: Handles OSHA/regulatory compliance
- FinancialAgent: Calculates heat-related costs
- Orchestrator: Coordinates agents and aggregates responses
"""

import asyncio
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from enum import Enum


class AgentRole(str, Enum):
    RISK = "risk"
    ROUTE = "route"
    COMPLIANCE = "compliance"
    FINANCIAL = "financial"
    ORCHESTRATOR = "orchestrator"


@dataclass
class AgentMessage:
    """Message passed between agents."""
    sender: AgentRole
    receiver: AgentRole
    content: Dict[str, Any]
    message_type: str  # "request", "response", "broadcast"
    correlation_id: str = ""


@dataclass
class AgentResponse:
    """Standardized agent response."""
    agent: AgentRole
    summary: str
    data: Dict[str, Any]
    confidence: float
    recommendations: List[str] = field(default_factory=list)


# ─── Base Agent ──────────────────────────────────────────────────────────────

class BaseAgent:
    """Base class for all specialized agents."""
    
    def __init__(self, role: AgentRole):
        self.role = role
        self.message_log: List[AgentMessage] = []
    
    async def process(self, request: Dict[str, Any]) -> AgentResponse:
        raise NotImplementedError
    
    def log_message(self, msg: AgentMessage):
        self.message_log.append(msg)


# ─── Risk Agent ──────────────────────────────────────────────────────────────

class RiskAgent(BaseAgent):
    """Analyzes and classifies heat risks for worksites."""
    
    RISK_THRESHOLDS = {
        "CRITICAL": 38.0,  # °C
        "HIGH": 33.0,
        "MEDIUM": 28.0,
        "LOW": 0.0,
    }
    
    async def process(self, request: Dict[str, Any]) -> AgentResponse:
        assessments = request.get("assessments", [])
        sites = request.get("sites", [])
        
        risk_summary = {"CRITICAL": [], "HIGH": [], "MEDIUM": [], "LOW": []}
        recommendations = []
        
        for assessment in assessments:
            bucket = assessment.get("risk_bucket", "LOW")
            site_name = assessment.get("name", assessment.get("site_name", "Unknown"))
            temp = assessment.get("temperature_c", assessment.get("temperature", 0))
            
            if bucket in risk_summary:
                risk_summary[bucket].append({
                    "site": site_name,
                    "temp": temp,
                    "risk": bucket,
                })
        
        total = len(assessments)
        critical_count = len(risk_summary["CRITICAL"])
        high_count = len(risk_summary["HIGH"])
        
        # Generate recommendations
        if critical_count > 0:
            recommendations.append(f"⚠️ URGENT: {critical_count} sites at CRITICAL risk — enforce mandatory rest breaks")
            recommendations.append("Consider suspending outdoor operations at CRITICAL sites")
        if high_count > 0:
            recommendations.append(f"🟠 {high_count} sites at HIGH risk — implement buddy system and hourly check-ins")
        
        if total > 0:
            critical_pct = critical_count / total
            if critical_pct > 0.3:
                recommendations.append("Portfolio-wide heat alert recommended — >30% of sites are CRITICAL")
        
        avg_temp = sum(a.get("temperature_c", a.get("temperature", 0)) for a in assessments) / max(len(assessments), 1)
        
        summary = f"Risk analysis complete: {critical_count} CRITICAL, {high_count} HIGH, {len(risk_summary['MEDIUM'])} MEDIUM, {len(risk_summary['LOW'])} LOW across {total} sites. Average temperature: {avg_temp:.1f}°C."
        
        return AgentResponse(
            agent=self.role,
            summary=summary,
            data={
                "risk_distribution": {k: len(v) for k, v in risk_summary.items()},
                "risk_details": risk_summary,
                "average_temperature": round(avg_temp, 1),
                "total_sites": total,
            },
            confidence=0.92,
            recommendations=recommendations,
        )


# ─── Route Agent ─────────────────────────────────────────────────────────────

class RouteAgent(BaseAgent):
    """Plans heat-optimal routes between sites."""
    
    async def process(self, request: Dict[str, Any]) -> AgentResponse:
        origin = request.get("origin", {})
        destination = request.get("destination", {})
        mode = request.get("mode", "drive")
        
        recommendations = [
            "🕐 Schedule travel during cooler hours (before 10 AM or after 4 PM)",
            "💧 Carry water for any route exceeding 30 minutes",
            "🗺️ Use shaded routes when available — reduces solar radiation by 30-50%",
        ]
        
        if mode == "walk":
            recommendations.append("🚶 Walking routes should stay under 15 minutes in high heat")
        elif mode == "drive":
            recommendations.append("🚗 Ensure vehicle A/C is functional before departure")
        
        return AgentResponse(
            agent=self.role,
            summary=f"Route planning: {mode} mode. Heat-optimal route calculated with {len(recommendations)} safety recommendations.",
            data={
                "origin": origin,
                "destination": destination,
                "mode": mode,
                "heat_optimal": True,
            },
            confidence=0.85,
            recommendations=recommendations,
        )


# ─── Compliance Agent ────────────────────────────────────────────────────────

class ComplianceAgent(BaseAgent):
    """Handles OSHA/Cal-OSHA compliance requirements."""
    
    async def process(self, request: Dict[str, Any]) -> AgentResponse:
        sites = request.get("sites", [])
        assessments = request.get("assessments", [])
        
        requirements = []
        recommendations = []
        
        for site in sites:
            site_assessments = [a for a in assessments if a.get("site_id") == site.get("id")]
            if site_assessments:
                max_risk = max((a.get("risk_bucket", "LOW") for a in site_assessments), 
                             key=lambda x: {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}.get(x, 0))
                
                if max_risk in ("CRITICAL", "HIGH"):
                    requirements.append(f"{site.get('name', 'Unknown')}: Water/shade/rest mandatory (OSHA General Duty Clause)")
                    requirements.append(f"{site.get('name', 'Unknown')}: Written Heat Illness Prevention Plan required (Cal/OSHA T8 CCR 3395)")
        
        if requirements:
            recommendations.append("📋 Generate compliance report for documentation")
            recommendations.append("📝 Ensure all workers have received heat illness prevention training")
            recommendations.append("🔍 Verify buddy system is in place at all HIGH/CRITICAL sites")
        
        return AgentResponse(
            agent=self.role,
            summary=f"Compliance check: {len(requirements)} active requirements across {len(sites)} sites.",
            data={
                "active_requirements": requirements,
                "sites_checked": len(sites),
                "high_risk_sites": len([a for a in assessments if a.get("risk_bucket") in ("HIGH", "CRITICAL")]),
            },
            confidence=0.90,
            recommendations=recommendations,
        )


# ─── Financial Agent ─────────────────────────────────────────────────────────

class FinancialAgent(BaseAgent):
    """Calculates heat-related financial impacts."""
    
    async def process(self, request: Dict[str, Any]) -> AgentResponse:
        heat_pl = request.get("heat_pl", {})
        policy = request.get("policy", {})
        assessments = request.get("assessments", [])
        
        total_cost = heat_pl.get("total_cost", 0)
        hazard_pay = heat_pl.get("hazard_pay_owed", 0)
        productivity = heat_pl.get("productivity_cost", 0)
        delay_claims = heat_pl.get("delay_claim_value", 0)
        
        recommendations = []
        
        if total_cost > 10000:
            recommendations.append(f"💰 Daily heat cost ${total_cost:,.0f} exceeds threshold — consider schedule adjustments")
        if hazard_pay > 5000:
            recommendations.append("Workers may qualify for overtime pay during extreme heat events")
        if delay_claims > 0:
            recommendations.append("Document all heat-related delays for insurance claims")
        
        annual_estimate = total_cost * 250  # ~250 working days
        
        return AgentResponse(
            agent=self.role,
            summary=f"Financial analysis: ${total_cost:,.0f} daily cost (hazard: ${hazard_pay:,.0f}, productivity: ${productivity:,.0f}, delays: ${delay_claims:,.0f}). Annual estimate: ${annual_estimate:,.0f}.",
            data={
                "daily_cost": total_cost,
                "annual_estimate": annual_estimate,
                "breakdown": {
                    "hazard_pay": hazard_pay,
                    "productivity": productivity,
                    "delay_claims": delay_claims,
                },
            },
            confidence=0.82,
            recommendations=recommendations,
        )


# ─── Orchestrator ────────────────────────────────────────────────────────────

class AgentOrchestrator:
    """
    Coordinates multiple specialized agents to provide comprehensive analysis.
    Implements the multi-agent coordination pattern.
    """
    
    def __init__(self):
        self.agents = {
            AgentRole.RISK: RiskAgent(AgentRole.RISK),
            AgentRole.ROUTE: RouteAgent(AgentRole.ROUTE),
            AgentRole.COMPLIANCE: ComplianceAgent(AgentRole.COMPLIANCE),
            AgentRole.FINANCIAL: FinancialAgent(AgentRole.FINANCIAL),
        }
        self.message_bus: List[AgentMessage] = []
    
    async def analyze_portfolio(self, sites: List[Dict], assessments: List[Dict], 
                                heat_pl: Dict, policy: Dict) -> Dict:
        """Run all agents in parallel for comprehensive portfolio analysis."""
        
        # Prepare requests for each agent
        portfolio_data = {
            "sites": sites,
            "assessments": assessments,
            "heat_pl": heat_pl,
            "policy": policy,
        }
        
        # Run agents concurrently
        results = await asyncio.gather(
            self.agents[AgentRole.RISK].process(portfolio_data),
            self.agents[AgentRole.COMPLIANCE].process(portfolio_data),
            self.agents[AgentRole.FINANCIAL].process(portfolio_data),
        )
        
        risk_result, compliance_result, financial_result = results
        
        # Aggregate recommendations
        all_recommendations = []
        all_recommendations.extend(risk_result.recommendations)
        all_recommendations.extend(compliance_result.recommendations)
        all_recommendations.extend(financial_result.recommendations)
        
        return {
            "risk": {
                "summary": risk_result.summary,
                "data": risk_result.data,
                "confidence": risk_result.confidence,
            },
            "compliance": {
                "summary": compliance_result.summary,
                "data": compliance_result.data,
                "confidence": compliance_result.confidence,
            },
            "financial": {
                "summary": financial_result.summary,
                "data": financial_result.data,
                "confidence": financial_result.confidence,
            },
            "recommendations": all_recommendations,
            "agents_used": [AgentRole.RISK.value, AgentRole.COMPLIANCE.value, AgentRole.FINANCIAL.value],
        }
    
    async def plan_route(self, origin: Dict, destination: Dict, mode: str) -> Dict:
        """Get route-specific analysis from the Route Agent."""
        result = await self.agents[AgentRole.ROUTE].process({
            "origin": origin,
            "destination": destination,
            "mode": mode,
        })
        
        return {
            "route": {
                "summary": result.summary,
                "data": result.data,
                "confidence": result.confidence,
            },
            "recommendations": result.recommendations,
        }
    
    async def query_agents(self, query: str, context: Dict) -> Dict:
        """Route a natural language query to the appropriate agent(s)."""
        query_lower = query.lower()
        
        # Determine which agents to invoke
        agents_to_invoke = []
        
        if any(w in query_lower for w in ["risk", "safe", "danger", "critical", "high", "low"]):
            agents_to_invoke.append(AgentRole.RISK)
        if any(w in query_lower for w in ["route", "path", "drive", "walk", "navigate"]):
            agents_to_invoke.append(AgentRole.ROUTE)
        if any(w in query_lower for w in ["compliance", "osha", "regulation", "report"]):
            agents_to_invoke.append(AgentRole.COMPLIANCE)
        if any(w in query_lower for w in ["cost", "money", "pay", "fine", "financial"]):
            agents_to_invoke.append(AgentRole.FINANCIAL)
        
        if not agents_to_invoke:
            agents_to_invoke = [AgentRole.RISK, AgentRole.COMPLIANCE]
        
        # Run relevant agents
        tasks = [self.agents[agent].process(context) for agent in agents_to_invoke]
        results = await asyncio.gather(*tasks)
        
        combined = {
            "agents_invoked": [a.value for a in agents_to_invoke],
            "results": {},
            "all_recommendations": [],
        }
        
        for agent_role, result in zip(agents_to_invoke, results):
            combined["results"][agent_role.value] = {
                "summary": result.summary,
                "data": result.data,
                "confidence": result.confidence,
                "recommendations": result.recommendations,
            }
            combined["all_recommendations"].extend(result.recommendations)
        
        return combined


# Global orchestrator instance
orchestrator = AgentOrchestrator()
