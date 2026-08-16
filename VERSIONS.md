# Version History

## v1.1.2 – 2026-08-16
- **Fixed Notification Image Path**: Updated notification icon URLs from `icon128.png` to `icons/icon128.png`, resolving `Error: Unable to download all specified images`.
- **Fixed Popup State Null Safety**: Added defensive fallback for `state.connection` preventing `TypeError: Cannot read properties of undefined (reading 'stakeStatus')`.
- **Svelte 5 Input & Submit Button Detection**: Upgraded selectors and context-based heuristics to identify Stake's "Claim Bonus Drop" inputs and "Submit" buttons across nested Svelte 5 component trees.
- **Real-Time MutationObserver Toast Watcher**: Replaced periodic polling with real-time DOM mutation observing and increased observe timeout to 8 seconds to catch all transient toast confirmations.

## v1.1.1 – 2026-08-16
- **Fixed Content Script Module Error**: Converted `content/stake-automator.js` and `content/stakecruncher-monitor.js` to 100% self-contained standalone IIFE bundles with zero ES module `import` statements, eliminating `SyntaxError: Cannot use import statement outside a module`.
- **Added Custom Multi-Target Builder**: Created `scripts/build.js` ensuring isolated world script compatibility for Chrome Manifest V3.
- **Added Scripting Permission & Auto-Injection**: Injects into already-opened Stake and StakeCruncher tabs automatically.
- **React 16–19 Synthetic Value Tracker Support**: Added `_valueTracker` synchronization on Stake input.

## v1.1.0 – 2026-08-16
- **Auto-Navigation & Modal Opener**: Implemented auto-opening of Stake's `/settings/offers` redemption modal when closed or on demand.
- **Service Worker Keep-Alive**: Added 24-second `chrome.alarms` heartbeat keeping Manifest V3 service worker active and responsive.
- **Total Earnings Tracker**: Added cumulative USD/crypto winnings calculation and dashboard display with gold/emerald banner.
- **Quick Code Tester in Popup**: Added manual code claim input form for testing codes on demand directly inside the popup.
- **Smart Threshold Filters**: Minimum bonus value and maximum 7-day wager requirement filters.

## v1.0.0 – 2026-08-16
- Initial production-ready release with TypeScript, Vite, Vitest, and Web3 dark dashboard.