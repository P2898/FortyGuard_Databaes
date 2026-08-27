import { useState, useEffect } from "react";
import { getMetrics, type MonitoringMetrics } from "../lib/api";
import { useTheme } from "../lib/theme";

export default function MonitoringDashboard() {
  const { colors } = useTheme();
  const [metrics, setMetrics] = useState<MonitoringMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(5000);

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, autoRefresh);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const loadMetrics = async () => {
    try {
      const m = await getMetrics();
      setMetrics(m);
    } catch (e) {
      console.error("Failed to load metrics:", e);
    }
    setLoading(false);
  };

  if (loading || !metrics) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: colors.textMuted }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
        Loading monitoring data...
      </div>
    );
  }

  const { health, cache, fortyguard, supabase, agents, operations, recent_alerts } = metrics;

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.text, marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
        📊 Monitoring & Observability
        <span
          style={{
            fontSize: 12,
            padding: "4px 10px",
            borderRadius: 12,
            background: health.status === "healthy" ? "#dcfce7" : health.status === "degraded" ? "#fef3c7" : "#fecaca",
            color: health.status === "healthy" ? "#16a34a" : health.status === "degraded" ? "#d97706" : "#dc2626",
            fontWeight: 600,
          }}
        >
          {health.indicator} {health.status.toUpperCase()}
        </span>
      </h2>

      {/* Overview Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
        <MetricCard title="Uptime" value={metrics.uptime_human} icon="⏱️" colors={colors} />
        <MetricCard title="Total Requests" value={String(metrics.total_requests)} icon="📡" colors={colors} />
        <MetricCard title="Avg Response" value={`${metrics.avg_response_time_ms.toFixed(0)}ms`} icon="⚡" colors={colors} />
        <MetricCard title="P95 Response" value={`${metrics.p95_response_time_ms.toFixed(0)}ms`} icon="📈" colors={colors} />
        <MetricCard title="Error Rate" value={`${metrics.error_rate_percent}%`} icon="⚠️" colors={colors} alert={metrics.error_rate_percent > 5} />
        <MetricCard title="Cache Hit Rate" value={`${cache.hit_rate_percent}%`} icon="💾" colors={colors} />
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Cache Performance */}
        <Panel title="💾 Cache Performance" colors={colors}>
          <StatRow label="Cache Hits" value={String(cache.hits)} color="#16a34a" />
          <StatRow label="Cache Misses" value={String(cache.misses)} color="#d97706" />
          <StatRow label="Hit Rate" value={`${cache.hit_rate_percent}%`} color={colors.accent} />
          <BarChart value={cache.hit_rate_percent} label="Hit Rate" color="#16a34a" colors={colors} />
        </Panel>

        {/* External APIs */}
        <Panel title="🌐 External API Calls" colors={colors}>
          <StatRow label="FortyGuard Calls" value={String(fortyguard.total_calls)} color={colors.text} />
          <StatRow label="FortyGuard Errors" value={String(fortyguard.errors)} color={fortyguard.errors > 0 ? "#dc2626" : "#16a34a"} />
          <StatRow label="Supabase Calls" value={String(supabase.total_calls)} color={colors.text} />
          <StatRow label="Supabase Errors" value={String(supabase.errors)} color={supabase.errors > 0 ? "#dc2626" : "#16a34a"} />
        </Panel>

        {/* Agent Performance */}
        <Panel title="🤖 Multi-Agent Performance" colors={colors}>
          {Object.entries(agents).map(([name, stats]) => (
            <div key={name} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: colors.text, marginBottom: 2 }}>
                <span style={{ textTransform: "capitalize" }}>{name} Agent</span>
                <span style={{ color: colors.textMuted }}>{stats.calls} calls</span>
              </div>
              <div style={{ display: "flex", gap: 8, fontSize: 11, color: colors.textMuted }}>
                <span>Avg: {stats.avg_latency_ms}ms</span>
                <span>Max: {stats.max_latency_ms}ms</span>
              </div>
            </div>
          ))}
        </Panel>

        {/* Operation Breakdown */}
        <Panel title="⚡ Operation Performance" colors={colors}>
          {Object.entries(operations).map(([name, stats]) => (
            <div key={name} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: colors.text }}>
                <span style={{ fontFamily: "monospace" }}>{name}</span>
                <span style={{ color: colors.textMuted }}>{stats.count}× / avg {stats.avg_ms}ms</span>
              </div>
            </div>
          ))}
        </Panel>
      </div>

      {/* Recent Alerts */}
      {recent_alerts.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: colors.text, marginBottom: 8 }}>🔔 Recent Alerts</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recent_alerts.slice(0, 5).map((alert, i) => (
              <div
                key={i}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: alert.type === "slow_request" ? "#fef3c7" : "#fef2f2",
                  borderLeft: `3px solid ${alert.type === "slow_request" ? "#d97706" : "#dc2626"}`,
                  fontSize: 12,
                  color: colors.text,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{alert.message}</span>
                <span style={{ color: colors.textMuted, whiteSpace: "nowrap" }}>{alert.time_str}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Refresh controls */}
      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: colors.textMuted }}>
        <span>Auto-refresh:</span>
        {[1000, 5000, 10000, 30000].map((ms) => (
          <button
            key={ms}
            onClick={() => setAutoRefresh(ms)}
            style={{
              padding: "3px 10px",
              borderRadius: 8,
              border: `1px solid ${autoRefresh === ms ? colors.accent : colors.border}`,
              background: autoRefresh === ms ? `${colors.accent}15` : "transparent",
              color: autoRefresh === ms ? colors.accent : colors.textSecondary,
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            {ms / 1000}s
          </button>
        ))}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

function MetricCard({ title, value, icon, colors, alert }: { title: string; value: string; icon: string; colors: any; alert?: boolean }) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        background: colors.surface,
        border: `1px solid ${alert ? "#fbbf24" : colors.border}`,
        transition: "all 0.2s",
      }}
    >
      <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>{icon} {title}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: alert ? "#d97706" : colors.text }}>{value}</div>
    </div>
  );
}

function Panel({ title, colors, children }: { title: string; colors: any; children: React.ReactNode }) {
  return (
    <div style={{ padding: "14px 16px", borderRadius: 12, background: colors.surface, border: `1px solid ${colors.border}` }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: colors.text, marginBottom: 12 }}>{title}</h3>
      {children}
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ color, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function BarChart({ value, label, color, colors }: { value: number; label: string; color: string; colors: any }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ height: 6, borderRadius: 3, background: colors.borderLight, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${Math.min(value, 100)}%`,
            borderRadius: 3,
            background: color,
            transition: "width 0.5s ease",
          }}
        />
      </div>
    </div>
  );
}
