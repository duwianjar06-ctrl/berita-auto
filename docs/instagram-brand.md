# Instagram Berita Auto

## Bio

Rekomendasi utama:
`BERITA AUTO | Kabar terkini Indonesia & dunia. Update singkat, sumber jelas, langsung ke intinya. 👇 berita-auto.vercel.app`

Alternatif:
- Formal: `Berita terkini Indonesia & dunia. Ringkas, faktual, dan terpercaya. Baca selengkapnya di berita-auto.vercel.app`
- Modern-singkat: `📰 Berita hari ini, tanpa ribet. ⚡ Ringkas • aktual • faktual. 👇 berita-auto.vercel.app`

## Foto profil

1. **BA Monogram** — rekomendasi utama; paling terbaca pada avatar kecil.
2. **News Broadcast** — ikon bulletin/broadcast minimal dengan inisial BA.
3. **Wordmark Badge** — badge lingkaran BERITA AUTO dengan aksen editorial.

Aset awal siap pakai tersedia di `public/branding/instagram-profile-ba.svg`. Untuk akun Instagram, pemasangan foto profil dilakukan manual karena automation saat ini tidak mengasumsikan adanya endpoint resmi untuk mengganti profile picture.

## Visual posting

Visual sekarang dibuat kontekstual dari judul, ringkasan, isi artikel, kategori, dan keyword. Pipeline memetakan topik seperti olahraga, teknologi, ekonomi, bencana, kriminal, politik, internasional, kesehatan, dan sains ke treatment visual yang berbeda. Jika isi terlalu panjang, card otomatis menjadi dua slide dan worker membuat Instagram carousel dengan child media containers lalu parent carousel container.
