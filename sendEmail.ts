import { config } from 'dotenv';
import { GmailManager } from './gmailManager';

// Load environment variables
config();

/**
 * Show usage instructions
 */
function showUsage(): void {
    console.log('Usage: bun run sendEmail.ts <recipient-email> [template-file]');
    console.log('');
    console.log('Arguments:');
    console.log('  recipient-email    Email address to send to (required)');
    console.log('  template-file      Path to email template file (optional)');
    console.log('                     Default: emails/email_invitation.html.eml');
    console.log('');
    console.log('Examples:');
    console.log('  bun run sendEmail.ts john@example.com');
    console.log('  bun run sendEmail.ts jane@example.com emails/custom_template.eml');
}

/**
 * Main function
 */
async function main(): Promise<void> {
    console.log('Gmail API Email Sender');
    console.log('='.repeat(50));

    // Parse command line arguments
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error('❌ Error: Recipient email address is required!');
        console.log('');
        showUsage();
        process.exit(1);
    }

    const recipientEmail = args[0];
    const templateFile = args[1]; // Optional, will use default if not provided

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
        console.error('❌ Error: Invalid email address format!');
        console.error(`Provided email: ${recipientEmail}`);
        process.exit(1);
    }

    console.log(`📧 Recipient: ${recipientEmail}`);
    if (templateFile) {
        console.log(`📄 Template: ${templateFile}`);
    } else {
        console.log('📄 Template: emails/email_invitation.html.eml (default)');
    }

    // Initialize Gmail sender
    const sender = new GmailManager();

    // Check if we're already authenticated
    const isAuth = await sender.isAuthenticated();
    console.log(
        `🔐 Authentication status: ${isAuth ? '✅ Authenticated' : '❌ Not authenticated'}`
    );

    // Send email
    const success = templateFile
        ? await sender.sendEmail(recipientEmail, templateFile)
        : await sender.sendEmail(recipientEmail);

    if (success) {
        console.log('\n✅ Email sent successfully!');
        console.log(`📧 Sent to: ${recipientEmail}`);
    } else {
        console.log('\n❌ Failed to send email!');
        process.exit(1);
    }
}

// Run main function
main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
