export function getRiskColor(risk: string): string {
  switch (risk) {
    case "CRITICAL": return "#dc2626";
    case "HIGH": return "#ea580c";
    case "MEDIUM": return "#d97706";
    case "LOW": return "#16a34a";
    default: return "#6b7280";
  }
}

// Temperature conversion utilities
export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9/5) + 32;
}

export function formatTemperature(celsius: number, showBoth: boolean = true): string {
  const fahrenheit = celsiusToFahrenheit(celsius);
  if (showBoth) {
    return `${celsius.toFixed(1)}°C / ${fahrenheit.toFixed(0)}°F`;
  }
  return `${celsius.toFixed(1)}°C`;
}

// Temperature thresholds for color coding
export function getTempColor(tempC: number): string {
  if (tempC < 22) return "#22c55e"; // Cool - green
  if (tempC < 27) return "#84cc16"; // Mild - lime
  if (tempC < 32) return "#eab308"; // Warm - yellow
  if (tempC < 37) return "#f97316"; // Hot - orange
  return "#ef4444"; // Extreme - red
}

export function getRiskBg(risk: string, theme?: string): string {
  if (theme === "dark") {
    switch (risk) {
      case "CRITICAL": return "#3a1515";
      case "HIGH": return "#3a2510";
      case "MEDIUM": return "#3a3010";
      case "LOW": return "#152a15";
      default: return "#1a1a2a";
    }
  }
  switch (risk) {
    case "CRITICAL": return "#fef2f2";
    case "HIGH": return "#fff7ed";
    case "MEDIUM": return "#fffbeb";
    case "LOW": return "#f0fdf4";
    default: return "#f9fafb";
  }
}

export function exportCSV(data: Record<string, any>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(","),
    ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? "")).join(","))
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
