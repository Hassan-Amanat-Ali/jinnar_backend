import nodemailer from "nodemailer";
import { configDotenv } from "dotenv";

configDotenv();

// 1. Nodemailer Transporter
const transporter = nodemailer.createTransport({
  host: "127.0.0.1",
  // host: "195.110.58.111", // Keeping the comment from original file
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

/**
 * Sends an OTP to an email address using Nodemailer.
 * context can be: 'verification' or 'reset'
 */
export const sendVerificationEmail = async (userOrEmailObj, code, context = "verification") => {
  const email = userOrEmailObj.email || userOrEmailObj; // Handle user object or direct email string/object

  if (!email) {
    console.error("sendVerificationEmail called without a user email.");
    return;
  }

  const subject = context === "reset" ? "Reset Your Jinnar Password" : "Verify Your Jinnar Account";
  const body = `<p>Your Jinnar ${context === "reset" ? "password reset" : "verification"} code is: <b>${code}</b></p><p>This code will expire in 10 minutes.</p>`;

  if (transporter) {
    try {
      const mailOptions = {
        from: `"Jinnar Services" <${process.env.SMTP_USER}>`,
        to: email,
        subject: subject,
        html: body,
      };
      const response = await transporter.sendMail(mailOptions);
      console.log(`Email sent to ${email} response ${response.messageId}`);
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      throw new Error("Failed to send verification email.");
    }
  }
};
