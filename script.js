/**
 * Single Page Application Controller - Responsive & Public Access First
 */

const API_URL = "https://script.google.com/macros/s/AKfycbysyH1er8fwvVa5BsjQiZ31WTHThAKMUu77575RniqNqeoMxFKhvw6gtxc76yyPx4Uq/exec";

const KATEGORI_USIA = ["Caberawit", "Pra Remaja", "REMAJA", "Bapak-bapak", "Ibu-ibu"];

let appState = {
  user: null, // null jika pengunjung belum login (Guest/Tamu)
  masterKelompok: [],
  kegiatanAktif: [],
  monitoringData: [],
  sapaanAnalytics: null,
  currentSapaanFilter: "ALL",
  currentView: "dashboard"
};

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Cek sesi lokal jika pernah login
  const session = sessionStorage.getItem("userProfile");
  if (session) {
    appState.user = JSON.parse(session);
  }

  // 2. Render status header login/profil
  updateTopUserUI();

  // 3. Pasang Event Listener Form
  setupEventListeners();

  // 4. Langsung ambil data publik (tanpa menunggu login)
  await loadInitialData();
  await loadPenyapaanAnalytics();

  // 5. Masuk ke halaman Dashboard default
  navigate("dashboard");
});

function setupEventListeners() {
  document.getElementById("topLoginForm").addEventListener("submit", handleTopLogin);
  document.getElementById("presensiForm").addEventListener("submit", handleSubmitPresensi);
  document.getElementById("sapaanForm").addEventListener("submit", handleSubmitSapaan);
  document.getElementById("formKegiatan").addEventListener("submit", handleCreateKegiatan);
  document.getElementById("formUser").addEventListener("submit", handleCreateUser);
}

function toggleMobileNav() {
  const menu = document.getElementById("mobileNavMenu");
  menu.classList.toggle("hidden");
}

function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  const msg = document.getElementById("toastMsg");
  msg.innerText = message;
  toast.className = `fixed top-5 right-5 z-50 transform transition-all duration-300 translate-y-0 opacity-100 ${
    isError ? "bg-rose-600" : "bg-slate-900"
  } text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs sm:text-sm`;
  
  setTimeout(() => {
    toast.className = toast.className.replace("translate-y-0 opacity-100", "translate-y-[-150%] opacity-0");
  }, 3500);
}

// --- LOGIKA SESI & TOPBAR LOGIN ---

function updateTopUserUI() {
  const loginForm = document.getElementById("topLoginForm");
  const userPanel = document.getElementById("topUserPanel");
  const guestNotice = document.getElementById("guestNotice");

  const navAdmin = document.getElementById("nav-admin");
  const mNavAdmin = document.getElementById("m-nav-admin");

  if (appState.user) {
    // Tampilan jika sudah login
    loginForm.classList.add("hidden");
    userPanel.classList.remove("hidden");
    if (guestNotice) guestNotice.classList.add("hidden");

    document.getElementById("topUserName").innerText = appState.user.nama;
    document.getElementById("topUserRole").innerText = `${appState.user.scopeDesa || 'Daerah'} • ${appState.user.scopeKelompok || 'Semua'}`;
    document.getElementById("topRolePill").innerText = appState.user.role;

    if (appState.user.role === "Super Admin") {
      navAdmin.classList.remove("hidden");
      mNavAdmin.classList.remove("hidden");
    } else {
      navAdmin.classList.add("hidden");
      mNavAdmin.classList.add("hidden");
    }
  } else {
    // Tampilan mode tamu (Guest)
    loginForm.classList.remove("hidden");
    userPanel.classList.add("hidden");
    if (guestNotice) guestNotice.classList.remove("hidden");
    navAdmin.classList.add("hidden");
    mNavAdmin.classList.add("hidden");
  }

  updateRBACUI();
}

async function handleTopLogin(e) {
  e.preventDefault();
  const btn = document.getElementById("btnTopLogin");
  toggleBtnLoading(btn, true);

  const payload = {
    action: "login",
    username: document.getElementById("topUsername").value,
    password: document.getElementById("topPassword").value
  };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result.status === "success") {
      appState.user = result.profile;
      sessionStorage.setItem("userProfile", JSON.stringify(result.profile));
      showToast(`Selamat datang, ${result.profile.nama}`);
      document.getElementById("topLoginForm").reset();
      updateTopUserUI();
      setupDropdowns();
      renderPresensiInputRows();
      navigate(appState.currentView);
    } else {
      showToast(result.message, true);
    }
  } catch (err) {
    showToast("Koneksi server gagal.", true);
  } finally {
    toggleBtnLoading(btn, false, "Masuk");
  }
}

function logout() {
  sessionStorage.removeItem("userProfile");
  appState.user = null;
  showToast("Anda telah keluar dari sesi.");
  updateTopUserUI();
  setupDropdowns();
  renderPresensiInputRows();
  navigate("dashboard");
}

function updateRBACUI() {
  const role = appState.user ? appState.user.role : "Guest";

  // Form Input Presensi: Hanya aktif untuk Admin Kelompok
  const presensiWarning = document.getElementById("presensiAuthWarning");
  const presensiContainer = document.getElementById("presensiFormContainer");
  if (role === "Admin Kelompok") {
    presensiWarning.classList.add("hidden");
    presensiContainer.classList.remove("hidden");
  } else {
    presensiWarning.classList.remove("hidden");
    presensiContainer.classList.add("hidden");
  }

  // Form Input Sapaan: Hanya aktif untuk Super Admin
  const sapaanWarning = document.getElementById("sapaanAuthWarning");
  const sapaanContainer = document.getElementById("sapaanFormContainer");
  if (role === "Super Admin") {
    sapaanWarning.classList.add("hidden");
    sapaanContainer.classList.remove("hidden");
  } else {
    sapaanWarning.classList.remove("hidden");
    sapaanContainer.classList.add("hidden");
  }

  // Panel Admin: Hanya aktif untuk Super Admin
  const adminWarning = document.getElementById("adminAuthWarning");
  const adminContainer = document.getElementById("adminPanelContainer");
  if (role === "Super Admin") {
    adminWarning.classList.add("hidden");
    adminContainer.classList.remove("hidden");
  } else {
    adminWarning.classList.remove("hidden");
    adminContainer.classList.add("hidden");
  }
}

// --- BOOTSTRAP MASTER DATA (PUBLIK) ---

async function loadInitialData() {
  try {
    const res = await fetch(`${API_URL}?action=getInitialData`);
    const result = await res.json();
    if (result.status === "success") {
      appState.masterKelompok = result.data.kelompok;
      appState.kegiatanAktif = result.data.kegiatanAktif;

      document.getElementById("statKegiatanAktif").innerText = appState.kegiatanAktif.length;
      setupDropdowns();
      renderPresensiInputRows();
    }
  } catch (err) {
    showToast("Gagal mengambil data dari Google Sheets.", true);
  }
}

function setupDropdowns() {
  const desaSet = [...new Set(appState.masterKelompok.map(k => k.Nama_Desa))];
  
  // Filter Dropdown Desa
  const filterDesa = document.getElementById("filterDesaStatus");
  filterDesa.innerHTML = '<option value="ALL">Semua Desa</option>' + 
    desaSet.map(d => `<option value="${d}">${d}</option>`).join("");

  // Dropdown Kelompok Jamaah
  const filterJamaah = document.getElementById("filterKelompokJamaah");
  filterJamaah.innerHTML = '<option value="">Pilih Kelompok...</option>' + 
    appState.masterKelompok.map(k => `<option value="${k.ID_Kelompok}">${k.Nama_Desa} - ${k.Nama_Kelompok}</option>`).join("");

  // Dropdown Kegiatan
  const selectKeg = document.getElementById("selectKegiatanPresensi");
  selectKeg.innerHTML = appState.kegiatanAktif.map(k => `<option value="${k.ID_Kegiatan}">${k.Nama_Kegiatan}</option>`).join("");

  const filterKegStatus = document.getElementById("filterKegiatanStatus");
  filterKegStatus.innerHTML = appState.kegiatanAktif.map(k => `<option value="${k.ID_Kegiatan}">${k.Nama_Kegiatan}</option>`).join("");

  // Dropdown Input Sapaan
  const sapaanDesa = document.getElementById("sapaanDesaSelect");
  sapaanDesa.innerHTML = '<option value="">Pilih Desa...</option>' + 
    desaSet.map(d => `<option value="${d}">${d}</option>`).join("");

  // Set Scope Kelompok User
  if (appState.user && appState.user.role === "Admin Kelompok") {
    const kData = appState.masterKelompok.find(k => String(k.ID_Kelompok) === String(appState.user.scopeKelompok));
    document.getElementById("inputKelompokLocked").value = kData ? `${kData.Nama_Desa} - ${kData.Nama_Kelompok}` : appState.user.scopeKelompok;
  }
}

function syncKelompokDropdown(desa) {
  const sapaanKel = document.getElementById("sapaanKelompokSelect");
  const filtered = appState.masterKelompok.filter(k => k.Nama_Desa === desa);
  sapaanKel.innerHTML = filtered.map(k => `<option value="${k.ID_Kelompok}">${k.Nama_Kelompok}</option>`).join("");
}

// --- NAVIGASI SINGLE PAGE APPLICATION ---

function navigate(viewId) {
  appState.currentView = viewId;
  document.querySelectorAll("main > section").forEach(el => el.classList.add("hidden"));
  const activeView = document.getElementById(`view-${viewId}`);
  if (activeView) activeView.classList.remove("hidden");

  // Highlight Nav Link
  document.querySelectorAll("header nav button").forEach(btn => btn.classList.remove("nav-link-active"));
  const activeNavBtn = document.getElementById(`nav-${viewId}`);
  if (activeNavBtn) activeNavBtn.classList.add("nav-link-active");

  if (viewId === "status") {
    loadMonitoringGrid();
  } else if (viewId === "penyapaan") {
    renderPenyapaanView();
  }
}

function switchSapaanTab(tabId) {
  ["tab-pemetaan", "tab-riwayat", "tab-input"].forEach(t => {
    document.getElementById(t).classList.add("hidden");
  });
  document.getElementById(tabId).classList.remove("hidden");

  document.querySelectorAll("#view-penyapaan .tab-sapaan-active").forEach(b => b.classList.remove("tab-sapaan-active"));
  if (tabId === "tab-pemetaan") document.getElementById("btnTabPemetaan").classList.add("tab-sapaan-active");
  if (tabId === "tab-riwayat") document.getElementById("btnTabRiwayat").classList.add("tab-sapaan-active");
  if (tabId === "tab-input") document.getElementById("btnTabInput").classList.add("tab-sapaan-active");
}

// --- VIEW: DATA JAMAAH (PUBLIK) ---

async function loadJamaahData() {
  const kId = document.getElementById("filterKelompokJamaah").value;
  if (!kId) return;

  const tbody = document.getElementById("jamaahTableBody");
  tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400">Mengambil data jamaah...</td></tr>';

  try {
    const res = await fetch(`${API_URL}?action=getJamaahList&id_kelompok=${kId}`);
    const result = await res.json();
    if (result.status === "success") {
      if (result.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400">Belum ada jamaah terdaftar di kelompok ini.</td></tr>';
        return;
      }
      tbody.innerHTML = result.data.map(j => `
        <tr class="hover:bg-slate-50">
          <td class="p-3 font-semibold text-slate-900">${j.Nama_Lengkap}</td>
          <td class="p-3 text-slate-500">${j.Tanggal_Lahir ? String(j.Tanggal_Lahir).slice(0,10) : '-'} (${j.Usia || '-'} th)</td>
          <td class="p-3 text-slate-500">${j.Gender || '-'}</td>
          <td class="p-3"><span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[11px] font-bold">${j.Kelas_Usia}</span></td>
          <td class="p-3 text-slate-500">${j.Nama_Kelompok}</td>
          <td class="p-3">
            <span class="px-2 py-0.5 rounded text-[11px] font-bold ${String(j.Keaktifan).toLowerCase() === 'aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">
              ${j.Keaktifan}
            </span>
          </td>
        </tr>
      `).join("");
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-rose-500">Gagal memuat rujukan jamaah.</td></tr>';
  }
}

// --- VIEW: STATUS 44 KELOMPOK (PUBLIK) ---

async function loadMonitoringGrid() {
  const kegId = document.getElementById("filterKegiatanStatus").value;
  if (!kegId) return;

  const container = document.getElementById("monitoringGridContainer");
  container.innerHTML = '<div class="col-span-full py-8 text-center text-xs text-slate-400">Memuat status pengisian...</div>';

  try {
    const res = await fetch(`${API_URL}?action=getMonitoringStatus&id_kegiatan=${kegId}`);
    const result = await res.json();
    if (result.status === "success") {
      appState.monitoringData = result.data;
      filterMonitoringDisplay();
    }
  } catch (err) {
    container.innerHTML = '<div class="col-span-full py-8 text-center text-xs text-rose-500">Gagal memuat status.</div>';
  }
}

function filterMonitoringDisplay() {
  const selectedDesa = document.getElementById("filterDesaStatus").value;
  const container = document.getElementById("monitoringGridContainer");

  let filtered = appState.monitoringData;
  if (selectedDesa !== "ALL") {
    filtered = filtered.filter(k => k.nama_desa === selectedDesa);
  }

  container.innerHTML = filtered.map(k => `
    <div class="p-3 rounded-2xl border ${
      k.sudah_lapor ? "bg-emerald-50/80 border-emerald-200 text-emerald-900" : "bg-rose-50/80 border-rose-200 text-rose-900"
    } flex flex-col justify-between h-24 card-transition shadow-xs">
      <div>
        <span class="text-[9px] uppercase font-bold tracking-wider opacity-70">${k.nama_desa}</span>
        <div class="text-xs font-bold leading-tight mt-0.5 truncate" title="${k.nama_kelompok}">${k.nama_kelompok}</div>
      </div>
      <div class="flex items-center gap-1.5 mt-2">
        <span class="w-2 h-2 rounded-full ${k.sudah_lapor ? "bg-emerald-500" : "bg-rose-500"}"></span>
        <span class="text-[10px] font-bold">${k.sudah_lapor ? "Sudah Lapor" : "Belum Lapor"}</span>
      </div>
    </div>
  `).join("");
}

// --- VIEW: MODUL PENYAPAAN DAERAH (PUBLIK & ADMIN) ---

async function loadPenyapaanAnalytics() {
  try {
    const res = await fetch(`${API_URL}?action=getPenyapaanAnalytics`);
    const result = await res.json();
    if (result.status === "success") {
      appState.sapaanAnalytics = result.data;
      
      document.getElementById("badgeSapaanNavbar").innerText = `${result.data.totalSapaan} Sapaan`;
      document.getElementById("statTotalSapaan").innerText = `${result.data.totalSapaan} Kunjungan`;
    }
  } catch (err) {
    console.error("Gagal sinkronisasi data penyapaan:", err);
  }
}

function renderPenyapaanView() {
  if (!appState.sapaanAnalytics) return;
  const data = appState.sapaanAnalytics;

  // 1. Rekomendasi 1 terendah per Desa
  const rekomContainer = document.getElementById("rekomendasiCardsContainer");
  rekomContainer.innerHTML = data.rekomendasi.map(r => `
    <div class="bg-white p-3 rounded-xl border border-amber-300 shadow-sm flex flex-col justify-between">
      <div>
        <span class="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">${r.nama_desa}</span>
        <div class="text-xs font-bold text-slate-800 mt-1.5 truncate">${r.nama_kelompok}</div>
      </div>
      <div class="text-[11px] text-slate-500 mt-3 flex justify-between items-center">
        <span>Kunjungan:</span>
        <span class="font-bold text-rose-600">${r.frekuensi} Kali</span>
      </div>
    </div>
  `).join("");

  // 2. Peta Kartu Wilayah 4 Desa
  renderPetaWilayah();

  // 3. Tabel Riwayat
  renderRiwayatTable(data.riwayat);
}

function filterSapaanMap(filterType) {
  appState.currentSapaanFilter = filterType;
  renderPetaWilayah();
}

function renderPetaWilayah() {
  const data = appState.sapaanAnalytics;
  const container = document.getElementById("desaGridContainer");
  const desaGroups = {};

  data.kelompokMapping.forEach(k => {
    if (!desaGroups[k.nama_desa]) desaGroups[k.nama_desa] = [];
    if (appState.currentSapaanFilter === "SUDAH" && k.frekuensi === 0) return;
    if (appState.currentSapaanFilter === "BELUM" && k.frekuensi > 0) return;
    desaGroups[k.nama_desa].push(k);
  });

  container.innerHTML = Object.keys(desaGroups).map(desa => `
    <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
      <div class="flex justify-between items-center border-b pb-2">
        <h4 class="text-xs sm:text-sm font-bold text-slate-900">${desa}</h4>
        <span class="text-xs text-slate-400 font-medium">${desaGroups[desa].length} Kelompok</span>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
        ${desaGroups[desa].map(k => `
          <div class="p-2.5 rounded-xl border ${
            k.frekuensi > 0 ? "bg-emerald-50/70 border-emerald-200" : "bg-slate-50 border-slate-200"
          } flex flex-col justify-between h-20 card-transition">
            <div class="text-[11px] font-semibold text-slate-800 truncate" title="${k.nama_kelompok}">${k.nama_kelompok}</div>
            <div class="text-[10px] ${k.frekuensi > 0 ? "text-emerald-700 font-semibold" : "text-slate-400"} flex justify-between">
              <span>${k.frekuensi > 0 ? `${k.frekuensi}x Disapa` : "Belum Ada"}</span>
              <span>${k.tanggal_terakhir !== '-' ? String(k.tanggal_terakhir).slice(5,10) : ''}</span>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `).join("");
}

function renderRiwayatTable(riwayatList) {
  const tbody = document.getElementById("riwayatTableBody");
  if (!riwayatList || riwayatList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">Belum ada riwayat penyapaan tercatat.</td></tr>';
    return;
  }

  tbody.innerHTML = riwayatList.map(r => `
    <tr class="hover:bg-slate-50">
      <td class="p-3 text-slate-500 whitespace-nowrap">${r.Tanggal ? String(r.Tanggal).slice(0,10) : '-'}</td>
      <td class="p-3 font-semibold text-slate-800 whitespace-nowrap">${r.Nama_Desa} - ${r.Nama_Kelompok}</td>
      <td class="p-3"><span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[11px] font-semibold">${r.Jenis_Kegiatan_Sapaan}</span></td>
      <td class="p-3 text-slate-600 whitespace-nowrap">${r.Nama_Petugas}</td>
      <td class="p-3 text-slate-500 min-w-[200px]">${r.Catatan_Hasil_Solusi}</td>
    </tr>
  `).join("");
}

function filterRiwayatTable() {
  const query = document.getElementById("searchRiwayatInput").value.toLowerCase();
  const filtered = appState.sapaanAnalytics.riwayat.filter(r => 
    String(r.Nama_Kelompok).toLowerCase().includes(query) ||
    String(r.Nama_Desa).toLowerCase().includes(query) ||
    String(r.Nama_Petugas).toLowerCase().includes(query) ||
    String(r.Jenis_Kegiatan_Sapaan).toLowerCase().includes(query)
  );
  renderRiwayatTable(filtered);
}

// --- VIEW: INPUT PRESENSI AGREGAT ---

function renderPresensiInputRows() {
  const container = document.getElementById("presensiInputRows");
  let kData = null;

  if (appState.user && appState.user.scopeKelompok) {
    kData = appState.masterKelompok.find(k => String(k.ID_Kelompok) === String(appState.user.scopeKelompok));
  }

  container.innerHTML = KATEGORI_USIA.map(kat => {
    let target = 0;
    if (kData) {
      if (kat === "Caberawit") target = kData.Target_Caberawit || 0;
      if (kat === "Pra Remaja") target = kData.Target_Pra_Remaja || 0;
      if (kat === "REMAJA") target = kData.Target_REMAJA || 0;
      if (kat === "Bapak-bapak") target = kData.Target_Bapak || 0;
      if (kat === "Ibu-ibu") target = kData.Target_Ibu || 0;
    }

    return `
      <tr data-kategori="${kat}">
        <td class="py-2.5 px-3 font-semibold text-slate-800">${kat}</td>
        <td class="py-2 px-1"><input type="number" min="0" value="0" class="input-hadir w-14 sm:w-16 text-center border rounded-lg p-1 mx-auto block text-xs"></td>
        <td class="py-2 px-1"><input type="number" min="0" value="0" class="input-izin w-14 sm:w-16 text-center border rounded-lg p-1 mx-auto block text-xs"></td>
        <td class="py-2 px-1"><input type="number" min="0" value="0" class="input-sakit w-14 sm:w-16 text-center border rounded-lg p-1 mx-auto block text-xs"></td>
        <td class="py-2 px-1"><input type="number" min="0" value="0" class="input-alpa w-14 sm:w-16 text-center border rounded-lg p-1 mx-auto block text-xs"></td>
        <td class="py-2 px-1 text-center text-slate-500 font-semibold target-val">${target}</td>
      </tr>
    `;
  }).join("");
}

async function handleSubmitPresensi(e) {
  e.preventDefault();
  if (!appState.user || appState.user.role !== "Admin Kelompok") {
    showToast("Anda harus login sebagai Admin Kelompok.", true);
    return;
  }

  const btn = document.getElementById("btnSubmitPresensi");
  toggleBtnLoading(btn, true);

  const kategoriData = [];
  document.querySelectorAll("#presensiInputRows tr").forEach(row => {
    kategoriData.push({
      kategoriUsia: row.dataset.kategori,
      hadir: row.querySelector(".input-hadir").value,
      izin: row.querySelector(".input-izin").value,
      sakit: row.querySelector(".input-sakit").value,
      alpa: row.querySelector(".input-alpa").value,
      totalTarget: row.querySelector(".target-val").innerText
    });
  });

  const payload = {
    action: "submitPresensi",
    idKegiatan: document.getElementById("selectKegiatanPresensi").value,
    idKelompok: appState.user.scopeKelompok,
    inputBy: appState.user.nama,
    kategoriData: kategoriData
  };

  try {
    const res = await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) });
    const result = await res.json();
    if (result.status === "success") {
      showToast(result.message);
      document.getElementById("presensiForm").reset();
      renderPresensiInputRows();
    } else {
      showToast(result.message, true);
    }
  } catch (err) {
    showToast("Gagal menyimpan presensi.", true);
  } finally {
    toggleBtnLoading(btn, false, "Kirim Laporan Presensi");
  }
}

// --- SUBMIT SAPAAN & ADMIN CONTROL ---

async function handleSubmitSapaan(e) {
  e.preventDefault();
  if (!appState.user || appState.user.role !== "Super Admin") {
    showToast("Hanya Super Admin yang dapat menambah sapaan.", true);
    return;
  }

  const btn = document.getElementById("btnSubmitSapaan");
  toggleBtnLoading(btn, true);

  const kSelect = document.getElementById("sapaanKelompokSelect");
  const payload = {
    action: "addPenyapaan",
    tanggal: document.getElementById("sapaanTanggal").value,
    namaDesa: document.getElementById("sapaanDesaSelect").value,
    idKelompok: kSelect.value,
    namaKelompok: kSelect.options[kSelect.selectedIndex].text,
    namaPetugas: document.getElementById("sapaanPetugas").value,
    jenisKegiatan: document.getElementById("sapaanAgenda").value,
    catatan: document.getElementById("sapaanCatatan").value
  };

  try {
    const res = await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) });
    const result = await res.json();
    if (result.status === "success") {
      showToast(result.message);
      document.getElementById("sapaanForm").reset();
      await loadPenyapaanAnalytics();
      switchSapaanTab("tab-pemetaan");
      renderPenyapaanView();
    } else {
      showToast(result.message, true);
    }
  } catch (err) {
    showToast("Gagal menyimpan log penyapaan.", true);
  } finally {
    toggleBtnLoading(btn, false, "Simpan Laporan Sapaan");
  }
}

async function handleCreateKegiatan(e) {
  e.preventDefault();
  const btn = document.getElementById("btnSubmitKegiatan");
  toggleBtnLoading(btn, true);

  const payload = {
    action: "createKegiatan",
    namaKegiatan: document.getElementById("kegiatanNama").value,
    tanggalMulai: document.getElementById("kegiatanMulai").value,
    tanggalSelesai: document.getElementById("kegiatanSelesai").value,
    targetUsia: document.getElementById("kegiatanTarget").value
  };

  try {
    const res = await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) });
    const result = await res.json();
    if (result.status === "success") {
      showToast(result.message);
      document.getElementById("formKegiatan").reset();
      await loadInitialData();
    }
  } catch (err) {
    showToast("Gagal membuka kegiatan.", true);
  } finally {
    toggleBtnLoading(btn, false, "Buka Kegiatan");
  }
}

async function handleCreateUser(e) {
  e.preventDefault();
  const btn = document.getElementById("btnSubmitUser");
  toggleBtnLoading(btn, true);

  const payload = {
    action: "createUser",
    nama: document.getElementById("userNama").value,
    username: document.getElementById("userUsername").value,
    password: document.getElementById("userPassword").value,
    role: document.getElementById("userRole").value,
    scopeDesa: document.getElementById("userScopeDesa").value,
    scopeKelompok: document.getElementById("userScopeKelompok").value
  };

  try {
    const res = await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) });
    const result = await res.json();
    if (result.status === "success") {
      showToast(result.message);
      document.getElementById("formUser").reset();
    }
  } catch (err) {
    showToast("Gagal mendaftarkan user.", true);
  } finally {
    toggleBtnLoading(btn, false, "Simpan Akun Pengguna");
  }
}

function adjustScopeInputs(role) {
  const desaInput = document.getElementById("userScopeDesa");
  const kelInput = document.getElementById("userScopeKelompok");

  if (role === "Super Admin") {
    desaInput.value = "ALL";
    kelInput.value = "ALL";
    desaInput.disabled = true;
    kelInput.disabled = true;
  } else if (role === "Admin Desa") {
    desaInput.disabled = false;
    kelInput.value = "ALL";
    kelInput.disabled = true;
  } else {
    desaInput.disabled = false;
    kelInput.disabled = false;
  }
}

function toggleBtnLoading(btn, isLoading, defaultText = "") {
  if (isLoading) {
    btn.disabled = true;
    btn.dataset.oldHtml = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span>';
  } else {
    btn.disabled = false;
    btn.innerHTML = defaultText ? `<span>${defaultText}</span>` : btn.dataset.oldHtml;
  }
}
