# CLAUDE.md - AI Assistant Guide for TradingView Assistant Chrome Extension

## Project Overview

**Type:** Chrome Extension (Manifest V3)
**Purpose:** Backtesting trading strategies and displaying external signals on TradingView
**License:** Apache-2.0
**Version:** 2.11.19 (as of manifest.json)
**Author:** Andrei Kuminov (akumidv)
**Distribution:** Chrome Web Store + Manual Installation

This is a browser extension that automates the process of optimizing trading strategy parameters on TradingView by interacting with the TradingView UI and extracting backtest results. It supports multiple optimization algorithms and can visualize results in 3D charts.

### Core Functionality
1. **Strategy Backtesting & Optimization** - Automates parameter testing using various algorithms
2. **External Signal Upload** - Loads buy/sell signals from CSV files to display on TradingView charts
3. **3D Visualization** - Shows parameter optimization results in 3D charts
4. **Results Management** - Saves and exports backtest results

### Important Disclaimer
This extension automates UI interactions with TradingView and may violate their Terms of Service. Heavy usage can lead to account bans. The extension does NOT use TradingView API calls, parse financial data, or scrape content - it only automates user behavior through the UI.

## Architecture

### Extension Structure

```
tradingview-assistant-chrome-extension/
├── manifest.json              # Chrome extension manifest (v3)
├── content_scripts/           # Scripts injected into TradingView pages
│   ├── controller.js          # Main message handler and coordinator
│   ├── action.js              # User action handlers
│   ├── backtest.js            # Backtesting logic and optimization algorithms
│   ├── model.js               # Data models for strategy parameters
│   ├── tv.js                  # TradingView UI interaction layer
│   ├── tvChart.js             # Chart-specific TradingView interactions
│   ├── ui.js                  # Extension UI elements and popups
│   ├── selector.js            # CSS selectors for TradingView elements
│   ├── page.js                # Page utility functions
│   ├── file.js                # File handling (CSV parsing/export)
│   ├── storage.js             # Chrome storage API wrapper
│   └── signal.js              # External signal handling
├── popup/                     # Extension popup UI
│   ├── assistant.html         # Popup HTML
│   ├── assistant.js           # Popup logic
│   └── style.css              # Popup styles
├── page-context.js            # Injected script for TradingView window access
├── tv-page-objects.js         # Debug script for finding TV DOM elements
├── annealing.js               # Simulated annealing algorithm implementation
├── lib/                       # Third-party libraries
│   └── plotly.min.js          # 3D chart visualization
├── images/                    # Extension icons
├── fonts/                     # Custom fonts
├── pinescripts/               # Pine Script templates
│   └── iondv_signals.txt      # Signal display Pine Script
└── prepare-ext.sh             # Build script for packaging
```

### Execution Flow

1. **Extension Load** → `manifest.json` defines content scripts for `https://*.tradingview.com/chart/*`
2. **Page Load** → Content scripts inject into TradingView page
3. **Initialization** → `controller.js` sets up message listeners and mutation observers
4. **User Action** → Popup (`popup/assistant.js`) sends message to content script
5. **Processing** → `controller.js` routes to appropriate `action.js` handler
6. **TV Interaction** → `tv.js` manipulates TradingView UI via DOM selectors
7. **Data Extraction** → `page-context.js` accesses `window.TradingView` object
8. **Results Storage** → `storage.js` saves to Chrome storage API

### Communication Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Popup UI       │ ◄─────► │  Content Script  │ ◄─────► │ Page Context    │
│  (assistant.js) │  chrome │  (controller.js) │  window │ (page-context.js)│
│                 │  runtime│  (action.js)     │  events │                 │
└─────────────────┘  msgs   └──────────────────┘         └─────────────────┘
                                      │                            │
                                      ▼                            ▼
                              ┌──────────────┐            ┌──────────────┐
                              │  TV UI (DOM) │            │ TradingView  │
                              │  (tv.js)     │            │ window obj   │
                              └──────────────┘            └──────────────┘
```

## Key Files Deep Dive

### manifest.json
- **Manifest Version:** 3 (latest Chrome extension format)
- **Permissions:** `storage`, `unlimitedStorage`, `activeTab`
- **Content Scripts:** Run on `https://*.tradingview.com/chart/*` at `document_end`
- **Injection Order:** selector.js → page.js → ui.js → tv.js → tvChart.js → file.js → storage.js → signal.js → model.js → backtest.js → action.js → controller.js
- **Web Accessible Resources:** page-context.js, fonts, plotly.min.js

### controller.js (Entry Point)
- Sets up interval check for injected UI elements (every 1s)
- Listens for Chrome runtime messages from popup
- Routes actions to appropriate handlers in `action.js`
- Implements global error handling
- Manages `action.workerStatus` to prevent concurrent operations
- Sets up MutationObserver on TradingView dialog elements

**Key Pattern:** Uses async/await throughout, ensures single-threaded execution via `workerStatus` lock.

### action.js (Action Handlers)
Main user actions:
- `saveParameters` - Export strategy parameters to CSV
- `loadParameters` - Import parameters from CSV
- `uploadSignals` - Load external signals from CSV
- `uploadStrategyTestParameters` - Load test configuration
- `getStrategyTemplate` - Generate CSV template for current strategy
- `testStrategy` / `deepTestStrategy` - Run optimization
- `previewStrategyTestResults` - Show results table
- `downloadStrategyTestResults` - Export results CSV
- `clearAll` - Clear stored data
- `show3DChart` - Display 3D parameter visualization

### backtest.js (Core Optimization Logic)
**Main Function:** `backtest.testStrategy(testResults, strategyData, allRangeParams)`

**Optimization Methods:**
1. **Random** - Completely random parameter selection (default)
2. **Random Improvement** - Random changes, keep if better
3. **Sequential** - Systematically test each parameter
4. **Annealing** - Simulated annealing with cooling schedule
5. **Brute Force** - Exhaustive search of parameter space

**Key Functions:**
- `getInitBestValues()` - Get baseline from current/previous tests
- `optRandomIteration()` - Random improvement algorithm
- `optSequentialIteration()` - Sequential search
- `optAnnealingIteration()` - Annealing step (uses annealing.js)
- `optBruteForce()` - Exhaustive search
- `delay()` - Random delay between tests (avoid detection)

**Important:** All results stored in `testResults.perfomanceSummary` array.

### tv.js (TradingView Integration)
**Critical Functions:**
- `tv.getStrategy()` - Get current strategy data and parameters
- `tv.setStrategyParams()` - Update strategy parameters via UI
- `tv.getPerformance()` - Extract backtest results
- `tv.openStrategyTab()` - Navigate to strategy tester
- `tv.dialogHandler()` - Handle TradingView dialog mutations

**Data Access Pattern:**
```javascript
// Old TV API
window.TradingView.bottomWidgetBar._widgets.backtesting._reportWidgetsSet.reportWidget._data.performance

// New TV API (deep history)
window.TradingView.bottomWidgetBar._options.backtestingStrategyDispatcher._modelStrategies[0]._reportData.performance
```

The code handles both old and new TradingView UI versions via `isBaseTradingView` flag.

### selector.js (CSS Selectors)
**Purpose:** Centralized TradingView DOM selectors
**Pattern:** Uses object with getter functions for version-dependent selectors
- `selStatus.isNewVersion` - Determines which selectors to use
- Dynamic selectors via getters (e.g., `get strategyPerformanceTab()`)

**Important:** TradingView frequently changes their UI. This file needs frequent updates.

### page-context.js (Window Access)
**Injection Method:** Injected via script tag to access page's JavaScript context
**Communication:** Uses `window.postMessage()` for bidirectional messaging

**Actions:**
- `getPerformance` - Extracts test results from TradingView object
- `setStrategyParams` - Sets parameters via TradingView internals
- `previewStrategyTestResults` - Shows results popup overlay
- `show3DChart` - Creates Plotly 3D scatter chart

**Pattern:**
```javascript
window.addEventListener('message', (event) => {
  if (event.data.name === 'iondvScript') {
    // Handle request
    // Access window.TradingView directly
    // Post response back
    window.postMessage({name: 'iondvPage', action: ..., data: ...}, origin)
  }
})
```

### model.js (Data Models)
**Core Functions:**
- `model.getStrategyParameters()` - Load/generate parameter ranges
- `model.getStrategyRange()` - Auto-generate test ranges (default: 0.5x to 2x current value)
- `model.parseStrategyParamsAndGetMsg()` - Parse CSV parameter file
- `model.convertStrategyRangeToTemplate()` - Generate CSV template
- `model.getBestResult()` - Find optimal result from test data
- `model.createParamsFromRange()` - Generate all parameter combinations

**Parameter Range Format:**
```javascript
paramRange[paramName] = [from, to, step, default, priority]
// Example: [50, 200, 10, 100, 1]
```

### ui.js (UI Elements)
**Functions:**
- `ui.statusMessage()` / `ui.statusMessageRemove()` - Show/hide status overlay
- `ui.alertPopup()` / `ui.showErrorPopup()` - Modal dialogs
- `ui.checkInjectedElements()` - Inject "Set strategy" button into TV UI
- `ui.autoCloseAlert()` - Temporary alert messages

**Pattern:** Creates overlay DOM elements dynamically, uses inline styles for isolation.

### storage.js (Persistence)
**Wrapper for Chrome Storage API**
- `storage.setKeys()` - Save data
- `storage.getKey()` - Load data
- Storage keys: `STRATEGY_KEY_PARAM`, `STRATEGY_KEY_BACKTEST`, `STRATEGY_KEY_SIGNAL`

### file.js (File Operations)
- `file.parseCSV()` - CSV parsing with papaparse-like logic
- `file.downloadCSV()` - Trigger browser download
- `file.loadFileAsText()` - Read file upload

## Development Workflow

### Building the Extension
```bash
./prepare-ext.sh
# Creates: assistnat-ext.zip with all necessary files
```

### Manual Installation
1. Navigate to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select repository directory (contains manifest.json)

### Update Process
1. Download new version to same directory
2. Go to `chrome://extensions`
3. Click reload button for extension

### Testing
- No automated tests in repository
- Testing done manually on TradingView
- Use F12 developer console to see logs
- Check `tv-page-objects.js` for debugging TradingView DOM changes

## Code Patterns and Conventions

### Async/Await Everywhere
All major functions use async/await. Example:
```javascript
async function someAction() {
  await tv.openStrategyTab()
  const strategy = await tv.getStrategy()
  // ...
}
```

### Error Handling Pattern
```javascript
try {
  // operation
} catch (err) {
  console.error(err)
  await ui.showErrorPopup(`Error: ${err.message}`)
}
action.workerStatus = null
ui.statusMessageRemove()
```

### Worker Status Lock
Prevents concurrent operations:
```javascript
if(action.workerStatus !== null) {
  ui.autoCloseAlert(`Waiting for end previous work. Status: ${action.workerStatus}`)
  return sendResponse()
}
action.workerStatus = request.action
// ... do work ...
action.workerStatus = null
```

### Selector Usage Pattern
```javascript
const element = await page.waitForSelector(SEL.strategyTesterTab)
await page.mouseClickSelector(SEL.okBtn)
```

### Page Context Communication
```javascript
// From content script
await tv.sendMessage({action: 'getPerformance'})

// From page-context.js
window.postMessage({name: 'iondvPage', action: 'getPerformance', data: ...})
```

### Parameter Handling
Parameters support three types:
1. **Boolean** - `[true, false, 0, defaultValue, priority]`
2. **Select/Dropdown** - `[optionsString, '', 0, defaultValue, priority]`
   - Options format: "option1;option2;option3"
3. **Numeric** - `[min, max, step, defaultValue, priority]`

### Naming Conventions
- Global objects: lowercase (e.g., `tv`, `ui`, `backtest`, `action`)
- Constants: UPPER_CASE (e.g., `SEL`, `SUPPORT_TEXT`)
- Functions: camelCase (e.g., `getStrategyParameters`)
- Private helpers: Regular functions, not prefixed

### No Build Tools
- Pure JavaScript (ES6+)
- No transpilation
- No bundling
- No package.json or npm
- Direct script loading in manifest.json

## TradingView Integration Mechanics

### Challenges
1. **No Official API** - All interaction via DOM manipulation
2. **UI Changes Frequently** - Selectors break regularly
3. **Version Detection** - Must support old and new TradingView UI
4. **Sandboxed Context** - Content scripts can't access window.TradingView directly

### Solutions
1. **Dual Selector Sets** - Old and new UI versions supported
2. **MutationObserver** - Watch for dialog changes
3. **Script Injection** - `page-context.js` runs in page context for window access
4. **Retry Logic** - Waits and retries for UI elements
5. **Delay Randomization** - Avoid bot detection

### Key TradingView Paths
```javascript
// Strategy parameters (old)
window.TradingView.bottomWidgetBar._widgets.backtesting._reportWidgetsSet.model

// Strategy parameters (new/deep)
window.TradingView.bottomWidgetBar._options.backtestingStrategyDispatcher._modelStrategies[0]

// Performance data (old)
window.TradingView.bottomWidgetBar._widgets.backtesting._reportWidgetsSet.reportWidget._data.performance

// Performance data (new)
window.TradingView.bottomWidgetBar._options.backtestingStrategyDispatcher._modelStrategies[0]._reportData.performance
```

### Version Detection
```javascript
let isBaseTradingView = true
try {
  // Try old API
  data = window.TradingView.bottomWidgetBar._widgets.backtesting...
} catch (err) {
  if (isBaseTradingView !== false) {
    try {
      // Try new API
      data = window.TradingView.bottomWidgetBar._options.backtestingStrategyDispatcher...
      isBaseTradingView = false
    } catch (e) {
      isBaseTradingView = null
      console.error("Can't get TV API")
    }
  }
}
```

## Optimization Algorithms

### 1. Random (Default)
- Completely random parameter selection each iteration
- Good for initial exploration
- No memory of previous tests

### 2. Random Improvement
- Randomly change ONE parameter
- Keep change only if result improves
- Simple hill climbing

### 3. Sequential Improvements
- Test each parameter systematically
- For each parameter, try all values in range
- Keep best, move to next parameter
- Risk: Can get stuck in local optima

### 4. Simulated Annealing
- Implemented in `annealing.js`
- Randomly select parameter and value
- Accept worse results with decreasing probability
- "Temperature" cools over time (parameter spread narrows)
- Can escape local optima
- Best for complex parameter spaces

### 5. Brute Force
- Test ALL possible parameter combinations
- Exhaustive but very slow
- Only practical for small parameter spaces

### Filter System
Can filter results by additional criteria:
- Minimum/maximum value for any metric
- Ascending or descending filter
- Applied after optimization metric check

### Results Format
```javascript
testResults = {
  shortName: "Strategy Name",
  optParamName: "Net profit: All",
  isMaximizing: true,
  method: "annealing",
  cycles: 100,
  filterParamName: "Total closed trades",
  filterValue: 100,
  filterAscending: true,
  backtestDelay: 2,
  randomDelay: true,
  perfomanceSummary: [
    {
      "Net profit: All": 12345,
      "Total closed trades": 150,
      "param1": 100,
      "param2": 50,
      "_setTime_": 1.2,
      "_parseTime_": 0.5
      // ... all other metrics and parameters
    }
  ]
}
```

## External Signals Feature

### CSV Format
```csv
timestamp,ticker,timeframe,signal
1625718600000,BTCUSDT,1m,BUY
2021-07-27T01:00:00Z,BABA,1H,SELL
```

### Pine Script Integration
Users must create Pine Script indicator named `iondvSignals` (see `pinescripts/iondv_signals.txt`):
- Takes timestamp strings as inputs
- Displays buy/sell arrows on chart
- Script inputs updated by extension via UI automation

### Storage
Signals stored in Chrome storage, loaded when indicator opened.

## Important Considerations for AI Assistants

### When Modifying Code

1. **TradingView Selector Changes** - The most common breakage point
   - Always test on actual TradingView
   - Check console for selector errors
   - Update both old and new version paths if needed
   - Selector changes happen frequently (weeks/months)

2. **Timing Issues** - Critical for reliability
   - Always use `await page.waitForTimeout()` between UI changes
   - TradingView needs time to process parameter changes
   - Add delays before reading results
   - Consider randomization to avoid detection

3. **Worker Status Lock** - Prevent race conditions
   - Never bypass the `workerStatus` check
   - Always set it at start, clear at end
   - Include in finally blocks for error safety

4. **Error Handling** - User experience
   - Always catch and display meaningful errors
   - Use `ui.showErrorPopup()` for user-facing errors
   - Log detailed info to console for debugging
   - Guide users to GitHub issues if problem persists

5. **Storage Limits** - Chrome has storage quotas
   - Use `unlimitedStorage` permission (already in manifest)
   - Large backtest results can be 10MB+
   - Consider data cleanup strategies

6. **Communication Patterns** - Multi-context architecture
   - Content script ↔ Page context requires `postMessage`
   - Popup ↔ Content script uses `chrome.runtime.sendMessage`
   - Always handle message routing errors
   - Use unique `requestId` for async responses

7. **Manifest V3 Compliance**
   - No remote code execution
   - Service workers instead of background pages (though not used here)
   - Host permissions strict

8. **Performance**
   - No framework overhead (vanilla JS)
   - Minimize DOM queries
   - Cache selectors where possible
   - Be careful with large datasets in 3D charts

### Code Quality Guidelines

1. **No Modern Build Tools** - Keep it simple
   - Don't add webpack, vite, etc.
   - No TypeScript (unless full conversion)
   - No JSX or frameworks
   - Keep dependencies minimal

2. **Browser Compatibility**
   - Target Chromium browsers only
   - Use ES6+ freely (async/await, arrow functions, etc.)
   - No polyfills needed

3. **Debugging Support**
   - Keep console.log statements for debugging
   - Add meaningful log messages
   - Include action names in logs
   - Log performance metrics (_setTime_, _parseTime_)

4. **Documentation**
   - Comment complex algorithms
   - Document TradingView API paths
   - Explain selector logic
   - Note version-specific code

### Testing Strategy

Since there are no automated tests:
1. Test on actual TradingView with real strategy
2. Test all optimization methods
3. Test with different parameter types (boolean, numeric, select)
4. Verify signal upload/display
5. Check 3D chart rendering
6. Test CSV import/export
7. Verify storage persistence across page reloads
8. Test error scenarios (missing elements, network issues)

### Common Pitfalls

1. **Forgetting await** - All TV interactions are async
2. **Hardcoded delays** - Use configurable `backtestDelay`
3. **Single version support** - Always support old and new TV UI
4. **Missing error handling** - Wrap TV interactions in try/catch
5. **Blocking UI** - Use status messages during long operations
6. **Ignoring worker lock** - Can cause data corruption

### When TradingView Updates Break Things

1. Check `selector.js` first - 90% of breaks are here
2. Use `tv-page-objects.js` to explore new DOM structure
3. Run search functions to find new paths to data
4. Update both getter functions and static selectors
5. Test with both old and new versions if possible
6. Update version detection logic if needed

### Extension Publishing

When preparing for Chrome Web Store:
1. Run `./prepare-ext.sh` to create zip
2. Update version in manifest.json
3. Test the zipped version works
4. Prepare screenshots for store listing
5. Update description if new features added
6. Consider privacy policy if data handling changes

## File Dependencies Graph

```
manifest.json
  ├── Content Scripts (in order)
  │   ├── selector.js (defines SEL, selStatus)
  │   ├── page.js (provides page utilities)
  │   ├── ui.js (provides ui object)
  │   ├── tv.js (uses SEL, page, ui)
  │   ├── tvChart.js (uses tv)
  │   ├── file.js (provides file object)
  │   ├── storage.js (provides storage object)
  │   ├── signal.js (uses tv, file, storage, ui)
  │   ├── model.js (uses storage, file)
  │   ├── backtest.js (uses tv, ui, page, model)
  │   ├── action.js (uses all above)
  │   └── controller.js (uses action, ui, page, SEL, tv)
  ├── Popup
  │   ├── assistant.html
  │   ├── assistant.js (communicates with controller.js)
  │   └── style.css
  └── Page Context
      ├── page-context.js (injected, isolated context)
      └── lib/plotly.min.js (for 3D charts)
```

## Recent Changes

Version 2.10.x → 2.11.x:
- Fix for splitting Performance summary into three tabs
- Updated selectors for new TradingView UI

## Resources

- **Repository:** https://github.com/akumidv/tradingview-assistant-chrome-extension
- **Issues:** https://github.com/akumidv/tradingview-assistant-chrome-extension/issues
- **Chrome Store:** https://chrome.google.com/webstore/detail/tradingview-assistant/pfbdfjaonemppanfnlmliafffahlohfg
- **Video Tutorial:** https://youtu.be/xhnlSCIlEkw
- **Install Guide:** https://www.youtube.com/watch?v=FH7dI4K8w5k

## Contact

- Email: akumidv [at] yahoo.com (for non-bug inquiries)
- GitHub Issues: Use for bug reports and feature requests
- LinkedIn: https://linkedin.com/in/akuminov

---

**Last Updated:** 2025-12-04
**AI Assistant:** This file was generated for Claude and other AI assistants to understand the codebase structure and development patterns.
