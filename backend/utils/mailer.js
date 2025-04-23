
const nodemailer = require('nodemailer');
require('dotenv').config();



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
