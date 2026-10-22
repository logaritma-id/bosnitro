#!/usr/bin/env python3
"""
=============================================================================
AL-KAHFI CCTV & POS EDGE BRIDGE (Untuk Armbian TV Box ANT 02)
=============================================================================
Fungsi:
1. Mendengarkan (listen) transaksi baru di cabang ini secara real-time.
2. Saat ada transaksi COMPLETED, script langsung mengambil 1 frame dari RTSP CCTV lokal (hanya ~100ms).
3. Mengunggah snapshot ke Cloudinary dan menyimpan URL-nya ke database Supabase.
4. Mengirimkan foto bukti transaksi + rincian nota langsung ke Bot Telegram Owner.
=============================================================================
"""

import os
import sys
import time
import subprocess
import requests
import json
from datetime import datetime

# ================= KREDENSIAL & KONFIGURASI =================
# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://qxvgciwufwvchgfapjyk.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4dmdjaXd1Znd2Y2hnZmFwanlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NTg0MDUsImV4cCI6MjEwNzAzNDQwNX0.K_TtTLNO3STcq-VbqjeQ_cZ0ua-QKZBoK1jAu9ZcDmU")

# Cloudinary
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "y1dqh5nu")
CLOUDINARY_UPLOAD_PRESET = os.getenv("CLOUDINARY_UPLOAD_PRESET", "pos_kasir")

# Telegram Bot Owner
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "-10023481920")

# Cabang & CCTV
BRANCH_NAME = os.getenv("BRANCH_NAME", "Graha Prima")
# Format RTSP: rtsp://username:password@IP_CCTV:554/stream1
RTSP_URL = os.getenv("RTSP_URL", "rtsp://admin:admin@192.168.8.100:554/stream1")

TEMP_PHOTO_PATH = "/tmp/cctv_snapshot.jpg"

def log(msg):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{now}] {msg}", flush=True)

def capture_cctv_frame():
    """Mengambil 1 frame dari CCTV via RTSP lokal menggunakan ffmpeg"""
    try:
        if os.path.exists(TEMP_PHOTO_PATH):
            os.remove(TEMP_PHOTO_PATH)

        # Ambil 1 frame cepat tanpa re-encode berat
        cmd = [
            "ffmpeg", "-y",
            "-rtsp_transport", "tcp",
            "-i", RTSP_URL,
            "-vframes", "1",
            "-q:v", "2",
            TEMP_PHOTO_PATH
        ]
        
        # Eksekusi dengan batas waktu maksimal 3 detik
        res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=3)
        if res.returncode == 0 and os.path.exists(TEMP_PHOTO_PATH):
            return TEMP_PHOTO_PATH
    except Exception as e:
        log(f"⚠️ Gagal capture CCTV via ffmpeg: {e}")
    return None

def upload_to_cloudinary(file_path):
    """Mengunggah foto hasil jepretan ke Cloudinary Free Tier"""
    try:
        url = f"https://api.cloudinary.com/v1_1/{CLOUDINARY_CLOUD_NAME}/image/upload"
        with open(file_path, 'rb') as f:
            files = {'file': f}
            data = {'upload_preset': CLOUDINARY_UPLOAD_PRESET}
            r = requests.post(url, files=files, data=data, timeout=10)
            if r.status_code == 200:
                res_json = r.json()
                return res_json.get("secure_url")
    except Exception as e:
        log(f"⚠️ Gagal upload ke Cloudinary: {e}")
    return None

def send_telegram_alert(photo_path, trx):
    """Mengirim foto dan rincian transaksi ke Telegram Bot Owner"""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return

    try:
        trx_id = trx.get("id", "")[:8]
        amount = int(float(trx.get("total_amount", 0)))
        method = trx.get("payment_method", "CASH")
        branch = trx.get("branch_id", BRANCH_NAME)

        caption = (
            f"🔔 <b>TRANSAKSI BARU SELESAI</b>\n\n"
            f"🧾 <b>No Nota:</b> <code>TRX-{trx_id}</code>\n"
            f"📍 <b>Cabang:</b> {branch}\n"
            f"💰 <b>Total:</b> Rp {amount:,} ({method})\n"
            f"🕒 <b>Waktu:</b> {datetime.now().strftime('%H:%M:%S')} WIB\n\n"
            f"<i>📸 Snapshot otomatis dari CCTV POS</i>"
        ).replace(",", ".")

        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendPhoto"
        with open(photo_path, 'rb') as photo_file:
            files = {'photo': photo_file}
            data = {
                'chat_id': TELEGRAM_CHAT_ID,
                'caption': caption,
                'parse_mode': 'HTML'
            }
            requests.post(url, files=files, data=data, timeout=10)
            log("✅ Sukses kirim foto snapshot ke Telegram Owner!")
    except Exception as e:
        log(f"⚠️ Gagal kirim ke Telegram: {e}")

def update_supabase_snapshot(trx_id, photo_url):
    """Update URL foto ke baris transaksi di Supabase agar muncul di Dashboard Owner"""
    try:
        url = f"{SUPABASE_URL}/rest/v1/transactions?id=eq.{trx_id}"
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        }
        body = {"snapshot_url": photo_url}
        requests.patch(url, headers=headers, json=body, timeout=5)
    except Exception as e:
        log(f"⚠️ Gagal update snapshot_url ke Supabase: {e}")

def main():
    log(f"🚀 Memulai Al-Kahfi CCTV Edge Bridge untuk cabang: {BRANCH_NAME}...")
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }

    # Set untuk melacak ID transaksi yang sudah diproses agar tidak duplikat
    processed_ids = set()

    # Ambil 5 transaksi terakhir saat startup agar tidak memotret ulang transaksi lama
    try:
        init_url = f"{SUPABASE_URL}/rest/v1/transactions?select=id&order=created_at.desc&limit=5"
        r = requests.get(init_url, headers=headers, timeout=5)
        if r.status_code == 200:
            for item in r.json():
                processed_ids.add(item["id"])
    except Exception:
        pass

    log("✅ Edge Bridge Standby 24/7 mendengarkan transaksi...")

    while True:
        try:
            # Polling transaksi terbaru setiap 1.5 detik
            query_url = (
                f"{SUPABASE_URL}/rest/v1/transactions"
                f"?select=id,total_amount,payment_status,payment_method,branch_id,created_at,snapshot_url"
                f"&payment_status=eq.COMPLETED"
                f"&order=created_at.desc&limit=2"
            )
            res = requests.get(query_url, headers=headers, timeout=5)
            if res.status_code == 200:
                transactions = res.json()
                for trx in transactions:
                    t_id = trx.get("id")
                    # Jika ada transaksi baru yang belum diproses dan belum ada snapshot
                    if t_id and t_id not in processed_ids and not trx.get("snapshot_url"):
                        processed_ids.add(t_id)
                        log(f"📸 Transaksi baru terdeteksi (TRX-{t_id[:8]}), menjepret CCTV...")

                        # 1. Capture 1 frame dari CCTV
                        photo = capture_cctv_frame()
                        if photo:
                            # 2. Kirim ke Telegram Owner
                            send_telegram_alert(photo, trx)

                            # 3. Upload ke Cloudinary & Update Supabase
                            cloud_url = upload_to_cloudinary(photo)
                            if cloud_url:
                                update_supabase_snapshot(t_id, cloud_url)
                                log(f"✅ Foto tersimpan di Cloudinary & Dashboard: {cloud_url}")
                        else:
                            log("⚠️ Kamera tidak merespons / RTSP offline.")

        except Exception as err:
            log(f"Loop error: {err}")

        time.sleep(1.5)

if __name__ == "__main__":
    main()
