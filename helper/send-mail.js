const { createTransport } = require("nodemailer");
require("dotenv/config");

// Email configuration with better error handling
const createEmailTransporter = () => {
  const requiredEnvVars = ['MAIL_LOGIN_USER', 'MAIL_LOGIN_PASS'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  return createTransport({
    host: "smtp-relay.brevo.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.MAIL_LOGIN_USER,
      pass: process.env.MAIL_LOGIN_PASS,
    },
    // Connection timeout
    connectionTimeout: 10000,
    // Socket timeout
    socketTimeout: 10000,
    // Pool settings for better performance
    pool: true,
    maxConnections: 5,
    maxMessages: 10,
  });
};

const sendMail = async (from, subject, text, name) => {
  const transporter = createEmailTransporter();
  
  // Validate environment variables
  const recipients = process.env.MAIL_TO 
    ? process.env.MAIL_TO.split(',').map(email => email.trim())
    : ["mhmd.ahmd.0597@gmail.com", "mohmed2011515616@gmail.com"];

  const mailOptions = {
    from: `"Contact Form" <${process.env.MAIL_LOGIN_USER}>`, // Use authenticated sender
    replyTo: `"${name}" <${from}>`, // Set reply-to as the actual sender
    to: recipients,
    subject: `[Contact Form] ${subject}`,
    text: text,
    html: htmlTemplate(name, subject, from, text),
    // Add message ID for tracking
    messageId: `${Date.now()}.${Math.random().toString(36).substr(2, 9)}@yourdomain.com`
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return result;
  } catch (error) {
    console.error('Failed to send email:', error);
    throw new Error('Email delivery failed');
  } finally {
    // Close the transporter
    transporter.close();
  }
};

const htmlTemplate = (name, subject, from, body) => {
  // Escape HTML to prevent XSS
  const escapeHtml = (unsafe) => {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const safeName = escapeHtml(name);
  const safeSubject = escapeHtml(subject);
  const safeFrom = escapeHtml(from);
  const safeBody = escapeHtml(body).replace(/\n/g, '<br>');

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Contact Form Message</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f4f4f7;
            padding: 20px;
            margin: 0;
            line-height: 1.6;
          }
          .container {
            max-width: 600px;
            margin: auto;
            background: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            padding: 30px;
          }
          .header {
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          h2 {
            color: #333;
            margin-top: 0;
            font-size: 24px;
          }
          .field {
            margin-bottom: 15px;
          }
          .label {
            font-weight: bold;
            color: #555;
            font-size: 14px;
            margin-bottom: 5px;
            display: block;
          }
          .value {
            color: #333;
            font-size: 16px;
            word-wrap: break-word;
          }
          .message-body {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            border-left: 4px solid #007bff;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            font-size: 12px;
            text-align: center;
            color: #6c757d;
          }
          .timestamp {
            font-size: 12px;
            color: #6c757d;
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>📬 New Contact Form Submission</h2>
            <div class="timestamp">
              Received on ${new Date().toLocaleString('en-US', { 
                timeZone: 'UTC',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZoneName: 'short'
              })}
            </div>
          </div>
          
          <div class="field">
            <span class="label">From:</span>
            <div class="value">${safeName}</div>
          </div>
          
          <div class="field">
            <span class="label">Email:</span>
            <div class="value">${safeFrom}</div>
          </div>
          
          <div class="field">
            <span class="label">Subject:</span>
            <div class="value">${safeSubject}</div>
          </div>
          
          <div class="field">
            <span class="label">Message:</span>
            <div class="message-body">${safeBody}</div>
          </div>
          
          <div class="footer">
            <p>This message was sent from your website contact form.</p>
            <p>Please reply directly to this email to respond to ${safeName}.</p>
          </div>
        </div>
      </body>
    </html>
  `;
};

module.exports = { sendMail };