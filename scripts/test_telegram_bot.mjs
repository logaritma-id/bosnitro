import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Baca .env.local
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v) envVars[k.trim()] = v.join('=').trim();
});

const BOT_TOKEN = envVars.TELEGRAM_BOT_TOKEN || '8694023744:AAGpIA-6uJpmWnl14ARejwb2Rpp42mv7n1k';
const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL || 'https://qxvgciwufwvchgfapjyk.supabase.co';
const SUPABASE_KEY = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Whitelist & Pending Actions
const ALLOWED_CHAT_IDS = new Set(['7061579608', 7061579608, '-10023481920', -10023481920]);
const pendingActions = new Map();

const KEYBOARDS = {
  MAIN: {
    inline_keyboard: [
      [
        { text: "📊 Laporan & Omset", callback_data: "/menu_omset" },
        { text: "📹 Foto CCTV", callback_data: "/cctv" }
      ],
      [
        { text: "📦 Produk & Stok", callback_data: "/menu_produk" },
        { text: "👥 Karyawan & Kasir", callback_data: "/menu_karyawan" }
      ],
      [
        { text: "🛡️ Audit Fraud", callback_data: "/fraud" },
        { text: "⚡ Kontrol Mesin IoT", callback_data: "/menu_mesin" }
      ]
    ]
  },
  PRODUK: {
    inline_keyboard: [
      [
        { text: "➕ Panduan Tambah Produk", callback_data: "/panduan_tambah_produk" },
        { text: "🏷️ Panduan Ubah Harga", callback_data: "/panduan_ubah_harga" }
      ],
      [
        { text: "📥 Panduan Tambah Stok", callback_data: "/panduan_tambah_stok" },
        { text: "⚠️ Cek Stok Menipis", callback_data: "/stok_menipis" }
      ],
      [
        { text: "📋 Lihat Semua Produk", callback_data: "/semua_produk" },
        { text: "🔙 Menu Utama", callback_data: "/menu_utama" }
      ]
    ]
  },
  KARYAWAN: {
    inline_keyboard: [
      [
        { text: "👤 Siapa Kasir Jaga?", callback_data: "/kasir" },
        { text: "🔑 Panduan Ganti PIN", callback_data: "/panduan_ganti_pin" }
      ],
      [
        { text: "🔙 Menu Utama", callback_data: "/menu_utama" }
      ]
    ]
  },
  MESIN: {
    inline_keyboard: [
      [
        { text: "⚙️ Status Alat (ESP32)", callback_data: "/mesin" },
        { text: "⏱️ Durasi Katup", callback_data: "/durasi_katup" }
      ],
      [
        { text: "🔒 KUNCI MESIN (Lock)", callback_data: "/kunci" },
        { text: "🔓 BUKA KUNCI (Unlock)", callback_data: "/buka" }
      ],
      [
        { text: "🔙 Menu Utama", callback_data: "/menu_utama" }
      ]
    ]
  },
  DURASI: {
    inline_keyboard: [
      [
        { text: "⏱️ Set 60s (1 Ban)", callback_data: "/set_durasi_60" },
        { text: "⏱️ Set 120s (2 Ban)", callback_data: "/set_durasi_120" }
      ],
      [
        { text: "⏱️ Set 180s (3 Ban)", callback_data: "/set_durasi_180" },
        { text: "⏱️ Set 240s (4 Ban)", callback_data: "/set_durasi_240" }
      ],
      [
        { text: "🔙 Menu Mesin", callback_data: "/menu_mesin" },
        { text: "🏠 Menu Utama", callback_data: "/menu_utama" }
      ]
    ]
  },
  CONFIRMATION: {
    inline_keyboard: [
      [
        { text: "✅ Ya, Eksekusi Sekarang", callback_data: "CONFIRM_ACTION" },
        { text: "❌ Batal", callback_data: "CANCEL_ACTION" }
      ]
    ]
  }
};

async function sendTelegram(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function handleMessage(text, fromName = 'Boss', chatId = '') {
  const clean = text.trim();
  const lower = clean.toLowerCase();

  // Whitelist check
  if (ALLOWED_CHAT_IDS.size > 0 && !ALLOWED_CHAT_IDS.has(String(chatId)) && !ALLOWED_CHAT_IDS.has(Number(chatId))) {
    return {
      type: 'text',
      text: `⛔ <b>AKSES DITOLAK</b>\n\n` +
        `Maaf ${fromName}, akun Telegram Anda (ID: <code>${chatId}</code>) tidak terdaftar dalam Whitelist Administrator Al-Kahfi. Hubungi Owner untuk izin akses.`,
      keyboard: { inline_keyboard: [] }
    };
  }

  // Konfirmasi Aksi
  if (clean === 'CONFIRM_ACTION') {
    const pending = pendingActions.get(chatId);
    if (!pending) return { type: 'text', text: `⚠️ Tidak ada perintah yang menunggu konfirmasi.`, keyboard: KEYBOARDS.MAIN };
    pendingActions.delete(chatId);

    try {
      if (pending.action === 'ADD_PRODUCT') {
        const { name, harga, hpp, stok, category } = pending.data;
        const { error } = await supabase.from('products').insert({
          name,
          harga,
          hpp,
          stok,
          category,
          img: `https://placehold.co/100x100/1e293b/ffffff?text=${encodeURIComponent(name.slice(0, 8))}`
        });
        if (error) throw error;
        return {
          type: 'text',
          text: `✅ <b>SUKSES! PRODUK BERHASIL DITAMBAHKAN</b>\n\n` +
            `Produk <b>"${name}"</b> (Harga: Rp ${harga.toLocaleString('id-ID')}, Stok: ${stok}) sekarang aktif di database dan langsung muncul di tablet kasir!`,
          keyboard: KEYBOARDS.PRODUK
        };
      }

      if (pending.action === 'UPDATE_PRICE') {
        const { id, name, newPrice } = pending.data;
        const { error } = await supabase.from('products').update({ harga: newPrice, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
        return {
          type: 'text',
          text: `✅ <b>SUKSES! HARGA DIPERBARUI</b>\n\n` +
            `Harga <b>"${name}"</b> resmi diubah menjadi <b>Rp ${newPrice.toLocaleString('id-ID')}</b>. Kasir langsung menggunakan harga baru ini.`,
          keyboard: KEYBOARDS.PRODUK
        };
      }

      if (pending.action === 'UPDATE_STOCK') {
        const { id, name, addedQty, newTotal } = pending.data;
        const { error } = await supabase.from('products').update({ stok: newTotal, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
        return {
          type: 'text',
          text: `✅ <b>SUKSES! STOK BERHASIL DITAMBAHKAN</b>\n\n` +
            `Stok <b>"${name}"</b> bertambah +${addedQty} unit. Total stok terkini di kasir: <b>${newTotal} unit</b>.`,
          keyboard: KEYBOARDS.PRODUK
        };
      }
    } catch (e) {
      return { type: 'text', text: `⚠️ Gagal eksekusi: ${e.message}`, keyboard: KEYBOARDS.MAIN };
    }
  }

  if (clean === 'CANCEL_ACTION') {
    pendingActions.delete(chatId);
    return { type: 'text', text: `❌ <b>Perintah dibatalkan.</b> Tidak ada perubahan data di kasir.`, keyboard: KEYBOARDS.MAIN };
  }

  // Navigasi Menu
  if (lower === '/start' || lower === '/menu' || lower === '/menu_utama') {
    return {
      type: 'text',
      text: `👋 <b>Halo ${fromName}! Saya Asisten AI Al-Kahfi v2.0.</b>\n\n` +
        `Pusat kendali POS Kasir, Master Stok, Karyawan, dan Mesin IoT berada dalam genggaman Anda.\n\n` +
        `Silakan pilih menu di bawah atau ketik perintah langsung!`,
      keyboard: KEYBOARDS.MAIN
    };
  }

  if (lower === '/menu_produk') {
    return {
      type: 'text',
      text: `📦 <b>MENU KELOLA MASTER PRODUK & STOK</b>\n\n` +
        `Anda bisa menambah produk baru, menaikkan/menurunkan harga jual, atau menambah stok barang langsung dari sini tanpa perlu membuka dashboard web.\n\n` +
        `Pilih opsi di bawah atau gunakan perintah kilat:`,
      keyboard: KEYBOARDS.PRODUK
    };
  }

  if (lower === '/menu_karyawan') {
    return {
      type: 'text',
      text: `👥 <b>MENU MANAJEMEN KARYAWAN & SHIFT</b>\n\nPantau kasir yang sedang aktif bertugas atau ubah PIN login kasir dari jarak jauh.`,
      keyboard: KEYBOARDS.KARYAWAN
    };
  }

  if (lower === '/menu_mesin') {
    return {
      type: 'text',
      text: `⚡ <b>MENU KONTROL MESIN IOT AL-KAHFI</b>\n\nKendalikan katup solenoid nitrogen di gerai secara remote via ESP32.`,
      keyboard: KEYBOARDS.MESIN
    };
  }

  // Panduan
  if (lower === '/panduan_tambah_produk') {
    return {
      type: 'text',
      text: `💡 <b>CARA CEPAT MENAMBAH PRODUK BARU:</b>\n\n` +
        `Ketik dengan format:\n` +
        `<code>+produk [Nama] | [Harga Jual] | [Modal HPP] | [Stok]</code>\n\n` +
        `<b>Contoh Siap Pakai (Tinggal Salin & Ubah):</b>\n` +
        `<code>+produk Lap Microfiber | 15000 | 8000 | 25</code>\n` +
        `<code>+produk Oli Enduro Matic | 52000 | 40000 | 12</code>`,
      keyboard: KEYBOARDS.PRODUK
    };
  }

  if (lower === '/panduan_ubah_harga') {
    return {
      type: 'text',
      text: `💡 <b>CARA CEPAT UBAH HARGA PRODUK:</b>\n\n` +
        `Ketik dengan format:\n` +
        `<code>+harga [Nama Produk] [Harga Baru]</code>\n\n` +
        `<b>Contoh:</b>\n` +
        `<code>+harga Tambal Ban 18000</code>\n` +
        `<code>+harga Oli MPX 58000</code>`,
      keyboard: KEYBOARDS.PRODUK
    };
  }

  if (lower === '/panduan_tambah_stok') {
    return {
      type: 'text',
      text: `💡 <b>CARA CEPAT TAMBAH STOK BARANG:</b>\n\n` +
        `Ketik dengan format:\n` +
        `<code>+stok [Nama Produk] [Jumlah Tambah]</code>\n\n` +
        `<b>Contoh:</b>\n` +
        `<code>+stok Oli MPX 24</code>\n` +
        `<code>+stok Cairan Tubles 10</code>`,
      keyboard: KEYBOARDS.PRODUK
    };
  }

  // Parser: +produk
  if (lower.startsWith('+produk ') || lower.includes('tambah produk baru')) {
    const parts = clean.replace(/^\+produk\s+/i, '').split('|').map(s => s.trim());
    if (parts.length >= 2) {
      const name = parts[0];
      const harga = parseInt(parts[1].replace(/[^0-9]/g, '')) || 0;
      const hpp = parts[2] ? parseInt(parts[2].replace(/[^0-9]/g, '')) || 0 : Math.round(harga * 0.7);
      const stok = parts[3] ? parseInt(parts[3].replace(/[^0-9]/g, '')) || 10 : 10;
      const category = name.toLowerCase().includes('ban') || name.toLowerCase().includes('nitrogen') ? 'nitrogen' : 'ritel';
      const margin = harga - hpp;
      const marginPct = harga > 0 ? ((margin / harga) * 100).toFixed(1) : '0';

      pendingActions.set(chatId, {
        action: 'ADD_PRODUCT',
        data: { name, harga, hpp, stok, category }
      });

      const card = `📦 <b>KONFIRMASI INPUT PRODUK BARU</b>\n` +
        `──────────────────────────\n` +
        `• <b>Nama Produk:</b> ${name}\n` +
        `• <b>Kategori:</b> ${category.toUpperCase()}\n` +
        `• <b>Harga Jual:</b> Rp ${harga.toLocaleString('id-ID')}\n` +
        `• <b>Modal (HPP):</b> Rp ${hpp.toLocaleString('id-ID')}\n` +
        `• <b>Laba Bersih:</b> Rp ${margin.toLocaleString('id-ID')} (${marginPct}%)\n` +
        `• <b>Stok Masuk:</b> ${stok} unit\n` +
        `──────────────────────────\n` +
        `<i>Apakah data ini sudah benar dan mau disimpan ke Kasir?</i>`;

      return { type: 'text', text: card, keyboard: KEYBOARDS.CONFIRMATION };
    }
  }

  // Parser: +harga
  if (lower.startsWith('+harga ') || (lower.includes('ubah harga') && /\d+/.test(lower))) {
    const cleanStr = clean.replace(/^\+harga\s+/i, '').trim();
    const words = cleanStr.split(/\s+/);
    const newPrice = parseInt(words[words.length - 1].replace(/[^0-9]/g, ''));
    const prodSearch = words.slice(0, words.length - 1).join(' ').trim();

    if (newPrice && prodSearch) {
      const { data: matched } = await supabase.from('products').select('*').ilike('name', `%${prodSearch}%`).limit(1).single();
      if (matched) {
        pendingActions.set(chatId, {
          action: 'UPDATE_PRICE',
          data: { id: matched.id, name: matched.name, newPrice }
        });

        const card = `🏷️ <b>KONFIRMASI PERUBAHAN HARGA PRODUK</b>\n` +
          `──────────────────────────\n` +
          `• <b>Produk:</b> ${matched.name}\n` +
          `• <b>Harga Sekarang:</b> Rp ${matched.harga.toLocaleString('id-ID')}\n` +
          `• <b>Harga Baru:</b> <b>Rp ${newPrice.toLocaleString('id-ID')}</b>\n` +
          `──────────────────────────\n` +
          `<i>Harga di tablet kasir akan langsung berubah saat Anda klik Eksekusi. Lanjutkan?</i>`;

        return { type: 'text', text: card, keyboard: KEYBOARDS.CONFIRMATION };
      }
    }
  }

  // Parser: +stok
  if (lower.startsWith('+stok ') || (lower.includes('tambah stok') && /\d+/.test(lower))) {
    const cleanStr = clean.replace(/^\+stok\s+/i, '').trim();
    const words = cleanStr.split(/\s+/);
    const qty = parseInt(words[words.length - 1].replace(/[^0-9]/g, ''));
    const prodSearch = words.slice(0, words.length - 1).join(' ').trim();

    if (qty && prodSearch) {
      const { data: matched } = await supabase.from('products').select('*').ilike('name', `%${prodSearch}%`).limit(1).single();
      if (matched) {
        const newTotal = (matched.stok || 0) + qty;
        pendingActions.set(chatId, {
          action: 'UPDATE_STOCK',
          data: { id: matched.id, name: matched.name, addedQty: qty, newTotal }
        });

        const card = `📥 <b>KONFIRMASI TAMBAH STOK BARANG</b>\n` +
          `──────────────────────────\n` +
          `• <b>Produk:</b> ${matched.name}\n` +
          `• <b>Stok Saat Ini:</b> ${matched.stok} unit\n` +
          `• <b>Jumlah Masuk:</b> +${qty} unit\n` +
          `• <b>Total Akhir:</b> <b>${newTotal} unit</b>\n` +
          `──────────────────────────\n` +
          `<i>Apakah stok fisik barang sudah dicek dan siap disimpan ke kasir?</i>`;

        return { type: 'text', text: card, keyboard: KEYBOARDS.CONFIRMATION };
      }
    }
  }

  // Lihat Semua Produk
  if (lower === '/semua_produk' || lower.includes('semua produk') || lower.includes('daftar produk')) {
    const { data: products } = await supabase.from('products').select('*').order('id', { ascending: true });
    let msg = `📦 <b>DAFTAR MASTER PRODUK & STOK KASIR</b>\n\n`;
    (products || []).forEach((p, idx) => {
      const margin = p.harga - (p.hpp || 0);
      const stockBadge = p.stok <= 5 ? `⚠️ <b>${p.stok} unit</b>` : `${p.stok} unit`;
      msg += `${idx + 1}. <b>${p.name}</b> (${p.category || 'ritel'})\n`;
      msg += `   • Harga: <b>Rp ${p.harga.toLocaleString('id-ID')}</b> (Laba: Rp ${margin.toLocaleString('id-ID')})\n`;
      msg += `   • Sisa Stok: ${stockBadge}\n\n`;
    });
    return { type: 'text', text: msg, keyboard: KEYBOARDS.PRODUK };
  }

  // Stok Menipis
  if (lower === '/stok_menipis' || lower.includes('stok menipis') || lower.includes('stok habis')) {
    const { data: products } = await supabase.from('products').select('*').lte('stok', 5).order('stok', { ascending: true });
    if (!products || products.length === 0) {
      return { type: 'text', text: `📦 <b>INVENTORI AMAN!</b>\n\nSemua stok produk ritel dan oli masih aman di atas 5 unit.`, keyboard: KEYBOARDS.PRODUK };
    }
    let msg = `⚠️ <b>PERINGATAN STOK MENIPIS (≤ 5 UNIT)</b>\n\n`;
    products.forEach((p, idx) => {
      msg += `${idx + 1}. <b>${p.name}</b>: Sisa <b>${p.stok} unit</b> (Rp ${p.harga.toLocaleString('id-ID')})\n`;
    });
    return { type: 'text', text: msg, keyboard: KEYBOARDS.PRODUK };
  }

  // Omset
  if (lower.includes('omset') || lower.includes('pendapatan') || lower === '/menu_omset') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: trxList } = await supabase
      .from('transactions')
      .select('*')
      .gte('created_at', today.toISOString())
      .neq('payment_status', 'ATTENDANCE')
      .neq('branch_id', 'SYSTEM');

    const list = trxList || [];
    const completedList = list.filter(t => t.payment_status === 'COMPLETED');
    const totalOmset = completedList.reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0);
    const totalTrx = completedList.length;
    const cashTrx = completedList.filter(t => (t.payment_method || '').toUpperCase().includes('CASH'));
    const qrisTrx = completedList.filter(t => (t.payment_method || '').toUpperCase().includes('QRIS'));
    const totalCash = cashTrx.reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0);
    const totalQris = qrisTrx.reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0);
    const avgBasket = totalTrx > 0 ? Math.round(totalOmset / totalTrx) : 0;
    const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });

    let msg = `📊 <b>LAPORAN OMSET HARI INI</b>\n`;
    msg += `📍 <b>Cabang:</b> Graha Prima\n`;
    msg += `🕒 <b>Update:</b> ${nowTime} WIB\n\n`;
    msg += `💰 <b>Total Omset:</b> Rp ${totalOmset.toLocaleString('id-ID')}\n`;
    msg += `🧾 <b>Total Transaksi:</b> ${totalTrx} transaksi\n`;
    msg += `🛒 <b>Rata-rata/Nota:</b> Rp ${avgBasket.toLocaleString('id-ID')}\n\n`;
    msg += `<b>Rincian Pembayaran:</b>\n`;
    msg += `💵 <b>Tunai (Cash):</b> Rp ${totalCash.toLocaleString('id-ID')} (${cashTrx.length} trx)\n`;
    msg += `📱 <b>QRIS:</b> Rp ${totalQris.toLocaleString('id-ID')} (${qrisTrx.length} trx)\n`;

    if (totalTrx === 0) {
      msg += `\n<i>Belum ada transaksi pengerjaan yang diselesaikan hari ini.</i>`;
    }
    return { type: 'text', text: msg, keyboard: KEYBOARDS.MAIN };
  }

  // CCTV
  if (lower.includes('cctv') || lower.includes('kamera') || lower.includes('foto') || lower === '/cctv') {
    const { data: latestTrx } = await supabase
      .from('transactions')
      .select('*')
      .neq('branch_id', 'SYSTEM')
      .like('snapshot_url', 'http%')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!latestTrx || !latestTrx.snapshot_url) {
      return {
        type: 'text',
        text: `📹 <i>Belum ada foto snapshot CCTV di database.</i>\n\nBegitu CCTV dan Armbian TV Box di lapangan terpasang, setiap kasir menekan tombol selesai di kasir, foto motor dan pelanggan akan langsung dikirimkan ke sini secara otomatis!`,
        keyboard: KEYBOARDS.MAIN
      };
    }

    const timeStr = new Date(latestTrx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
    const caption = `📹 <b>SNAPSHOT CCTV TRANSAKSI TERAKHIR</b>\n\n` +
      `🧾 <b>ID Transaksi:</b> <code>TRX-${latestTrx.id.slice(0, 8)}</code>\n` +
      `🕒 <b>Waktu:</b> ${timeStr} WIB\n` +
      `📍 <b>Cabang:</b> ${latestTrx.branch_id || 'Graha Prima'}\n` +
      `💰 <b>Total:</b> Rp ${Number(latestTrx.total_amount).toLocaleString('id-ID')} (${latestTrx.payment_method || 'CASH'})\n` +
      `🚦 <b>Status:</b> ${latestTrx.payment_status}`;

    return { type: 'photo', photoUrl: latestTrx.snapshot_url, caption, keyboard: KEYBOARDS.MAIN };
  }

  // Fraud
  if (lower.includes('fraud') || lower.includes('curang') || lower.includes('bocor') || lower === '/fraud') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: fraudAlerts } = await supabase.from('transactions').select('*').gte('created_at', today.toISOString()).eq('payment_status', 'FRAUD_ALERT');
    const { data: devices } = await supabase.from('branch_devices').select('*');
    const totalFraud = (fraudAlerts || []).length;
    const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });

    let msg = `🛡️ <b>AUDIT KEAMANAN & FRAUD SENTINEL</b>\n`;
    msg += `🕒 <b>Status per:</b> ${nowTime} WIB\n\n`;
    if (totalFraud === 0) {
      msg += `✅ <b>KONDISI AMAN (TIDAK ADA KEBOCORAN)</b>\n`;
      msg += `Semua pembukaan katup solenoid terintegrasi 100% dengan transaksi kasir. Tidak ada pengisian angin liar hari ini.\n\n`;
    } else {
      msg += `🚨 <b>PERINGATAN: DITEMUKAN ${totalFraud} INDIKASI KECURANGAN!</b>\n\n`;
    }
    msg += `<b>Status Perangkat IoT:</b>\n`;
    (devices || []).forEach(d => {
      const isOnline = d.last_heartbeat && (new Date().getTime() - new Date(d.last_heartbeat).getTime()) < 30000;
      msg += `• <b>${d.device_code}:</b> ${isOnline ? '🟢 Online' : '🔴 Offline'} (Mode: <code>${d.device_status}</code>)\n`;
    });
    return { type: 'text', text: msg, keyboard: KEYBOARDS.MAIN };
  }

  // Status Mesin
  if (lower.includes('status mesin') || lower.includes('esp32') || lower === '/mesin') {
    const { data: dev } = await supabase.from('branch_devices').select('*').eq('device_code', 'NITRO-01').single();
    if (!dev) return { type: 'text', text: '⚠️ Perangkat NITRO-01 tidak ditemukan.', keyboard: KEYBOARDS.MESIN };
    const diffMs = dev.last_heartbeat ? new Date().getTime() - new Date(dev.last_heartbeat).getTime() : 999999;
    const isOnline = diffMs < 30000;

    let msg = `⚙️ <b>STATUS MESIN NITROGEN (NITRO-01)</b>\n\n`;
    msg += `📶 <b>Koneksi:</b> ${isOnline ? '🟢 Online' : '🔴 Offline'}\n`;
    msg += `🔒 <b>Mode Perangkat:</b> <code>${dev.device_status}</code>\n`;
    msg += `⏱️ <b>Durasi Katup:</b> ${dev.active_duration_seconds} detik\n`;
    msg += `🕒 <b>Heartbeat Terakhir:</b> ${dev.last_heartbeat ? new Date(dev.last_heartbeat).toLocaleTimeString('id-ID') : '-'}\n\n`;
    msg += isOnline ? `<i>Perangkat siap melayani transaksi kasir & bot.</i>` : `<i>Perangkat offline (ESP32 sedang dicabut dari listrik).</i>`;
    return { type: 'text', text: msg, keyboard: KEYBOARDS.MESIN };
  }

  // Kunci Mesin
  if (lower.includes('kunci mesin') || lower.includes('lock') || lower === '/kunci') {
    await supabase.from('branch_devices').update({ device_status: 'LOCKED', updated_at: new Date().toISOString() }).eq('device_code', 'NITRO-01');
    return {
      type: 'text',
      text: `🔒 <b>MESIN BERHASIL DIKUNCI (LOCKED)!</b>\n\nKatup solenoid tidak akan merespons pengisian angin sampai Anda membuka kuncinya kembali.`,
      keyboard: KEYBOARDS.MESIN
    };
  }

  // Buka Kunci
  if (lower.includes('buka kunci') || lower.includes('unlock') || lower === '/buka') {
    await supabase.from('branch_devices').update({ device_status: 'IDLE', updated_at: new Date().toISOString() }).eq('device_code', 'NITRO-01');
    return {
      type: 'text',
      text: `🔓 <b>KUNCI DIBUKA (NORMAL IDLE)!</b>\n\nMesin kembali siap melayani transaksi kasir.`,
      keyboard: KEYBOARDS.MESIN
    };
  }

  // Set Durasi Cepat via Tombol
  if (lower.startsWith('/set_durasi_')) {
    const sec = parseInt(lower.replace('/set_durasi_', '')) || 60;
    await supabase.from('branch_devices').update({ active_duration_seconds: sec, updated_at: new Date().toISOString() }).eq('device_code', 'NITRO-01');
    return {
      type: 'text',
      text: `⏱️ <b>DURASI KATUP BERHASIL DIATUR!</b>\n\n` +
        `Durasi aktif katup solenoid <b>NITRO-01</b> diatur menjadi <b>${sec} detik</b>.\n` +
        `ESP32 akan menggunakan nilai ini saat solenoid diaktifkan.`,
      keyboard: KEYBOARDS.DURASI
    };
  }

  // Set Durasi via Teks: +durasi [detik]
  if (lower.startsWith('+durasi ') || (lower.includes('durasi') && /\d+/.test(lower) && (lower.includes('ubah') || lower.includes('set') || lower.includes('ganti')))) {
    const sec = parseInt(clean.replace(/[^0-9]/g, '')) || 60;
    await supabase.from('branch_devices').update({ active_duration_seconds: sec, updated_at: new Date().toISOString() }).eq('device_code', 'NITRO-01');
    return {
      type: 'text',
      text: `⏱️ <b>SUKSES! DURASI KATUP DIPERBARUI</b>\n\n` +
        `Durasi aktif katup solenoid <b>NITRO-01</b> diubah menjadi <b>${sec} detik</b>.`,
      keyboard: KEYBOARDS.DURASI
    };
  }

  // Tampilkan Informasi Durasi Katup
  if (lower === '/durasi_katup' || lower.includes('durasi katup') || lower === 'durasi') {
    const { data: dev } = await supabase.from('branch_devices').select('*').eq('device_code', 'NITRO-01').single();
    const currentSec = dev?.active_duration_seconds || 0;
    let msg = `⏱️ <b>PENGATURAN DURASI KATUP NITROGEN (ESP32)</b>\n\n`;
    msg += `• <b>Perangkat:</b> NITRO-01 (Graha Prima)\n`;
    msg += `• <b>Durasi Terakhir Tercatat:</b> <b>${currentSec} detik</b>\n\n`;
    msg += `<b>Aturan Standar Otomatis Kasir:</b>\n`;
    msg += `• Tambah Angin Motor: 60 detik / ban\n`;
    msg += `• Isi Baru / Mobil: 120 - 240 detik\n\n`;
    msg += `<i>Anda bisa mengatur durasi katup dengan klik tombol cepat di bawah atau ketik langsung:</i>\n`;
    msg += `<code>+durasi [detik]</code> (contoh: <code>+durasi 90</code>)`;
    return { type: 'text', text: msg, keyboard: KEYBOARDS.DURASI };
  }

  // Kasir Jaga
  if (lower.includes('kasir') || lower.includes('operator') || lower.includes('siapa jaga') || lower === '/kasir') {
    const { data: opConfig } = await supabase.from('transactions').select('snapshot_url').eq('payment_status', 'SYSTEM_CONFIG_OPERATORS').order('created_at', { ascending: false }).limit(1).single();
    let operators = [];
    if (opConfig && opConfig.snapshot_url) {
      try { operators = JSON.parse(opConfig.snapshot_url); } catch (e) {}
    }

    let targetBranch = '';
    if (lower.includes('graha prima') || lower.includes('graha')) targetBranch = 'Graha Prima';
    else if (lower.includes('regency')) targetBranch = 'Regency';
    else if (lower.includes('melasty')) targetBranch = 'Graha Melasty';
    else if (lower.includes('buwek')) targetBranch = 'Buwek';

    let filteredOps = operators;
    if (targetBranch) {
      filteredOps = operators.filter(o => (o.branch || '').toLowerCase().includes(targetBranch.toLowerCase()));
    }

    let msg = `👤 <b>INFORMASI KASIR & OPERATOR AL-KAHFI</b>\n\n`;
    if (targetBranch) msg += `📍 <b>Cabang:</b> ${targetBranch}\n\n`;

    if (filteredOps.length > 0) {
      filteredOps.forEach((op, idx) => {
        msg += `${idx + 1}. <b>${op.name}</b> (${op.role || 'Operator'})\n`;
        msg += `• Cabang: ${op.branch || 'Semua Cabang'}\n`;
        msg += `• PIN: <code>${op.pin}</code>\n\n`;
      });
    } else {
      msg += `<i>Belum ada operator yang terdaftar untuk cabang ini.</i>\n`;
    }
    return { type: 'text', text: msg, keyboard: KEYBOARDS.KARYAWAN };
  }

  // Default Fallback
  return {
    type: 'text',
    text: `🤖 <b>Asisten AI Al-Kahfi v2.0:</b>\n` +
      `Siap Boss! Anda bisa menggunakan menu navigasi di bawah atau gunakan perintah kilat:\n\n` +
      `• <code>+produk Lap Microfiber | 15000 | 8000 | 20</code>\n` +
      `• <code>+harga Tambal Ban 18000</code>\n` +
      `• <code>+stok Oli MPX 24</code>\n` +
      `• <i>"Berapa omset hari ini?"</i>`,
    keyboard: KEYBOARDS.MAIN
  };
}

// ---------------- BACKGROUND DEVOPS SENTINEL ----------------
const devStatusCache = new Map();
let lastDevCheck = 0;

async function checkDevOpsHealth() {
  const now = Date.now();
  if (now - lastDevCheck < 25000) return; // Cek tiap 25 detik
  lastDevCheck = now;

  try {
    const { data: devices } = await supabase.from('branch_devices').select('*');
    if (devices) {
      for (const dev of devices) {
        const code = dev.device_code || 'NITRO-01';
        const lastHb = dev.last_heartbeat ? new Date(dev.last_heartbeat).getTime() : 0;
        const diffSec = Math.round((now - lastHb) / 1000);
        const isOnline = diffSec <= 45;

        const prevState = devStatusCache.get(code);

        // KASUS A: Perangkat baru saja mati / dicabut (ONLINE -> OFFLINE)
        if (prevState === 'ONLINE' && !isOnline) {
          devStatusCache.set(code, 'OFFLINE');
          const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
          const alertMsg = `🚨 <b>[DEV-ALERT: PERANGKAT OFFLINE]</b>\n\n` +
            `• <b>Perangkat:</b> <code>${code}</code> (Graha Prima)\n` +
            `• <b>Waktu Hilang:</b> ${timeStr} WIB\n` +
            `• <b>Durasi:</b> ${diffSec} detik lalu\n` +
            `• <b>Indikasi:</b> Daya listrik dicabut, saklar dimatikan, atau modem Orbit putus sinyal.\n\n` +
            `<i>💡 Info Developer: Perangkat terdeteksi mati sebelum owner menyadarinya.</i>`;
          
          await sendTelegram('sendMessage', {
            chat_id: '7061579608',
            text: alertMsg,
            parse_mode: 'HTML'
          }).catch(() => {});
        }
        // KASUS B: Perangkat kembali nyala (OFFLINE -> ONLINE)
        else if (prevState === 'OFFLINE' && isOnline) {
          devStatusCache.set(code, 'ONLINE');
          const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
          const recoveryMsg = `🟢 <b>[DEV-ALERT: PERANGKAT KEMBALI ONLINE]</b>\n\n` +
            `• <b>Perangkat:</b> <code>${code}</code> (Graha Prima)\n` +
            `• <b>Waktu Pulih:</b> ${timeStr} WIB\n` +
            `• <b>Status:</b> Berhasil reconnect & kirim heartbeat ke Supabase.\n\n` +
            `<i>Sistem operasional nitrogen kembali normal 100%.</i>`;

          await sendTelegram('sendMessage', {
            chat_id: '7061579608',
            text: recoveryMsg,
            parse_mode: 'HTML'
          }).catch(() => {});
        }
        // Cache awal
        else if (!prevState) {
          devStatusCache.set(code, isOnline ? 'ONLINE' : 'OFFLINE');
        }
      }
    }
  } catch (err) {
    // Abaikan error jaringan sementara
  }
}

async function startPolling() {
  console.log("🚀 Menghapus webhook lama untuk beralih ke Long Polling v2.0...");
  await sendTelegram('deleteWebhook', { drop_pending_updates: false });

  console.log("✅ Bot AI Al-Kahfi v2.0 (Executive Execution Engine + DevOps Sentinel) AKTIF!");
  let offset = 0;

  while (true) {
    try {
      // Jalankan Sentinel Pengawas Hardware Lapangan
      checkDevOpsHealth().catch(() => {});

      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=20`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.result.length > 0) {
          for (const update of data.result) {
            offset = update.update_id + 1;

            let chatId = null;
            let text = '';
            let fromName = 'Boss';

            if (update.message) {
              chatId = update.message.chat.id;
              text = update.message.text || '';
              fromName = update.message.from.first_name || 'Boss';
            } else if (update.callback_query) {
              chatId = update.callback_query.message.chat.id;
              text = update.callback_query.data || '';
              fromName = update.callback_query.from.first_name || 'Boss';
              sendTelegram('answerCallbackQuery', { callback_query_id: update.callback_query.id }).catch(() => {});
            }

            if (chatId && text) {
              console.log(`📩 Pesan dari ${fromName} (${chatId}): "${text}"`);
              sendTelegram('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});

              const reply = await handleMessage(text, fromName, chatId);
              const kb = reply.keyboard || KEYBOARDS.MAIN;

              if (reply.type === 'photo' && reply.photoUrl) {
                const photoRes = await sendTelegram('sendPhoto', {
                  chat_id: chatId,
                  photo: reply.photoUrl,
                  caption: reply.caption,
                  parse_mode: 'HTML',
                  reply_markup: kb
                });
                if (!photoRes.ok) {
                  await sendTelegram('sendMessage', {
                    chat_id: chatId,
                    text: reply.caption || reply.text,
                    parse_mode: 'HTML',
                    reply_markup: kb
                  });
                }
              } else {
                await sendTelegram('sendMessage', {
                  chat_id: chatId,
                  text: reply.text,
                  parse_mode: 'HTML',
                  reply_markup: kb
                });
              }
              console.log(`📤 Sukses membalas ke ${fromName}`);
            }
          }
        }
      }
    } catch (e) {
      console.error("Polling error:", e.message);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

startPolling();
