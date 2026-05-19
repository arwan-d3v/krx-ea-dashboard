import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { message, targetChatId } = body;

    const token = process.env.TELEGRAM_BOT_TOKEN;
    // Jika tidak ada target spesifik, kirim ke Super Admin
    const chatId = targetChatId || process.env.TELEGRAM_ADMIN_CHAT_ID;

    if (!token || !chatId) {
      return NextResponse.json(
        { success: false, error: "Token atau Chat ID belum disetting di .env.local" }, 
        { status: 400 }
      );
    }

    const telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`;

    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML' // Memungkinkan teks tebal (<b>) atau miring (<i>)
      }),
    });

    const data = await response.json();

    if (data.ok) {
      return NextResponse.json({ success: true, data });
    } else {
      return NextResponse.json({ success: false, error: data.description }, { status: 400 });
    }

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}