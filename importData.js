function importData(context) {
    var dataSource = context.getDataSource();
    var realmID = dataSource.getSetting("realmID").getValue();
    var apiEndpoint = dataSource.getSetting("apiEndpoint").getValue();
    var startDateString = dataSource.getSetting("Period Range").getValue().getFromPeriodStartDateTime().substring(0, 10);
    var endDateString = dataSource.getSetting("Period Range").getValue().getToPeriodEndDateTime().substring(0, 10);
    
    // Get the Account List from Quickbooks
    var getAccountListMethod = 'GET';
    var getAccountListBody = '';
    var getAccountListHeaders = {"Accept": "application/json"}; // We need this in the header, otherwise the Quickboks API will send back text that cannot be parsed by JSON
    var accountListRequestURL = `${apiEndpoint}/v3/company/${realmID}/query?query=select * from Account&minorversion=62/`;
    var accountListResponse = ai.https.authorizedRequest(accountListRequestURL, getAccountListMethod, getAccountListBody, getAccountListHeaders);
    
    if (accountListResponse.getHttpCode() === 200) {
        responseBody = accountListResponse.getBody();
        var accountsData = JSON.parse(responseBody).QueryResponse.Account;

        ai.log.logInfo("Accounts Data", JSON.stringify(accountsData));
        ai.log.logInfo(accountsData.length);

        var tableId = context.getRowset(['id']).getTableId();
        var rowset = ["id", "tx_date", "amount", "balance", "tx_type", "doc_num", "name", "memo", "split_acc"];
        var dataRowset = context.getRowset(rowset);
        
        // Import the data
        for (i = 0; i < 4; i++) {
            var internalActId = accountsData[i].Id;
            var importDataMethod = 'GET';
            var importDataBody = '';
            var importDataHeaders = {};
            var importDataRequestURL = `${apiEndpoint}/v3/company/${realmID}/reports/GeneralLedger?start_date=${startDateString}&end_date=${endDateString}&accounting_method=Accrual&account=${parseInt(internalActId)}&minorversion=62`;
            var importDataResponse = ai.https.authorizedRequest(importDataRequestURL, importDataMethod, importDataBody, importDataHeaders);
            // ai.log.logInfo("Request URL", importDataRequestURL);
    
            if (tableId == "adaptive_sum_txns") {
                try {
                    // ai.log.logInfo("Trying to get data from source...", `Connecting to ${apiEndpoint}`);
                    // ai.log.logInfo("Import Data Response HTTP Code", importDataResponse.getHttpCode());
                    importDataResponse;
                }
                catch (exception) {
                    ai.log.logError('HTTPS connection request failed', +exception);
                    throw "Connection Error";
                }
                
                if (importDataResponse.getHttpCode() == '200') {
                    // ai.log.logVerbose('Connection successful. Retrieving data...');
                    var importDataResponseBody = importDataResponse.getBody();
                    ai.log.logInfo("Response Body", importDataResponseBody);
                    
                    // Locate the embedded object within the JSON response containing the rows of data
                    var data = JSON.parse(importDataResponseBody).Rows.Row[0].Rows.Row;
                    var dataHeaderActId = JSON.parse(importDataResponseBody).Rows.Row[0].Header.ColData[0].id;
                    // ai.log.logInfo("Import Data String Response", JSON.stringify(data));
                    ai.log.logInfo('Acct ID: ', JSON.stringify(dataHeaderActId));
                    
                    ai.log.logInfo('Getting row count...', `${data.length} rows`);
                    
                    for (j = 0; j < data.length; j++) {
                        dataRowset.addRow(
                            [
                                dataHeaderActId,                    // Internal QB Account ID
                                new Date(data[j].ColData[0].value), // Txn Date
                                Number(data[j].ColData[6].value),   // Txn Amount
                                Number(data[j].ColData[7].value),   // Account Balance
                                data[j].ColData[1].value,           // Txn Type
                                data[j].ColData[2].value,           // Txn doc_num
                                data[j].ColData[3].value,           // Name
                                data[j].ColData[4].value,           // Txn Memo
                                data[j].ColData[5].value            // Txn Split
                            ]
                        );
                    }
                } else {
                    ai.log.logError('Error retrieving account data from source.');
                    throw "Error";
                }
            } else {
                ai.log.logError('tableId does not match current table');
                throw "Error";
            }
        }
    } else {
        ai.log.logError('Error retreiving list of accounts from source');
        throw "Error";
    }
}
