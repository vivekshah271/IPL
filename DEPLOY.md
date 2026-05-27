# Deploy to Render

## 1. Push code to GitHub

From the project folder:

```bash
git init
git add .
git commit -m "Prepare IPL auction app for Render deployment"
```

Create a new repo on GitHub, then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

## 2. Create the Render service

1. Sign in at [https://dashboard.render.com](https://dashboard.render.com)
2. **New** → **Blueprint**
3. Connect your GitHub account and select the repository
4. Render reads `render.yaml` and creates:
   - **ipl-auction** web service (free)
   - **ipl-auction-db** Postgres (free) with `DATABASE_URL` linked automatically
5. Click **Apply** / **Deploy**

Or use **New → Web Service** manually:

| Setting | Value |
|--------|--------|
| Build Command | `npm install && npm install --prefix client --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/state` |
| Environment | `DATABASE_URL` = Internal Database URL from your Postgres instance |

### Add Postgres to an existing Render web service

1. **New** → **PostgreSQL** (free) → create `ipl-auction-db`
2. Open your web service → **Environment** → add `DATABASE_URL` (copy **Internal Database URL** from Postgres)
3. Redeploy

## 3. Share the URL

After deploy succeeds, Render gives you a URL like:

`https://ipl-auction-xxxx.onrender.com`

- **Viewers:** share that link (opens Live Viewer by default)
- **You (auctioneer):** same URL, open **Auctioneer Panel** and log in

Optional auctioneer link: `https://your-app.onrender.com?tab=auctioneer`

## 4. Before going live

- Open the URL once ~5 minutes before the auction (free tier may sleep after 15 min idle)
- Change auctioneer password in `client/src/components/AuctioneerLogin.jsx` if needed
- Ensure `data/players.json` is committed in the repo
- With Postgres, **sold players and bids survive** server sleep and redeploys (13 → 14 June)

## Persistence (Postgres)

Auction progress is saved automatically after each action to a single `auction_state` row (`JSONB`).

- **Without `DATABASE_URL`:** in-memory only (local dev default)
- **With `DATABASE_URL`:** survives overnight and cold starts

Local Postgres (optional): copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm start`.

## Troubleshooting

- **Build fails:** Check Render logs; confirm Node 18+ and that `client` dependencies install
- **Blank page:** Build step must complete so `client/dist` exists
- **OFFLINE / no updates:** Wait for cold start, or refresh after the service wakes up
- **DB connection errors:** Confirm `DATABASE_URL` is set on the web service (not only on the database)
- **State reset unexpectedly:** Check logs for `Failed to persist`; use **Reset** only when you intend to clear
