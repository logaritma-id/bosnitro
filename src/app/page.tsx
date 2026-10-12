import Link from "next/link";
import { ShoppingCart, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl text-center border-t-8 border-red-600">
        <div className="flex justify-center mb-6">
          <img src="/logo.png" alt="Logo Al-Kahfi" className="h-20 w-auto object-contain drop-shadow" />
        </div>
        <h1 className="text-2xl font-black text-gray-800 tracking-tight mb-2">POS NITROGEN AL-KAHFI</h1>
        <p className="text-gray-500 text-sm mb-8">Pilih portal yang ingin Anda buka:</p>

        <div className="space-y-4">
          <Link
            href="/kasir"
            className="flex items-center justify-between p-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-2xl shadow-lg transition-all transform hover:-translate-y-0.5 group"
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <ShoppingCart size={24} className="text-yellow-300" />
              </div>
              <div className="text-left">
                <p className="font-black text-base">Aplikasi Kasir</p>
                <p className="text-xs text-red-100 font-medium">Layanan Nitrogen & Kasir Outlet</p>
              </div>
            </div>
            <span className="font-bold text-yellow-300 text-sm group-hover:translate-x-1 transition-transform">Buka →</span>
          </Link>

          <Link
            href="/owner"
            className="flex items-center justify-between p-4 bg-[#012B89] hover:bg-[#00226e] text-white rounded-2xl shadow-lg transition-all transform hover:-translate-y-0.5 group"
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <ShieldCheck size={24} className="text-yellow-400" />
              </div>
              <div className="text-left">
                <p className="font-black text-base">Dashboard Owner</p>
                <p className="text-xs text-blue-200 font-medium">Manajemen Cabang, Stok & Audit</p>
              </div>
            </div>
            <span className="font-bold text-yellow-400 text-sm group-hover:translate-x-1 transition-transform">Buka →</span>
          </Link>
        </div>

        <p className="text-[11px] text-gray-400 mt-8 font-medium">
          © 2026 Outlet Nitrogen Al-Kahfi. All rights reserved.
        </p>
      </div>
    </div>
  );
}
