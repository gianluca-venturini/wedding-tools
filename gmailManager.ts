import { readFileSync, existsSync } from 'fs';
import { GoogleAuthManager, createFullAuth } from './authManager';

export interface EmailHeaders {
    From?: string;
    To?: string;
    Subject?: string;
    [key: string]: string | undefined;
}

export interface ParsedEmail {
    headers: EmailHeaders;
    body: string;
}

export class GmailManager {
    private gmail: any = null;
    private authManager: GoogleAuthManager;

    constructor(authManager?: GoogleAuthManager) {
        // Use provided auth manager or create a Gmail-specific one
        this.authManager = authManager || createFullAuth();
    }

    /**
     * Ensure Gmail service is available
     */
    private async ensureGmailService(): Promise<void> {
        if (!this.gmail) {
            this.gmail = await this.authManager.getGmail();
        }
    }

    /**
     * Parse email template file and extract headers and body
     */
    private parseEmailTemplate(templateFile: string): ParsedEmail | null {
        if (!existsSync(templateFile)) {
            console.error(`Error: Template file '${templateFile}' not found!`);
            return null;
        }

        const content = readFileSync(templateFile, 'utf8');
        const lines = content.split('\n');

        // Find the first empty line that separates headers from body
        let headerEndIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim() === '') {
                headerEndIndex = i;
                break;
            }
        }

        if (headerEndIndex === -1) {
            console.error('Error: No empty line found to separate headers from body!');
            return null;
        }

        // Extract headers and body
        const headerLines = lines.slice(0, headerEndIndex);
        const bodyLines = lines.slice(headerEndIndex + 1);

        // Parse headers
        const headers: EmailHeaders = {};
        headerLines.forEach((line: string) => {
            if (line.includes(':')) {
                const [key, ...valueParts] = line.split(':');
                headers[key.trim()] = valueParts.join(':').trim();
            }
        });

        const MANDATORY_FIELDS = ['From', 'Subject'];
        const missingFields = MANDATORY_FIELDS.filter(field => !headers[field]);
        if (missingFields.length > 0) {
            console.error(
                `Error: ${missingFields.join(', ')} field is required in email template!`
            );
            return null;
        }

        const body = bodyLines.join('\n');
        return { headers, body };
    }

    /**
     * Create email message
     */
    private createMessage(headers: EmailHeaders, body: string): string {
        const messageParts = [];

        // Add any additional headers (like Content-Type for HTML emails)
        Object.keys(headers).forEach(key => {
            messageParts.push(`${key}: ${headers[key] || ''}`);
        });

        messageParts.push('');
        messageParts.push(body);

        const message = messageParts.join('\n');
        return Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    /**
     * Send email using Gmail API
     */
    public async sendEmail(
        toAddress: string,
        templateFile: string = 'emails/email_invitation.html.eml'
    ): Promise<boolean> {
        try {
            await this.ensureGmailService();

            // Parse email template
            const parsed = this.parseEmailTemplate(templateFile);
            if (!parsed) {
                console.error('Error: Failed to parse email template!');
                return false;
            }

            const { headers, body } = parsed;

            // Override the To address with the provided parameter
            headers.To = toAddress;

            // Debug: Log headers to see what we're sending
            console.log('Parsed headers:', headers);
            console.log('Content-Type header:', headers['Content-Type']);

            // Validate required fields
            if (!headers.To) {
                console.error('Error: "To" field is required!');
                return false;
            }

            // Create message
            const raw = this.createMessage(headers, body);

            // Debug: Log the raw message before base64 encoding
            const decodedMessage = Buffer.from(
                raw.replace(/-/g, '+').replace(/_/g, '/'),
                'base64'
            ).toString('utf8');
            console.log('Raw email message:');
            console.log(decodedMessage);

            // Send email
            const response = await this.gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: raw,
                },
            });

            console.log('Email sent successfully!');
            console.log(`Message ID: ${response.data.id}`);
            console.log(`To: ${headers.To}`);
            console.log(`Subject: ${headers.Subject}`);

            return true;
        } catch (error) {
            console.error('An error occurred:', error);
            return false;
        }
    }

    /**
     * Check if authentication is valid
     */
    public async isAuthenticated(): Promise<boolean> {
        return await this.authManager.isAuthenticated();
    }

    /**
     * Clear authentication (logout)
     */
    public clearAuth(): void {
        this.authManager.clearAuth();
        this.gmail = null;
    }
}
