const twilio = require('twilio');

/**
 * Sends an SMS message using EnableX SMS API (primary) or Twilio (fallback).
 * Falls back to console log simulation if credentials are not configured or if provider fails.
 * 
 * @param {Object} params
 * @param {string} params.to - Recipient phone number (E.164 format, e.g. +91XXXXXXXXXX)
 * @param {string} params.body - The message body
 * @returns {Promise<{success: boolean, provider?: string, messageId?: string, mocked?: boolean, warning?: string}>}
 */
const sendSms = async ({ to, body }) => {
    // 1. Check EnableX SMS Credentials
    const enablexAppId = process.env.ENABLEX_SMS_APP_ID || process.env.ENABLEX_APP_ID;
    const enablexAppKey = process.env.ENABLEX_SMS_APP_KEY || process.env.ENABLEX_APP_KEY;

    if (enablexAppId && enablexAppKey && enablexAppKey !== 'your_enablex_app_key_here') {
        try {
            const authHeader = 'Basic ' + Buffer.from(`${enablexAppId}:${enablexAppKey}`).toString('base64');
            const response = await fetch('https://api.enablex.io/messaging/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authHeader
                },
                body: JSON.stringify({
                    to: [{ to }],
                    channel: 'sms',
                    content: { body }
                })
            });

            const data = await response.json();
            if (response.ok && (data.job_id || data.result === 0 || data.code === 200 || data.status === 'success')) {
                console.log(`✅ [EnableX SMS] Message sent to ${to}: ${data.job_id || JSON.stringify(data)}`);
                return { success: true, provider: 'enablex', messageId: data.job_id };
            } else {
                console.warn(`⚠️ [EnableX SMS] Response error (${response.status}):`, data);
                // Continue to try Twilio or Fallback
            }
        } catch (enablexError) {
            console.error('❌ [EnableX SMS] Error:', enablexError?.message || enablexError);
        }
    }

    // 2. Check Twilio Credentials
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (accountSid && authToken && fromNumber && !accountSid.includes('placeholder')) {
        try {
            const client = twilio(accountSid, authToken);
            const message = await client.messages.create({
                body,
                from: fromNumber,
                to,
            });
            return { success: true, provider: 'twilio', messageId: message.sid };
        } catch (twilioError) {
            console.error('❌ [Twilio SMS] Error:', twilioError?.message || twilioError);
        }
    }

    // 3. Graceful Simulation Fallback
    console.log(`\n=========================================`);
    console.log(`📱 MOCK SMS SERVICE (Simulation / Fallback)`);
    console.log(`To: ${to}`);
    console.log(`Message: ${body}`);
    console.log(`=========================================\n`);
    return { success: true, mocked: true, warning: 'Fallback simulation active' };
};

module.exports = { sendSms };
