const { createTransport } = require("nodemailer");
const { getMailConfig } = require("./mail-config");

// Reused while a serverless instance is warm; rebuilt if the settings change
// (e.g. after the credentials in Secrets Manager are rotated).
let transporter;
let transporterKey;

const getTransporter = (config) => {
  const key = [config.host, config.port, config.user, config.pass].join("|");
  if (!transporter || transporterKey !== key) {
    transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.pass },
      connectionTimeout: 10000,
      socketTimeout: 10000,
    });
    transporterKey = key;
  }
  return transporter;
};

const sendMail = async ({ from, subject, body, name }) => {
  const config = await getMailConfig();
  const mailer = getTransporter(config);

  try {
    return await mailer.sendMail({
      from: { name: "Contact Form", address: config.from }, // verified sender
      replyTo: { name, address: from }, // object form: nodemailer encodes it safely
      to: config.to,
      subject: `[Contact Form] ${subject}`,
      text: body,
      html: htmlTemplate(name, subject, from, body),
    });
  } catch (error) {
    throw new Error(`Email delivery failed: ${error.code || error.message}`);
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