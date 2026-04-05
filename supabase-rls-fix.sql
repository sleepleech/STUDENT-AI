-- ============================================================
-- NATA SENSEI — Panduan Setup Lengkap Supabase
-- Jalankan sesuai urutan yang sudah kamu setup sebelumnya
-- ============================================================

-- ============================================================
-- BAGIAN A: SCHEMA (sudah kamu jalankan sebelumnya - SKIP)
-- ============================================================
-- (Schema sudah benar: profiles, materials, flashcards, quizzes)
-- (RLS sudah dimatikan di profiles: DISABLE ROW LEVEL SECURITY)


-- ============================================================
-- BAGIAN B: BUAT AKUN ADMIN (JALANKAN INI SEKARANG)
-- ============================================================
-- Karena kamu tidak bisa buat user langsung via SQL di auth.users,
-- ikuti langkah berikut:

-- LANGKAH 1: Daftar akun via Supabase Authentication Dashboard
--   Buka: Authentication → Users → "Add user" → "Create new user"
--   Email    : sleepy@gmail.com
--   Password : 13071997
--   Centang "Auto Confirm User" (WAJIB)

-- LANGKAH 2: Setelah user dibuat, jalankan SQL ini untuk jadikan admin:
UPDATE public.profiles 
SET 
  name = 'Admin Sleepy',
  role = 'admin', 
  status = 'active'
WHERE email = 'sleepy@gmail.com';

-- Cek hasilnya:
SELECT id, name, email, role, status FROM public.profiles WHERE email = 'sleepy@gmail.com';


-- ============================================================
-- BAGIAN C: JIKA PROFIL ADMIN BELUM MUNCUL
-- (terjadi jika tidak ada trigger otomatis buat profil)
-- ============================================================
-- Pertama ambil UUID dari user yang baru dibuat:
-- SELECT id FROM auth.users WHERE email = 'sleepy@gmail.com';

-- Lalu insert manual (ganti 'UUID-DARI-QUERY-ATAS' dengan hasil query):
-- INSERT INTO public.profiles (id, name, email, role, status, belt_rank)
-- VALUES ('UUID-DARI-QUERY-ATAS', 'Admin Sleepy', 'sleepy@gmail.com', 'admin', 'active', 'Black Belt')
-- ON CONFLICT (id) DO UPDATE SET role = 'admin', status = 'active', name = 'Admin Sleepy';


-- ============================================================
-- BAGIAN D: CEK STATUS USER (MONITORING)
-- ============================================================
-- Lihat semua user:
-- SELECT id, name, email, role, status, joined_at FROM public.profiles ORDER BY joined_at DESC;

-- Aktifkan user yang pending:
-- UPDATE public.profiles SET status = 'active' WHERE email = 'emailuser@gmail.com';

-- Suspend user:
-- UPDATE public.profiles SET status = 'suspended' WHERE email = 'emailuser@gmail.com';


-- ============================================================
-- BAGIAN E: TAMBAH INSERT POLICY (agar register bisa masukkan profil)
-- (Opsional karena RLS sudah dimatikan, tapi best practice)
-- ============================================================
-- Jika suatu saat RLS diaktifkan kembali, policy ini diperlukan:
/*
CREATE POLICY "Allow user insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);
*/


-- ============================================================
-- BAGIAN F: MATIKAN KONFIRMASI EMAIL DI SUPABASE
-- (WAJIB agar user bisa daftar tanpa konfirmasi email)
-- ============================================================
-- Buka: Supabase Dashboard → Authentication → Providers → Email
-- Toggle OFF: "Confirm email"
-- Ini tidak bisa dilakukan via SQL.


-- ============================================================
-- BAGIAN G: ENV VARIABLES DI VERCEL
-- ============================================================
-- Pastikan ini sudah ada di Vercel Project → Settings → Environment Variables:
-- NEXT_PUBLIC_SUPABASE_URL   = https://odpiwmdbzsbdbcfiicre.supabase.co
-- NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGci...
-- GEMINI_API_KEYS            = (isi dari .env.local)
-- GROQ_API_KEY               = (isi dari .env.local)
-- XAI_API_KEY                = (isi dari .env.local)
-- CEREBRAS_API_KEYS          = (isi dari .env.local)
-- SAMBANOVA_API_KEY          = (isi dari .env.local)
