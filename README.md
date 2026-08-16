# ⚡ Stake Auto-Claim — Manifest V3 Chrome Extension

A high-performance, production-ready Manifest V3 Chrome extension designed to automatically detect new bonus drops from **StakeCruncher** and instantly claim them on **Stake.com** via the standard webpage user interface.

---

## 🌟 Key Features

- **⚡ Zero-Latency Mutation Detection**: Uses `MutationObserver` on `https://stakecruncher.com/bonus-codes` to instantly capture newly published bonus codes the exact millisecond they render in the DOM.
- **🛡️ Strict Safety & Non-Invasive UI Policy**: Interacts with Stake solely through the normal visible DOM interface (focus, synthetic input dispatch, and click events). **Zero** CAPTCHA bypass, **zero** Cloudflare bypass, **zero** cookie/token extraction, and **zero** private API exploitation.
- **⏸️ Instant Challenge Pause**: If Stake presents any human verification, Cloudflare Turnstile, or CAPTCHA challenge, the extension immediately halts automation and displays `PAUSED_SECURITY_CHALLENGE`. The user manually solves the challenge and clicks **RESUME**.
- **🎯 Baseline Isolation**: On initial page load of StakeCruncher, existing visible codes are recorded as baseline and **never** trigger mass claim requests. Only genuinely new codes appearing in DOM mutations trigger the auto-claim pipeline.
- **📊 Real-Time Web3 Dashboard**: Sleek, dark casino aesthetic popup (~380×580px) displaying connection status, latest detected code with copy helper, 6 session metric counters, and a live activity feed.
- **⚙️ Configurable Preferences**: Options page with toggles for desktop notifications, audio chimes (synthesized locally via Web Audio API), custom Stake mirror domains, history capacity, and debug logs.
- **🔒 Fully Client-Side**: No external backend servers, no cloud databases, and zero credential storage.

---

## 🏗️ Architecture Flow

```
+-------------------------------------------------------------+
|               StakeCruncher (bonus-codes)                   |
|  DOM Mutation -> MutationObserver -> parseBonusCodeElement  |
+-------------------------------------------------------------+
                              | (NEW_CODE Message)
                              v
+-------------------------------------------------------------+
|             Background Service Worker & Coordinator         |
|  - Deduplication Check (seenCodes, claimedCodes)            |
|  - Queue Management (sequential claimQueue)                 |
|  - Tab Discovery (find active Stake.com tab)                |
|  - Notification & Metric Dispatch                           |
+-------------------------------------------------------------+
                              | (EXECUTE_CLAIM Message)
                              v
+-------------------------------------------------------------+
|                     Stake.com Content Script                |
|  1. Check for Security Challenge / CAPTCHA                  |
|  2. findBonusCodeInput() -> enterBonusCode(code)            |
|  3. findClaimButton() -> click()                            |
|  4. Observe DOM Toast / Message -> Classify Result          |
+-------------------------------------------------------------+
                              | (CLAIM_RESULT)
                              v
+-------------------------------------------------------------+
|                     State & Stats Storage                   |
|  - Updates session stats (Success, Expired, Already Had)    |
|  - Updates live activity feed in Popup UI                   |
+-------------------------------------------------------------+
```

---

## 🚀 Installation & Setup

> 📘 **Looking for the complete walkthrough?** See the [Chrome Installation & Usage Guide](CHROME_GUIDE.md).

### Prerequisites
- Node.js (v18+ recommended)
- Google Chrome (or Chromium-based browser like Brave, Edge)

### 1. Build the Extension
```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Check TypeScript types
npm run typecheck

# Build the production bundle
npm run build
```

The compiled extension files will be placed into the `dist/` directory.

### 2. Load the Unpacked Extension in Chrome
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click the **Load unpacked** button.
4. Select the `dist/` folder inside this project directory.
5. The **Stake Auto-Claim** extension icon will now appear in your browser toolbar.

---

## 🕹️ User Workflow

1. **Open Stake**: Navigate to `https://stake.com` (and log into your account). Ensure the redemption modal or offers tab is accessible.
2. **Open StakeCruncher**: Navigate to `https://stakecruncher.com/bonus-codes` in another tab or window.
3. **Activate Auto-Claim**: Click the extension icon in your Chrome toolbar and press **[ ACTIVATE AUTO-CLAIM ]**.
4. **Leave Running**: Keep the tabs open in the background. When a new bonus drop appears, the extension will automatically:
   - Capture the code
   - Route it to the Stake tab
   - Fill and click the claim button
   - Display desktop notifications and update the popup metrics.

---

## 🛡️ Security & Compliance Guidelines

The extension strictly adheres to web safety and browser extension policies:
- **No Credential Harvesting**: Never reads passwords, 2FA tokens, private keys, or wallet seed phrases.
- **No Token / Cookie Extraction**: Never accesses `document.cookie`, `localStorage`, `sessionStorage`, or auth headers.
- **No Protection Bypass**: Zero automated CAPTCHA solvers or Cloudflare bypass mechanisms.
- **Minimal Permissions**: Host permissions are restricted exclusively to `stake.com` and `stakecruncher.com`.

---

## 🧪 Testing & Validation

### Automated Unit Tests
Run the Vitest test suite covering element parsing, code normalization, duplicate checking, queue coordination, challenge detection, and storage:
```bash
npm test
```

### Manual Test Fixture
Open `dist/test-fixtures/bonus-codes-fixture.html` (or `test/fixtures/bonus-codes-fixture.html`) in Chrome to test DOM mutations in a controlled environment:
- Includes 30 initial baseline codes (will not trigger claim).
- Automatically triggers a fresh code injection after 2 seconds.
- Interactive buttons to simulate duplicates, batch additions, and sparse codes.

---

## 📁 Project Structure

```
.
├── manifest.json                  # Manifest V3 definition
├── package.json                   # Dependencies and npm scripts
├── tsconfig.json                  # Strict TypeScript configuration
├── vite.config.ts                 # Multi-entry Vite bundler config
├── src/
│   ├── background/
│   │   ├── coordinator.ts         # Central claim queue & tab coordinator
│   │   ├── notifications.ts       # Desktop alerts and badge updater
│   │   ├── service-worker.ts      # Main extension service worker
│   │   └── storage.ts             # Type-safe chrome.storage wrapper
│   ├── content/
│   │   ├── stake-automator.ts     # Stake.com visible UI interaction
│   │   ├── stake-detector.ts      # Heuristic input/button/challenge detector
│   │   └── stakecruncher-monitor.ts # MutationObserver on StakeCruncher
│   ├── options/
│   │   ├── options.css            # Options page styles
│   │   ├── options.html           # Settings UI
│   │   └── options.ts             # Settings controller
│   ├── popup/
│   │   ├── popup.css              # Dark Web3 popup styles
│   │   ├── popup.html             # Popup dashboard UI
│   │   └── popup.ts               # Popup state controller
│   └── shared/
│       ├── constants.ts           # Selectors, regexes, and defaults
│       ├── logger.ts              # Structured console logger
│       ├── messages.ts            # Type-safe extension messages
│       ├── parser.ts              # Code parser and deduplicator
│       └── types.ts               # TypeScript data models
└── test/
    ├── coordinator.test.ts        # Queue & state machine unit tests
    ├── fixtures/
    │   └── bonus-codes-fixture.html # DOM mutation test fixture
    ├── parser.test.ts             # DOM parsing & regex tests
    ├── stake-detector.test.ts     # Heuristic detection tests
    └── storage.test.ts            # Storage operations & stats tests
```
