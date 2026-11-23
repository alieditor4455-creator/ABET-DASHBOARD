# Setting up ABET Content OS on free services

Total time is about 15 minutes. You don't need a credit card. You'll create two free accounts, then give Claude two access keys through a secure form. Never paste keys into the chat.

## What runs where (all free)

| Part | Service | Free plan limits that matter |
|---|---|---|
| Website (the dashboard) | Cloudflare Pages | Unlimited visits; commercial use allowed |
| Claude connector (MCP) | Cloudflare Workers | 100,000 requests a day |
| Database, login, permissions | Supabase | 500 MB database; **pauses after 7 days with no use** (one click to resume) |
| File storage | Supabase Storage | **1 GB total, 50 MB per file** |
| AI (scripts, ideas, plans) | Your Claude Pro plan, through a custom connector | Your normal Pro usage limits |
| Video rendering | Your editors, in their own tools | Not automated yet |

Why not Vercel: its free plan doesn't allow commercial use. Cloudflare's free plan does.

When you outgrow the free plans:
- **Videos over 50 MB:** Cloudflare R2 gives 10 GB free, but it needs a card on file.
- **Database:** Supabase Pro costs $25 a month and never pauses.

## Step 1: Supabase (database and login)

1. Go to **supabase.com** and click **Start your project**. Sign in with **GitHub**.
2. Create an organization. Name it "ABET Global" and choose the **Free** plan.
3. Click **New project**:
   - Name: `abet-content-os`
   - Database password: click **Generate a password** and save it in a password manager.
   - Region: **Central EU (Frankfurt)** is closest to the Sofia head office. Pick another if most of your team is elsewhere.
4. Wait about 2 minutes for the project to finish setting up.
5. Create an access token. Click your avatar (bottom-left), then **Account preferences**, then **Access Tokens**. Click **Generate new token** and name it `claude-setup`. **Copy it and keep the tab open.** You'll paste it into a secure form, not the chat.
6. Send Claude the **Project ID**: **Project Settings → General → Project ID**. It looks like `abcdefghijklmnop`. The Project ID isn't secret, so you can paste it in chat.

## Step 2: Cloudflare (website hosting)

1. Go to **dash.cloudflare.com/sign-up** and create an account with your work email. Verify the email.
2. Get your **Account ID**: on the home page, click **⋯** next to the account name and choose **Copy account ID**. It isn't secret, so you can paste it in chat.
3. Create an API token. Go to **My Profile → API Tokens → Create Token** and choose **Create Custom Token**, with these settings:
   - Name: `claude-deploy`
   - Permissions:
     - Account → **Cloudflare Pages** → Edit
     - Account → **Workers Scripts** → Edit
     - Account → **Workers KV Storage** → Edit
   - Account Resources: Include → your account

   Click **Continue to summary**, then **Create Token**. Copy it for the secure form.

## Step 3: Hand over the keys

Reply in chat with:
- your Supabase **Project ID**
- your Cloudflare **Account ID**

Claude then shows two **secure forms**: one for the Supabase token and one for the Cloudflare token. The keys go straight into this environment's encrypted settings. Claude never sees them, and they're never stored in the code.

## Step 4: Connect Claude Pro (after the first deploy)

Claude will give you a connector URL like `https://abet-mcp.<your-account>.workers.dev/mcp`. Then:

1. On claude.ai, go to **Settings → Connectors → Add custom connector**.
2. Name: `ABET Content OS`. URL: the link Claude gives you.
3. Click **Connect** and sign in with your ABET Content OS account.

From then on you can ask Claude, in any chat, things like "Write a 45-second reel script about pips for beginners and save it to the ABET dashboard". The script appears in Content Studio and Production, with your name on it.

## Later: custom domain

To use `app.abetglobal.com`, whoever manages the abetglobal.com DNS adds one CNAME record. Claude will give you the exact record. Until then the app lives at `abet-content-os.pages.dev`.

## Later: social publishing

Each platform's official API needs a developer app, and some need an approval review:

- **YouTube:** free API quota. A Google Cloud project, quick to set up.
- **Instagram and Facebook:** a Meta developer app and app review, which takes days to weeks.
- **LinkedIn:** company-page posting needs Community Management API approval.
- **TikTok:** the Content Posting API needs an audit before posts can be public.
- **X:** the API is paid for meaningful posting volume.

Until a platform is approved, the app prepares a **manual publishing package** for it: the final file, a caption sized for that platform, hashtags and the risk warning. Someone posts it by hand.
