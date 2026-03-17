const file = {
  MAX_FILE_SIZE_MB: 10,
  MAX_FILES_COUNT: 50,
  ALLOWED_MIME_TYPES: ['text/csv', 'text/plain', 'application/vnd.ms-excel']
}

file.saveAs = (text, filename) => {
  let aData = document.createElement('a');
  aData.setAttribute('href', 'data:text/plain;charset=urf-8,' + encodeURIComponent(text));
  aData.setAttribute('download', filename);
  aData.click();
  if (aData.parentNode)
    aData.parentNode.removeChild(aData);
}

file.upload = async (handler, endOfMsg, isMultiple = false) => {
  let fileUploadEl = document.createElement('input');
  fileUploadEl.type = 'file';
  fileUploadEl.accept = '.csv,text/csv';
  if(isMultiple)
    fileUploadEl.multiple = 'multiple';
  fileUploadEl.addEventListener('change', async () => {
    let message = isMultiple ? 'File upload results:\n' : 'File upload result:\n'

    // Validate file count
    if (fileUploadEl.files.length > file.MAX_FILES_COUNT) {
      message = `Error: Too many files selected (${fileUploadEl.files.length}). Maximum is ${file.MAX_FILES_COUNT} files.`
      await ui.showPopup(message)
      ui.isMsgShown = false
      return
    }

    for(let uploadedFile of fileUploadEl.files) {
      // Validate file size
      const fileSizeMB = uploadedFile.size / (1024 * 1024)
      if (fileSizeMB > file.MAX_FILE_SIZE_MB) {
        message += `  - ${uploadedFile.name}: File too large (${fileSizeMB.toFixed(2)}MB). Maximum is ${file.MAX_FILE_SIZE_MB}MB.\n`
        continue
      }

      // Validate MIME type (if browser provides it)
      if (uploadedFile.type && !file.ALLOWED_MIME_TYPES.includes(uploadedFile.type)) {
        console.warn(`[WARN] Suspicious MIME type for ${uploadedFile.name}: ${uploadedFile.type}`)
      }

      message += await handler(uploadedFile)
    }
    message += endOfMsg ? '\n' + endOfMsg : ''
    await ui.showPopup(message)
    ui.isMsgShown = false
  });
  fileUploadEl.click();
}


file.parseCSV = async (fileData) => {
  return new Promise((resolve, reject) => {
    const CSV_FILENAME = fileData.name
    const isCSV = CSV_FILENAME.toLowerCase().endsWith('.csv')
    if(!isCSV) return reject(`please upload correct file.`)

    // Validate file size before reading
    const maxSizeBytes = file.MAX_FILE_SIZE_MB * 1024 * 1024
    if (fileData.size > maxSizeBytes) {
      return reject(`File ${CSV_FILENAME} is too large (${(fileData.size / (1024 * 1024)).toFixed(2)}MB). Maximum is ${file.MAX_FILE_SIZE_MB}MB.`)
    }

    const reader = new FileReader();
    reader.addEventListener('load', async (event) => {
      if(!event.target.result) return reject(`there error when loading content from the file ${CSV_FILENAME}`)
      const CSV_VALUE = event.target.result

      // Validate content length
      if (CSV_VALUE.length > maxSizeBytes) {
        return reject(`File content too large. Maximum is ${file.MAX_FILE_SIZE_MB}MB.`)
      }
      try {
        const csvData = parseCSV2JSON(CSV_VALUE)
        if (csvData && csvData.length)
          return resolve(csvData)
      } catch (err) {
        console.error(err)
        return reject(`CSV parsing error: ${err.message}`)
      }
      return reject(`there is no data in the file`)
    })
    return reader.readAsText(fileData);
  });
}


file.uploadHandler = async (fileData) => {
  const propVal = {}
  let strategyName = null
  const csvData = await file.parseCSV(fileData)

  // Validate CSV data structure
  if (!csvData || csvData.length === 0) {
    return `  - ${fileData.name}: Empty CSV file or no valid data found.\n`
  }
  if (!csvData[0]) {
    return `  - ${fileData.name}: Invalid CSV structure - no header row found.\n`
  }

  const headers = Object.keys(csvData[0])
  const missColumns = ['Name','Value'].filter(columnName => !headers.includes(columnName.toLowerCase()))
  if(missColumns && missColumns.length)
    return `  - ${fileData.name}: There is no column(s) "${missColumns.join(', ')}" in CSV.\nPlease add all necessary columns to CSV like showed in the template.\n\nSet parameters canceled.\n`
  csvData.forEach(row => {
    if(row['name'] === '__indicatorName')
      strategyName = row['value']
    else
      propVal[row['name']] = row['value']
  })
  if(!strategyName)
    return 'The name for indicator in row with name ""__indicatorName"" is missed in CSV file'
  const res = await tv.setStrategyParams(strategyName, propVal, false, true)
  const lastSetResult = tv.lastSetStrategyResult || {}
  if (res) {
    return 'All settings applied successfully.'
  }
  return `The name "${strategyName}" of the indicator from the file does not match the name in the open window`
}

function parseCSV2JSON(s, sep= ',') {
  const csv = s.split(/\r\n|\r|\n/g).filter(item => item).map(line => parseCSVLine(line))
  if(!csv || csv.length <= 1) return []
  const headers = csv[0].map(item => item.toLowerCase())
  const JSONData = csv.slice(1).map((line) => {
    const lineObj = {}
    line.forEach((value, line_index) => lineObj[headers[line_index]] = value)
    return lineObj
  })
  return JSONData;
}


function parseCSVLine(text) {
  function replaceEscapedSymbols(textVal) {
    return textVal.replaceAll('\\"', '"')
  }

  return text.match( /\s*(".*?"|'.*?'|[^,]+|)\s*(,(?!\s*\\")|$)/g ).map(function (subText) { // \s*(\".*?\"|'.*?'|[^,]+|)\s*(,|$)
    let m;
    if (m = subText.match(/^\s*\"(.*?)\"\s*,?(?!\s*\\")$/))
      return replaceEscapedSymbols(m[1])//m[1] // Double Quoted Text // /^\s*\"(.*?)\"\s*,?$/
    if (m = subText.match(/^\s*'(.*?)'\s*,?$/))
      return replaceEscapedSymbols(m[1]); // Single Quoted Text
    if (m = subText.match(/^\s*(true|false)\s*,?$/i))
      return m[1].toLowerCase() === 'true'; // Boolean
    if (m = subText.match(/^\s*((?:\+|\-)?\d+)\s*,?$/))
      return parseInt(m[1]); // Integer Number
    if (m = subText.match(/^\s*((?:\+|\-)?\d*\.\d*)\s*,?$/))
      return parseFloat(m[1]); // Floating Number
    if (m = subText.match(/^\s*(.*?)\s*,?$/))
      return replaceEscapedSymbols(m[1]); // Unquoted Text
    return subText;
  } );
}



file.convertResultsToCSV = (testResults) => {
  function prepareValToCSV(value) {
    if (!value)
      return 0
    if (typeof value !== 'number')
      return JSON.stringify(value)
    return parseFloat(value) === parseInt(value) ? parseInt(value) : parseFloat(value)
    // return (Math.round(value * 100)/100).toFixed(2)
  }

  if(!testResults || !testResults.perfomanceSummary || !testResults.perfomanceSummary.length)
    return 'There is no data for conversion'
  let headers = Object.keys(testResults.perfomanceSummary[0]) // The first test table can be with error and can't have rows with previous values when parsedReport
  if(testResults.hasOwnProperty('paramsNames') && headers.length <= (Object.keys(testResults.paramsNames).length + 1)) { // Find the another header if only params names and 'comment' in headers
    const headersAll = testResults.perfomanceSummary.find(report => Object.keys(report).length > headers.length)
    if(headersAll)
      headers = Object.keys(headersAll)
  }

  let csv = headers.map(header => JSON.stringify(header)).join(',')
  csv += '\n'
  testResults.perfomanceSummary.forEach(row => {
    const rowData = headers.map(key => typeof row[key] === 'undefined' ? '' : prepareValToCSV(row[key]))
    csv += rowData.join(',').replaceAll('\\"', '""')
    csv += '\n'
  })
  if(testResults.filteredSummary && testResults.filteredSummary.length) {
    csv += headers.map(key => key !== 'comment' ? '' : 'Bellow filtered results of tests') // Empty line
    csv += '\n'
    testResults.filteredSummary.forEach(row => {
      const rowData = headers.map(key => typeof row[key] === 'undefined' ? '' : prepareValToCSV(row[key]))
      csv += rowData.join(',').replaceAll('\\"', '""')
      csv += '\n'
    })
  }
  return csv
}
