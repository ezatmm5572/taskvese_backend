import nodemailer from "nodemailer";
import { SMTP_PASS, SMTP_USER } from "../../../config/config.env.js";


// Create a transporter using SMTP
const transporter = nodemailer.createTransport({
  service:"gmail",
  tls:{
    rejectUnauthorized:false
  },
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

// Function to send email
export async function sendEmail({
  to,
  subject,
  text,
  html,
} = {}) {
  try {
    const info = await transporter.sendMail({
      from: `"Task Management System" <${SMTP_USER}>`,
      to,
      subject,
      text,
      html,
      attachments: []
    });

    return info;
  } catch (error) {
    console.error("Email send error:", error);
    throw error;
  }
}



export const generateOtp=async()=>{
    const otp=Math.floor(100000+Math.random()*900000)
    return otp
}