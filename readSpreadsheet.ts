import { SpreadsheetManager } from './spreadsheetManager';
import { createFullAuth } from './authManager';

/**
 * Main function to read data from the specified Google Spreadsheet
 */
async function main(): Promise<void> {
    console.log('Google Spreadsheet Reader');
    console.log('='.repeat(50));

    // Initialize SpreadsheetManager with full auth (Gmail + Sheets)
    const authManager = createFullAuth();
    const spreadsheetManager = new SpreadsheetManager(authManager);

    // The specific spreadsheet ID provided by the user
    const spreadsheetId = '1x6id8Gj2nixQdyA5yQDRvlgttOinkMnfi3OYmLslNzA';

    try {
        // First, let's get some basic info about the spreadsheet
        console.log('\n📊 Getting spreadsheet information...');
        const info = await spreadsheetManager.getSpreadsheetInfo(spreadsheetId);

        if (info) {
            console.log(`📝 Spreadsheet Title: ${info.properties?.title || 'Unknown'}`);
            console.log(`📋 Number of sheets: ${info.sheets?.length || 0}`);

            // Show available sheet names
            if (info.sheets && info.sheets.length > 0) {
                console.log('📄 Available sheets:');
                info.sheets.forEach((sheet: any, index: number) => {
                    console.log(`   ${index + 1}. ${sheet.properties?.title || 'Unnamed Sheet'}`);
                });
            }
        }

        // Read the first few rows from the first sheet
        console.log('\n📖 Reading first 10 rows from the first sheet...');
        const data = await spreadsheetManager.readSpreadsheet(spreadsheetId, 'List!A1:Z10');

        if (data && data.length > 0) {
            console.log(`\n✅ Successfully read ${data.length} rows:`);
            console.log('─'.repeat(80));

            // Display the data in a formatted way
            data.forEach((row, index) => {
                console.log(`Row ${index + 1}:`, row.map(cell => cell || '<empty>').join(' | '));
            });

            console.log('─'.repeat(80));
            console.log(`📊 Data summary: ${data.length} rows × ${data[0]?.length || 0} columns`);
        } else {
            console.log('❌ No data found in the specified range.');
        }
    } catch (error) {
        console.error('❌ Error reading spreadsheet:', error);
        console.log('\n💡 Troubleshooting tips:');
        console.log('1. Make sure you have the correct permissions for this spreadsheet');
        console.log('2. Check that your Google Cloud Console has Sheets API enabled');
        console.log('3. Verify your authentication credentials in the .env file');
        console.log('4. Ensure the spreadsheet is shared with your Google account');
    }

    console.log('\n🏁 Done!');
}

// Run the main function
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
