# ThermalOps Command Center

**Industrial heat-risk intelligence for safer operations.**

ThermalOps Command Center converts geographic temperature data into an operational decision layer for industrial teams. It combines site heatmaps, risk ranking, anomaly detection, governance thresholds, explainable interventions, assessment history, exports, and an executive heat brief.

## What it does

- Accepts industrial site CSV files with `id`, `name`, `lat`, and `lon` columns.
- Runs Demo Mode with local sample data or Live Mode through the FortyGuard API.
- Ranks sites as **Critical**, **High**, **Moderate**, or **Low** using peak temperature, exceedance, persistence, and anomaly signals.
- Displays a Google Maps thermal field with clickable site markers.
- Flags unusual hotspots with the exact label **Anomaly Detected**.
- Applies example governance thresholds including OSHA 35 °C and UAE 45 °C.
- Generates plain-language recommendations such as “Halt outdoor work 12:00–15:00” and “Deploy mobile cooling unit.”
- Produces an exactly three-sentence executive heat brief.
- Persists assessment history and supports comparison, CSV export, and print-to-PDF reporting with limitations metadata.

## Technology

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS 4, shadcn-style UI |
| Backend | Express 4, tRPC 11 |
| Database | MySQL/TiDB through Drizzle ORM |
| Authentication | Manus OAuth |
| Mapping | Google Maps through the configured Forge map proxy |
| External climate data | FortyGuard Temperature API |
| Analytics | Deterministic weighted risk scoring and IQR anomaly detection |
| AI | Built-in Forge LLM integration |
| Testing | Vitest and TypeScript checks |

## Quick start

### Requirements

Install Node.js LTS, Git, and pnpm. On Windows, install pnpm with:

```bash
npm install --global pnpm
```

### Install and run

```bash
git clone https://github.com/P2898/FortyGuard_Databaes.git
cd FortyGuard_Databaes
pnpm install
pnpm check
pnpm test
pnpm dev
```

Open the local URL printed by the development server, normally `http://localhost:3000`.

Start in **Demo Mode**. Demo Mode is the safest way to understand the dashboard before making live API requests.

## Environment configuration

Create a local `.env` file in the project root. Never commit it or paste real values into source code.

```env
FORTYGUARD_API_KEY=your_private_FortyGuard_key
FORTYGUARD_BASE_URL=https://api.fortyguard.com
DATABASE_URL=mysql://username:password@host:3306/thermalops
JWT_SECRET=your_long_random_session_secret

VITE_APP_ID=your_Manus_app_id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=your_Manus_oauth_portal_url
OWNER_OPEN_ID=your_owner_open_id
OWNER_NAME=Your Name

BUILT_IN_FORGE_API_URL=your_server_forge_url
BUILT_IN_FORGE_API_KEY=your_server_forge_key
VITE_FRONTEND_FORGE_API_URL=your_frontend_forge_url
VITE_FRONTEND_FORGE_API_KEY=your_frontend_forge_key

VITE_APP_TITLE=ThermalOps Command Center
VITE_APP_LOGO=
```

The FortyGuard key is used only by the server-side proxy. Do not place it in React code or expose it through a public repository. Database, OAuth, Forge, and session values are also private project configuration.

## FortyGuard workflow

The application sends a geographic request to the server, receives an asynchronous `activity_id`, polls until the task completes, normalizes the result, and then calculates site-level risk. Use small U.S. test areas first. The quickstart documentation states that API coverage is U.S.-only and that Premium endpoints may require a Premium plan.

The official Python learning repository is available at:

- [FortyGuard Temperature API Quickstart](https://github.com/FortyGuard-Tech/temperature-api-quickstart)
- [FortyGuard API documentation](https://docs-api.fortyguard.com/docs/introduction)

## Project structure

```text
client/          React pages, components, map UI, and styling
drizzle/         Database schema and migrations
server/          tRPC procedures, API proxy, risk engine, and database helpers
shared/           Shared types and constants
```

## Validation

Run the project checks before opening a pull request or deploying:

```bash
pnpm check
pnpm test
pnpm build
```

## Limitations

FortyGuard coverage, plan availability, request limits, and Premium endpoint access are controlled by FortyGuard. Governance thresholds in this application are configurable decision-support examples and are not legal advice or an automatic determination of regulatory compliance. Heat-risk results should be reviewed by qualified safety and operations personnel.

## License

This project is maintained for the FortyGuard hackathon and subsequent prototyping. Add the project license terms before distributing it outside the intended team.
