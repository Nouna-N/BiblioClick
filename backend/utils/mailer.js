// backend/utils/mailer.js

const nodemailer = require('nodemailer');
require('dotenv').config();
console.log("MAIL_USER:", process.env.MAIL_USER);
console.log("MAIL_PASS:", process.env.MAIL_PASS ? '✔️ présent' : '❌ manquant');

console.log("MAIL_USER:", process.env.MAIL_USER); // à supprimer après test
console.log("MAIL_PASS:", process.env.MAIL_PASS ? "****" : "MISSING"); // à supprimer après test

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

const sendResetCode = async (to, code) => {
  const mailOptions = {
    from: `"Support" <${process.env.MAIL_USER}>`,
    to,
    subject: 'Code de vérification pour réinitialiser votre mot de passe',
    text: `Votre code de vérification est : ${code}. Il est valable pendant 10 minutes.`
  };

  return transporter.sendMail(mailOptions);
};



module.exports = { sendResetCode };
