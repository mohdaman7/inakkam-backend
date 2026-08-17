const twilio = require('twilio');

/**
 * Sends an SMS message using Twilio.
 * Falls back to console log simulation if credentials are not configured.
 * 
 * @param {Object} params
 * @param {string} params.to - Recipient phone number (E.164 format, e.g. +91XXXXXXXXXX)
 * @param {string} params.body - The message body
 * @returns {Promise<{success: boolean, messageId?: string, mocked?: boolean}>}
 */
const sendSms = async ({ to, body }) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
        console.warn('⚠️ Twilio credentials missing in environment variables. Falling back to log simulation.');
        console.log(`\n=========================================`);
        console.log(`📱 MOCK SMS SERVICE (Twilio)`);
        console.log(`To: ${to}`);
        console.log(`Message: ${body}`);
        console.log(`=========================================\n`);
        return { success: true, mocked: true };
    }

    try {
        const client = twilio(accountSid, authToken);
        const message = await client.messages.create({
            body,
            from: fromNumber,
            to,
        });
        return { success: true, messageId: message.sid };
    } catch (error) {
        console.error('❌ Twilio SMS Error:', error);
        throw new Error(`Failed to send SMS: ${error.message}`);
    }
};

module.exports = { sendSms };
