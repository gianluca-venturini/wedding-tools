import { GoogleAuthManager, createSheetsAuth } from './authManager';

export class SpreadsheetManager {
    private sheets: any = null;
    private authManager: GoogleAuthManager;

    constructor(authManager?: GoogleAuthManager) {
        // Use provided auth manager or create a Sheets-specific one
        this.authManager = authManager || createSheetsAuth();
    }

    /**
     * Ensure Google Sheets service is available
     */
    private async ensureSheetsService(): Promise<void> {
        if (!this.sheets) {
            this.sheets = await this.authManager.getSheets();
        }
    }

    /**
     * Read data from a Google Spreadsheet
     * @param spreadsheetId - The ID of the spreadsheet
     * @param range - The range to read (e.g., 'Sheet1!A1:D10' or 'Sheet1')
     * @returns Promise<any[][]> - 2D array of cell values
     */
    public async readSpreadsheet(
        spreadsheetId: string,
        range: string = 'Sheet1'
    ): Promise<any[][] | null> {
        try {
            await this.ensureSheetsService();

            console.log(`Reading data from spreadsheet: ${spreadsheetId}`);
            console.log(`Range: ${range}`);

            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId,
                range,
            });

            const rows = response.data.values;
            if (!rows || rows.length === 0) {
                console.log('No data found.');
                return [];
            }

            console.log(`Successfully read ${rows.length} rows of data.`);
            return rows;
        } catch (error) {
            console.error('Error reading spreadsheet:', error);
            return null;
        }
    }

    /**
     * Write data to a Google Spreadsheet
     * @param spreadsheetId - The ID of the spreadsheet
     * @param range - The range to write to (e.g., 'Sheet1!A1' or 'Sheet1!A1:D10')
     * @param values - 2D array of values to write
     * @param valueInputOption - How to interpret input data ('RAW' or 'USER_ENTERED')
     * @returns Promise<boolean> - Success status
     */
    public async writeSpreadsheet(
        spreadsheetId: string,
        range: string,
        values: any[][],
        valueInputOption: 'RAW' | 'USER_ENTERED' = 'USER_ENTERED'
    ): Promise<boolean> {
        if (!values || values.length === 0) {
            console.error('Error: No data provided to write!');
            return false;
        }

        try {
            await this.ensureSheetsService();

            console.log(`Writing data to spreadsheet: ${spreadsheetId}`);
            console.log(`Range: ${range}`);
            console.log(
                `Data dimensions: ${values.length} rows x ${values[0]?.length || 0} columns`
            );

            const response = await this.sheets.spreadsheets.values.update({
                spreadsheetId,
                range,
                valueInputOption,
                requestBody: {
                    values,
                },
            });

            console.log(`Successfully wrote ${response.data.updatedCells} cells.`);
            console.log(`Updated range: ${response.data.updatedRange}`);
            return true;
        } catch (error) {
            console.error('Error writing to spreadsheet:', error);
            return false;
        }
    }

    /**
     * Append data to a Google Spreadsheet
     * @param spreadsheetId - The ID of the spreadsheet
     * @param range - The range to append to (e.g., 'Sheet1!A:D')
     * @param values - 2D array of values to append
     * @param valueInputOption - How to interpret input data ('RAW' or 'USER_ENTERED')
     * @returns Promise<boolean> - Success status
     */
    public async appendToSpreadsheet(
        spreadsheetId: string,
        range: string,
        values: any[][],
        valueInputOption: 'RAW' | 'USER_ENTERED' = 'USER_ENTERED'
    ): Promise<boolean> {
        if (!values || values.length === 0) {
            console.error('Error: No data provided to append!');
            return false;
        }

        try {
            await this.ensureSheetsService();

            console.log(`Appending data to spreadsheet: ${spreadsheetId}`);
            console.log(`Range: ${range}`);
            console.log(
                `Data dimensions: ${values.length} rows x ${values[0]?.length || 0} columns`
            );

            const response = await this.sheets.spreadsheets.values.append({
                spreadsheetId,
                range,
                valueInputOption,
                insertDataOption: 'INSERT_ROWS',
                requestBody: {
                    values,
                },
            });

            console.log(`Successfully appended ${response.data.updates?.updatedCells} cells.`);
            console.log(`Updated range: ${response.data.updates?.updatedRange}`);
            return true;
        } catch (error) {
            console.error('Error appending to spreadsheet:', error);
            return false;
        }
    }

    /**
     * Get spreadsheet metadata
     * @param spreadsheetId - The ID of the spreadsheet
     * @returns Promise<any> - Spreadsheet metadata
     */
    public async getSpreadsheetInfo(spreadsheetId: string): Promise<any | null> {
        try {
            await this.ensureSheetsService();

            const response = await this.sheets.spreadsheets.get({
                spreadsheetId,
            });

            return response.data;
        } catch (error) {
            console.error('Error getting spreadsheet info:', error);
            return null;
        }
    }

    /**
     * Check if authentication is valid
     */
    public async isAuthenticated(): Promise<boolean> {
        return await this.authManager.isAuthenticated();
    }
}
