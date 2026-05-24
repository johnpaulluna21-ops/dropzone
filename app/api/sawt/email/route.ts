import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  try {
    const { datContent, datFilename, clientName, registeredName, tin, quarterNum, year } = await request.json();

    const quarterLabels: Record<number, string> = {
      1: "1st Quarter",
      2: "2nd Quarter",
      3: "3rd Quarter",
      4: "4th Quarter",
    };

    const subject = `Summary Alphalist of Withholding Taxes (${clientName}) ${quarterLabels[quarterNum]} ${year}`;

    const body = `TIN: ${tin}\nREGISTERED NAME: ${registeredName}`;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: "esubmission@bir.gov.ph",
      subject,
      text: body,
      attachments: [
        {
          filename: datFilename,
          content: Buffer.from(datContent),
          contentType: "text/plain",
        },
      ],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Email send error:", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}