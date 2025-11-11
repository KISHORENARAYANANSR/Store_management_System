import nodemailer from "nodemailer";

async function sendMail() {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "kishore.rnaipl@gmail.com",
      pass: "xxbwotrbsczgsvue", // App password
    },
    logger: true,
    debug: true,
  });

  try {
    const info = await transporter.sendMail({
      from: '"Kishore 👨‍💻" <kishore.rnaipl@gmail.com>',
      to: "kishoreprojectiot@gmail.com", // your test email
      subject: "✅ Nodemailer Test Mail",
      text: "If you see this, mail is working!",
    });
    console.log("✅ Mail sent! Message ID:", info.messageId);
  } catch (err) {
    console.error("❌ Mail failed:", err);
  }
}

sendMail();
