"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { uploadSnapshot } from "@/lib/cloudinary";
import { printReceipt, connectPrinter, activePrinterDevice } from "@/lib/print";
import { Camera, Printer, ShoppingCart, Info, ScanLine, User, MapPin, Wifi, Bluetooth, Plus, Minus, Trash2, XCircle, RefreshCcw, Video, ChevronLeft, Wrench, CheckCircle, Lock, Unlock, LogOut } from "lucide-react";

import { getProducts, getOperators, getBranches } from "@/lib/localDb";

type Product = {
  id: string | number;
  name: string;
  harga: number;
  img?: string;
  category?: string;
};

export default function KasirPage() {
  const [activeTab, setActiveTab] = useState<"nitrogen" | "retail">("nitrogen");
  const [cart, setCart] = useState<(Product & { qty: number })[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  
  // Mobile View State
  const [mobileView, setMobileView] = useState<"products" | "cart">("products");
  
  // Auth & Shift States
  const [appState, setAppState] = useState<"login" | "open_shift" | "pos" | "close_shift">("login");
  const [operator, setOperator] = useState<{name: string, id: string} | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [startingCash, setStartingCash] = useState(0);
  const [actualEndingCash, setActualEndingCash] = useState(0);
  const [shiftStats, setShiftStats] = useState({ cash: 0, qris: 0, trxCount: 0 });
  
  // States
  const [checkoutStep, setCheckoutStep] = useState<"cart" | "payment">("cart");
  const [pendingTrxId, setPendingTrxId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "QRIS">("CASH");
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [iotStatus, setIotStatus] = useState<"Online" | "Offline">("Offline");
  const [showIotPrompt, setShowIotPrompt] = useState(false);
  const [showIgnoreReason, setShowIgnoreReason] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<"Loading" | "Ready" | "Error">("Loading");
  const [vehicleType, setVehicleType] = useState<"motor" | "mobil" | null>(null);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [branchName, setBranchName] = useState("");

  useEffect(() => {
    setProducts(getProducts());
    const savedBranches = getBranches();
    if (savedBranches && savedBranches.length > 0) {
      setBranchName(savedBranches[0].name);
    }
    
    // Broadcast listener for live DB updates
    const channel = new BroadcastChannel('pos_demo_channel');
    channel.onmessage = (event) => {
      if (event.data.type === 'DB_UPDATE') {
        if (event.data.payload.entity === 'products') setProducts(getProducts());
        if (event.data.payload.entity === 'branchStats') {
          const branches = getBranches();
          if (branches && branches.length > 0) setBranchName(branches[0].name);
        }
      }
    };
    return () => channel.close();
  }, []);
  const [lastCart, setLastCart] = useState<any[] | null>(null);
  const [lastTotal, setLastTotal] = useState<number>(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const loginVideoRef = useRef<HTMLVideoElement>(null);

  // Cek Status Printer Periodik
  useEffect(() => {
    const interval = setInterval(() => {
      setPrinterConnected(!!(activePrinterDevice && activePrinterDevice.gatt?.connected));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleConnectPrinter = async () => {
    const success = await connectPrinter();
    setPrinterConnected(success);
  };

  // Setup Camera for background snapshot
  useEffect(() => {
    setCameraStatus("Ready");
    setIotStatus("Online");
  }, []);

  // Live Camera Feed for Login Attendance
  useEffect(() => {
    let stream: MediaStream | null = null;
    let isMounted = true;
    
    if (appState === "login") {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
        .then(s => {
          if (!isMounted) {
            s.getTracks().forEach(t => t.stop());
            return;
          }
          stream = s;
          if (loginVideoRef.current) {
            loginVideoRef.current.srcObject = s;
            // Dihapus: loginVideoRef.current.play().catch(console.error);
            // Browser akan play otomatis karena ada attribute autoPlay
          }
        }).catch(err => console.log("Login camera error:", err));
    }
    
    return () => {
      isMounted = false;
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [appState]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) => prev.map(item => {
      if (item.id === id) {
        const newQty = item.qty + delta;
        return { ...item, qty: newQty > 0 ? newQty : 0 };
      }
      return item;
    }).filter(item => item.qty > 0));
  };

  const removeItem = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    if (confirm("Kosongkan keranjang?")) {
      setCart([]);
      setCashReceived(0);
      setMobileView("products");
    }
  };

  const reprintLastReceipt = async () => {
    if (!lastCart || lastCart.length === 0) {
      alert("Belum ada transaksi sebelumnya untuk dicetak ulang.");
      return;
    }
    await printReceipt(lastCart, lastTotal);
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.harga || 0) * item.qty, 0);
  const kembalian = paymentMethod === "CASH" ? Math.max(0, cashReceived - totalAmount) : 0;
  
  // Hitung jumlah ban untuk Nitrogen
  const nitrogenQty = cart.filter(c => c.name.toLowerCase().includes('isi') || c.name.toLowerCase().includes('tambal') || c.name.toLowerCase().includes('nitrogen')).reduce((sum, item) => sum + item.qty, 0);
  const iotDurationSeconds = nitrogenQty * 120; // 120 detik per ban

  const capturePhoto = async (): Promise<string | null> => {
    try {
      setCameraStatus("Loading");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      
      return new Promise((resolve) => {
        const video = document.createElement("video");
        video.srcObject = stream;
        video.play();
        
        video.onplaying = () => {
          setTimeout(() => {
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext("2d")?.drawImage(video, 0, 0);
            
            stream.getTracks().forEach(track => track.stop());
            setCameraStatus("Ready");
            
            resolve(canvas.toDataURL("image/jpeg", 0.7));
          }, 500);
        };
      });
    } catch (err) {
      console.log("Kamera gagal diakses:", err);
      setCameraStatus("Error");
      return null;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    const ops = getOperators();
    const found = ops.find((op: any) => op.pin === pinInput);
    if (found) {
      // Capture attendance photo
      try {
        if (loginVideoRef.current) {
          const canvas = document.createElement("canvas");
          canvas.width = loginVideoRef.current.videoWidth || 640;
          canvas.height = loginVideoRef.current.videoHeight || 480;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(loginVideoRef.current, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
            // Non-blocking upload
            uploadSnapshot(dataUrl).catch(console.error);
          }
        }
      } catch (err) {
        console.error("Gagal foto absensi:", err);
      }
      
      setOperator({ id: found.id, name: found.name });
      setBranchName(found.branch);
      setPinInput("");
      setAppState("open_shift");
    } else {
      alert("PIN Salah! Coba lagi.");
      setPinInput("");
    }
    setIsProcessing(false);
  };

  const handleOpenShift = (e: React.FormEvent) => {
    e.preventDefault();
    setAppState("pos");
  };

  const handleCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    const systemEndingCash = startingCash + shiftStats.cash;
    const selisih = actualEndingCash - systemEndingCash;
    
    // --- Broadcast Shift Event for Demo ---
    try {
      const channel = new BroadcastChannel('pos_demo_channel');
      channel.postMessage({
        type: 'CLOSE_SHIFT',
        payload: {
          shiftReport: {
            id: `SH-${Math.floor(1000 + Math.random() * 9000)}`,
            date: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + " " + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            cashier: operator?.name || "Kasir Utama",
            branch: "Tambun 1",
            modal: startingCash,
            system: systemEndingCash,
            physical: actualEndingCash,
            selisih: selisih
          }
        }
      });
      channel.close();
    } catch (err) {
      console.error("Broadcast failed:", err);
    }
    // ------------------------------------

    alert(`Shift Ditutup!\nTotal Transaksi: ${shiftStats.trxCount}\nTotal QRIS: Rp ${shiftStats.qris.toLocaleString('id-ID')}\nSistem Tunai: Rp ${systemEndingCash.toLocaleString('id-ID')}\nFisik Tunai: Rp ${actualEndingCash.toLocaleString('id-ID')}\nSelisih: Rp ${selisih.toLocaleString('id-ID')}`);
    
    setAppState("login");
    setOperator(null);
    setShiftStats({ cash: 0, qris: 0, trxCount: 0 });
    setStartingCash(0);
    setActualEndingCash(0);
  };

  const handleStartPengerjaan = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    
    try {
      let snapshotUrl = "";
      const photoDataUrl = await capturePhoto();
      if (photoDataUrl) {
        snapshotUrl = await uploadSnapshot(photoDataUrl);
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (supabaseUrl && supabaseUrl !== 'https://mock.supabase.co') {
        const { data: trxData, error: trxError } = await supabase
          .from('transactions')
          .insert({
            total_amount: totalAmount,
            payment_status: 'PENDING',
            snapshot_url: snapshotUrl,
            branch_id: 'd0e659b9-0c62-4015-ab1b-265de35bfcd1'
          })
          .select()
          .single();
          
        if (trxError) throw trxError;
        setPendingTrxId(trxData.id);

        if (nitrogenQty > 0) {
          await supabase
            .from('branch_devices')
            .update({
              device_status: 'ACTIVE',
              active_duration_seconds: iotDurationSeconds,
              last_heartbeat: new Date().toISOString()
            })
            .eq('device_code', 'NITRO-01');
        }
      } else {
        console.log("ℹ️ Mode Demo: Transaksi disimpan lokal sebagai PENDING.");
        setPendingTrxId("demo-trx-id");
      }

      setCheckoutStep("payment");
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan saat memulai pengerjaan.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelesaikanPembayaran = async () => {
    if (paymentMethod === "CASH" && cashReceived < totalAmount) {
      alert("Uang diterima kurang dari total belanja!");
      return;
    }

    setIsProcessing(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (supabaseUrl && supabaseUrl !== 'https://mock.supabase.co' && pendingTrxId && pendingTrxId !== "demo-trx-id") {
        const { error: updateError } = await supabase
          .from('transactions')
          .update({
             payment_method: paymentMethod,
             payment_status: 'COMPLETED'
          })
          .eq('id', pendingTrxId);
          
        if (updateError) throw updateError;
      }

      await printReceipt(cart, totalAmount);
      setPrinterConnected(true);
      
      setLastCart([...cart]);
      setLastTotal(totalAmount);
      
      // Update Shift Stats
      setShiftStats(prev => ({
        ...prev,
        trxCount: prev.trxCount + 1,
        cash: paymentMethod === "CASH" ? prev.cash + totalAmount : prev.cash,
        qris: paymentMethod === "QRIS" ? prev.qris + totalAmount : prev.qris
      }));

      // --- Broadcast Event for Realtime Demo to Owner Dashboard ---
      try {
        const channel = new BroadcastChannel('pos_demo_channel');
        channel.postMessage({
          type: 'NEW_TRANSACTION',
          payload: {
            id: `TRX-${Math.floor(1000 + Math.random() * 9000)}`,
            time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            branch: "Tambun 1", // Simulasi cabang yang aktif
            cashier: operator?.name || "Kasir Utama",
            amount: totalAmount,
            // Simulasi random img placeholder or specific
            newSnap: {
              id: `TRX-${Math.floor(1000 + Math.random() * 9000)}`,
              time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
              branch: "Tambun 1",
              cashier: operator?.name || "Kasir Utama",
              amount: totalAmount,
              img: "https://placehold.co/400x300/1e293b/ffffff?text=Snapshot\n+Baru"
            }
          }
        });
        channel.close();
      } catch (err) {
        console.error("Broadcast failed:", err);
      }
      // ---------------------------------------------------------

      alert(`Transaksi Lunas! ${paymentMethod === 'CASH' ? '\nKembalian: Rp ' + kembalian.toLocaleString('id-ID') : ''}`);
      setCart([]);
      setCashReceived(0);
      setMobileView("products");
      setCheckoutStep("cart");
      setPendingTrxId(null);
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan saat menyelesaikan pembayaran.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCashChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Hilangkan semua karakter selain angka
    const val = e.target.value.replace(/\D/g, '');
    setCashReceived(Number(val));
  };

  if (appState === "login") {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm text-center">
          <div className="w-24 h-24 rounded-full overflow-hidden mx-auto mb-6 border-4 border-blue-100 bg-gray-100 relative shadow-inner">
            <video ref={loginVideoRef} className="object-cover w-full h-full transform scale-x-[-1]" autoPlay playsInline muted />
            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
              <Camera size={24} className="text-white drop-shadow-md opacity-80" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-gray-800 mb-2">Login & Absensi</h1>
          <p className="text-gray-500 mb-8 text-sm">Wajah Anda akan difoto otomatis saat masuk.</p>
          <form onSubmit={handleLogin} className="space-y-6">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center text-4xl font-black tracking-[0.5em] p-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-gray-900"
              placeholder="••••"
              autoFocus
            />
            <button type="submit" disabled={pinInput.length < 4 || isProcessing} className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center space-x-2">
              {isProcessing ? <span className="animate-pulse">Memverifikasi...</span> : <span>MASUK</span>}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (appState === "open_shift") {
    return (
      <div className="min-h-screen bg-blue-600 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm text-center">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Unlock size={40} />
          </div>
          <h1 className="text-2xl font-black text-gray-800 mb-2">Buka Shift</h1>
          <p className="text-gray-500 mb-8">Halo, {operator?.name}! Masukkan uang modal laci saat ini.</p>
          <form onSubmit={handleOpenShift} className="space-y-6">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                value={startingCash ? startingCash.toLocaleString('id-ID') : ''}
                onChange={(e) => setStartingCash(Number(e.target.value.replace(/\D/g, '')))}
                className="w-full text-right text-3xl font-black p-4 pl-12 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:border-green-500 focus:ring-4 focus:ring-green-100 outline-none transition-all text-gray-900"
                placeholder="0"
                autoFocus
              />
            </div>
            <button type="submit" className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-2xl shadow-lg transition-all">
              MULAI BEKERJA
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (appState === "close_shift") {
    const systemEndingCash = startingCash + shiftStats.cash;
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-2xl w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogOut size={32} />
            </div>
            <h1 className="text-2xl font-black text-gray-800">Tutup Shift</h1>
            <p className="text-gray-500">Hitung fisik uang di laci Anda sekarang.</p>
          </div>
          
          <div className="bg-gray-50 rounded-2xl p-4 mb-6 space-y-3 text-sm">
            <div className="flex justify-between text-gray-600"><span className="font-semibold">Modal Awal</span><span className="font-bold">Rp {startingCash.toLocaleString('id-ID')}</span></div>
            <div className="flex justify-between text-gray-600"><span className="font-semibold">Pendapatan Tunai</span><span className="font-bold">+ Rp {shiftStats.cash.toLocaleString('id-ID')}</span></div>
            <div className="flex justify-between text-gray-600"><span className="font-semibold">Pendapatan QRIS</span><span className="font-bold text-blue-600">Rp {shiftStats.qris.toLocaleString('id-ID')}</span></div>
            <div className="border-t pt-2 mt-2 flex justify-between items-center">
              <span className="font-black text-gray-800">Uang Tunai Seharusnya</span>
              <span className="font-black text-xl text-gray-800">Rp {systemEndingCash.toLocaleString('id-ID')}</span>
            </div>
          </div>

          <form onSubmit={handleCloseShift} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Uang Tunai Fisik di Laci</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={actualEndingCash ? actualEndingCash.toLocaleString('id-ID') : ''}
                  onChange={(e) => setActualEndingCash(Number(e.target.value.replace(/\D/g, '')))}
                  className="w-full text-right text-2xl font-black p-4 pl-12 bg-white border-2 border-gray-300 rounded-2xl focus:border-red-500 focus:ring-4 focus:ring-red-100 outline-none transition-all text-gray-900"
                  placeholder="0"
                />
              </div>
              <div className="mt-2 text-center text-sm font-bold">
                {actualEndingCash > 0 && (
                  actualEndingCash === systemEndingCash ? (
                    <span className="text-green-600">Balance (Pas) ✅</span>
                  ) : actualEndingCash > systemEndingCash ? (
                    <span className="text-blue-600">Lebih Rp {(actualEndingCash - systemEndingCash).toLocaleString('id-ID')}</span>
                  ) : (
                    <span className="text-red-600">Kurang Rp {(systemEndingCash - actualEndingCash).toLocaleString('id-ID')} ⚠️</span>
                  )
                )}
              </div>
            </div>
            
            <div className="flex space-x-3 pt-4">
              <button type="button" onClick={() => setAppState("pos")} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all">Batal</button>
              <button type="submit" disabled={!actualEndingCash} className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-bold rounded-xl transition-all shadow-lg">Akhiri Shift</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen md:h-screen bg-gray-50 font-sans md:overflow-hidden">
      {/* Hidden Video element for auto-snapshot */}
      <video ref={videoRef} className="hidden" muted playsInline autoPlay />

      {/* Header Info - Responsive wrapping */}
      <header className="bg-gradient-to-r from-red-600 to-red-700 shadow-md border-b-4 border-[#012B89] px-4 lg:px-6 py-2 flex flex-col md:flex-row justify-between items-center z-10 gap-3 shrink-0">
        <div className="flex items-center space-x-4 md:space-x-6 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center space-x-3 text-white">
            <img src="/logo.png" alt="Logo Al-Kahfi" className="h-10 w-auto drop-shadow-md" />
            <div className="flex flex-col">
              <span className="font-black text-sm md:text-lg leading-tight drop-shadow-md uppercase">{branchName}</span>
              <span className="text-[10px] font-bold text-yellow-300">Outlet Nitrogen Al-Kahfi</span>
            </div>
          </div>
          <div className="flex items-center space-x-3 border-l border-white/20 pl-4 md:pl-6">
            <div className="flex items-center space-x-2 text-white">
              <User size={18} />
              <span className="font-medium text-sm md:text-base drop-shadow-md">Kasir: {operator?.name}</span>
            </div>
            <button onClick={() => setAppState("close_shift")} className="px-2.5 py-1 md:px-3 md:py-1.5 bg-yellow-400 text-red-700 hover:bg-yellow-300 rounded-lg text-xs md:text-sm font-black transition-colors shadow-sm flex items-center space-x-1">
              <LogOut size={14} />
              <span>Tutup Shift</span>
            </button>
          </div>
        </div>
        
        <div 
          className="flex items-center flex-nowrap gap-1.5 md:gap-2 w-full md:w-auto justify-start md:justify-end overflow-x-auto pb-1 md:pb-0 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* Status Kamera */}
          <div className={`shrink-0 flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] md:text-sm font-medium ${
            cameraStatus === 'Ready' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
          }`}>
            <Video size={12} className="md:w-[14px] md:h-[14px]" />
            <span>Cam: {cameraStatus}</span>
          </div>
          {/* Status IoT */}
          <div className={`shrink-0 flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] md:text-sm font-medium ${iotStatus === 'Online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            <Wifi size={12} className="md:w-[14px] md:h-[14px]" />
            <span>IoT: {iotStatus}</span>
          </div>
          {/* Status Printer */}
          <button 
            onClick={handleConnectPrinter}
            className={`shrink-0 flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] md:text-sm font-medium transition-all hover:ring-2 hover:ring-blue-300 ${printerConnected ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer'}`}
          >
            <Bluetooth size={12} className="md:w-[14px] md:h-[14px]" />
            <span>Printer: {printerConnected ? 'Connected' : 'Disconnected'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row md:overflow-hidden relative">
        {/* Kiri: Area Produk */}
        <div className={`flex-1 flex-col p-3 md:p-4 space-y-4 md:overflow-y-auto pb-24 md:pb-4 ${mobileView === 'cart' ? 'hidden md:flex' : 'flex'}`}>
          {/* Header Tabs */}
          <div className="flex space-x-2 p-1 bg-white rounded-xl shadow-sm border shrink-0">
            <button
              onClick={() => setActiveTab("nitrogen")}
              className={`flex-1 py-2.5 md:py-3 text-sm md:text-lg font-bold rounded-lg transition-colors ${
                activeTab === "nitrogen" ? "bg-blue-600 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              Layanan Nitrogen
            </button>
            <button
              onClick={() => setActiveTab("retail")}
              className={`flex-1 py-2.5 md:py-3 text-sm md:text-lg font-bold rounded-lg transition-colors ${
                activeTab === "retail" ? "bg-blue-600 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              Ritel & Aksesoris
            </button>
          </div>

          {/* Produk Grid */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border p-3 md:p-4">
            {activeTab === "nitrogen" && (
              <div className="flex flex-col h-full">
                {vehicleType === null ? (
                  <div className="grid grid-cols-2 gap-4 h-full p-2">
                    <button 
                      onClick={() => setVehicleType("motor")}
                      className="bg-white border-2 border-gray-100 rounded-3xl hover:border-blue-500 hover:shadow-xl transition-all flex flex-col items-center justify-center p-6 group"
                    >
                      <div className="w-24 h-24 sm:w-32 sm:h-32 bg-blue-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <span className="text-5xl sm:text-7xl">🏍️</span>
                      </div>
                      <span className="font-black text-xl sm:text-2xl text-gray-800">Motor</span>
                      <span className="text-gray-500 font-medium text-sm mt-1">Pilih layanan Motor</span>
                    </button>
                    
                    <button 
                      onClick={() => setVehicleType("mobil")}
                      className="bg-white border-2 border-gray-100 rounded-3xl hover:border-blue-500 hover:shadow-xl transition-all flex flex-col items-center justify-center p-6 group"
                    >
                      <div className="w-24 h-24 sm:w-32 sm:h-32 bg-blue-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <span className="text-5xl sm:text-7xl">🚗</span>
                      </div>
                      <span className="font-black text-xl sm:text-2xl text-gray-800">Mobil</span>
                      <span className="text-gray-500 font-medium text-sm mt-1">Pilih layanan Mobil</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center space-x-3 mb-4 bg-gray-50 p-2 rounded-xl">
                      <button 
                        onClick={() => setVehicleType(null)} 
                        className="p-3 bg-white border shadow-sm rounded-lg hover:bg-gray-100 font-bold text-gray-600 transition-all"
                      >
                         &larr; Kembali
                      </button>
                      <div className="font-bold text-gray-800 text-lg flex items-center">
                        <span className="mr-2 text-2xl">{vehicleType === 'motor' ? '🏍️' : '🚗'}</span>
                        Varian Layanan {vehicleType.charAt(0).toUpperCase() + vehicleType.slice(1)}
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-4">
                      {products.filter(p => p.name.toLowerCase().includes(vehicleType) && (p.name.toLowerCase().includes("isi") || p.name.toLowerCase().includes("tambal") || p.name.toLowerCase().includes("nitrogen"))).map((product) => (
                        <button
                          key={product.id}
                          onClick={() => addToCart(product)}
                          className="w-full p-4 md:p-5 border-2 border-gray-100 rounded-2xl hover:border-blue-500 hover:bg-blue-50 bg-white transition-all flex items-center justify-between group shadow-sm hover:shadow-md"
                        >
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                               {product.name.toLowerCase().includes('baru') ? <Plus size={24} /> : product.name.toLowerCase().includes('tambah') ? <RefreshCcw size={24} /> : <Wrench size={24} />}
                            </div>
                            <div className="text-left">
                              <span className="font-bold text-gray-800 text-lg md:text-xl block">{product.name}</span>
                              <span className="text-gray-500 text-sm font-medium">{product.name.toLowerCase().includes('baru') ? 'Pengurasan & Isi Ulang' : product.name.toLowerCase().includes('tambah') ? 'Penambahan Tekanan' : 'Perbaikan Ban Bocor'}</span>
                            </div>
                          </div>
                          <span className="text-blue-600 font-black text-xl">Rp {product.harga.toLocaleString('id-ID')}</span>
                        </button>
                      ))}
                      {products.filter(p => p.name.toLowerCase().includes(vehicleType) && (p.name.toLowerCase().includes("isi") || p.name.toLowerCase().includes("tambal") || p.name.toLowerCase().includes("nitrogen"))).length === 0 && (
                        <div className="text-center p-8 text-gray-400 font-bold border-2 border-dashed border-gray-200 rounded-2xl">
                          Belum ada layanan untuk {vehicleType}.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "retail" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-gray-50 p-3 md:p-4 rounded-xl border">
                  <span className="font-semibold text-gray-800 text-sm md:text-base">Scan Barcode Produk</span>
                  <button 
                    onClick={() => setCameraActive(!cameraActive)}
                    className="bg-gray-800 text-white px-4 py-2 md:px-5 md:py-2.5 rounded-lg flex items-center space-x-2 hover:bg-gray-700 text-sm md:text-base"
                  >
                    <ScanLine size={18} />
                    <span>{cameraActive ? "Tutup Scanner" : "Buka Scanner"}</span>
                  </button>
                </div>
                
                {cameraActive && (
                  <div className="bg-black aspect-video rounded-xl flex items-center justify-center text-white border-2 border-gray-200">
                    <span className="text-xs md:text-sm">Kamera Scanner Placeholder (Gunakan html5-qrcode)</span>
                  </div>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mt-4">
                  {products.filter(p => !(p.name.toLowerCase().includes("isi") || p.name.toLowerCase().includes("tambal") || p.name.toLowerCase().includes("nitrogen"))).map((product) => (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      className="p-3 border border-gray-100 rounded-2xl hover:border-gray-800 hover:shadow-lg hover:-translate-y-1 bg-white transition-all flex flex-col items-center overflow-hidden"
                    >
                      <div className="w-full aspect-square bg-gray-50 rounded-xl mb-3 overflow-hidden flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={product.img || "https://placehold.co/200x200/eff6ff/2563eb?text=No+Image"} alt={product.name} className="object-cover w-full h-full" />
                      </div>
                      <span className="text-xs md:text-sm font-bold text-gray-800 text-center leading-tight mb-1 md:mb-2">{product.name}</span>
                      <span className="text-gray-800 font-black text-sm md:text-base">Rp {product.harga.toLocaleString('id-ID')}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Floating Cart Button for Mobile */}
        {cart.length > 0 && mobileView === "products" && (
          <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-gray-200 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-30">
            <button 
              onClick={() => setMobileView("cart")} 
              className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold flex justify-between items-center shadow-lg active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center space-x-2">
                <div className="bg-blue-800/50 px-2 py-0.5 rounded-md text-sm">{cart.reduce((s, i) => s + i.qty, 0)}</div>
                <span>Item</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>Rp {totalAmount.toLocaleString('id-ID')}</span>
                <span>&rarr;</span>
              </div>
            </button>
          </div>
        )}

        {/* Kanan: Cart / Struk */}
        <div className={`w-full md:w-[340px] lg:w-[420px] bg-white shadow-xl flex-col border-t md:border-t-0 md:border-l z-10 relative shrink-0 md:h-full ${mobileView === 'cart' ? 'flex' : 'hidden md:flex'}`}>
          <div className="p-3 md:p-4 bg-gray-800 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2 md:space-x-3">
              {/* Mobile Back Button */}
              <button onClick={() => setMobileView('products')} className="md:hidden p-1 bg-gray-700 hover:bg-gray-600 rounded-md mr-1 transition-colors">
                <ChevronLeft size={20} />
              </button>
              <ShoppingCart size={20} className="md:w-5 md:h-5" />
              <h2 className="text-base md:text-lg font-bold">Pesanan Saat Ini</h2>
            </div>
            <div className="bg-gray-700 px-2.5 py-1 rounded-full text-xs md:text-sm font-bold">
              {cart.reduce((s, i) => s + i.qty, 0)} Item
            </div>
          </div>
          
          {/* Cart List */}
          <div className="flex-1 overflow-y-auto p-2 min-h-0">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-300 space-y-3 py-10 md:py-16">
                <ShoppingCart size={48} className="mb-2 md:w-16 md:h-16" />
                <p className="text-base md:text-lg font-medium">Keranjang Kosong</p>
              </div>
            ) : (
              <div className="space-y-2 p-1 md:p-2">
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-2.5 md:p-3 bg-white border border-gray-100 shadow-sm rounded-xl shrink-0">
                    <div className="flex-1 pr-2">
                      <div className="font-bold text-gray-800 text-sm md:text-base leading-tight">{item.name}</div>
                      <div className="text-xs md:text-sm text-gray-500 font-medium mt-0.5 md:mt-1">Rp {item.harga.toLocaleString('id-ID')} / item</div>
                    </div>
                    
                    <div className="flex items-center space-x-1 md:space-x-2 shrink-0">
                      <div className="flex items-center bg-gray-50 rounded-lg p-0.5 md:p-1 border border-gray-200">
                        <button onClick={() => updateQty(item.id, -1)} className="p-1.5 md:p-2 text-gray-800 hover:bg-gray-200 rounded-md transition-colors">
                          <Minus size={14} className="md:w-4 md:h-4 stroke-[3]" />
                        </button>
                        <span className="font-black w-6 md:w-8 text-center text-sm md:text-base text-gray-900">{item.qty}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="p-1.5 md:p-2 text-gray-800 hover:bg-gray-200 rounded-md transition-colors">
                          <Plus size={14} className="md:w-4 md:h-4 stroke-[3]" />
                        </button>
                      </div>
                      <button onClick={() => removeItem(item.id)} className="p-1.5 md:p-2 text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition-colors">
                        <Trash2 size={18} className="md:w-5 md:h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment Panel - Ultra Compact Professional POS Style */}
          <div className="bg-white border-t shadow-[0_-4px_10px_rgba(0,0,0,0.03)] p-3 md:p-4 shrink-0 z-20">
            {/* Top Bar: Actions */}
            <div className="flex justify-between items-center mb-3">
              <div className="flex space-x-1.5 md:space-x-2">
                <button 
                  onClick={clearCart} 
                  disabled={cart.length === 0}
                  className="p-1.5 md:px-3 md:py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-semibold text-xs md:text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Batalkan Transaksi"
                >
                  <XCircle size={18} className="md:w-5 md:h-5" />
                  <span className="hidden md:inline md:ml-1.5">Batal</span>
                </button>
                <button 
                  onClick={reprintLastReceipt}
                  disabled={!lastCart}
                  className="p-1.5 md:px-3 md:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold text-xs md:text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Cetak Ulang Struk"
                >
                  <RefreshCcw size={18} className="md:w-5 md:h-5" />
                  <span className="hidden md:inline md:ml-1.5">Reprint</span>
                </button>
              </div>
            </div>

            {/* Main Checkout Button */}
            <button
              onClick={handleStartPengerjaan}
              disabled={cart.length === 0 || isProcessing}
              className={`w-full p-3.5 md:p-4 rounded-xl flex justify-between items-center transition-all shadow-md group ${
                cart.length === 0 
                ? "bg-gray-300 shadow-none cursor-not-allowed" 
                : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 hover:shadow-blue-500/30"
              }`}
            >
              <div className="flex items-center space-x-2 text-white/90 group-hover:text-white">
                {isProcessing ? (
                  <span className="animate-pulse flex items-center space-x-2"><Video size={20} className="md:w-[24px] md:h-[24px]" /> <span>Memulai...</span></span>
                ) : (
                  <>
                    <Wrench size={20} className="md:w-[24px] md:h-[24px]" />
                    <span className="text-sm md:text-base font-bold uppercase tracking-wider">
                      PROSES PENGERJAAN
                    </span>
                  </>
                )}
              </div>
              <div className="text-white text-xl md:text-2xl font-black text-right leading-none">
                <span className="text-xs md:text-sm font-medium opacity-80 block mb-0.5 text-right uppercase tracking-wider">Total</span>
                Rp {totalAmount.toLocaleString('id-ID')}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Secure Post-Paid Workflow: Layar Pengerjaan & Pembayaran */}
      {checkoutStep === "payment" && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] p-6 md:p-8 w-full max-w-md shadow-2xl flex flex-col items-center space-y-5 animate-in zoom-in-95 duration-200">
            
            <div className="flex flex-col items-center text-center space-y-1 mb-2">
              <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-inner border-4 bg-green-50 text-green-600 border-green-100 mb-2">
                <CheckCircle size={32} strokeWidth={3} />
              </div>
              <h2 className="text-xl md:text-2xl font-black text-gray-800 tracking-tight">Sedang Dikerjakan...</h2>
              <p className="text-gray-500 font-medium text-xs md:text-sm">Data tercatat di server. Selesaikan pengerjaan, lalu minta pembayaran ke pelanggan.</p>
            </div>
            
            {/* Payment Collection Form */}
            <div className="w-full bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-bold text-gray-700 uppercase">Tagihan Pelanggan</span>
                <span className="text-2xl font-black text-blue-600">Rp {totalAmount.toLocaleString('id-ID')}</span>
              </div>
              
              <div className="flex bg-gray-200 p-1 rounded-xl">
                <button
                  onClick={() => setPaymentMethod("CASH")}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                    paymentMethod === "CASH" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  TUNAI
                </button>
                <button
                  onClick={() => setPaymentMethod("QRIS")}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                    paymentMethod === "QRIS" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  QRIS
                </button>
              </div>

              {paymentMethod === "CASH" && (
                <div className="space-y-3">
                  <div className="flex space-x-2">
                    <div className="flex-1 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">Rp</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={cashReceived ? cashReceived.toLocaleString('id-ID') : ''}
                        onChange={handleCashChange}
                        placeholder="0"
                        className="w-full text-right text-xl font-bold pl-8 pr-3 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none text-gray-900 bg-white transition-all"
                      />
                    </div>
                    <div className="w-[120px] flex flex-col justify-center px-3 bg-gray-200 rounded-xl shrink-0">
                      <span className="text-[10px] text-gray-500 font-bold uppercase">Kembali</span>
                      <span className={`font-bold text-base leading-none mt-1 ${kembalian > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                        Rp {kembalian.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button onClick={() => setCashReceived(totalAmount)} className="flex-1 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-blue-50 hover:border-blue-300 transition-colors shadow-sm">Uang Pas</button>
                    <button onClick={() => setCashReceived(50000)} className="flex-1 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-blue-50 hover:border-blue-300 transition-colors shadow-sm">50rb</button>
                    <button onClick={() => setCashReceived(100000)} className="flex-1 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-blue-50 hover:border-blue-300 transition-colors shadow-sm">100rb</button>
                  </div>
                </div>
              )}
            </div>
            
            <button 
              onClick={handleSelesaikanPembayaran} 
              disabled={isProcessing || (paymentMethod === "CASH" && cashReceived < totalAmount)} 
              className="w-full py-4 bg-gray-900 hover:bg-black text-white rounded-2xl font-black text-lg shadow-xl shadow-gray-900/20 transition-all flex justify-center items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <span className="animate-pulse">Menyimpan...</span>
              ) : (
                <>
                  <Printer size={20} />
                  <span>LUNASI & CETAK STRUK</span>
                </>
              )}
            </button>
            
          </div>
        </div>
      )}

    </div>
  );
}
