import { redirect } from "next/navigation";

export default function Home() {
  // Alihkan secara otomatis seluruh pengunjung halaman utama ke portal Kasir Lapangan
  // Menghilangkan akses tombol Owner dari publik demi keamanan data gerai
  redirect("/kasir");
}
