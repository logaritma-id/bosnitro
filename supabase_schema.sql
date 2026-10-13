-- ==========================================================
-- SKEMA DATABASE SUPABASE UNTUK POS KASIR AL-KAHFI
-- Jalankan query ini di SQL Editor dashboard Supabase Anda
-- ==========================================================

-- 1. Tabel Transaksi
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total_amount NUMERIC NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'PENDING',
    payment_method TEXT,
    snapshot_url TEXT,
    branch_id TEXT DEFAULT 'd0e659b9-0c62-4015-ab1b-265de35bfcd1',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabel Perangkat IoT / Kompresor Cabang
CREATE TABLE IF NOT EXISTS public.branch_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_code TEXT UNIQUE NOT NULL,
    device_status TEXT NOT NULL DEFAULT 'IDLE',
    active_duration_seconds INTEGER DEFAULT 0,
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabel Master Produk & Stok
CREATE TABLE IF NOT EXISTS public.products (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    harga INTEGER NOT NULL DEFAULT 0,
    hpp INTEGER NOT NULL DEFAULT 0,
    stok INTEGER NOT NULL DEFAULT 0,
    img TEXT DEFAULT '',
    category TEXT NOT NULL DEFAULT 'nitrogen',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inisialisasi data produk default
INSERT INTO public.products (name, harga, hpp, stok, img, category)
VALUES
  ('Isi Baru Motor', 5000, 500, 999, 'https://placehold.co/100x100/1e293b/ffffff?text=Isi+Baru', 'nitrogen'),
  ('Tambal Ban Motor', 15000, 1000, 4, 'https://placehold.co/100x100/1e293b/ffffff?text=Tambal', 'nitrogen'),
  ('Ganti Oli Mesin', 50000, 35000, 12, 'https://placehold.co/100x100/1e293b/ffffff?text=Oli', 'ritel'),
  ('Cairan Tubles', 35000, 20000, 2, 'https://placehold.co/100x100/1e293b/ffffff?text=Tubles', 'ritel')
ON CONFLICT DO NOTHING;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access products" ON public.products;
CREATE POLICY "Public access products"
ON public.products FOR ALL
USING (true)
WITH CHECK (true);

-- Inisialisasi perangkat bawaan NITRO-01
INSERT INTO public.branch_devices (device_code, device_status, active_duration_seconds)
VALUES ('NITRO-01', 'IDLE', 0)
ON CONFLICT (device_code) DO NOTHING;

-- 3. Kebijakan Keamanan (Row Level Security) agar Kasir & Owner dapat Read/Write via Anon Key
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access transactions" ON public.transactions;
CREATE POLICY "Public access transactions" 
ON public.transactions FOR ALL 
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "Public access branch_devices" ON public.branch_devices;
CREATE POLICY "Public access branch_devices" 
ON public.branch_devices FOR ALL 
USING (true) 
WITH CHECK (true);
