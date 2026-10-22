# PANDUAN CEPAT SETUP CCTV & ARMBIAN TV BOX DI LAPANGAN

Panduan ini digunakan saat Anda atau Owner berada di lokasi gerai bersama perangkat:
1. Telkomsel Orbit Router
2. POE Switch (`LS-DS0402A-DP6`)
3. Kamera CCTV IP
4. Armbian TV Box (`ANT 02`)

---

## 1. Sambungan Kabel Fisik (Selesai dalam 2 Menit)
1. Colok kabel power Telkomsel Orbit dan tunggu sampai lampu indikator biru menyala (Internet aktif).
2. Colok kabel power POE Switch (Lampu indikator 52V menyala).
3. Sambungkan kabel LAN dari **Port LAN Orbit** ke **Port Uplink 1 POE Switch**.
4. Sambungkan kabel LAN dari **Kamera CCTV IP** ke **Port POE (Port 1) pada POE Switch**.
5. Sambungkan kabel LAN dari **Armbian TV Box (`ANT 02`)** ke **Port Uplink 2 POE Switch** (atau port LAN Orbit).
6. Colok adaptor daya Armbian TV Box.

---

## 2. Pemasangan Program di Armbian TV Box (Cukup Sekali Saja)

Hubungkan laptop Anda ke WiFi Orbit yang sama, lalu buka terminal / CMD:

### A. Masuk ke Armbian TV Box via SSH:
```bash
ssh root@192.168.8.xxx
# Masukkan password armbian (default: 1234 atau root)
```
*(Catatan: Anda bisa melihat IP Armbian dan IP CCTV di dashboard Orbit: `192.168.8.1` pada menu Perangkat Terhubung)*

### B. Install library pendukung (hanya butuh 1 menit):
```bash
apt-get update && apt-get install -y python3 python3-pip ffmpeg
pip3 install requests
```

### C. Pasang Script Otomatis:
```bash
mkdir -p /root/cctv_bridge
# Copy file cctv_bridge.py ke dalam folder tersebut
```

### D. Pasang Auto-Start (Systemd) agar jalan otomatis saat dicolok listrik:
```bash
cp alkahfi-cctv.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable alkahfi-cctv
systemctl start alkahfi-cctv
```

Untuk cek statusnya:
```bash
systemctl status alkahfi-cctv
```

---

## 3. Uji Coba (Live Test)
1. Lakukan transaksi di Kasir (Rp 5.000 / Isi Angin).
2. Klik **"Selesaikan Pembayaran"**.
3. Struk tercetak di printer thermal.
4. Dalam 1–2 detik, foto CCTV motor/pelanggan otomatis:
   - Terkirim ke Bot Telegram Owner.
   - Muncul di Dashboard Owner pada tab **Audit CCTV**.
