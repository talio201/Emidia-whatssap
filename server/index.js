import express from "express";
import cors from "cors";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;


const API_TOKEN = process.env.API_TOKEN || "changeme";

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));

// Middleware de autenticação simples por token
function authMiddleware(req, res, next) {
  // Para testes: se API_TOKEN não está definido, aceita qualquer requisição
  if (!API_TOKEN || API_TOKEN === "changeme") {
    return next();
  }
  const token = req.headers["x-api-token"] || req.query.api_token;
  if (token !== API_TOKEN) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

// Middleware de validação básica de entrada
function validateStringFields(fields) {
  return (req, res, next) => {
    for (const f of fields) {
      if (typeof req.body[f] !== "string" || req.body[f].length === 0) {
        return res.status(400).json({ error: `invalid_field_${f}` });
      }
    }
    next();
  };
}

const PORT = process.env.PORT || 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "data");
const uploadsDir = path.join(dataDir, "uploads");
const dataFile = path.join(dataDir, "store.json");

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const loadStore = () => {
  if (!fs.existsSync(dataFile)) {
    return { schedules: [], uploads: [], replies: [], campaigns: [], tags: [], contactTags: {}, funnel: {}, sentLog: [] };
  }
  try {
    const data = JSON.parse(fs.readFileSync(dataFile, "utf-8"));
    return {
      schedules: data.schedules || [],
      uploads: data.uploads || [],
      replies: data.replies || [],
      campaigns: data.campaigns || [],
      tags: data.tags || [],
      contactTags: data.contactTags || {},
      funnel: data.funnel || {},
      sentLog: data.sentLog || []
    };
  } catch {
    return { schedules: [], uploads: [], replies: [], campaigns: [], tags: [], contactTags: {}, funnel: {}, sentLog: [] };
  }
};

const saveStore = (store) => {
  fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));
};

let latestQr = null;
let clientReady = false;
let lastAuthError = null;

const client = new Client({
  authStrategy: new LocalAuth({ clientId: "default" }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ]
  }
});

client.on("qr", async (qr) => {
  try {
    latestQr = await QRCode.toDataURL(qr);
    clientReady = false;
  } catch (e) {
    latestQr = null;
  }
});

client.on("ready", () => {
  clientReady = true;
  latestQr = null;
  lastAuthError = null;
});

client.on("auth_failure", (msg) => {
  lastAuthError = msg;
  clientReady = false;
});

client.on("disconnected", () => {
  clientReady = false;
});

client.on("message", async (msg) => {
  try {
    // Simula leitura da mensagem recebida
    if (msg.from && !msg.fromMe) {
      try {
        await msg.getChat().then(chat => chat.sendSeen());
      } catch {}
    }
    const store = loadStore();
    store.replies.unshift({
      id: msg.id?._serialized || "",
      from: msg.from || "",
      body: msg.body || "",
      timestamp: msg.timestamp || Date.now(),
      fromMe: !!msg.fromMe
    });
    // Atualiza funil automaticamente para quem respondeu
    if (msg.from) {
      const num = msg.from.replace(/\D/g, "");
      if (num) {
        store.funnel[num] = store.funnel[num] || { stage: "Respondeu", updatedAt: Date.now() };
        store.funnel[num].stage = "Respondeu";
        store.funnel[num].updatedAt = Date.now();
      }
    }
    store.replies = store.replies.slice(0, 200);
    saveStore(store);
  } catch {
    // ignore
  }
});

await client.initialize();

app.get("/status", (_req, res) => {
  res.json({ ready: clientReady, hasQr: !!latestQr, authError: lastAuthError });
});

app.get("/qr", (_req, res) => {
  if (!latestQr) {
    res.status(404).json({ error: "qr_not_ready" });
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`
    <html>
      <head><title>QR WhatsApp</title></head>
      <body style="display:flex;align-items:center;justify-content:center;height:100vh;background:#111;">
        <div style="text-align:center;color:#fff;font-family:Arial;">
          <h2>Escaneie o QR no WhatsApp</h2>
          <img src="${latestQr}" alt="QR" style="width:320px;height:320px;" />
          <p>Atualize a página se expirar.</p>
        </div>
      </body>
    </html>
  `);
});

app.post("/upload", authMiddleware, validateStringFields(["filename", "base64", "mime"]), async (req, res) => {
  const { filename, base64, mime } = req.body || {};
  try {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = path.join(uploadsDir, `${id}-${safeName}`);
    fs.writeFileSync(filePath, Buffer.from(base64, "base64"));

    const store = loadStore();
    store.uploads.push({ id, filename: safeName, mime, path: filePath, createdAt: Date.now() });
    saveStore(store);

    res.json({ id });
  } catch (e) {
    res.status(500).json({ error: "upload_failed" });
  }
});

app.post("/schedule", authMiddleware, async (req, res) => {
  const { numbers, message, sendAt, uploadId, campaignId } = req.body || {};
  if (!Array.isArray(numbers) || numbers.length === 0 || !sendAt) {
    res.status(400).json({ error: "missing_schedule_data" });
    return;
  }
  const store = loadStore();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  store.schedules.push({
    id,
    numbers,
    message: message || "",
    sendAt,
    uploadId: uploadId || null,
    campaignId: campaignId || null,
    status: "pending",
    createdAt: Date.now()
  });
  saveStore(store);
  res.json({ id });
});

app.get("/schedules", (_req, res) => {
  const store = loadStore();
  res.json({ schedules: store.schedules || [] });
});

app.get("/contacts", async (_req, res) => {
  if (!clientReady) {
    return res.status(401).json({ error: "whatsapp_not_authenticated" });
  }
  try {
    const contacts = await client.getContacts();
    const mapped = contacts
      .filter((c) => c.id && c.id.user)
      .map((c) => ({
        id: c.id._serialized,
        number: c.id.user,
        name: c.name || c.pushname || c.shortName || ""
      }));
    res.json({ contatos: mapped });
  } catch (e) {
    res.status(500).json({ error: "contacts_failed" });
  }
});

app.get("/chats", async (_req, res) => {
  try {
    const chats = await client.getChats();
    const mapped = chats.map((c) => ({
      id: c.id?._serialized || "",
      name: c.name || c.formattedTitle || c.title || "",
      isGroup: !!c.isGroup,
      unreadCount: c.unreadCount || 0,
      lastMessage: c.lastMessage?.body || "",
      timestamp: c.lastMessage?.timestamp || null
    }));
    res.json({ chats: mapped });
  } catch (e) {
    res.status(500).json({ error: "chats_failed" });
  }
});

app.get("/replies", (_req, res) => {
  const store = loadStore();
  res.json({ replies: store.replies || [] });
});

app.get("/messages", async (req, res) => {
  const { chatId } = req.query || {};
  if (!chatId) {
    res.status(400).json({ error: "missing_chatId" });
    return;
  }
  try {
    const chat = await client.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit: 50 });
    const mapped = messages.map((m) => ({
      id: m.id?._serialized || "",
      body: m.body || "",
      fromMe: !!m.fromMe,
      timestamp: m.timestamp || null,
      hasMedia: !!m.hasMedia
    }));
    res.json({ messages: mapped });
  } catch (e) {
    res.status(500).json({ error: "messages_failed" });
  }
});

app.post("/send", authMiddleware, validateStringFields(["message"]), async (req, res) => {
  const { number, message, chatId, campaignId } = req.body || {};
  if ((!number && !chatId) || !message) {
    res.status(400).json({ error: "missing_target_or_message" });
    return;
  }

  try {
    const target = chatId || `${number.replace(/\D/g, "")}@c.us`;
    const result = await client.sendMessage(target, message);
    const store = loadStore();
    store.sentLog.unshift({
      id: result.id?._serialized || "",
      to: target,
      message,
      campaignId: campaignId || null,
      timestamp: Date.now()
    });
    store.sentLog = store.sentLog.slice(0, 500);
    saveStore(store);
    res.json({ success: true, id: result.id?._serialized || null });
  } catch (e) {
    res.status(500).json({ error: "send_failed" });
  }
});

app.post("/send-media", authMiddleware, validateStringFields(["mediaBase64", "mimetype"]), async (req, res) => {
  const { number, chatId, message, mediaBase64, mimetype, filename, campaignId } = req.body || {};
  if ((!number && !chatId) || !mediaBase64 || !mimetype) {
    res.status(400).json({ error: "missing_target_or_media" });
    return;
  }

  try {
    const target = chatId || `${number.replace(/\D/g, "")}@c.us`;
    const media = new MessageMedia(mimetype, mediaBase64, filename || "arquivo");
    const result = await client.sendMessage(target, media, { caption: message || "" });
    const store = loadStore();
    store.sentLog.unshift({
      id: result.id?._serialized || "",
      to: target,
      message: message || "",
      campaignId: campaignId || null,
      timestamp: Date.now()
    });
    store.sentLog = store.sentLog.slice(0, 500);
    saveStore(store);
    res.json({ success: true, id: result.id?._serialized || null });
  } catch (e) {
    res.status(500).json({ error: "send_media_failed" });
  }
});

// Campaigns
app.get("/campaigns", (_req, res) => {
  const store = loadStore();
  res.json({ campaigns: store.campaigns || [] });
});

app.post("/campaigns", (req, res) => {
  const { name, message, numbers, tag } = req.body || {};
  if (!name) {
    res.status(400).json({ error: "missing_campaign_name" });
    return;
  }
  const store = loadStore();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  store.campaigns.push({
    id,
    name,
    message: message || "",
    numbers: Array.isArray(numbers) ? numbers : [],
    tag: tag || null,
    createdAt: Date.now()
  });
  saveStore(store);
  res.json({ id });
});

// Tags
app.get("/tags", (_req, res) => {
  const store = loadStore();
  res.json({ tags: store.tags || [], contactTags: store.contactTags || {} });
});

app.post("/tags", (req, res) => {
  const { name } = req.body || {};
  if (!name) {
    res.status(400).json({ error: "missing_tag_name" });
    return;
  }
  const store = loadStore();
  if (!store.tags.includes(name)) store.tags.push(name);
  saveStore(store);
  res.json({ success: true });
});

app.post("/tags/apply", (req, res) => {
  const { numbers, tags } = req.body || {};
  if (!Array.isArray(numbers) || !Array.isArray(tags)) {
    res.status(400).json({ error: "missing_tags_data" });
    return;
  }
  const store = loadStore();
  numbers.forEach((n) => {
    const num = String(n).replace(/\D/g, "");
    if (!num) return;
    store.contactTags[num] = Array.from(new Set([...(store.contactTags[num] || []), ...tags]));
  });
  saveStore(store);
  res.json({ success: true });
});

// Funnel
app.get("/funnel", (_req, res) => {
  const store = loadStore();
  res.json({ funnel: store.funnel || {} });
});

app.post("/funnel/update", (req, res) => {
  const { number, stage } = req.body || {};
  if (!number || !stage) {
    res.status(400).json({ error: "missing_funnel_data" });
    return;
  }
  const store = loadStore();
  const num = String(number).replace(/\D/g, "");
  store.funnel[num] = { stage, updatedAt: Date.now() };
  saveStore(store);
  res.json({ success: true });
});

// Reports
app.get("/reports", (_req, res) => {
  const store = loadStore();
  const totalSent = store.sentLog.length;
  const totalReplies = store.replies.filter(r => !r.fromMe).length;
  const byCampaign = {};
  store.sentLog.forEach((s) => {
    const key = s.campaignId || "manual";
    byCampaign[key] = (byCampaign[key] || 0) + 1;
  });
  res.json({ totalSent, totalReplies, byCampaign });
});

app.post("/groups/create", async (req, res) => {
  const { name, numbers } = req.body || {};
  if (!name || !Array.isArray(numbers) || numbers.length === 0) {
    res.status(400).json({ error: "missing_group_data" });
    return;
  }
  try {
    const participants = numbers.map((n) => `${String(n).replace(/\D/g, "")}@c.us`);
    const chat = await client.createGroup(name, participants);
    res.json({ id: chat?.id?._serialized || null });
  } catch (e) {
    res.status(500).json({ error: "create_group_failed" });
  }
});

app.post("/groups/add", async (req, res) => {
  const { chatId, numbers } = req.body || {};
  if (!chatId || !Array.isArray(numbers) || numbers.length === 0) {
    res.status(400).json({ error: "missing_group_data" });
    return;
  }
  try {
    const chat = await client.getChatById(chatId);
    await chat.addParticipants(numbers.map((n) => `${String(n).replace(/\D/g, "")}@c.us`));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "add_participants_failed" });
  }
});

app.post("/groups/remove", async (req, res) => {
  const { chatId, numbers } = req.body || {};
  if (!chatId || !Array.isArray(numbers) || numbers.length === 0) {
    res.status(400).json({ error: "missing_group_data" });
    return;
  }
  try {
    const chat = await client.getChatById(chatId);
    await chat.removeParticipants(numbers.map((n) => `${String(n).replace(/\D/g, "")}@c.us`));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "remove_participants_failed" });
  }
});


// Função utilitária para jitter (delay aleatório)
function randomDelay(min = 15000, max = 45000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Função utilitária para spintax simples
function spintax(msg, vars = {}) {
  // Exemplo: "{Olá|Oi|E aí} {nome}, seu pedido {saiu|tem novidades}!"
  let out = msg.replace(/\{([^}]+)\}/g, (_, opts) => {
    const arr = opts.split('|');
    return arr[Math.floor(Math.random() * arr.length)];
  });
  // Substitui variáveis do tipo {{nome}}
  Object.entries(vars).forEach(([k, v]) => {
    out = out.replace(new RegExp(`{{${k}}}`, 'g'), v);
  });
  return out;
}

// Função para verificar se está em horário comercial (8h-20h)
function horarioHumano() {
  const h = new Date().getHours();
  return h >= 8 && h < 20;
}

// Função para controle de ramp-up (limite diário por idade do número)
function podeEnviarHoje(store, maxPorDia = 50) {
  // Exemplo: limita a 50 envios/dia, pode customizar por idade do número
  const hoje = new Date().toISOString().slice(0, 10);
  const enviadosHoje = (store.sentLog || []).filter(s => {
    const data = new Date(s.timestamp).toISOString().slice(0, 10);
    return data === hoje;
  }).length;
  return enviadosHoje < maxPorDia;
}

// Scheduler com jitter, composing, spintax, ramp-up e horário humano
setInterval(async () => {
  const store = loadStore();
  const now = Date.now();
  const pending = (store.schedules || []).filter((s) => s.status === "pending");
  for (const sched of pending) {
    const when = new Date(sched.sendAt).getTime();
    if (Number.isNaN(when) || when > now) continue;

    // Checa horário humano e ramp-up
    if (!horarioHumano() || !podeEnviarHoje(store, 50)) {
      continue;
    }

    try {
      let media = null;
      if (sched.uploadId) {
        const upload = (store.uploads || []).find((u) => u.id === sched.uploadId);
        if (upload && fs.existsSync(upload.path)) {
          media = MessageMedia.fromFilePath(upload.path);
        }
      }

      for (const n of sched.numbers) {
        const jid = `${String(n).replace(/\D/g, "")}@c.us`;

        // Simula presença (composing)
        await client.sendPresenceAvailable();
        await client.sendPresenceUpdate('composing', jid);
        await new Promise(r => setTimeout(r, Math.floor(Math.random() * 2000) + 3000)); // 3-5s

        // Varia mensagem (spintax)
        let msgFinal = sched.message || "";
        // Exemplo: pode passar variáveis como nome, etc.
        msgFinal = spintax(msgFinal, { nome: n });

        if (media) {
          await client.sendMessage(jid, media, { caption: msgFinal });
        } else {
          await client.sendMessage(jid, msgFinal);
        }

        // Jitter entre envios
        await new Promise(r => setTimeout(r, randomDelay()));
      }

      sched.status = "sent";
      sched.sentAt = Date.now();
    } catch {
      sched.status = "failed";
      sched.sentAt = Date.now();
    }
  }
  saveStore(store);
}, 10000);


app.listen(PORT, () => {
  console.log(`WhatsApp backend rodando na porta ${PORT}`);
});

// Rota raiz para status do backend
app.get('/', (req, res) => {
  res.json({ status: 'Backend WhatsApp rodando', timestamp: new Date().toISOString() });
});

export default app;
