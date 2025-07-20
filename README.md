# Wedding Tools

Suite of tools for organizing a wedding

## Sending Emails

### Setup

1. Install Bun: https://bun.sh/
2. Install dependencies: bun install
3. Enable Gmail API in Google Cloud Console
4. Create OAuth 2.0 credentials and add them to your .env file
5. Copy .env.example to .env and fill in your credentials
6. Run the script for the first time to authorize access

### Usage

Edit email templates with a WYSIWYG editor e.g. https://topol.io/ and save them to the `emails` directory.

```bash
bun run sendEmail <email_address>
```