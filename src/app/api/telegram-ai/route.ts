import { NextRequest, NextResponse } from 'next/server';
import { processOwnerMessage } from '@/lib/telegram-agent';

// Token bot diambil dari environment variables atau fallback
const getBotToken = () => {
  return process.env.TELEGRAM_BOT_TOKEN || process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || '';
};

// Inline Keyboard Tombol Cepat untuk Owner
const QUICK_KEYBOARD = {
  inline_keyboard: [
    [
      { text: "📊 Cek Omset", callback_data: "/omset" },
      { text: "📹 Foto CCTV", callback_data: "/cctv" }
    ],
    [
      { text: "🛡️ Audit Fraud", callback_data: "/fraud" },
      { text: "⚙️ Status Mesin", callback_data: "/mesin" }
    ],
    [
      { text: "🔒 Kunci Mesin", callback_data: "/kunci" },
      { text: "🔓 Buka Kunci", callback_data: "/buka" }
    ]
  ]
};

// Helper Kirim Pesan Teks Telegram
async function sendTelegramMessage(botToken: string, chatId: number | string, text: string) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      reply_markup: QUICK_KEYBOARD,
      disable_web_page_preview: false
    })
  });
}

// Helper Kirim Foto Telegram (Snapshot CCTV)
async function sendTelegramPhoto(botToken: string, chatId: number | string, photoUrl: string, caption: string) {
  const url = `https://api.telegram.org/bot${botToken}/sendPhoto`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption: caption,
      parse_mode: 'HTML',
      reply_markup: QUICK_KEYBOARD
    })
  });
}

// Helper Kirim Aksi Chat (Indikator Mengetik)
async function sendChatAction(botToken: string, chatId: number | string, action: 'typing' | 'upload_photo') {
  const url = `https://api.telegram.org/bot${botToken}/sendChatAction`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: action })
  }).catch(() => {});
}

// Helper Menjawab Callback Query Tombol
async function answerCallbackQuery(botToken: string, callbackQueryId: string) {
  const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId })
  }).catch(() => {});
}

// GET: Health Check & Webhook Setup Assistant
export async function GET(req: NextRequest) {
  const host = req.headers.get('host') || 'pos-kasir-wine.vercel.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const webhookUrl = `${protocol}://${host}/api/telegram-ai`;
  const token = getBotToken();

  return NextResponse.json({
    status: 'ONLINE',
    service: 'Al-Kahfi Executive Telegram AI Bot',
    version: '1.0.0',
    botTokenConfigured: Boolean(token),
    webhookEndpoint: webhookUrl,
    setupGuide: {
      step1: "Dapatkan Token Bot dari @BotFather di Telegram.",
      step2: "Tambahkan TELEGRAM_BOT_TOKEN ke file .env.local atau Vercel Environment Variables.",
      step3: `Buka URL ini di browser untuk mengaktifkan webhook: https://api.telegram.org/bot${token || '<BOT_TOKEN>'}/setWebhook?url=${webhookUrl}`
    }
  });
}

// POST: Webhook Handler Telegram
export async function POST(req: NextRequest) {
  try {
    const token = getBotToken();
    if (!token) {
      console.warn("TELEGRAM_BOT_TOKEN belum diset.");
      return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN belum diset di server." }, { status: 400 });
    }

    const body = await req.json();

    let chatId: number | string | null = null;
    let text: string = '';
    let fromName: string = 'Boss';
    let callbackQueryId: string | null = null;

    // A. Pesan Teks Biasa dari Owner
    if (body.message) {
      chatId = body.message.chat?.id;
      text = body.message.text || '';
      fromName = body.message.from?.first_name || 'Boss';
    } 
    // B. Klik Tombol Inline Keyboard
    else if (body.callback_query) {
      callbackQueryId = body.callback_query.id;
      chatId = body.callback_query.message?.chat?.id;
      text = body.callback_query.data || '';
      fromName = body.callback_query.from?.first_name || 'Boss';
      
      // Jawab callback segera agar indikator loading di tombol hilang
      if (callbackQueryId) {
        answerCallbackQuery(token, callbackQueryId);
      }
    }

    if (!chatId || !text) {
      return NextResponse.json({ ok: true, note: 'No message/chatId to process' });
    }

    // Indikator "Sedang Mengetik..." di Telegram
    sendChatAction(token, chatId, 'typing');

    // Proses Perintah lewat AI Agent Brain
    const agentResponse = await processOwnerMessage(text, fromName);

    // Kirim Balasan ke Telegram
    if (agentResponse.type === 'photo' && agentResponse.photoUrl) {
      sendChatAction(token, chatId, 'upload_photo');
      const photoRes = await sendTelegramPhoto(token, chatId, agentResponse.photoUrl, agentResponse.caption || '');
      
      // Jika upload photo gagal (misal URL foto tidak valid), fallback ke teks
      if (!photoRes.ok) {
        await sendTelegramMessage(token, chatId, agentResponse.caption || agentResponse.text || 'Gagal memuat foto');
      }
    } else {
      await sendTelegramMessage(token, chatId, agentResponse.text);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Telegram Webhook Error:", error);
    return NextResponse.json({ error: error.message || "Internal Error" }, { status: 500 });
  }
}
