
require('./config/db'); // koneksi MongoDB

const multer = require('multer');
const express = require('express');
const path = require('path');
const app = express();
const Order = require('./models/Order'); // model pesanan
const session = require('express-session');
const bcrypt = require('bcryptjs');
const midtransRoutes = require('./midtrans');
const midtransClient = require('midtrans-client');

app.use(midtransRoutes);
app.use(session({
  secret: 'rakstudio-secret',
  resave: false,
  saveUninitialized: true
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---------------- Konfigurasi penyimpanan ----------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    // Ganti spasi jadi underscore, buang karakter aneh
    const cleanName = file.originalname.replace(/\s+/g, '_').replace(/[^\w.-]/g, '');
    const uniqueSuffix = Date.now() + '-' + cleanName;
    cb(null, uniqueSuffix);
  }
});

const upload = multer({ storage });

// Konfigurasi view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname)));
app.use(express.urlencoded({ extended: true }));

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

// Middleware global untuk semua EJS
app.use((req, res, next) => {
  res.locals.isLoggedIn = !!req.session.userId;
  res.locals.userName = req.session.userName;
  res.locals.userRole = req.session.userRole;
  res.locals.userEmail = req.session.userEmail;
  next();
});

app.get('/bayar-midtrans-test', (req, res) => {
  res.render('bayar-midtrans-test'); // otomatis cari views/bayar-midtrans-test.ejs
});

// ---------------- ROUTING INDEX ----------------

app.get('/', async (req, res) => {
  try {
    const produk = await Product.find().sort({ tanggal: -1 }).limit(4); // 4 produk terbaru
    const portofolio = await Portofolio.find().sort({ tanggal: -1}).limit(6);
    res.render('index', { produk, portofolio });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat halaman beranda');
  }
});


app.get('/konfirmasi', (req, res) => {
  res.sendFile(path.join(__dirname, 'konfirmasi.html'));
});

const User = require('./models/User');

// ---------------- ROUTING LAYANAN ----------------
app.get('/layanan', requireLogin, (req, res) => {
  res.render('layanan'); // tidak perlu .ejs, otomatis dicari dari /views
});

// ---------------- ROUTING PORTOFOLIO ----------------
const Portofolio = require('./models/Portofolio');

// Halaman user portofolio
app.get('/portofolio', requireLogin, async (req, res) => {
  try {
    const portofolio = await Portofolio.find().sort({ tanggal: -1 });

    res.render('portofolio', {
      portofolio,
      activePage: 'portofolio', // menandai tab aktif
      isLoggedIn: req.session.isLoggedIn,
      userRole: req.session.userRole,
      userName: req.session.userName,
      userEmail: req.session.userEmail
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat portofolio');
  }
});

// Halaman admin portofolio
app.get('/admin/portofolio', async (req, res) => {
  const portofolio = await Portofolio.find().sort({ tanggal: -1 });
  res.render('admin/portofolio-admin', { portofolio, activePage:'portofolio' });
});

// Tambah portofolio
app.post('/admin/portofolio/tambah', upload.single('gambar'), async (req, res) => {
  try {
    const { judul, deskripsi } = req.body;
    const gambar = req.file ? req.file.filename : null;
    await Portofolio.create({ judul, deskripsi, gambar });
    res.redirect('/admin/portofolio');
  } catch (err) {
    res.status(500).send('Gagal menambahkan portofolio');
  }
});

// Hapus portofolio
app.post('/admin/portofolio/:id/hapus', async (req, res) => {
  try {
    await Portofolio.findByIdAndDelete(req.params.id);
    res.redirect('/admin/portofolio');
  } catch (err) {
    res.status(500).send('Gagal menghapus portofolio');
  }
});

// Route User Portofolio
app.get('/portofolio', async (req, res) => {
  const portofolio = await Portofolio.find().sort({ tanggal: -1 });
  res.render('portofolio', { portofolio });
});

// ---------------- RIWAYAT PEMESANAN ----------------
app.get('/riwayat', async (req, res) => {
  if (!req.session.userEmail) {
    return res.redirect('/login');
  }

  try {
    const pesanan = await Order.find({ email: req.session.userEmail }).sort({ tanggal: -1 });
    res.render('riwayat', { pesanan });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat riwayat pemesanan');
  }
});

// ---------------- ROUTING LOGIN DAN REGISTER ----------------
app.get('/buat-admin', async (req, res) => {
  try {
    const existing = await User.findOne({ email: 'admin@rakstudio.com' });
    if (existing) return res.send('Admin sudah ada.');

    await User.create({
      nama: 'Admin',
      email: 'admin@rakstudio.com',
      password: 'admin123', // akan di-hash otomatis
      role: 'admin'
    });

    res.send('✅ Admin berhasil dibuat');
  } catch (err) {
    console.error(err);
    res.status(500).send('❌ Gagal membuat admin');
  }
});

// GET login form
app.get('/login', (req, res) => {
  res.render('login_signup',{
    errorLogin: null,
    errorSignup: null,
    show: 'login'
  });
});

// POST register
app.post('/signup', async (req, res) => {
  const { nama, email, password } = req.body;
  try {
    await User.create({ nama, email, password });
    res.redirect('/login');
  } catch (err) {
    res.send('Gagal register: ' + err.message);
  }
});

// POST login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.render('login_signup', {
        errorLogin: 'User tidak ditemukan',
        errorSignup: null,
        show: 'login'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    console.log('🔍 Cek Login:', { inputPassword: password, hash: user.password, cocok: isMatch });

    if (!isMatch) {
      return res.render('login_signup', {
        errorLogin: 'Password salah',
        errorSignup: null,
        show: 'login'
      });
    }

    // Simpan session
    req.session.userId = user._id;
    req.session.userName = user.nama;
    req.session.userRole = user.role;
    req.session.userEmail = user.email;

    // Arahkan sesuai role
    if (user.role === 'admin') {
      return res.redirect('/admin/pesanan');
    } else {
      return res.redirect('/'); // atau halaman user biasa
    }

  } catch (err) {
    console.error('❌ Error login:', err);
    res.status(500).send('Terjadi kesalahan saat login');
  }
});

// GET logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// ---------------- MIDDLEWARE LOGIN PROTEKSI ----------------
function authMiddleware(req, res, next) {
  if (!req.session.userId || req.session.userRole !== 'admin') {
    return res.redirect('/login');
  }
  next();
}

// ---------------- PROTEKSI SEMUA ROUTE ADMIN ----------------
app.use('/admin', authMiddleware);

// ---------------- ROUTING ADMIN MENGGUNAKAN EJS ----------------

// Halaman daftar pesanan
app.get('/admin/pesanan', async (req, res) => {
  try {
    const pesanan = await Order.find().sort({ tanggal: -1 });
    res.render('admin/pesanan-admin', { pesanan, activePage:'pesanan' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal mengambil data pesanan');
  }
});

// Halaman detail pesanan
app.get('/admin/pesanan/:id', async (req, res) => {
  try {
    const pesanan = await Order.findById(req.params.id);
    if (!pesanan) return res.status(404).send('Pesanan tidak ditemukan');
    res.render('admin/detail-pesanan', { pesanan });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat detail pesanan');
  }
});

// ---------------- POST PESANAN ----------------

app.post('/pesan', upload.single('referensi'), async (req, res) => {
  try {
    const fileName = req.file ? req.file.filename : null;
    const fileAsli = req.file ? req.file.originalname : null;
    console.log('📥 Data form masuk:', req.body);
    console.log('📎 File:', req.file);

    await Order.create({
      nama: req.body.nama,
      email: req.session.userEmail,
      paket: req.body.paket,
      deskripsi: req.body.deskripsi,
      fileReferensi: fileName,
      fileAsli: fileAsli,
      status: 'Baru'
    });
    console.log('✅ Data berhasil disimpan ke MongoDB');

    res.redirect('/sukses');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menyimpan data');
  }
});

app.get('/form-pemesanan', requireLogin, (req, res) => {
  res.render('form-pemesanan', {
    error: null
  });
});

// Halaman detail pesanan
app.get('/admin/pesanan/:id', async (req, res) => {
  try {
    const pesanan = await Order.findById(req.params.id);
    if (!pesanan) return res.status(404).send('Pesanan tidak ditemukan');
    res.render('admin/detail-pesanan', { pesanan });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat detail pesanan');
  }
});

// ---------------- POST PESANAN ----------------

app.post('/pesan', upload.single('referensi'), async (req, res) => {
  try {
    const fileName = req.file ? req.file.filename : null;
    const fileAsli = req.file ? req.file.originalname : null;
    console.log('📥 Data form masuk:', req.body);
    console.log('📎 File:', req.file);

    await Order.create({
      nama: req.body.nama,
      email: req.session.userEmail,
      paket: req.body.paket,
      deskripsi: req.body.deskripsi,
      fileReferensi: fileName,
      fileAsli: fileAsli,
      status: 'Baru'
    });
    console.log('✅ Data berhasil disimpan ke MongoDB');

    res.redirect('/sukses');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menyimpan data');
  }
});

app.get('/form-pemesanan', requireLogin, (req, res) => {
  res.render('form-pemesanan', {
    error: null
  });
});

// ---------------- POST KONFIRMASI LAYANAN ----------------
app.post('/konfirmasi-layanan', upload.single('referensi'), async (req, res) => {
  try {
    const { nama, email, paket, deskripsi } = req.body;
    const fileName = req.file ? req.file.filename : null;
    const fileAsli = req.file ? req.file.originalname : null;

    req.session.tempPesananLayanan = {
      nama,
      email,
      paket,
      deskripsi,
      fileReferensi: fileName,
      fileAsli: fileAsli,
      jenisLayanan: 'design-graphic',
      status: 'Baru'
    };

    let harga = 0;
    if (paket === 'Basic') harga = 150000;
    else if (paket === 'Standard') harga = 250000;
    else if (paket === 'Premium') harga = 400000;

    const snap = new midtransClient.Snap({
      isProduction: false,
      serverKey: process.env.MIDTRANS_SERVER_KEY,
      clientKey: process.env.MIDTRANS_CLIENT_KEY
    });

    const parameter = {
      transaction_details: {
        order_id: 'ORDER-LAYANAN-' + Date.now(),
        gross_amount: harga
      },
      customer_details: {
        first_name: nama,
        email: email
      },
      item_details: [
        {
          id: 'LAYANAN-' + Date.now(),
          name: `Paket ${paket} - Design Graphic`,
          price: harga,
          quantity: 1
        }
      ]
    };

  const transaction = await snap.createTransaction(parameter);
    const token = transaction.token;

    res.render('konfirmasi-layanan', {
      data: req.session.tempPesananLayanan,
      harga,
      token,
      clientKey: process.env.MIDTRANS_CLIENT_KEY
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal membuat transaksi Midtrans');
  }
});




// ---------------- ROUTE SUKSES LAYANAN ----------------
app.get('/sukses-layanan', async (req, res) => {
  const data = req.session.tempPesananLayanan;

  if (!data) {
    return res.status(400).send('Data pesanan tidak ditemukan di sesi.');
  }

  try {
    await Order.create({
      nama: data.nama,
      email: data.email,
      paket: data.paket,
      deskripsi: data.deskripsi,
      fileReferensi: data.fileReferensi,
      fileAsli: data.fileAsli,
      jenisLayanan: data.jenisLayanan,
      status: 'Baru'
    });

    // Bersihkan sesi
    delete req.session.tempPesananLayanan;

    res.render('sukses-layanan');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menyimpan pesanan ke database');
  }
});

// ---------------- ROUTE PEMESANAN UI ----------------
app.get('/form-ui', requireLogin, (req, res) => {
  res.render('form-ui');
});

app.post('/konfirmasi-ui', upload.single('referensi'), async (req, res) => {
  try {
    const { nama, email, paket, deskripsi } = req.body;
    const fileName = req.file ? req.file.filename : null;
    const fileAsli = req.file ? req.file.originalname : null;

    let harga = 0;
    if (paket === 'Basic') harga = 250000;
    else if (paket === 'Standard') harga = 350000;
    else if (paket === 'Premium') harga = 500000;

    const snap = new midtransClient.Snap({
      isProduction: false,
      serverKey: process.env.MIDTRANS_SERVER_KEY,
      clientKey: process.env.MIDTRANS_CLIENT_KEY
    });

    const parameter = {
      transaction_details: {
        order_id: 'ORDER-UI-' + Date.now(),
        gross_amount: harga
      },
      customer_details: {
        first_name: nama,
        email: email
      },
      item_details: [
        {
          id: 'UI-' + Date.now(),
          name: `Paket ${paket} - UI Design`,
          price: harga,
          quantity: 1
        }
      ]
    };

    const transaction = await snap.createTransaction(parameter);
    const token = transaction.token;

    // ❗ Simpan data dulu ke session, JANGAN ke database
    req.session.tempPesananUI = {
      nama,
      email,
      paket,
      deskripsi,
      fileReferensi: fileName,
      fileAsli: fileAsli,
      jenisLayanan: 'ui-design',
      status: 'Baru'
    };

    res.render('konfirmasi-ui', {
      data: req.session.tempPesananUI,
      token,
      clientKey: process.env.MIDTRANS_CLIENT_KEY
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memproses pemesanan UI');
  }
});


// ---------------- ROUTE SUKSES UI ----------------
app.get('/sukses-ui', async (req, res) => {
  const data = req.session.tempPesananUI;

  if (!data) return res.status(400).send('Data UI tidak ditemukan');

  try {
    await Order.create({
      nama: data.nama,
      email: data.email,
      paket: data.paket,
      deskripsi: data.deskripsi,
      fileReferensi: data.fileReferensi,
      fileAsli: data.fileAsli,
      jenisLayanan: data.jenisLayanan,
      status: 'Baru'
    });

    delete req.session.tempPesananUI;
    res.render('sukses-ui');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menyimpan pesanan UI');
  }
});

// ---------------- ROUTING PRODUCT UNTUK USER ----------------
const Product = require('./models/Product');
app.get('/produk', async (req, res) => {
  const produk = await Product.find().sort({ tanggal: -1 });
  res.render('produk', { produk });
});

// ---------------- Detail Produk ----------------
app.get('/produk/:id', requireLogin, async (req, res) => {
  try {
    const produk = await Product.findById(req.params.id);
    if (!produk) return res.status(404).send('Produk tidak ditemukan');
    res.render('detail-produk', { produk });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat detail produk');
  }
});

// ---------------- Konfirmasi Produk ----------------
app.get('/konfirmasi-produk/:id', async (req, res) => {
  try {
    const produk = await Product.findById(req.params.id);
    if (!produk) return res.status(404).send('Produk tidak ditemukan');

    const snap = new midtransClient.Snap({
      isProduction: false,
      serverKey: process.env.MIDTRANS_SERVER_KEY,
      clientKey: process.env.MIDTRANS_CLIENT_KEY
    });

    const parameter = {
      transaction_details: {
        order_id: `ORDER-${produk._id}-${Date.now()}`,
        gross_amount: produk.harga
      },
      customer_details: {
        first_name: req.session.userName || 'Guest',
        email: req.session.userEmail || 'guest@example.com'
      },
      item_details: [
        {
          id: produk._id.toString(),
          name: produk.nama,
          price: produk.harga,
          quantity: 1
        }
      ]
    };

    const transaction = await snap.createTransaction(parameter);
    const token = transaction.token;

    res.render('konfirmasi-produk', {
      produk,
      token,
      clientKey: process.env.MIDTRANS_CLIENT_KEY,
      userName: req.session.userName,
      userEmail: req.session.userEmail
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat halaman konfirmasi');
  }
});

// ---------------- Sukses ----------------
app.get('/sukses', async (req, res) => {
  const produkId = req.query.produkId;

  try {
    const produk = await Product.findById(produkId);
    if (!produk) return res.status(404).send('Produk tidak ditemukan');

    console.log('File yang akan di-download:', produk.fileZip);
    res.render('sukses', { produk });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat halaman sukses');
  }
});

// ---------------- Download file Zip ----------------
const fs = require('fs');

app.get('/download/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'uploads', req.params.filename);
  if (!fs.existsSync(filePath)) {
    console.error('❌ File tidak ditemukan:', filePath);
    return res.status(404).send('File tidak ditemukan');
  }
  console.log('Sedang Mendownload',filePath);
  res.download(filePath);
});

// ---------------- ROUTING PRODUCT DI ADMIN ----------------


app.get('/admin/produk', async (req, res) => {
  console.log('GET /admin/produk dipanggil')
  try {
    const produk = await Product.find().sort({ tanggal: -1 });
    res.render('admin/produk-admin', { produk, activePage: 'produk' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal mengambil data produk');
  }
});

// ---------------- POST TAMBAH PRODUK ----------------
app.post('/admin/produk/tambah', upload.fields([
  {name: 'gambar', maxCount: 1},
  {name: 'fileZip', maxCount: 1}
]),
async (req, res) => {
  try {
    const { nama, harga, deskripsi, kategori } = req.body;
    const gambar = req.files['gambar'] ? req.files['gambar'][0].filename : null;
    const fileZip = req.files['fileZip'] ? req.files['fileZip'][0].filename : null;

    await Product.create({
      nama,
      harga,
      deskripsi,
      kategori,
      gambar,
      fileZip
    });

    console.log('✅ Produk berhasil ditambahkan:', nama);
    res.redirect('/admin/produk');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menambahkan produk');
  }
});
// ---------------- EDIT PRODUK-FORM EDIT ----------------
app.get('/admin/produk/:id/edit', async (req, res) => {
  const produk = await Product.findById(req.params.id);
  if (!produk) return res.status(404).send('Produk tidak ditemukan');
  res.render('admin/edit-produk', { produk });
});

// ---------------- EDIT PRODUK-SIMPAN ----------------
app.post('/admin/produk/:id/edit', upload.single('gambar'), async (req, res) => {
  try {
    const { nama, harga, deskripsi, kategori } = req.body;
    const data = { nama, harga, deskripsi, kategori };

    if (req.file) {
      data.gambar = req.file.filename;
    }

    await Product.findByIdAndUpdate(req.params.id, data);
    res.redirect('/admin/produk');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memperbarui produk');
  }
});

// ---------------- HAPUS PRODUK ----------------
app.post('/admin/produk/:id/hapus', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.redirect('/admin/produk');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menghapus produk');
  }
});

// ---------------- UPDATE STATUS ----------------
app.post('/admin/pesanan/:id/update', async (req, res) => {
  try {
    const { status } = req.body;
    await Order.findByIdAndUpdate(req.params.id, { status });
    res.redirect('/admin/pesanan');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memperbarui status');
  }
});

// ---------------- LISTEN ----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server aktif di http://localhost:${PORT}`);
});
