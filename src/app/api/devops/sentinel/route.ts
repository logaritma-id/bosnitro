import { NextRequest, NextResponse } from 'next/server';
import { runHealthCheck, sendDeveloperAlert } from '@/lib/devops-sentinel';

export async function GET(req: NextRequest) {
  try {
    const result = await runHealthCheck();
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const devChatId = process.env.TELEGRAM_DEV_CHAT_ID || '7061579608'; // Baim's Telegram

    // Jika ada alert baru dan bot token terpasang, kirim ke Telegram Developer
    if (result.alerts.length > 0 && token && devChatId) {
      for (const alertMsg of result.alerts) {
        await sendDeveloperAlert(token, devChatId, alertMsg);
      }
    }

    return NextResponse.json({
      status: 'SUCCESS',
      health: result,
      alertsDispatched: result.alerts.length
    });
  } catch (err: any) {
    return NextResponse.json({ status: 'ERROR', error: err.message }, { status: 500 });
  }
}
