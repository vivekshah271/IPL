# IPL Live Auction Portal

Real-time IPL-style auction with **Auctioneer Panel** and **Live Viewer Panel**, powered by Socket.IO. Player data is imported from the ARROW IPL auction catalogue PDF.

## Quick start

```bash
cd ipl-auction
npm install
npm run parse          # Import players from catalogue.pdf
cd client && npm install && cd ..
npm run dev            # Server :3001 + Client :5173
```

- **Auctioneer Panel**: Manage players, bids, sold/unsold, team budgets.
- **Live Viewer Panel**: Display-only; updates instantly when the auctioneer acts.

Open http://localhost:5173 and switch tabs in the header.

## Data

Place `catalogue.pdf` in the project root (included from ARROW Player List). Run `npm run parse` to regenerate `data/players.json`.

## Teams & budget

All 10 IPL franchises start with **₹120 Cr** purse and **25** squad slots. Selling a player deducts the final price from the buying team's remaining budget in real time.

## Production

```bash
npm install
npm run build
npm start
```

Serves the built client from the Express server (default port 3001, or `PORT` env var).

## Deploy on Render (free tier)

1. Push this project to a **GitHub** repository.
2. Go to [render.com](https://render.com) → **New** → **Blueprint** (or **Web Service**).
3. Connect the repo. If using Blueprint, Render reads `render.yaml` automatically.
4. Manual Web Service settings (if not using Blueprint):
   - **Build command:** `npm install && npm install --prefix client && npm run build`
   - **Start command:** `npm start`
   - **Health check path:** `/api/state`
5. Deploy. Share your `https://….onrender.com` URL.

**Share with viewers:** `https://your-app.onrender.com` (opens **Live Viewer** by default)  
**Auctioneer:** same URL with `?tab=auctioneer` or use the Auctioneer tab after login.

**Free tier notes:** The app sleeps after ~15 minutes with no traffic; the first visit after that may take up to a minute to wake up. Open the URL before the auction starts.

**Postgres:** Blueprint deploy includes a free database. Auction state (sales, bids, live player) persists across restarts. See `DEPLOY.md` and `.env.example` for local setup.
