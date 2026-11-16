// Optional email. If the SMTP settings are not in .env, replies are still saved and the customer
// reads them on the status page.
exports.mailConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

exports.sendReply = async ({ to, subject, text }) => {
  const nodemailer = require('nodemailer'); // only loaded when email is set up
  const port = Number(process.env.SMTP_PORT) || 587;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: `Re: ${String(subject).replace(/[\r\n]+/g, ' ')}`,
    text,
  });
};
