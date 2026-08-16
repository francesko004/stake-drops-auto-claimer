# 📘 Complete Guide: Using Stake Auto-Claim in Google Chrome

A step-by-step guide on how to build, install, configure, and use the **Stake Auto-Claim** Chrome Extension.

---

## 📋 Table of Contents
1. [Overview](#-overview)
2. [Step 1: Build the Extension](#-step-1-build-the-extension)
3. [Step 2: Install into Google Chrome](#-step-2-install-into-google-chrome)
4. [Step 3: Setup Your Browser Tabs](#-step-3-setup-your-browser-tabs)
5. [Step 4: Using the Extension Dashboard](#-step-4-using-the-extension-dashboard)
6. [Key Features & Controls](#-key-features--controls)
7. [Configuring Preferences & Filters](#-configuring-preferences--filters)
8. [Updating / Reloading the Extension](#-updating--reloading-the-extension)
9. [Troubleshooting & FAQs](#-troubleshooting--faqs)

---

## ⚡ Overview
**Stake Auto-Claim** is an automated bonus drop claimer that:
- Monitors live drops on [StakeCruncher.com](https://stakecruncher.com/bonus-codes) in real time using DOM `MutationObserver`.
- Instantly transmits new codes to your active [Stake.com](https://stake.com) tab.
- Automatically types and submits the bonus code with **< 50ms turbo latency**.
- Automatically clicks **Dismiss / Close** on confirmation popups to keep your screen ready for the next drop.

---

## 🔨 Step 1: Build the Extension

Open your terminal or command prompt in the project root directory:

```bash
# 1. Install project dependencies (if not done yet)
npm install

# 2. Build the extension bundle into /dist
npm run build
```

> **Result:** A production-ready `/dist` folder containing `manifest.json`, `icons/`, `popup/`, `options/`, `content/`, and `background/` will be generated.

---

## 🧩 Step 2: Install into Google Chrome

1. Open **Google Chrome** (or any Chromium browser such as Brave, Edge, Opera).
2. In the address bar, type:
   ```text
   chrome://extensions/
   ```
   and press **Enter**.
3. In the top-right corner of the Extensions page, turn **ON** the **Developer mode** toggle switch.

   ```
   +-------------------------------------------------------------+
   | Extensions                        [ Developer mode  (ON) ]  |
   +-------------------------------------------------------------+
   | [ Load unpacked ]  [ Pack extension ]  [ Update ]           |
   +-------------------------------------------------------------+
   ```

4. Click the **Load unpacked** button in the top-left corner.
5. In the file picker dialog, navigate to your project directory and select the **`dist`** folder:
   ```text
   c:\Users\fshah\dyad-apps\Stake Drops Auto Claimer\dist
   ```
6. Click **Select Folder**.

### 📌 Pin the Extension to Toolbar
1. Click the **Puzzle Piece icon** 🧩 in Chrome's top-right toolbar.
2. Find **Stake Auto-Claim** and click the **Pin** 📌 icon next to it so it stays visible in your toolbar.

---

## 🌐 Step 3: Setup Your Browser Tabs

For automated drop claiming, keep two tabs open in your browser:

### 1️⃣ Tab 1: Stake.com
- Open [https://stake.com](https://stake.com) (or your regional mirror like `stake.us`, `stake.bet`).
- Make sure you are **logged in** to your account.
- *(Optional)* You can navigate to **Settings > Offers** or leave it on the home page — the extension will automatically open the offers tab when a drop arrives.

### 2️⃣ Tab 2: StakeCruncher
- Open [https://stakecruncher.com/bonus-codes](https://stakecruncher.com/bonus-codes).
- Leave this tab open. The extension will passively listen for new bonus drops appearing on the live table.

---

## 🎮 Step 4: Using the Extension Dashboard

Click the **Stake** icon in your toolbar to open the popup dashboard:

```
+---------------------------------------------------------+
| [Stake Logo] STAKE AUTO-CLAIM [v1.2 TURBO]  [✕] [🎁] [⚙]|
|              Ultra-Fast Drop Claimer                    |
+---------------------------------------------------------+
| TOTAL EARNINGS CLAIMED       [⚡ FAST-CLAIM] [LIVE 💰]  |
| $15.50                                                  |
+---------------------------------------------------------+
| ENGINE STATUS                                [●] ACTIVE |
| [ Stake: CONNECTED ]     [ StakeCruncher: MONITORING ]  |
+---------------------------------------------------------+
| LATEST BONUS DROP                            2s ago     |
| [ stakebonus123 ] [📋]          [$5.00] [CLAIMED]       |
| Wager Req: $3,000 in 7 days                             |
+---------------------------------------------------------+
| MANUAL CLAIM / FAST TESTER                              |
| [ Enter custom bonus code...          ] [ Claim ]       |
+---------------------------------------------------------+
| SESSION METRICS                                [Reset]  |
| [  12 Detected ]   [  8 Attempted ]   [  7 Claimed ]    |
| [  1 Expired   ]   [  2 Already   ]   [  0 Failed  ]    |
+---------------------------------------------------------+
| LIVE ACTIVITY STREAM                         (● Live)   |
| 15:42:10 ✓ Bonus claimed: stakebonus123 (+$5.00)        |
+---------------------------------------------------------+
| [⚡ DEACTIVATE AUTO-CLAIM ]                              |
| [ PAUSE ]                     [ CLEAR LOGS ]            |
+---------------------------------------------------------+
```

1. **Click `[ ACTIVATE AUTO-CLAIM ]`**: The status dot turns vibrant green `ACTIVE`.
2. **Leave Chrome Running**: As soon as a bonus drop is announced on StakeCruncher, the extension will automatically claim it on Stake in milliseconds.

---

## 🚀 Key Features & Controls

| Feature | Description |
| :--- | :--- |
| **⚡ Turbo Fast-Claim (< 50ms)** | Instant synthetic event injection into Stake's Svelte 5 engine with zero delay. |
| **✕ Auto-Dismiss Dialogs** | Automatically clicks "Dismiss", "Close", or "Got it" after each claim to keep the UI clear. |
| **✕ Manual Dismiss Button** | Top header button to instantly close any stuck modal or dialog with one click. |
| **🎁 Open Offers Tab** | Quick shortcut button in header to jump directly to Stake's bonus code redemption form. |
| **📋 Manual Claim Tester** | Paste any custom promo code into the input field and hit **Claim** for immediate testing. |
| **⏸️ Safety Challenge Pause** | If Cloudflare / Turnstile verification appears, automation pauses safely. Complete the check and click **Resume**. |

---

## ⚙️ Configuring Preferences & Filters

Click the **Settings gear** ⚙ in the popup header (or right-click extension icon > *Options*):

- **Turbo Fast-Claiming Mode**: Enables sub-50ms ultra-low latency claiming.
- **Auto-Dismiss Claim Modals & Toasts**: Automatically dismisses confirmation dialogs.
- **Minimum Bonus Value ($ USD)**: Skip drops with stated value below this threshold (set `0` to claim all).
- **Maximum 7-Day Wager Requirement ($ USD)**: Skip drops that require more than your recent wager volume (set `0` for unlimited).
- **Desktop Notifications**: Receive rich popups when drops are detected and claimed.
- **Audio Chime Alerts**: Play sound notification on successful claims.
- **Allowed Stake Domains**: Configure custom mirrors (e.g. `stake.com, stake.us, stake.bet, stake.games`).

---

## 🔄 Updating / Reloading the Extension

Whenever you make changes to the source code:

1. In your terminal, run:
   ```bash
   npm run build
   ```
2. In Google Chrome, go to `chrome://extensions/`.
3. Locate **Stake Auto-Claim** and click the **circular Reload icon** 🔄.
4. Refresh your open `stake.com` and `stakecruncher.com` tabs once so they reconnect to the new service worker.

---

## ❓ Troubleshooting & FAQs

### Q: The status says "Stake: NOT_FOUND"
- **Fix:** Ensure you have `https://stake.com` (or your configured mirror domain) open in at least one browser tab.

### Q: The status says "StakeCruncher: NOT_FOUND"
- **Fix:** Open `https://stakecruncher.com/bonus-codes` in a tab.

### Q: What happens if a CAPTCHA or Cloudflare challenge appears?
- **Answer:** The extension will immediately halt automation to protect your account and display a red **HUMAN VERIFICATION REQUIRED** banner. Solve the challenge on Stake, then click **RESUME** in the popup.

### Q: Will existing codes on StakeCruncher be claimed when I refresh the page?
- **Answer:** No. On initial load, the extension records all existing codes as baseline history. Only **genuinely new codes** appearing in live DOM mutations are claimed.
