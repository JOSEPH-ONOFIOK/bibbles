# Mochi sign-ups sheet: deploy guide

`Code.gs` is a Google Apps Script web app that keeps a readable list of sign-ups
in a Google Sheet. Upstash is the database once it is connected; before that this
sheet is the only shared list. Visitors never wait for it, and if it goes down the
site keeps working.

## 1. Make the spreadsheet

1. Go to <https://sheets.new> and name it something like `Mochi Signups`.
2. Leave it empty. The script creates its tab on the first save.

## 2. Add the script

1. In the spreadsheet: **Extensions → Apps Script**.
2. Delete the placeholder `myFunction` code.
3. Paste the whole contents of [Code.gs](Code.gs).
4. Save (⌘S / Ctrl+S).

## 3. Check it works

Back in the editor, pick `selfTest` in the function dropdown, press **Run**,
allow the permissions Google asks for, then open **Execution log**. The last
line should read:

```
PASS. Delete the "selftest" row before going live.
```

Delete the `selftest` row from the `Signups` tab.

## 4. Deploy it

1. **Deploy → New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Set **Execute as: Me** and **Who has access: Anyone**.
4. **Deploy**, then **Authorize access**. Google warns the app is unverified;
   that is expected for your own script. Choose **Advanced → Go to (project name)**.
5. Copy the **Web app URL**, which looks like
   `https://script.google.com/macros/s/AKfy.../exec`.

"Anyone" is required because the site calls the URL from its server without
Google credentials. There is no secret, so anyone who has this URL can add rows.
Keep it out of the repo and out of anything public. The sheet itself stays private.

## 5. Point the site at it

Add this in Vercel (**Project → Settings → Environment Variables**), then redeploy:

```
GOOGLE_SHEETS_WEBAPP_URL=https://script.google.com/macros/s/AKfy.../exec
```

To check, open your web app URL with `?version` on the end. It should show the
script version.

## Re-deploying after an edit

A new deployment gets a new URL. To keep the existing one:

**Deploy → Manage deployments → pencil icon → Version: New version → Deploy**

## What lands in the sheet

**Signups** has one row per X handle:

| Column | Value |
| --- | --- |
| X Handle | Their X username |
| Wallet | The wallet they entered |
| Complete | yes once all five tasks are done |
| Followed, Liked + Reposted | When they did each |
| Tag Reply, Mochi Post | Links to their verified posts |
| Joined At, Completed At, Updated At | Timestamps in UTC |
| Referred By | Who invited them |
| Referrals | Friends they brought in, updated on each new referral |
| Votes, Airdrop | Filled in when their gallery Mochi reaches the airdrop goal |
| MochiList | yes once their MochiList spot is confirmed |
| MochiList Wallet, MochiList Collection | The holder wallet they checked and the collection found in it |
| MochiList Comment | Link to their verified comment on the announcement |
| MochiList At | When the spot was confirmed |

Sorting or filtering the tab is safe: handles are found by name, never by row
position. Filled-in cells are kept: someone who clears their browser and starts
over keeps their row, and it stays `yes` once complete.

For exact referral, vote and airdrop numbers use the CSV export at
`/api/admin/export?key=...`, which is worked out from the database. Votes in the
sheet only update when someone secures an airdrop.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `Sheets web app returned 401/403` in the logs | Access isn't "Anyone", or the deployment was never authorised |
| Edits to `Code.gs` have no effect | Saved but not deployed as a new version |
