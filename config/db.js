// config/db.js
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, '❌ Koneksi MongoDB gagal:'));
db.once('open', () => {
  console.log('✅ Terkoneksi ke MongoDB Atlas!');
});

module.exports = db;
