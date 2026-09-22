'use strict';

const nodemailer = require('nodemailer');

let transporter = null;

function isEmailConfigured() {
    return Boolean(
        process.env.SMTP_HOST &&
        process.env.SMTP_PORT &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS
    );
}

function getTransporter() {
    if (transporter) {
        return transporter;
    }

    if (!isEmailConfigured()) {
        return null;
    }

    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    return transporter;
}

async function sendEmail({
    to,
    subject,
    text,
    html
}) {
    if (!to) {
        console.warn('[EMAIL] Recipient email missing. Email skipped.');
        return {
            success: false,
            skipped: true,
            reason: 'missing_recipient'
        };
    }

    const mailer = getTransporter();

    if (!mailer) {
        console.warn('[EMAIL] SMTP not configured. Email skipped.');
        return {
            success: false,
            skipped: true,
            reason: 'smtp_not_configured'
        };
    }

    try {
        const info = await mailer.sendMail({
            from:
                process.env.SMTP_FROM ||
                process.env.SMTP_USER,
            to,
            subject,
            text,
            html
        });

        console.log(
            `[EMAIL] Sent to ${to}: ${info.messageId}`
        );

        return {
            success: true,
            messageId: info.messageId
        };
    } catch (error) {
        console.error(
            `[EMAIL] Failed to send to ${to}:`,
            error.message
        );

        return {
            success: false,
            skipped: false,
            error: error.message
        };
    }
}

module.exports = {
    isEmailConfigured,
    sendEmail
};