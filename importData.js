function importData(context) {
    var dataSource = context.getDataSource();
    var realmID = dataSource.getSetting("realmID").getValue();
    var apiEndpoint = dataSource.getSetting("apiEndpoint").getValue();
    var startDateString = dataSource.getSetting("Period Range").getValue().getFromPeriodStartDateTime().substring(0, 10);
    var endDateString = dataSource.getSetting("Period Range").getValue().getToPeriodEndDateTime().substring(0, 10);
    var method = 'GET';
    var body = '';
    var headers = { };

    var tableId = context.getRowset(['id']).getTableId();
    var accountList = [];
    
    // Get the Account List from Quickbooks
    var accountListRequestURL = `${apiEndpoint}/v3/company/${realmID}/reports/AccountList?minorversion=62`;
    var accountListResponse = ai.https.authorizedRequest(accountListRequestURL, method, body, headers);
    
    if (accountListResponse.getHttpCode() === 200) {
        responseBody = accountListResponse.getBody();
        var accountsData = JSON.parse(responseBody).Rows.Row;

        for (i = 0; i < accountsData.length; i++) {
            accountList.push({
                id: accountsData[i].ColData[0].value,
                name: accountsData[i].ColData[1].value
            });
        }
        ai.log.logInfo('List of Accounts', JSON.stringify(accountList));
    } else {
        ai.log.logError('Error retreiving list of accounts from source');
        throw "Error";
    }
        
    // Iterate through list of accounts and import data into the table
    ai.log.logInfo(`Loading table ${tableId}`);
    var table = 'adaptive_sum_txns';
    var rowset = ["tx_date", "amount", "balance", "tx_type", "doc_num", "name", "memo", "split_acc"];
    for (i = 0; i < accountList.length; i++) {
            // ai.log.logInfo(`starting here with ${accountList[0].id}, ${accountList[0].name}`);
            importData(table, accountList[i].id, rowset);
    }
    
    // Import Data Function
    function importData(table, acctId, colArray) {
        if (tableId == table) {
            var dataRowset = context.getRowset(colArray);
            var dataColumns = dataRowset.getColumns();
            
            importDataRequestURL = `${apiEndpoint}/v3/company/${realmID}/reports/GeneralLedger?start_date=${startDateString}&end_date=${endDateString}&accounting_method=Accrual&account=${acctId}&minorversion=62`;
            var importDataResponse = ai.https.authorizedRequest(importDataRequestURL, method, body, headers);
            
            try {
                // ai.log.logInfo("Trying to get data from source...", `Connecting to ${apiEndpoint}`);
                ai.log.logInfo("url", importDataRequestURL);
                // ai.log.logInfo("import data response", importDataResponse.getHttpCode());
                importDataResponse;
            }
            catch (exception) {
                ai.log.logError('HTTPS connection request failed', +exception);
                throw "Connection Error";
            }
            
            if (importDataResponse.getHttpCode() == '200') {
                // ai.log.logVerbose('Connection successful. Retrieving data...');
                var importDataResponseBody = importDataResponse.getBody();
                ai.log.logInfo("import data response", importDataResponseBody);
                // Locate the embedded object within the JSON response containing the rows of data
                var data = JSON.parse(importDataResponseBody).Rows.Row[0].Rows.Row;
                
                ai.log.logInfo('Getting row count...', `${data.length} rows`);
                
                for (i = 0; i < data.length; i++) {
                    dataRowset.addRow(
                        [
                            new Date(data[i].ColData[0].value),
                            Number(data[i].ColData[6].value),
                            Number(data[i].ColData[7].value),
                            data[i].ColData[1].value,
                            data[i].ColData[2].value,
                            data[i].ColData[3].value,
                            data[i].ColData[4].value,
                            data[i].ColData[5].value
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
}
