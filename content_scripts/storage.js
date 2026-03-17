const storage = {
  KEY_PREFIX: 'iondv',
  STRATEGY_KEY_PARAM: 'strategy_param',
  STRATEGY_KEY_RESULTS: 'strategy_result',
  SIGNALS_KEY_PREFIX: 'signals'
}



storage.getKey = async (storageKey) => {
  const getParam = storageKey === null ? null : Array.isArray(storageKey) ? storageKey.map(item => `${storage.KEY_PREFIX}_${item}`) : `${storage.KEY_PREFIX}_${storageKey}`
  return new Promise ((resolve, reject) => {
    chrome.storage.local.get(getParam, (getResults) => {
      // Check for Chrome storage errors
      if (chrome.runtime.lastError) {
        console.error('[ERROR] storage.getKey: Chrome storage error:', chrome.runtime.lastError.message)
        return reject(new Error(`Storage get failed: ${chrome.runtime.lastError.message}`))
      }

      if(storageKey === null) {
        const storageData = {}
        Object.keys(getResults).filter(key => key.startsWith(storage.KEY_PREFIX)).forEach(key => storageData[key] = getResults[key])
        return resolve(storageData)
      } else if(!getResults.hasOwnProperty(`${storage.KEY_PREFIX}_${storageKey}`)) {
        return resolve(null)
      }
      return resolve(getResults[`${storage.KEY_PREFIX}_${storageKey}`])
    })
  })
}

storage.setKeys = async (storageKey, value) => {
  const storageData = {}
  storageData[`${storage.KEY_PREFIX}_${storageKey}`] = value
  return new Promise ((resolve, reject) => {
    chrome.storage.local.set(storageData, () => {
      // Check for Chrome storage errors (e.g., quota exceeded)
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message
        console.error('[ERROR] storage.setKeys: Chrome storage error:', errorMsg)

        // Check if quota exceeded
        if (errorMsg.includes('QUOTA_BYTES') || errorMsg.includes('quota')) {
          chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
            const mbUsed = (bytesInUse / (1024 * 1024)).toFixed(2)
            console.error(`[ERROR] Storage quota exceeded. Currently using: ${mbUsed}MB`)
          })
          return reject(new Error(`Storage quota exceeded. Please clear old test results or reduce data size.`))
        }

        return reject(new Error(`Storage set failed: ${errorMsg}`))
      }
      resolve()
    })
  })
}

storage.removeKey = async (storageKey) => {
  return new Promise ((resolve, reject) => {
    chrome.storage.local.remove(storageKey, () => {
      // Check for Chrome storage errors
      if (chrome.runtime.lastError) {
        console.error('[ERROR] storage.removeKey: Chrome storage error:', chrome.runtime.lastError.message)
        return reject(new Error(`Storage remove failed: ${chrome.runtime.lastError.message}`))
      }
      resolve()
    })
  })
}

storage.clearAll = async () => {
  const allStorageKey = await storage.getKey(null)
  await storage.removeKey(Object.keys(allStorageKey))
  return Object.keys(allStorageKey)
}