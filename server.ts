import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Mailer only if credentials exist
const createTransporter = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || '587'),
    secure: SMTP_PORT === '465',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // File persistence paths
  const LEADS_FILE = path.join(process.cwd(), 'leads_storage.json');

  // API Routes
  app.get("/api/leads/load", async (req, res) => {
    try {
      const data = await fs.readFile(LEADS_FILE, 'utf-8');
      res.json(JSON.parse(data));
    } catch (error) {
      res.json([]);
    }
  });

  app.post("/api/leads/save", async (req, res) => {
    try {
      const leads = req.body;
      await fs.writeFile(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf-8');
      res.json({ status: "success", count: leads.length });
    } catch (error) {
      console.error("Save error:", error);
      res.status(500).json({ error: "Failed to save leads" });
    }
  });

  app.post("/api/email/send", async (req, res) => {
    const { to, subject, html } = req.body;
    console.log(`[SMTP] Attempting dispatch to: ${to}`);
    
    const transporter = createTransporter();
    if (!transporter) {
      console.error("[SMTP] Failed - No configuration found in environment variables.");
      return res.status(500).json({ error: "SMTP is not configured in environment variables. Please check your .env file." });
    }

    try {
      // Split by double newline to identify true paragraphs from the AI
      const paragraphs = html.split(/\n\s*\n/).filter((p: string) => p.trim());
      const formattedHtml = paragraphs.map((p: string) => `<p style="margin-bottom: 24px;">${p.replace(/\n/g, '<br>')}</p>`).join('');

      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #111; max-width: 600px;">
          <div style="color: #111;">${formattedHtml}</div>
          <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px; font-size: 11px; color: #aaa;">
            Sent by ${process.env.SMTP_FROM_NAME || 'LeadFlow OSS Engine'}
          </div>
        </div>
      `;

      const mailOptions: Parameters<typeof transporter.sendMail>[0] = {
        from: `"${process.env.SMTP_FROM_NAME || 'LeadFlow OSS Engine'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
        to,
        subject,
        html: emailHtml,
      };
      if (process.env.SMTP_BCC) {
        mailOptions.bcc = process.env.SMTP_BCC;
      }
      await transporter.sendMail(mailOptions);
      res.json({ success: true });
    } catch (error: any) {
      console.error("SMTP error:", error);
      res.status(500).json({ error: error.message || "Failed to send email" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
