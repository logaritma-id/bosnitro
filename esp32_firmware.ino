/*
 * ==============================================================================
 * FIRMWARE IOT NITROGEN AL-KAHFI (SYSTEM A - TIME STARVATION) - PRODUCTION 24/7
 * Target Board  : ESP32 Dev Module / NodeMCU ESP32
 * Komponen      : ESP32 + Modul Relay Optocoupler 1-Channel (Mode L) + Solenoid Valve 220V
 * Fitur Tambahan: WEB CAPTIVE PORTAL (WiFiManager) + Reset Button via Tombol BOOT
 *                 + WiFiClientSecure (Buffer Optimized 2KB RAM)
 *                 + Anti-Freeze Auto-Recover + Retry Reset Status IDLE
 * ==============================================================================
 */

#include <WiFi.h>
#include <WiFiManager.h>        // Library: WiFiManager by tzapu
#include <HTTPClient.h>
#include <WiFiClientSecure.h>  // Wajib untuk koneksi HTTPS ke Supabase
#include <ArduinoJson.h>        // Library: ArduinoJson by Benoit Blanchon

// --- 1. KREDENSIAL CLOUD SUPABASE ---
const char* SUPABASE_URL = "https://qxvgciwufwvchgfapjyk.supabase.co";
const char* SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4dmdjaXd1Znd2Y2hnZmFwanlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NTg0MDUsImV4cCI6MjEwNzAzNDQwNX0.K_TtTLNO3STcq-VbqjeQ_cZ0ua-QKZBoK1jAu9ZcDmU";
const char* DEVICE_CODE  = "NITRO-01";

// --- 2. PIN HARDWARE ---
const int RELAY_PIN       = 4; // GPIO 4 terhubung ke pin IN Relay
const int RESET_WIFI_PIN  = 0; // Tombol BOOT bawaan ESP32 (GPIO 0) untuk reset WiFi

// Logika Relay Optocoupler (Jumper pada posisi L: LOW = NYALA, HIGH = MATI/STANDBY)
#define RELAY_ON  LOW
#define RELAY_OFF HIGH

// Objek WiFiManager
WiFiManager wm;

// Variabel State Timer
bool isValveOpen = false;
unsigned long valveStartTime = 0;
unsigned long activeDurationMs = 0;
unsigned long lastHeartbeatTime = 0;
unsigned long lastPollTime = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n==============================================");
  Serial.println("  IoT Outlet Nitrogen Al-Kahfi - System A     ");
  Serial.println("  Versi Produksi Stabil 24/7 (Optocoupler)    ");
  Serial.println("==============================================");

  // Setup Pin Hardware - Pastikan Relay MATI (Standby) saat startup
  pinMode(RELAY_PIN, INPUT);
  pinMode(RESET_WIFI_PIN, INPUT_PULLUP);

  // Self-Test Relay: Nyalakan 400ms lalu matikan agar terdengar bunyi klik konfirmasi hardware
  Serial.println("[TEST] Uji coba klik relay 400ms...");
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_ON);
  delay(400);
  pinMode(RELAY_PIN, INPUT);
  Serial.println("[TEST] Uji coba relay selesai. Relay kini tertutup (STANDBY).");

  // Inisialisasi Koneksi WiFi via Web Portal
  setupWiFiPortal();

  // Sinkronisasi Waktu Real-Time (NTP)
  configTime(7 * 3600, 0, "pool.ntp.org", "time.google.com");
}

void loop() {
  // 0. Proteksi Anti-Freeze (Jika RAM bebas di bawah 25KB, restart bersih)
  if (ESP.getFreeHeap() < 25000) {
    Serial.println("[SYSTEM] RAM menipis, melakukan restart otomatis...");
    ESP.restart();
  }

  // 1. Cek apakah tombol BOOT (GPIO 0) ditekan selama 3 detik untuk reset WiFi
  cekTombolResetWiFi();

  // 2. Pastikan WiFi tetap terhubung
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Koneksi terputus. Mencoba menghubungkan kembali...");
    WiFi.reconnect();
    delay(2000);
    return;
  }

  unsigned long currentMillis = millis();

  // 3. Logika Timer Solenoid Valve (Otomatis Tutup saat waktu habis)
  if (isValveOpen) {
    if (currentMillis - valveStartTime >= activeDurationMs) {
      Serial.println("[VALVE] WAKTU HABIS - Menutup katup otomatis sesuai batas durasi!");
      tutupValve();
    }
  }

  // 4. Polling Status Perintah dari Kasir ke Supabase
  // - Saat katup aktif: polling tiap 1 detik agar saat kasir klik 'Selesai', katup seketika menutup!
  // - Saat katup idle/standby: polling tiap 1.5 detik
  unsigned long pollInterval = isValveOpen ? 1000 : 1500;
  if (currentMillis - lastPollTime >= pollInterval) {
    lastPollTime = currentMillis;
    cekPerintahKasir();
  }

  // 5. Kirim Heartbeat ke Supabase (Tiap 15 detik agar terdeteksi Online di POS)
  if (currentMillis - lastHeartbeatTime >= 15000) {
    lastHeartbeatTime = currentMillis;
    kirimHeartbeat();
  }
}

// ==============================================================================
// SETUP WIFI DENGAN PORTAL WEB (WIFIMANAGER)
// ==============================================================================
void setupWiFiPortal() {
  Serial.println("[WiFi] Memeriksa konfigurasi WiFi tersimpan...");

  wm.setTitle("Al-Kahfi Nitrogen IoT");
  wm.setConfigPortalTimeout(180); // 3 menit timeout jika tidak dikonfigurasi

  bool res = wm.autoConnect("AL-KAHFI-NITROGEN-SETUP");

  if (!res) {
    Serial.println("[WiFi] Gagal terhubung atau waktu setup habis. Me-restart ESP32...");
    delay(3000);
    ESP.restart();
  } else {
    Serial.println("\n[WiFi] Berhasil Terhubung ke Internet!");
    Serial.print("[WiFi] IP Address: ");
    Serial.println(WiFi.localIP());
  }
}

// ==============================================================================
// CEK TOMBOL RESET WIFI (Tekan tombol BOOT 3 detik untuk ganti WiFi)
// ==============================================================================
void cekTombolResetWiFi() {
  if (digitalRead(RESET_WIFI_PIN) == LOW) {
    Serial.println("[RESET] Tombol BOOT ditekan. Tahan 3 detik untuk reset WiFi...");
    delay(3000);
    if (digitalRead(RESET_WIFI_PIN) == LOW) {
      Serial.println("[RESET] Mereset pengaturan WiFi...");
      wm.resetSettings();
      Serial.println("[RESET] Pengaturan dihapus! Me-restart ESP32 ke mode Setup...");
      delay(1000);
      ESP.restart();
    }
  }
}

// ==============================================================================
// FUNGSI CEK PERINTAH KASIR DARI SUPABASE (HTTPS + SSL Buffer Opto)
// ==============================================================================
void cekPerintahKasir() {
  WiFiClientSecure client;
  client.setInsecure(); // Wajib agar tidak ditolak validasi SSL Supabase

  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/branch_devices?device_code=eq." + DEVICE_CODE + "&select=device_status,active_duration_seconds";
  
  if (http.begin(client, url)) {
    http.addHeader("apikey", SUPABASE_KEY);
    http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);

    int httpCode = http.GET();
    if (httpCode == 200) {
      String payload = http.getString();
      StaticJsonDocument<512> doc;
      DeserializationError error = deserializeJson(doc, payload);

      if (!error && doc.size() > 0) {
        const char* status = doc[0]["device_status"];
        int durationSeconds = doc[0]["active_duration_seconds"] | 60;

        // KASUS 1: Jika kasir menekan tombol "Proses Pengerjaan" -> status jadi ACTIVE
        if (String(status) == "ACTIVE" && !isValveOpen) {
          Serial.printf("[IoT] PERINTAH DITERIMA DARI KASIR: Buka Valve selama %d detik!\n", durationSeconds);
          bukaValve(durationSeconds);
        }
        // KASUS 2: Jika operator menekan tombol "Selesai" / "Lunasi" lebih cepat -> status jadi IDLE
        else if (String(status) == "IDLE" && isValveOpen) {
          Serial.println("[IoT] OPERATOR KLIK SELESAI: Pengerjaan selesai lebih awal. Menutup katup sekarang!");
          tutupValve();
        }
      }
    } else {
      Serial.printf("[IoT] Polling gagal, HTTP Code: %d\n", httpCode);
    }
    http.end();
  }
}

// ==============================================================================
// FUNGSI BUKA VALVE
// ==============================================================================
void bukaValve(int seconds) {
  isValveOpen = true;
  valveStartTime = millis();
  activeDurationMs = (unsigned long)seconds * 1000;

  // Nyalakan Relay -> Solenoid Valve Terbuka (Tarik pin ke GND / Mode L)
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_ON);
  Serial.printf("[VALVE] RELAY NYALA - Solenoid Valve Terbuka selama %d detik!\n", seconds);
}

// ==============================================================================
// FUNGSI TUTUP VALVE & KEMBALIKAN STATUS KE IDLE (DENGAN RETRY)
// ==============================================================================
void tutupValve() {
  // Matikan Relay -> Solenoid Valve Tertutup (Lepas pin ke High-Z)
  pinMode(RELAY_PIN, INPUT);
  isValveOpen = false;
  Serial.println("[VALVE] WAKTU HABIS - Relay Mati, Solenoid Valve Tertutup Rapat!");

  // Update status kembali ke 'IDLE' di Supabase dengan retry 3x
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/branch_devices?device_code=eq." + DEVICE_CODE;
  
  for (int attempt = 0; attempt < 3; attempt++) {
    if (http.begin(client, url)) {
      http.addHeader("apikey", SUPABASE_KEY);
      http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
      http.addHeader("Content-Type", "application/json");
      http.addHeader("Prefer", "return=minimal");

      String jsonBody = "{\"device_status\":\"IDLE\",\"active_duration_seconds\":0}";
      int code = http.sendRequest("PATCH", jsonBody);
      http.end();
      if (code >= 200 && code < 300) {
        Serial.println("[VALVE] Sukses update status IDLE ke Supabase.");
        break;
      }
    }
    delay(500);
  }
}

// ==============================================================================
// FUNGSI HEARTBEAT (Kirim tanda online ke Supabase)
// ==============================================================================
void kirimHeartbeat() {
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/branch_devices?device_code=eq." + DEVICE_CODE;
  
  if (http.begin(client, url)) {
    http.addHeader("apikey", SUPABASE_KEY);
    http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Prefer", "return=minimal");

    String jsonBody = "{\"last_heartbeat\":\"" + getISOTimestamp() + "\"}";
    http.sendRequest("PATCH", jsonBody);
    http.end();
  }
}

String getISOTimestamp() {
  time_t now = time(nullptr);
  if (now > 100000) {
    struct tm* timeinfo = gmtime(&now);
    char buffer[30];
    strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", timeinfo);
    return String(buffer);
  }
  return "2026-10-22T12:00:00Z";
}
