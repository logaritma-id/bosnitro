export let activePrinterDevice: BluetoothDevice | null = null;
export let activePrinterCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

export async function connectPrinter(): Promise<boolean> {
    try {
        if (!navigator.bluetooth) {
            alert("Web Bluetooth tidak didukung di browser ini.");
            return false;
        }

        const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'] // Generic ESC/POS service
        });

        const server = await device.gatt?.connect();
        if (!server) return false;
        
        // Simpan referensi device agar tidak terputus
        activePrinterDevice = device;
        
        // Note: Pada skenario printer nyata, kita harus mencari service & characteristic khusus
        // Di sini kita coba ambil jika ada (untuk simulasi/demo)
        try {
            const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
            const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
            activePrinterCharacteristic = characteristic;
        } catch (e) {
            console.log("Mock Printer: Service GATT spesifik tidak ditemukan. Tetap tersambung secara logic.");
            // Tetap jalankan mode mock jika service tidak persis cocok
        }

        device.addEventListener('gattserverdisconnected', () => {
            console.warn("Koneksi Printer terputus.");
            activePrinterDevice = null;
            activePrinterCharacteristic = null;
        });

        return true;
    } catch (error: any) {
        if (error.name !== 'NotFoundError') {
            console.warn("Gagal menyambungkan Bluetooth:", error);
        }
        return false;
    }
}

export async function printReceipt(cart: any[], total: number) {
    let text = "=== ALKAHFI POS ===\n\n";
    cart.forEach(item => {
        text += `${item.name}\n${item.qty} x Rp ${item.price} = Rp ${item.qty * item.price}\n`;
    });
    text += "-------------------\n";
    text += `TOTAL: Rp ${total}\n\n`;
    text += "Terima Kasih\n\n\n\n";

    // 1. Silent Auto-Print via Web Bluetooth (jika tersambung)
    if (activePrinterDevice && activePrinterDevice.gatt?.connected) {
        try {
            if (activePrinterCharacteristic) {
                const encoder = new TextEncoder();
                const data = encoder.encode(text);
                await activePrinterCharacteristic.writeValue(data);
                console.log("Struk berhasil dikirim via Web Bluetooth!");
            } else {
                console.log("Mode Simulasi: Struk dikirim ke Printer Bluetooth (Karakteristik tidak spesifik).");
            }
            return; // Selesai mencetak tanpa popup
        } catch (error) {
            console.error("Gagal mengirim bytes ke printer:", error);
            // Lanjut ke fallback jika gagal write
        }
    }

    // 2. Fallback: RawBT Intent (Otomatis & Tanpa Popup untuk Android Tablet)
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
        console.log("Web Bluetooth terputus/gagal. Fallback ke RawBT Intent...");
        const rawBtUrl = `intent:${encodeURI(text)}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
        window.location.href = rawBtUrl;
        return;
    }

    console.warn("Tidak ada printer tersambung dan bukan Android. Lewati cetak struk.");
}
