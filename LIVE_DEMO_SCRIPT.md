# Shade — Live Demo Script

**Duration:** 3 minutes max
**Setup:** Open https://frontend-ten-pied-ucmtf13d1v.vercel.app in Chrome (dark mode)
**Recording:** Start screen recording before beginning

---

## Opening (15 seconds)

**[Screen: Dashboard with stat cards visible]**

> "Heat kills 38 US workers every year and costs the economy 100 billion dollars annually. Existing tools use weather station data at 11-kilometer resolution — they can tell you it's hot in Tracy, but they can't tell the difference between a foggy Oakland waterfront at 19 degrees and a Tracy warehouse at 39 degrees on the same day. That's a 36-degree difference that determines whether workers need halt-work protocols or just water stations.
>
> Shade is a heat safety intelligence platform powered by FortyGuard's 20-meter resolution temperature data. Let me show you how it works."

---

## Part 1: Fleet Dashboard — Real-Time Risk (30 seconds)

**[Click "Dashboard" in sidebar]**

> "Here's the Fleet Dashboard. We're monitoring 8 Bay Area worksites in real time."

**[Point to stat cards at top]**

> "Total sites: 8. Active alerts show CRITICAL and HIGH risk. Average temperature across the portfolio is displayed here."

**[Scroll down to the Fleet Dashboard table]**

> "Each site is ranked by risk level using exact NWS Heat Index thresholds. Tracy Logistics Hub and Livermore Solar Farm are CRITICAL right now — heat index above 103 degrees Fahrenheit, which is the NWS Danger zone. Oakland and SF Waterfront are LOW — coastal sites stay cooler."

**[Hover over a CRITICAL row to show the threshold tooltip]**

> "Every threshold is sourced — this isn't invented. NWS Danger, 103 to 124 Fahrenheit. You can verify it yourself."

**[Click the red CRITICAL count stat card — table filters]**

> "Click any stat card to filter. These two sites need immediate attention."

---

## Part 2: Heat P&L — Financial Impact (20 seconds)

**[Click "Heat P&L" in sidebar]**

> "Now let's talk money. This is the Heat P&L — our financial impact calculator."

**[Point to the total cost number]**

> "Today's estimated portfolio cost is 20,500 dollars. That's hazard pay owed to workers in extreme heat, productivity loss, and schedule delay exposure."

**[Point to the line items]**

> "Hazard pay: 675 dollars based on company wage rates. Productivity loss: 35 dollars from the SF Federal Reserve's research. Schedule delays: 20,000 dollars at 5,000 per exceedance day. Every number traces back to a real source."

---

## Part 3: Predictive Forecast (25 seconds)

**[Click "Forecast" in sidebar]**

> "This is the 12-hour predictive forecast. For each site, we show checkpoints at 0, 3, 6, 9, and 12 hours into the future."

**[Point to Cost of Inaction card]**

> "If no action is taken, projected cost: 10,500 dollars. But if we reschedule — shift the shift from 2 PM to 7 AM — we save 700 dollars. That's the reschedule and save recommendation."

**[Point to a CRITICAL site card]**

> "Livermore Solar Farm — peak at 5 PM, Danger zone. Hours above 103 degrees: 2. The system tells you exactly when to stop outdoor work."

---

## Part 4: Kelvin AI Chatbot (40 seconds)

**[Click "Kelvin" in sidebar]**

> "This is Kelvin — our AI safety assistant. Ask it anything."

**[Type: "Is Tracy safe?"]**

> **[Kelvin responds with site-specific CRITICAL risk data]**

> "Kelvin pulls real-time data from FortyGuard for Tracy and tells you it's CRITICAL at 36 degrees with a recommendation to halt heavy work."

**[Type: "How much does heat cost us?"]**

> **[Kelvin responds with financial breakdown]**

> "Financial query — it gives you the exact cost breakdown from our Heat P&L model."

**[Type: "Is it safe to work outdoors?"]**

> **[Kelvin responds with human-friendly advice]**

> "This runs our heat illness prediction model. It says 'work with caution' with specific actions — mandatory rest every 30 minutes, buddy system. Numbers plus plain-language advice."

**[Type: "Plan a route from Oakland to Tracy"]**

> **[App navigates to Route Planner]**

> "And it even navigates you to the Route Planner with the locations pre-filled."

---

## Part 5: Route Planner (20 seconds)

**[Route Planner is now open]**

> "Here's the route from Oakland Port to Tracy Logistics Hub. Two routes — fastest in red, coolest in orange."

**[Point to the temperature comparison]**

> "Fastest route average: 37.4 degrees. Coolest route: 36.9 degrees. The cooler route deviates from the highway to avoid urban heat islands — saves workers from half a degree of heat exposure."

**[Point to the map with colored route lines]**

> "Blue means cooler, red means hotter. Workers can see exactly where the danger zones are."

---

## Part 6: Voice + Mobile (15 seconds)

**[Click the microphone button]**

> "Kelvin also supports voice input — click the mic, speak your question, and it transcribes and responds instantly."

**[Speak: "What's the temperature at Livermore?"]**

> **[Kelvin responds with site-specific data]**

> "And the entire app works on mobile — every screen, every feature, right in your phone browser."

---

## Closing (15 seconds)

**[Screen: Dashboard overview]**

> "Shade combines FortyGuard's 20-meter resolution data with OSHA compliance rules, predictive analytics, and financial modeling — all sourced to official NWS, OSHA, and NIOSH thresholds. Nothing is invented. Every number has a citation.
>
> We're Shade. Turning hyperlocal temperature data into actionable safety intelligence. Thank you."

---

## Quick Reference — What to Click

| Order | Page | Action |
|---|---|---|
| 1 | Dashboard | Show stat cards, scroll to table, filter by CRITICAL |
| 2 | Heat P&L | Show total cost, hover line items |
| 3 | Forecast | Show cost of inaction, reschedule savings |
| 4 | Kelvin | Type 4 queries, show navigation feature |
| 5 | Route Planner | Show fastest vs coolest route comparison |
| 6 | Kelvin | Demo voice input |
| 7 | Dashboard | Closing shot |

## Backup Lines (if something fails)

- If Render is sleeping: "The backend runs on Render's free tier — it takes a moment to wake up on first request."
- If voice doesn't work: "Voice input works on Chrome and Edge — uses the browser's built-in speech recognition."
- If forecast shows different numbers: "These are dynamic predictions based on current conditions — they update in real time."

## Key Numbers to Remember

| Stat | Value |
|---|---|
| Sites monitored | 8 |
| Daily heat cost | ~$20,500 |
| Cost of inaction | ~$15,500 |
| Reschedule savings | ~$700 |
| CRITICAL sites | 2 (Tracy, Livermore) |
| Resolution | 20 meters |
| OSHA fine example | $182,000 (Safeway Tracy) |
| Workers killed/year | 38+ |
| Economic cost/year | $100 billion |
