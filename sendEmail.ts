import { config } from 'dotenv';
import { GmailManager } from './gmailManager';
import { createFullAuth } from './authManager';
import { SpreadsheetManager } from './spreadsheetManager';

// Load environment variables
config();

/**
 * Get recipient information from spreadsheet
 * @param spreadsheetManager - SpreadsheetManager instance
 * @param recipientEmail - Email to look up
 * @param spreadsheetId - The ID of the spreadsheet
 * @param sheetName - The name of the sheet
 * @returns Promise with recipient information and row index
 */
async function getRecipientInformationFromSpreadsheet(
    spreadsheetManager: SpreadsheetManager,
    recipientEmail: string,
    spreadsheetId: string,
    sheetName: string
): Promise<{ recipientName: string; rowIndex: number }> {
    try {
        console.log(`🔍 Looking up recipient information for: ${recipientEmail}`);

        // Read all data from the sheet (columns A and C)
        const range = `${sheetName}!F:G`;
        const rows = await spreadsheetManager.readSpreadsheet(spreadsheetId, range);

        if (!rows || rows.length === 0) {
            console.error('❌ No data found in spreadsheet');
            throw new Error('No data found in spreadsheet');
        }

        // Find the row where column A matches the recipient email
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const emailInSpreadsheet = row[0]; // Column F
            const nameInSpreadsheet = row[1]; // Column G

            if (
                emailInSpreadsheet &&
                emailInSpreadsheet.toLowerCase().trim() === recipientEmail.toLowerCase().trim()
            ) {
                console.log(`✅ Found recipient: ${nameInSpreadsheet || '<empty>'}`);
                return {
                    recipientName: nameInSpreadsheet || null,
                    rowIndex: i + 1, // Add 1 because spreadsheet rows are 1-indexed
                };
            }
        }

        console.warn(`⚠️ Recipient email ${recipientEmail} not found in spreadsheet`);
        throw new Error('Recipient not found in spreadsheet');
    } catch (error) {
        console.error('❌ Error reading recipient information from spreadsheet:', error);
        throw new Error('Error reading recipient information from spreadsheet');
    }
}

/**
 * Show usage instructions
 */
function showUsage(): void {
    console.log('Usage: bun run sendEmail.ts <recipient-email> [template-file]');
    console.log('');
    console.log('Arguments:');
    console.log('  recipient-email    Email address to send to (required)');
    console.log('  template-file      Path to email template file (optional)');
    console.log('                     e.g. emails/invitation.html.eml');
    console.log('');
    console.log('Examples:');
    console.log('  bun run sendEmail.ts jane@example.com emails/invitation.html.eml');
}

async function main(): Promise<void> {
    console.log('Gmail API Email Sender');
    console.log('='.repeat(50));

    // Parse command line arguments
    const args = process.argv.slice(2);

    if (args.length !== 2) {
        console.error('❌ Error: Recipient email address and template file are required!');
        console.log('');
        showUsage();
        process.exit(1);
    }

    const recipientEmail = args[0];
    const templateFile = args[1];

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
        console.error('❌ Error: Invalid email address format!');
        console.error(`Provided email: ${recipientEmail}`);
        process.exit(1);
    }
    console.log(`📧 Recipient email: ${recipientEmail}`);

    if (!templateFile) {
        console.error('❌ Error: Template file is required!');
        process.exit(1);
    }
    console.log(`📄 Template: ${templateFile}`);

    // Get spreadsheet configuration
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const sheetListName = process.env.SPREADSHEET_LIST_NAME;
    const sheetNotificationName = process.env.SPREADSHEET_NOTIFICATION_NAME;

    if (!spreadsheetId || !sheetListName || !sheetNotificationName) {
        console.error(
            '❌ Missing required environment variables: SPREADSHEET_ID or SPREADSHEET_LIST_NAME or SPREADSHEET_NOTIFICATION_NAME'
        );
        process.exit(1);
    }
    console.log(`📊 Spreadsheet ID: ${spreadsheetId}`);
    console.log(`📊 Sheet List Name: ${sheetListName}`);
    console.log(`📊 Sheet Notification Name: ${sheetNotificationName}`);

    // Create auth manager for both Gmail and Sheets
    const authManager = createFullAuth();

    // Create SpreadsheetManager instance
    const spreadsheetManager = new SpreadsheetManager(authManager);

    // Read recipient information from spreadsheet
    const { recipientName } = await getRecipientInformationFromSpreadsheet(
        spreadsheetManager,
        recipientEmail,
        spreadsheetId,
        sheetListName
    );

    if (!recipientName) {
        throw new Error('Recipient name not found in spreadsheet');
    }
    console.log(`📧 Recipient: ${recipientName}`);

    // Initialize Gmail sender with auth manager
    const sender = new GmailManager(authManager);

    // Check if we're already authenticated
    const isAuth = await sender.isAuthenticated();

    if (!isAuth) {
        console.error('❌ Not authenticated');
        process.exit(1);
    }
    console.log(`🔐 Authentication status: ✅ Authenticated`);

    // Prepare substitutions object
    const substitutions = {
        recipientName: recipientName,
    };

    // Send email
    const success = await sender.sendEmail(recipientEmail, templateFile, substitutions);

    if (!success) {
        console.error('❌ Failed to send email!');
        process.exit(1);
    }

    console.log('\n✅ Email sent successfully!');
    console.log(`📧 Sent to: ${recipientEmail}`);
    // Append log to spreadsheet that the email was sent
    await spreadsheetManager.appendToSpreadsheet(spreadsheetId, `${sheetNotificationName}!A:D`, [
        [recipientEmail, recipientName, new Date().toISOString(), templateFile],
    ]);
}

// Run main function
main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
