/*
 @license Copyright 2021 akumidv (https://github.com/akumidv/)
 SPDX-License-Identifier: Apache-2.0
*/

'use strict';

(async function() {

  // Add action to set strategy parameters window
  // Store interval ID for cleanup
  const uiCheckInterval = setInterval(ui.checkInjectedElements, 1000);

  chrome.runtime.onMessage.addListener(
    async function(request, sender, sendResponse) {
      if(sender.tab || !request.hasOwnProperty('action') || !request.action) {
        console.log('Not for action message received:', request)
        return sendResponse()
      }
      if(action.workerStatus !== null) {
        // Check if worker has timed out (prevent deadlock)
        const now = Date.now()
        if (action.workerStatusTimestamp && (now - action.workerStatusTimestamp) > action.WORKER_TIMEOUT_MS) {
          console.warn(`[WARN] Worker status '${action.workerStatus}' timed out after ${Math.round((now - action.workerStatusTimestamp) / 1000)}s. Auto-clearing.`)
          action.workerStatus = null
          action.workerStatusTimestamp = null
        } else {
          const msg = `Waiting for end previous work. Status: ${action.workerStatus}`
          console.log(msg)
          ui.autoCloseAlert(msg)
          return sendResponse()
        }
      }

      action.workerStatus = request.action
      action.workerStatusTimestamp = Date.now()
      try {
        sendResponse()
        switch (request.action) {
          case 'saveParameters': {
            await action.saveParameters()
            break;
          }
          case 'loadParameters': {
            await action.loadParameters()
            break;
          }
          case 'uploadSignals':
            await action.uploadSignals()
            break
          case 'uploadStrategyTestParameters':
            await action.uploadStrategyTestParameters()
            break
          case 'getStrategyTemplate':
            await action.getStrategyTemplate()
            break
          case 'testStrategy':
            await action.testStrategy(request, false)
            break
          case 'deepTestStrategy':
            await action.testStrategy(request, true)
            break
          case 'previewStrategyTestResults':
            await action.previewStrategyTestResults()
            break
          case 'downloadStrategyTestResults':
            await action.downloadStrategyTestResults()
            break
          case 'clearAll':
            await action.clearAll()
            break
          case 'show3DChart':
            await action.show3DChart()
            break
          default:
            console.log('None of realisation for signal:', request)
        }
      } catch (err) {
        console.error(err)
        await ui.showErrorPopup(`An error has occurred.\n\nReload the page and try again.\nYou can describe the problem by following <a href="https://github.com/akumidv/tradingview-assistant-chrome-extension/issues" target="_blank">the link</a>.\n\nError message: ${err.message}`)
      } finally {
        // Always clear worker status, even if error occurred
        action.workerStatus = null
        action.workerStatusTimestamp = null
        ui.statusMessageRemove()
      }
    }
  );


  const dialogWindowNode = await page.waitForSelector(SEL.tvDialogRoot, 0)
  let tvObserver = null
  if(dialogWindowNode) {
    tvObserver = new MutationObserver(tv.dialogHandler);
    console.log('[INFO] Observer added to dialogWindowNode')
    tvObserver.observe(dialogWindowNode, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });
    await tv.dialogHandler() // First run
  }

  // Cleanup on page unload to prevent memory leaks
  window.addEventListener('beforeunload', () => {
    console.log('[INFO] Cleaning up extension resources before page unload')
    if (uiCheckInterval) {
      clearInterval(uiCheckInterval)
    }
    if (tvObserver) {
      tvObserver.disconnect()
    }
  })

})();
