"""
Monitoring & Observability Module
Tracks API health, response times, cache performance, and system metrics.

This provides:
1. Request/response timing (OpenTelemetry-style spans)
2. Cache hit/miss rates
3. API call tracking (FortyGuard, Supabase)
4. System health metrics
5. Alert thresholds
"""

import time
import asyncio
from collections import deque
from typing import Dict, List, Any
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class MetricPoint:
    """A single metric data point."""
    timestamp: float
    value: float
    labels: Dict[str, str] = field(default_factory=dict)


@dataclass
class RequestSpan:
    """An OpenTelemetry-style request span."""
    operation: str
    start_time: float
    end_time: float = 0
    status: str = "ok"
    attributes: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def duration_ms(self) -> float:
        return (self.end_time - self.start_time) * 1000


class MetricsCollector:
    """Collects and aggregates application metrics."""
    
    def __init__(self, max_history: int = 1000):
        self.max_history = max_history
        
        # Request metrics
        self.request_spans: deque = deque(maxlen=max_history)
        self.request_counts: Dict[str, int] = {}
        
        # Cache metrics
        self.cache_hits = 0
        self.cache_misses = 0
        
        # API call metrics
        self.fortyguard_calls = 0
        self.fortyguard_errors = 0
        self.supabase_calls = 0
        self.supabase_errors = 0
        
        # System metrics
        self.start_time = time.time()
        self.error_count = 0
        self.total_requests = 0
        
        # Agent metrics
        self.agent_calls: Dict[str, int] = {"risk": 0, "route": 0, "compliance": 0, "financial": 0}
        self.agent_latencies: Dict[str, List[float]] = {"risk": [], "route": [], "compliance": [], "financial": []}
        
        # Alert thresholds
        self.alerts: List[Dict] = []
        self.slow_request_threshold_ms = 5000
        self.high_error_rate_threshold = 0.1  # 10%
    
    def start_span(self, operation: str, attributes: Dict[str, Any] = None) -> RequestSpan:
        """Start a new request span."""
        span = RequestSpan(
            operation=operation,
            start_time=time.time(),
            attributes=attributes or {},
        )
        return span
    
    def end_span(self, span: RequestSpan, status: str = "ok"):
        """End a request span and record metrics."""
        span.end_time = time.time()
        span.status = status
        
        self.request_spans.append(span)
        self.total_requests += 1
        
        # Track by operation
        op = span.operation
        self.request_counts[op] = self.request_counts.get(op, 0) + 1
        
        # Check for slow requests
        if span.duration_ms > self.slow_request_threshold_ms:
            self._add_alert("slow_request", f"Slow request: {op} took {span.duration_ms:.0f}ms")
        
        if status == "error":
            self.error_count += 1
    
    def record_cache_hit(self):
        self.cache_hits += 1
    
    def record_cache_miss(self):
        self.cache_misses += 1
    
    def record_fortyguard_call(self, error: bool = False):
        self.fortyguard_calls += 1
        if error:
            self.fortyguard_errors += 1
    
    def record_supabase_call(self, error: bool = False):
        self.supabase_calls += 1
        if error:
            self.supabase_errors += 1
    
    def record_agent_call(self, agent: str, latency_ms: float):
        if agent in self.agent_calls:
            self.agent_calls[agent] += 1
            self.agent_latencies[agent].append(latency_ms)
            # Keep last 100 latencies
            if len(self.agent_latencies[agent]) > 100:
                self.agent_latencies[agent] = self.agent_latencies[agent][-100:]
    
    def _add_alert(self, alert_type: str, message: str):
        self.alerts.append({
            "type": alert_type,
            "message": message,
            "timestamp": time.time(),
            "time_str": datetime.now().strftime("%H:%M:%S"),
        })
        # Keep last 50 alerts
        if len(self.alerts) > 50:
            self.alerts = self.alerts[-50:]
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics snapshot."""
        uptime = time.time() - self.start_time
        cache_total = self.cache_hits + self.cache_misses
        cache_rate = (self.cache_hits / cache_total * 100) if cache_total > 0 else 0
        error_rate = (self.error_count / self.total_requests * 100) if self.total_requests > 0 else 0
        
        # Calculate average response times
        recent_spans = list(self.request_spans)[-100:]  # Last 100 requests
        avg_response_time = 0
        if recent_spans:
            avg_response_time = sum(s.duration_ms for s in recent_spans) / len(recent_spans)
        
        # P95 response time
        sorted_durations = sorted(s.duration_ms for s in recent_spans)
        p95_idx = int(len(sorted_durations) * 0.95) if sorted_durations else 0
        p95_response_time = sorted_durations[p95_idx] if sorted_durations else 0
        
        # Agent latencies
        agent_stats = {}
        for agent, latencies in self.agent_latencies.items():
            if latencies:
                agent_stats[agent] = {
                    "calls": self.agent_calls[agent],
                    "avg_latency_ms": round(sum(latencies) / len(latencies), 1),
                    "max_latency_ms": round(max(latencies), 1),
                }
            else:
                agent_stats[agent] = {"calls": 0, "avg_latency_ms": 0, "max_latency_ms": 0}
        
        # Operation breakdown
        operation_stats = {}
        for op, count in self.request_counts.items():
            op_spans = [s for s in recent_spans if s.operation == op]
            avg_time = sum(s.duration_ms for s in op_spans) / max(len(op_spans), 1)
            operation_stats[op] = {"count": count, "avg_ms": round(avg_time, 1)}
        
        return {
            "uptime_seconds": round(uptime),
            "uptime_human": _format_uptime(uptime),
            "total_requests": self.total_requests,
            "error_count": self.error_count,
            "error_rate_percent": round(error_rate, 1),
            "avg_response_time_ms": round(avg_response_time, 1),
            "p95_response_time_ms": round(p95_response_time, 1),
            "cache": {
                "hits": self.cache_hits,
                "misses": self.cache_misses,
                "hit_rate_percent": round(cache_rate, 1),
            },
            "fortyguard": {
                "total_calls": self.fortyguard_calls,
                "errors": self.fortyguard_errors,
            },
            "supabase": {
                "total_calls": self.supabase_calls,
                "errors": self.supabase_errors,
            },
            "agents": agent_stats,
            "operations": operation_stats,
            "recent_alerts": self.alerts[-10:],
            "health": self._get_health_status(error_rate, avg_response_time),
        }
    
    def _get_health_status(self, error_rate: float, avg_response_time: float) -> Dict:
        """Determine overall system health."""
        issues = []
        status = "healthy"
        
        if error_rate > self.high_error_rate_threshold * 100:
            status = "degraded"
            issues.append(f"High error rate: {error_rate:.1f}%")
        
        if avg_response_time > self.slow_request_threshold_ms:
            status = "degraded"
            issues.append(f"Slow average response: {avg_response_time:.0f}ms")
        
        if self.fortyguard_errors > self.fortyguard_calls * 0.5 and self.fortyguard_calls > 0:
            issues.append("FortyGuard API experiencing high failure rate")
        
        return {
            "status": status,
            "issues": issues,
            "indicator": "🟢" if status == "healthy" else "🟡" if status == "degraded" else "🔴",
        }


def _format_uptime(seconds: float) -> str:
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    if hours > 0:
        return f"{hours}h {minutes}m"
    elif minutes > 0:
        return f"{minutes}m {secs}s"
    else:
        return f"{secs}s"


# Global metrics instance
metrics = MetricsCollector()
