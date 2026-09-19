// =========================================================================
// FRONTEND LOGIC & REST API INTEGRATION (MOBILE OPTIMIZED & FULL CRUD)
// =========================================================================

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxsKkUaZguZ61zXtj17hi2tHQ7lP3TtPensR_ptmlhkWeGta3hyw1JjMAMmJ5MNzRu3/exec";

let appData = {
  pengurus: [],
  inventaris: [],
  jamaah: [],
  presensi: [],
  kegiatan: [],
  admins: [],
  master_kelompok: [],
  penyapaan: []
};

let currentAdmin = null;
let currentKelompok = "Caberawit";
let currentKelas = "Caberawit A";
let activeFormType = null;
let currentPetaFilter = "all";
let analyticsPenyapaan = null;
let currentActiveTab = "beranda";
let localPenyapaanData = [];
let editingRecordId = null;

document.addEventListener("DOMContentLoaded", () => {
  const savedAdmin = sessionStorage.getItem("currentAdmin");
  if (savedAdmin) {
    try {
      currentAdmin = JSON.parse(savedAdmin);
    } catch (e) {
      currentAdmin = null;
    }
  }

  setDefaultDate();
  loadAllData();
  updateAdminUI();
  switchTab("beranda");
});

// RBAC & AUTHENTICATION
function getAdminRole() {
  if (!currentAdmin) return "guest";
  return String(currentAdmin.role || "").trim().toLowerCase();
}

function isSuperOrDaerah() {
  const role = getAdminRole();
  return role.includes("super") || role.includes("daerah") || role.includes("admin daerah") || role === "admin";
}

function canWritePenyapaan() {
  return isSuperOrDaerah();
}

function showMessage(text, type = "info") {
  const msgBox = document.getElementById("status-message");
  if (!msgBox) return;
  msgBox.className = `mb-4 p-3 rounded-xl font-medium text-xs sm:text-sm border shadow-xs flex items-center justify-between ${
    type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
    type === "error" ? "bg-rose-50 text-rose-800 border-rose-200" :
    "bg-teal-50 text-teal-800 border-teal-200"
  }`;
  msgBox.innerHTML = `<span>${text}</span>`;
  msgBox.classList.remove("hidden");
}

function hideMessage() {
  const msgBox = document.getElementById("status-message");
  if (msgBox) msgBox.classList.add("hidden");
}

function openLoginModal() {
  const modal = document.getElementById("modal-login");
  if (modal) modal.classList.remove("hidden");
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add("hidden");
}

async function handleLogin(event) {
  event.preventDefault();
  const namaInput = document.getElementById("login-nama").value.trim();
  const pinInput = document.getElementById("login-pin").value.trim();

  if (!namaInput || !pinInput) {
    alert("Nama dan PIN/Sandi wajib diisi!");
    return;
  }

  showMessage("Sedang memproses login...", "info");

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "login",
        username: namaInput,
        password: pinInput
      })
    });
    const json = await res.json();

    if (json.success && json.admin) {
      currentAdmin = json.admin;
      sessionStorage.setItem("currentAdmin", JSON.stringify(currentAdmin));
      closeModal("modal-login");
      showMessage("Login berhasil! Selamat datang, " + (currentAdmin.nama || currentAdmin.username), "success");
      updateAdminUI();
      loadAllData();
    } else {
      alert("Gagal Login: " + (json.message || "Nama atau PIN salah."));
      hideMessage();
    }
  } catch (err) {
    console.error("Login Error:", err);
    alert("Terjadi kesalahan jaringan saat mencoba login ke server.");
    hideMessage();
  }
}

function logoutAdmin() {
  sessionStorage.removeItem("currentAdmin");
  currentAdmin = null;
  alert("Anda telah keluar (logout).");
  window.location.reload();
}

function updateAdminUI() {
  const badgeContainer = document.getElementById("admin-badge");
  const nameDisplay = document.getElementById("admin-name-display");
  const btnLogin = document.getElementById("btn-login-modal");
  const btnLogout = document.getElementById("btn-logout");
  const btnManage = document.getElementById("btn-admin-manage");

  if (currentAdmin) {
    if (badgeContainer) badgeContainer.classList.remove("hidden");
    if (nameDisplay) nameDisplay.innerText = currentAdmin.nama || currentAdmin.username || "Admin";
    if (btnLogin) btnLogin.classList.add("hidden");
    if (btnLogout) btnLogout.classList.remove("hidden");
    if (isSuperOrDaerah() && btnManage) {
      btnManage.classList.remove("hidden");
    } else if (btnManage) {
      btnManage.classList.add("hidden");
    }
    document.querySelectorAll(".admin-only").forEach(el => el.classList.remove("hidden"));
  } else {
    if (badgeContainer) badgeContainer.classList.add("hidden");
    if (btnLogin) btnLogin.classList.remove("hidden");
    if (btnLogout) btnLogout.classList.add("hidden");
    if (btnManage) btnManage.classList.add("hidden");
    document.querySelectorAll(".admin-only").forEach(el => el.classList.add("hidden"));
  }
}

function setDefaultDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const formattedToday = `${year}-${month}-${day}`;

  const dateInput = document.getElementById("presensi-date");
  if (dateInput) {
    dateInput.value = formattedToday;
    updateDayLabel();
  }

  const sapaanDateInput = document.getElementById("sapaan-batch-date");
  if (sapaanDateInput) {
    sapaanDateInput.value = formattedToday;
    updateSapaanDayLabel();
  }
}

function updateDayLabel() {
  const dateInput = document.getElementById("presensi-date");
  if (!dateInput || !dateInput.value) return;
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const d = new Date(dateInput.value + "T00:00:00");
  const dayEl = document.getElementById("presensi-day");
  if (dayEl) dayEl.value = days[d.getDay()];
  renderPresensiTable();
}

function updateSapaanDayLabel() {
  const dateInput = document.getElementById("sapaan-batch-date");
  if (!dateInput || !dateInput.value) return;
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const d = new Date(dateInput.value + "T00:00:00");
  const dayEl = document.getElementById("sapaan-batch-day");
  if (dayEl) dayEl.value = days[d.getDay()];
}

async function loadAllData() {
  showMessage("Memuat data dari server...", "info");
  try {
    const res = await fetch(`${SCRIPT_URL}?action=get_all_data`);
    const json = await res.json();
    if (json.success) {
      appData = {
        pengurus: Array.isArray(json.pengurus) ? json.pengurus : [],
        inventaris: Array.isArray(json.inventaris) ? json.inventaris : [],
        jamaah: Array.isArray(json.jamaah) ? json.jamaah : [],
        presensi: Array.isArray(json.presensi) ? json.presensi : [],
        kegiatan: Array.isArray(json.kegiatan) ? json.kegiatan : [],
        admins: Array.isArray(json.admins || json.users) ? (json.admins || json.users) : [],
        master_kelompok: Array.isArray(json.master_kelompok) ? json.master_kelompok : [],
        penyapaan: Array.isArray(json.penyapaan) ? json.penyapaan : []
      };

      try {
        await loadPenyapaanAnalytics();
        initGlobalWilayahFilters();
        initPresensiWilayahFilters();
        updateAdminUI();
        buildLocalPenyapaanState();
        renderAllViews();
      } catch (renderErr) {
        console.error("Render error:", renderErr);
      }
      hideMessage();
    } else {
      showMessage("Gagal memuat data: " + (json.error || json.message), "error");
    }
  } catch (err) {
    console.error("Network Error:", err);
    showMessage("Gagal terhubung ke Google Apps Script.", "error");
  }
}

async function loadPenyapaanAnalytics() {
  try {
    const res = await fetch(`${SCRIPT_URL}?action=get_penyapaan_analytics`);
    const json = await res.json();
    if (json.success) {
      analyticsPenyapaan = json;
      const badge = document.getElementById("badge-total-sapaan");
      if (badge) badge.innerText = json.totalSapaan || 0;
    }
  } catch (e) {
    console.warn("Gagal memuat analitik penyapaan:", e);
  }
}

function renderAllViews() {
  renderBerandaKegiatan();
  renderPengurus();
  renderInventaris();
  renderJamaah();
  renderPresensiTable();
  renderMonitoringTable();
  renderPenyapaanModule();
}

function switchTab(tabName) {
  currentActiveTab = tabName;
  document.querySelectorAll(".view-section").forEach(s => s.classList.add("hidden"));
  document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active", "border-teal-600", "text-teal-700", "font-bold"));

  const targetView = document.getElementById(`view-${tabName}`);
  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetView) targetView.classList.remove("hidden");
  if (targetTab) targetTab.classList.add("active", "border-teal-600", "text-teal-700", "font-bold");

  const presensiWilayahNav = document.getElementById("presensi-wilayah-nav");
  const subnav = document.getElementById("subnav-container");
  const classnav = document.getElementById("classnav-container");
  const filterSearchBox = document.getElementById("nav-filter-search-container");

  const allowedTabs = ["pengurus", "inventaris", "jamaah", "monitoring"];
  if (filterSearchBox) {
    if (allowedTabs.includes(tabName)) {
      filterSearchBox.classList.remove("hidden");
    } else {
      filterSearchBox.classList.add("hidden");
    }
  }

  if (tabName === "kelompok") {
    if (presensiWilayahNav) presensiWilayahNav.classList.remove("hidden");
    if (subnav) subnav.classList.remove("hidden");
    selectKelompok(currentKelompok);
  } else {
    if (presensiWilayahNav) presensiWilayahNav.classList.add("hidden");
    if (subnav) subnav.classList.add("hidden");
    if (classnav) classnav.classList.add("hidden");
  }

  if (tabName === "monitoring") renderMonitoringTable();
  else if (tabName === "penyapaan") renderPenyapaanModule();
  else if (tabName === "beranda") renderBerandaKegiatan();
  else if (tabName === "pengurus") renderPengurus();
  else if (tabName === "inventaris") renderInventaris();
  else if (tabName === "jamaah") renderJamaah();
}

function selectKelompok(kelompok) {
  currentKelompok = kelompok;
  document.querySelectorAll(".subnav-btn").forEach(b => b.classList.remove("active", "bg-teal-700", "text-white"));

  const idMap = {
    "ASAD": "sub-asad",
    "Caberawit": "sub-caberawit",
    "Pra Remaja": "sub-pra-remaja",
    "Remaja": "sub-remaja",
    "Muda-Mudi": "sub-muda-mudi",
    "Bapak-Bapak": "sub-bapak",
    "Ibu-Ibu": "sub-ibu"
  };
  if (idMap[kelompok] && document.getElementById(idMap[kelompok])) {
    document.getElementById(idMap[kelompok]).classList.add("active", "bg-teal-700", "text-white");
  }

  const classnav = document.getElementById("classnav-container");
  const classBtnContainer = document.getElementById("class-buttons");

  if (kelompok === "ASAD") {
    const classes = ["Caberawit Laki-Laki", "Caberawit Perempuan", "Laki-Laki", "Perempuan"];
    if (classnav) classnav.classList.remove("hidden");
    if (classBtnContainer) {
      classBtnContainer.innerHTML = "";
      classes.forEach((cls, idx) => {
        const btn = document.createElement("button");
        btn.className = `classnav-btn px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-teal-50 text-xs shrink-0 font-medium ${idx === 0 ? 'bg-teal-600 text-white border-teal-600' : ''}`;
        btn.innerText = cls;
        btn.onclick = () => selectKelas(cls, btn);
        classBtnContainer.appendChild(btn);
      });
    }
    selectKelas("Caberawit Laki-Laki");
  } else if (kelompok === "Caberawit") {
    const classes = ["Caberawit A", "Caberawit B", "Caberawit C", "Caberawit D"];
    if (classnav) classnav.classList.remove("hidden");
    if (classBtnContainer) {
      classBtnContainer.innerHTML = "";
      classes.forEach((cls, idx) => {
        const btn = document.createElement("button");
        btn.className = `classnav-btn px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-teal-50 text-xs shrink-0 font-medium ${idx === 0 ? 'bg-teal-600 text-white border-teal-600' : ''}`;
        btn.innerText = cls;
        btn.onclick = () => selectKelas(cls, btn);
        classBtnContainer.appendChild(btn);
      });
    }
    selectKelas(currentKelas && classes.includes(currentKelas) ? currentKelas : "Caberawit A");
  } else {
    if (classnav) classnav.classList.add("hidden");
    selectKelas("Umum");
  }
}

function selectKelas(kelas, btnEl) {
  currentKelas = kelas;
  if (btnEl) {
    document.querySelectorAll(".classnav-btn").forEach(b => b.classList.remove("bg-teal-600", "text-white", "border-teal-600"));
    btnEl.classList.add("bg-teal-600", "text-white", "border-teal-600");
  }
  const titleEl = document.getElementById("presensi-class-title");
  if (titleEl) {
    if (currentKelompok === "Caberawit" || currentKelompok === "ASAD") {
      titleEl.innerText = `Presensi: ${currentKelompok} (${currentKelas})`;
    } else {
      titleEl.innerText = `Presensi: ${currentKelompok}`;
    }
  }
  renderPresensiTable();
}

function calculateAge(dobString) {
  if (!dobString) return "-";
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return "-";
  const diffMs = Date.now() - dob.getTime();
  const ageDate = new Date(diffMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970) + " Thn";
}

function getDesaByKelompok(namaKelompok) {
  if (!namaKelompok || namaKelompok === "-") return "-";
  const mk = Array.isArray(appData.master_kelompok) ? appData.master_kelompok : [];
  const found = mk.find(k => String(k.Nama_Kelompok || "").trim().toLowerCase() === String(namaKelompok).trim().toLowerCase());
  return found ? String(found.Nama_Desa || "-").trim() : "-";
}

function getKelompokByNama(nama) {
  const jamaahList = Array.isArray(appData.jamaah) ? appData.jamaah : [];
  const found = jamaahList.find(j => String(j.Nama_Lengkap || j.Nama || "").trim().toLowerCase() === String(nama).trim().toLowerCase());
  return found ? (found.Nama_Kelompok || found.KelompokBinaan || "-") : "-";
}

// =========================================================================
// INISIALISASI FILTER WILAYAH (GLOBAL & PRESENSI)
// =========================================================================

function initGlobalWilayahFilters() {
  const desaSelect = document.getElementById("global-filter-desa");
  if (!desaSelect) return;

  const mk = Array.isArray(appData.master_kelompok) ? appData.master_kelompok : [];
  let desas = new Set();
  mk.forEach(m => {
    if (m.Nama_Desa && String(m.Nama_Desa).trim() !== "" && m.Nama_Desa !== "-") {
      desas.add(String(m.Nama_Desa).trim());
    }
  });

  if (desas.size === 0) desas = new Set(["Desa 1", "Desa 2", "Desa 3", "Desa 4"]);

  desaSelect.innerHTML = `<option value="Semua">Semua Desa</option>` +
    Array.from(desas).map(d => `<option value="${d}">${d}</option>`).join("");

  onGlobalDesaChange();
}

function onGlobalDesaChange() {
  const desaSelect = document.getElementById("global-filter-desa");
  const kelSelect = document.getElementById("global-filter-kelompok");
  if (!desaSelect || !kelSelect) return;

  const selectedDesa = desaSelect.value;
  const mk = Array.isArray(appData.master_kelompok) ? appData.master_kelompok : [];
  let kelompokList = [];

  if (selectedDesa === "Semua") {
    kelompokList = mk.map(m => String(m.Nama_Kelompok || "").trim()).filter(Boolean);
  } else {
    kelompokList = mk
      .filter(m => String(m.Nama_Desa || "").trim().toLowerCase() === selectedDesa.toLowerCase())
      .map(m => String(m.Nama_Kelompok || "").trim())
      .filter(Boolean);
  }

  const uniqueKelompok = [...new Set(kelompokList)];

  kelSelect.innerHTML = `<option value="Semua">Semua Kelompok</option>` +
    uniqueKelompok.map(k => `<option value="${k}">${k}</option>`).join("");

  onGlobalKelompokChange();
}

function onGlobalKelompokChange() {
  refreshCurrentActiveView();
}

function onGlobalSearchInput() {
  refreshCurrentActiveView();
}

function refreshCurrentActiveView() {
  if (currentActiveTab === "pengurus") renderPengurus();
  else if (currentActiveTab === "inventaris") renderInventaris();
  else if (currentActiveTab === "jamaah") renderJamaah();
  else if (currentActiveTab === "monitoring") renderMonitoringTable();
}

function initPresensiWilayahFilters() {
  const desaSelect = document.getElementById("presensi-filter-desa");
  if (!desaSelect) return;

  const mk = Array.isArray(appData.master_kelompok) ? appData.master_kelompok : [];
  let desas = new Set();
  mk.forEach(m => {
    if (m.Nama_Desa && String(m.Nama_Desa).trim() !== "" && m.Nama_Desa !== "-") {
      desas.add(String(m.Nama_Desa).trim());
    }
  });

  if (desas.size === 0) desas = new Set(["Desa 1", "Desa 2", "Desa 3", "Desa 4"]);

  desaSelect.innerHTML = `<option value="Semua">Semua Desa</option>` +
    Array.from(desas).map(d => `<option value="${d}">${d}</option>`).join("");

  onPresensiDesaChange();
}

function onPresensiDesaChange() {
  const desaSelect = document.getElementById("presensi-filter-desa");
  const kelSelect = document.getElementById("presensi-filter-kelompok");
  if (!desaSelect || !kelSelect) return;

  const selectedDesa = desaSelect.value;
  const mk = Array.isArray(appData.master_kelompok) ? appData.master_kelompok : [];
  let kelompokList = [];

  if (selectedDesa === "Semua") {
    kelompokList = mk.map(m => String(m.Nama_Kelompok || "").trim()).filter(Boolean);
  } else {
    kelompokList = mk
      .filter(m => String(m.Nama_Desa || "").trim().toLowerCase() === selectedDesa.toLowerCase())
      .map(m => String(m.Nama_Kelompok || "").trim())
      .filter(Boolean);
  }

  const uniqueKelompok = [...new Set(kelompokList)];

  kelSelect.innerHTML = `<option value="Semua">Semua Kelompok</option>` +
    uniqueKelompok.map(k => `<option value="${k}">${k}</option>`).join("");

  renderPresensiTable();
}

// =========================================================================
// SISTEM MODAL FORM GENERATOR (ROBUST DOM INJECTION)
// =========================================================================

function createDynamicModal() {
  let existing = document.getElementById("modal-dynamic-form");
  if (existing) existing.remove();

  const div = document.createElement("div");
  div.id = "modal-dynamic-form";
  div.className = "fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 hidden";
  div.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
      <div class="bg-teal-900 text-white px-4 py-3.5 sm:px-5 sm:py-4 flex justify-between items-center shrink-0">
        <h3 id="dynamic-modal-title" class="font-bold text-sm sm:text-base">Formulir Data</h3>
        <button type="button" onclick="closeModal('modal-dynamic-form')" class="text-white hover:text-rose-300 text-lg"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div id="dynamic-modal-body" class="p-4 sm:p-6 overflow-y-auto grow"></div>
      <div class="bg-slate-50 px-4 py-3 sm:px-5 sm:py-3 border-t flex justify-end gap-2 shrink-0">
        <button type="button" onclick="closeModal('modal-dynamic-form')" class="px-3.5 py-2 rounded-xl text-xs font-bold border bg-white hover:bg-slate-100 text-slate-700">Batal</button>
        <button type="button" onclick="submitDynamicForm()" class="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-md">Simpan Data</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);
  return div;
}

function openModalForm(type, id = null) {
  if (!currentAdmin) {
    alert("Akses Admin diperlukan untuk menambah atau mengubah data!");
    return;
  }

  activeFormType = type;
  editingRecordId = id;

  let modal = document.getElementById("modal-dynamic-form");
  if (!modal) {
    modal = createDynamicModal();
  }

  const titleEl = document.getElementById("dynamic-modal-title");
  const bodyEl = document.getElementById("dynamic-modal-body");
  if (!modal || !titleEl || !bodyEl) return;

  const mkList = Array.isArray(appData.master_kelompok) ? appData.master_kelompok : [];
  let formHtml = "";
  let title = "";

  if (type === "kegiatan") {
    title = id ? "Edit Agenda Kegiatan" : "Tambah Agenda Kegiatan Baru";
    const item = id ? (appData.kegiatan || []).find(x => String(x.ID || x.ID_Kegiatan) === String(id)) : {};
    const tglVal = item?.Tanggal ? String(item.Tanggal).split("T")[0] : new Date().toISOString().split("T")[0];

    formHtml = `
      <input type="hidden" id="form-kegiatan-id" value="${item?.ID || item?.ID_Kegiatan || ''}">
      <div class="space-y-3 text-xs sm:text-sm">
        <div>
          <label class="block font-bold text-slate-700 mb-1">Nama Kegiatan *</label>
          <input type="text" id="form-kegiatan-nama" value="${item?.Kegiatan || item?.Nama_Kegiatan || ''}" required class="w-full border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-teal-500" placeholder="Misal: Pengajian Rutin Daerah">
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Tanggal *</label>
            <input type="date" id="form-kegiatan-tanggal" value="${tglVal}" required class="w-full border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-teal-500">
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Hari</label>
            <input type="text" id="form-kegiatan-hari" value="${item?.Hari || 'Minggu'}" class="w-full border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-teal-500">
          </div>
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1">Jam / Waktu</label>
          <input type="text" id="form-kegiatan-jam" value="${item?.Jam || '19:30 - Selesai'}" class="w-full border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-teal-500">
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1">Pemateri</label>
          <input type="text" id="form-kegiatan-pemateri" value="${item?.Pemateri || ''}" class="w-full border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-teal-500" placeholder="Nama Ustaz / Pemateri">
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1">Keterangan / Lokasi</label>
          <textarea id="form-kegiatan-ket" rows="2" class="w-full border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-teal-500" placeholder="Lokasi majelis atau detail agenda">${item?.Keterangan || ''}</textarea>
        </div>
      </div>
    `;
  } else if (type === "pengurus") {
    title = id ? "Edit Data Pengurus" : "Tambah Data Pengurus";
    const item = id ? (appData.pengurus || []).find(x => String(x.ID) === String(id)) : {};
    const kelOptions = mkList.map(m => `<option value="${m.Nama_Kelompok}" ${item?.Kelompok === m.Nama_Kelompok || item?.Nama_Kelompok === m.Nama_Kelompok ? 'selected' : ''}>${m.Nama_Desa} - ${m.Nama_Kelompok}</option>`).join("");

    formHtml = `
      <input type="hidden" id="form-pengurus-id" value="${item?.ID || ''}">
      <div class="space-y-3 text-xs sm:text-sm">
        <div>
          <label class="block font-bold text-slate-700 mb-1">Nama Lengkap *</label>
          <input type="text" id="form-pengurus-nama" value="${item?.Nama || ''}" required class="w-full border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-teal-500">
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1">Kelompok Wilayah</label>
          <select id="form-pengurus-kelompok" class="w-full border rounded-lg px-3 py-2 bg-white outline-none focus:ring-1 focus:ring-teal-500">
            ${kelOptions || '<option value="-">-</option>'}
          </select>
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1">Jabatan *</label>
          <input type="text" id="form-pengurus-jabatan" value="${item?.Jabatan || ''}" required class="w-full border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-teal-500" placeholder="Contoh: Ketua, Sekretaris, Pembina">
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1">No. HP</label>
          <input type="text" id="form-pengurus-nohp" value="${item?.NoHP || ''}" class="w-full border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-teal-500">
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1">Status</label>
          <select id="form-pengurus-status" class="w-full border rounded-lg px-3 py-2 bg-white outline-none focus:ring-1 focus:ring-teal-500">
            <option value="Aktif" ${item?.Status !== 'Non-Aktif' ? 'selected' : ''}>Aktif</option>
            <option value="Non-Aktif" ${item?.Status === 'Non-Aktif' ? 'selected' : ''}>Non-Aktif</option>
          </select>
        </div>
      </div>
    `;
  } else if (type === "inventaris") {
    title = id ? "Edit Inventaris Barang" : "Tambah Inventaris Barang";
    const item = id ? (appData.inventaris || []).find(x => String(x.ID) === String(id)) : {};
    const tglMasukVal = item?.TanggalMasuk ? String(item.TanggalMasuk).split("T")[0] : new Date().toISOString().split("T")[0];
    const kelOptions = mkList.map(m => `<option value="${m.Nama_Kelompok}" ${item?.Kelompok === m.Nama_Kelompok || item?.Nama_Kelompok === m.Nama_Kelompok ? 'selected' : ''}>${m.Nama_Desa} - ${m.Nama_Kelompok}</option>`).join("");

    formHtml = `
      <input type="hidden" id="form-inventaris-id" value="${item?.ID || ''}">
      <div class="space-y-3 text-xs sm:text-sm">
        <div>
          <label class="block font-bold text-slate-700 mb-1">Nama Barang *</label>
          <input type="text" id="form-inventaris-nama" value="${item?.NamaBarang || ''}" required class="w-full border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-teal-500">
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1">Kelompok Lokasi</label>
          <select id="form-inventaris-kelompok" class="w-full border rounded-lg px-3 py-2 bg-white outline-none focus:ring-1 focus:ring-teal-500">
            ${kelOptions || '<option value="-">-</option>'}
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Jumlah</label>
            <input type="number" id="form-inventaris-jumlah" value="${item?.Jumlah || 1}" min="1" required class="w-full border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-teal-500">
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Kondisi</label>
            <select id="form-inventaris-kondisi" class="w-full border rounded-lg px-3 py-2 bg-white outline-none focus:ring-1 focus:ring-teal-500">
              <option value="Baik" ${item?.Kondisi !== 'Rusak' ? 'selected' : ''}>Baik</option>
              <option value="Rusak" ${item?.Kondisi === 'Rusak' ? 'selected' : ''}>Rusak</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1">Tanggal Masuk</label>
          <input type="date" id="form-inventaris-tanggal" value="${tglMasukVal}" class="w-full border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-teal-500">
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1">Keterangan</label>
          <textarea id="form-inventaris-ket" rows="2" class="w-full border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-teal-500">${item?.Keterangan || ''}</textarea>
        </div>
      </div>
    `;
  } else if (type === "jamaah") {
    title = id ? "Edit Data Jamaah" : "Tambah Data Jamaah";
    const item = id ? (appData.jamaah || []).find(x => String(x.ID_Jamaah || x.ID) === String(id)) : {};
    const tglLahirVal = item?.TanggalLahir ? String(item.TanggalLahir).split("T")[0] : "";
    const kelOptions = mkList.map(m => `<option value="${m.Nama_Kelompok}" ${item?.Nama_Kelompok === m.Nama_Kelompok || item?.KelompokBinaan === m.Nama_Kelompok ? 'selected' : ''}>${m.Nama_Desa} - ${m.Nama_Kelompok}</option>`).join("");

    formHtml = `
      <input type="hidden" id="form-jamaah-id" value="${item?.ID_Jamaah || item?.ID || ''}">
      <div class="space-y-3 text-xs sm:text-sm">
        <div>
          <label class="block font-bold text-slate-700 mb-1">Nama Lengkap *</label>
          <input type="text" id="form-jamaah-nama" value="${item?.Nama_Lengkap || item?.Nama || ''}" required class="w-full border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-teal-500">
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1">Tanggal Lahir</label>
          <input type="date" id="form-jamaah-tgl" value="${tglLahirVal}" class="w-full border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-teal-500">
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Jenjang Usia</label>
            <select id="form-jamaah-kelas-usia" class="w-full border rounded-lg px-3 py-2 bg-white outline-none focus:ring-1 focus:ring-teal-500">
              <option value="Caberawit" ${String(item?.Kelas_Usia || item?.Kelompok || '').includes('Caberawit') ? 'selected' : ''}>Caberawit</option>
              <option value="Pra Remaja" ${item?.Kelas_Usia === 'Pra Remaja' ? 'selected' : ''}>Pra Remaja</option>
              <option value="Remaja" ${item?.Kelas_Usia === 'Remaja' ? 'selected' : ''}>Remaja</option>
              <option value="Muda-Mudi" ${item?.Kelas_Usia === 'Muda-Mudi' ? 'selected' : ''}>Muda-Mudi</option>
              <option value="Bapak-Bapak" ${item?.Kelas_Usia === 'Bapak-Bapak' ? 'selected' : ''}>Bapak-Bapak</option>
              <option value="Ibu-Ibu" ${item?.Kelas_Usia === 'Ibu-Ibu' ? 'selected' : ''}>Ibu-Ibu</option>
            </select>
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Kelas (Caberawit)</label>
            <select id="form-jamaah-kelas" class="w-full border rounded-lg px-3 py-2 bg-white outline-none focus:ring-1 focus:ring-teal-500">
              <option value="Umum">- (Non-Caberawit)</option>
              <option value="Caberawit A" ${item?.Kelas === 'Caberawit A' ? 'selected' : ''}>Caberawit A</option>
              <option value="Caberawit B" ${item?.Kelas === 'Caberawit B' ? 'selected' : ''}>Caberawit B</option>
              <option value="Caberawit C" ${item?.Kelas === 'Caberawit C' ? 'selected' : ''}>Caberawit C</option>
              <option value="Caberawit D" ${item?.Kelas === 'Caberawit D' ? 'selected' : ''}>Caberawit D</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1">Kelompok Binaan</label>
          <select id="form-jamaah-kelompok-binaan" class="w-full border rounded-lg px-3 py-2 bg-white outline-none focus:ring-1 focus:ring-teal-500">
            ${kelOptions || '<option value="Kelompok 1">Kelompok 1</option>'}
          </select>
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1">Gender</label>
          <select id="form-jamaah-gender" class="w-full border rounded-lg px-3 py-2 bg-white outline-none focus:ring-1 focus:ring-teal-500">
            <option value="Laki-Laki" ${item?.Gender !== 'Perempuan' ? 'selected' : ''}>Laki-Laki</option>
            <option value="Perempuan" ${item?.Gender === 'Perempuan' ? 'selected' : ''}>Perempuan</option>
          </select>
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1">Alamat</label>
          <input type="text" id="form-jamaah-alamat" value="${item?.Alamat || ''}" class="w-full border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-teal-500">
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1">Status Keaktifan</label>
          <select id="form-jamaah-keaktifan" class="w-full border rounded-lg px-3 py-2 bg-white outline-none focus:ring-1 focus:ring-teal-500">
            <option value="Aktif" ${item?.Keaktifan !== 'Non-Aktif' && item?.Status !== 'Non-Aktif' ? 'selected' : ''}>Aktif</option>
            <option value="Non-Aktif" ${item?.Keaktifan === 'Non-Aktif' || item?.Status === 'Non-Aktif' ? 'selected' : ''}>Non-Aktif</option>
          </select>
        </div>
      </div>
    `;
  }

  titleEl.innerText = title;
  bodyEl.innerHTML = formHtml;
  modal.classList.remove("hidden");
}

async function submitDynamicForm() {
  if (!currentAdmin) return alert("Akses Admin diperlukan!");

  let actionName = "";
  let payloadData = {};

  if (activeFormType === "kegiatan") {
    actionName = "save_kegiatan";
    const nama = document.getElementById("form-kegiatan-nama")?.value.trim();
    const tanggal = document.getElementById("form-kegiatan-tanggal")?.value;
    if (!nama || !tanggal) return alert("Nama kegiatan dan tanggal wajib diisi!");

    payloadData = {
      ID: document.getElementById("form-kegiatan-id")?.value || `KEG-${Date.now()}`,
      Kegiatan: nama,
      Nama_Kegiatan: nama,
      Tanggal: tanggal,
      Hari: document.getElementById("form-kegiatan-hari")?.value || "Minggu",
      Jam: document.getElementById("form-kegiatan-jam")?.value || "19:30 - Selesai",
      Pemateri: document.getElementById("form-kegiatan-pemateri")?.value || "-",
      Keterangan: document.getElementById("form-kegiatan-ket")?.value || "-"
    };
  } else if (activeFormType === "pengurus") {
    actionName = "save_pengurus";
    const nama = document.getElementById("form-pengurus-nama")?.value.trim();
    const jabatan = document.getElementById("form-pengurus-jabatan")?.value.trim();
    const kel = document.getElementById("form-pengurus-kelompok")?.value || "-";
    if (!nama || !jabatan) return alert("Nama pengurus dan jabatan wajib diisi!");

    payloadData = {
      ID: document.getElementById("form-pengurus-id")?.value || `PGR-${Date.now()}`,
      Nama: nama,
      Jabatan: jabatan,
      Kelompok: kel,
      Nama_Kelompok: kel,
      Desa: getDesaByKelompok(kel),
      NoHP: document.getElementById("form-pengurus-nohp")?.value || "-",
      Status: document.getElementById("form-pengurus-status")?.value || "Aktif"
    };
  } else if (activeFormType === "inventaris") {
    actionName = "save_inventaris";
    const namaBarang = document.getElementById("form-inventaris-nama")?.value.trim();
    const kel = document.getElementById("form-inventaris-kelompok")?.value || "-";
    if (!namaBarang) return alert("Nama barang inventaris wajib diisi!");

    payloadData = {
      ID: document.getElementById("form-inventaris-id")?.value || `INV-${Date.now()}`,
      NamaBarang: namaBarang,
      Kelompok: kel,
      Nama_Kelompok: kel,
      Desa: getDesaByKelompok(kel),
      Jumlah: Number(document.getElementById("form-inventaris-jumlah")?.value) || 1,
      Kondisi: document.getElementById("form-inventaris-kondisi")?.value || "Baik",
      TanggalMasuk: document.getElementById("form-inventaris-tanggal")?.value || new Date().toISOString().split("T")[0],
      Keterangan: document.getElementById("form-inventaris-ket")?.value || "-"
    };
  } else if (activeFormType === "jamaah") {
    actionName = "save_jamaah";
    const nama = document.getElementById("form-jamaah-nama")?.value.trim();
    const kelBinaan = document.getElementById("form-jamaah-kelompok-binaan")?.value || "-";
    if (!nama) return alert("Nama lengkap jamaah wajib diisi!");

    payloadData = {
      ID_Jamaah: document.getElementById("form-jamaah-id")?.value || `JAM-${Date.now()}`,
      ID: document.getElementById("form-jamaah-id")?.value || `JAM-${Date.now()}`,
      Nama_Lengkap: nama,
      Nama: nama,
      TanggalLahir: document.getElementById("form-jamaah-tgl")?.value || "",
      Kelas_Usia: document.getElementById("form-jamaah-kelas-usia")?.value || "Caberawit",
      Kelas: document.getElementById("form-jamaah-kelas")?.value || "Umum",
      Nama_Kelompok: kelBinaan,
      KelompokBinaan: kelBinaan,
      Desa: getDesaByKelompok(kelBinaan),
      Gender: document.getElementById("form-jamaah-gender")?.value || "Laki-Laki",
      Alamat: document.getElementById("form-jamaah-alamat")?.value || "-",
      Keaktifan: document.getElementById("form-jamaah-keaktifan")?.value || "Aktif",
      Status: document.getElementById("form-jamaah-keaktifan")?.value || "Aktif"
    };
  }

  showMessage("Menyimpan data ke server...", "info");
  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: actionName,
        data: payloadData
      })
    });
    const json = await res.json();
    if (json.success) {
      showMessage("Data berhasil disimpan!", "success");
      closeModal("modal-dynamic-form");
      await loadAllData();
    } else {
      showMessage("Gagal menyimpan: " + (json.error || json.message), "error");
    }
  } catch (err) {
    console.error("Save Error:", err);
    showMessage("Terjadi kesalahan jaringan saat menyimpan data.", "error");
  }
}

async function deleteRow(sheetName, id) {
  if (!currentAdmin) return alert("Akses Admin diperlukan untuk menghapus data!");

  const confirmDelete = confirm(`Apakah Anda yakin ingin menghapus data ini?`);
  if (!confirmDelete) return;

  showMessage("Menghapus data...", "info");
  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "delete_row",
        sheetName: sheetName,
        id: id
      })
    });
    const json = await res.json();
    if (json.success) {
      showMessage("Data berhasil dihapus!", "success");
      await loadAllData();
    } else {
      showMessage("Gagal menghapus: " + (json.error || json.message), "error");
    }
  } catch (err) {
    console.error("Delete Error:", err);
    showMessage("Terjadi kesalahan jaringan saat menghapus data.", "error");
  }
}

function editJamaah(id) { openModalForm("jamaah", id); }
function editPengurus(id) { openModalForm("pengurus", id); }
function editInventaris(id) { openModalForm("inventaris", id); }

// =========================================================================
// RENDERING VIEWS DENGAN TOMBOL TAMBAH DATA & MOBILE CARD LAYOUT
// =========================================================================

function renderBerandaKegiatan() {
  const container = document.getElementById("kegiatan-cards-container");
  if (!container) return;

  const kegiatanList = Array.isArray(appData.kegiatan) ? appData.kegiatan : [];

  if (kegiatanList.length === 0) {
    container.innerHTML = `
      <div class="col-span-full bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 text-center text-slate-400">
        <i class="fa-solid fa-calendar-xmark text-3xl sm:text-4xl mb-2 text-slate-300"></i>
        <p class="text-xs sm:text-sm font-medium">Belum ada agenda kegiatan mendatang.</p>
      </div>
    `;
  } else {
    container.innerHTML = kegiatanList.map(k => `
      <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-3">
        <div>
          <div class="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5 mb-2.5">
            <span class="text-[11px] px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded-full border border-emerald-200 flex items-center gap-1">
              <i class="fa-solid fa-calendar-day"></i> ${k.Hari || '-'}, ${k.Tanggal ? String(k.Tanggal).split("T")[0] : '-'}
            </span>
            <span class="text-[11px] text-amber-600 font-bold flex items-center gap-1">
              <i class="fa-solid fa-clock"></i> ${k.Jam || 'WIB'}
            </span>
          </div>
          <h3 class="font-bold text-slate-800 text-sm sm:text-base mb-1">${k.Kegiatan || k.Nama_Kegiatan || '-'}</h3>
          <p class="text-xs text-slate-600 flex items-center gap-1 mb-2">
            <i class="fa-solid fa-user-tie text-teal-600"></i> <b>Pemateri:</b> ${k.Pemateri || '-'}
          </p>
          <p class="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            ${k.Keterangan || k.Target_Usia || 'Tidak ada catatan tambahan.'}
          </p>
        </div>
        <div class="admin-only ${isSuperOrDaerah() ? '' : 'hidden'} flex justify-end gap-3 pt-2 border-t border-slate-100">
          <button onclick="openModalForm('kegiatan', '${k.ID || k.ID_Kegiatan}')" class="text-amber-600 hover:text-amber-800 text-xs font-semibold flex items-center gap-1">
            <i class="fa-solid fa-pen"></i> Edit
          </button>
          <button onclick="deleteRow('Kegiatan', '${k.ID || k.ID_Kegiatan}')" class="text-rose-600 hover:text-rose-800 text-xs font-semibold flex items-center gap-1">
            <i class="fa-solid fa-trash"></i> Hapus
          </button>
        </div>
      </div>
    `).join("");
  }
}

function renderPengurus() {
  const tbody = document.getElementById("table-pengurus-body");
  if (!tbody) return;

  const data = Array.isArray(appData.pengurus) ? appData.pengurus : [];
  const desaFilter = document.getElementById("global-filter-desa")?.value || "Semua";
  const kelFilter = document.getElementById("global-filter-kelompok")?.value || "Semua";
  const search = (document.getElementById("global-search-input")?.value || "").toLowerCase().trim();

  const filtered = data.filter(p => {
    const kel = String(p.Kelompok || p.Nama_Kelompok || "-").trim();
    const desa = String((p.Desa && p.Desa !== "-") ? p.Desa : getDesaByKelompok(kel)).trim();
    const matchDesa = (desaFilter === "Semua") || (desa.toLowerCase() === desaFilter.toLowerCase());
    const matchKel = (kelFilter === "Semua") || (kel.toLowerCase() === kelFilter.toLowerCase());

    const namaStr = String(p.Nama || "").toLowerCase();
    const jabatanStr = String(p.Jabatan || "").toLowerCase();
    const noHpStr = String(p.NoHP || "").toLowerCase();
    const matchSearch = !search || namaStr.includes(search) || jabatanStr.includes(search) || noHpStr.includes(search);

    return matchDesa && matchKel && matchSearch;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-center text-slate-400 italic text-xs sm:text-sm">Tidak ada data pengurus yang sesuai kriteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const kel = p.Kelompok || p.Nama_Kelompok || "-";
    const desa = (p.Desa && p.Desa !== "-") ? p.Desa : getDesaByKelompok(kel);
    const wilayahLabel = (desa !== "-" && kel !== "-") ? `${desa} - ${kel}` : (desa !== "-" ? desa : (kel !== "-" ? kel : "-"));

    return `
      <tr class="bg-white border-b hover:bg-slate-50 text-xs sm:text-sm">
        <td class="px-3 sm:px-6 py-3 font-semibold text-slate-800">${p.Nama || '-'}</td>
        <td class="px-3 sm:px-6 py-3 text-xs text-slate-600">${wilayahLabel}</td>
        <td class="px-3 sm:px-6 py-3">${p.Jabatan || '-'}</td>
        <td class="px-3 sm:px-6 py-3 whitespace-nowrap">${p.NoHP || '-'}</td>
        <td class="px-3 sm:px-6 py-3"><span class="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold ${p.Status === 'Aktif' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">${p.Status || 'Aktif'}</span></td>
        <td class="px-3 sm:px-6 py-3 text-center admin-only ${isSuperOrDaerah() ? '' : 'hidden'} space-x-2 whitespace-nowrap">
          <button onclick="openModalForm('pengurus', '${p.ID}')" class="text-amber-600 hover:text-amber-800 p-1"><i class="fa-solid fa-pen-to-square"></i></button>
          <button onclick="deleteRow('Pengurus', '${p.ID}')" class="text-rose-600 hover:text-rose-800 p-1"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join("");
}

function renderInventaris() {
  const tbody = document.getElementById("table-inventaris-body");
  if (!tbody) return;

  const data = Array.isArray(appData.inventaris) ? appData.inventaris : [];
  const desaFilter = document.getElementById("global-filter-desa")?.value || "Semua";
  const kelFilter = document.getElementById("global-filter-kelompok")?.value || "Semua";
  const search = (document.getElementById("global-search-input")?.value || "").toLowerCase().trim();

  const filtered = data.filter(i => {
    const kel = String(i.Kelompok || i.Nama_Kelompok || "-").trim();
    const desa = String((i.Desa && i.Desa !== "-") ? i.Desa : getDesaByKelompok(kel)).trim();
    const matchDesa = (desaFilter === "Semua") || (desa.toLowerCase() === desaFilter.toLowerCase());
    const matchKel = (kelFilter === "Semua") || (kel.toLowerCase() === kelFilter.toLowerCase());

    const namaBrg = String(i.NamaBarang || "").toLowerCase();
    const kondisiStr = String(i.Kondisi || "").toLowerCase();
    const ketStr = String(i.Keterangan || "").toLowerCase();
    const matchSearch = !search || namaBrg.includes(search) || kondisiStr.includes(search) || ketStr.includes(search);

    return matchDesa && matchKel && matchSearch;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-6 text-center text-slate-400 italic text-xs sm:text-sm">Tidak ada data inventaris pada wilayah yang dipilih.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(i => {
    const kel = i.Kelompok || i.Nama_Kelompok || "-";
    const desa = (i.Desa && i.Desa !== "-") ? i.Desa : getDesaByKelompok(kel);

    return `
      <tr class="bg-white border-b hover:bg-slate-50 text-xs sm:text-sm">
        <td class="px-3 sm:px-6 py-3 font-semibold text-slate-800">${i.NamaBarang || '-'}</td>
        <td class="px-3 sm:px-4 py-3 text-xs text-slate-600">${desa}</td>
        <td class="px-3 sm:px-4 py-3 text-xs font-semibold text-slate-700">${kel}</td>
        <td class="px-3 sm:px-6 py-3 text-center font-bold">${i.Jumlah || 0}</td>
        <td class="px-3 sm:px-6 py-3"><span class="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold ${i.Kondisi === 'Baik' ? 'bg-teal-100 text-teal-800' : 'bg-rose-100 text-rose-800'}">${i.Kondisi || 'Baik'}</span></td>
        <td class="px-3 sm:px-6 py-3 whitespace-nowrap text-xs">${i.TanggalMasuk ? String(i.TanggalMasuk).split("T")[0] : '-'}</td>
        <td class="px-3 sm:px-6 py-3 text-xs text-slate-500">${i.Keterangan || '-'}</td>
        <td class="px-3 sm:px-6 py-3 text-center admin-only ${isSuperOrDaerah() ? '' : 'hidden'} space-x-2 whitespace-nowrap">
          <button onclick="openModalForm('inventaris', '${i.ID}')" class="text-amber-600 hover:text-amber-800 p-1"><i class="fa-solid fa-pen-to-square"></i></button>
          <button onclick="deleteRow('Inventaris', '${i.ID}')" class="text-rose-600 hover:text-rose-800 p-1"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join("");
}

function renderJamaah() {
  const tbody = document.getElementById("table-jamaah-body");
  if (!tbody) return;

  const data = Array.isArray(appData.jamaah) ? appData.jamaah : [];
  const desaFilter = document.getElementById("global-filter-desa")?.value || "Semua";
  const kelFilter = document.getElementById("global-filter-kelompok")?.value || "Semua";
  const search = (document.getElementById("global-search-input")?.value || "").toLowerCase().trim();

  const filtered = data.filter(j => {
    const jKel = String(j.Nama_Kelompok || j.KelompokBinaan || "-").trim();
    const jDesa = String((j.Desa && j.Desa !== "-") ? j.Desa : getDesaByKelompok(jKel)).trim();
    const matchDesa = (desaFilter === "Semua") || (jDesa.toLowerCase() === desaFilter.toLowerCase());
    const matchKel = (kelFilter === "Semua") || (jKel.toLowerCase() === kelFilter.toLowerCase());

    const namaStr = String(j.Nama_Lengkap || j.Nama || "").toLowerCase();
    const alamatStr = String(j.Alamat || "").toLowerCase();
    const idStr = String(j.ID_Jamaah || j.ID || "").toLowerCase();
    const matchSearch = !search || namaStr.includes(search) || alamatStr.includes(search) || idStr.includes(search);

    return matchDesa && matchKel && matchSearch;
  });

  const badgeCount = document.getElementById("jamaah-count-badge");
  if (badgeCount) badgeCount.innerText = `${filtered.length} Jamaah`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="px-4 py-6 text-center text-slate-400 italic text-xs sm:text-sm">Tidak ada data jamaah yang sesuai.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(j => {
    const rawKelasUsia = String(j.Kelas_Usia || j.Kelompok || "Unassigned").trim();
    let displayKelompok = rawKelasUsia;
    let displayKelas = "-";

    if (rawKelasUsia.toLowerCase().startsWith("caberawit")) {
      displayKelompok = "Caberawit";
      displayKelas = j.Kelas || rawKelasUsia;
    }

    const jKel = j.Nama_Kelompok || j.KelompokBinaan || '-';
    const jDesa = (j.Desa && j.Desa !== "-") ? j.Desa : getDesaByKelompok(jKel);

    return `
      <tr class="bg-white border-b hover:bg-slate-50 text-xs sm:text-sm">
        <td class="px-3 sm:px-4 py-3 font-mono text-[11px] text-slate-400">${j.ID_Jamaah || j.ID || '-'}</td>
        <td class="px-3 sm:px-4 py-3 font-semibold text-slate-800">${j.Nama_Lengkap || j.Nama || '-'}</td>
        <td class="px-3 sm:px-4 py-3 text-xs text-slate-600">${jDesa}</td>
        <td class="px-3 sm:px-4 py-3 text-xs font-semibold text-slate-800">${jKel}</td>
        <td class="px-3 sm:px-4 py-3 whitespace-nowrap text-xs">${j.TanggalLahir ? String(j.TanggalLahir).split("T")[0] : '-'} <span class="text-[10px] text-emerald-600 font-bold">(${calculateAge(j.TanggalLahir)})</span></td>
        <td class="px-3 sm:px-4 py-3"><span class="px-2 py-0.5 rounded bg-teal-50 text-teal-700 font-semibold text-[11px]">${displayKelompok}</span></td>
        <td class="px-3 sm:px-4 py-3"><span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">${displayKelas}</span></td>
        <td class="px-3 sm:px-4 py-3">${j.Gender || '-'}</td>
        <td class="px-3 sm:px-4 py-3 text-slate-500">${j.Alamat || '-'}</td>
        <td class="px-3 sm:px-4 py-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-semibold ${j.Keaktifan === 'Aktif' || j.Status === 'Aktif' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">${j.Keaktifan || j.Status || 'Aktif'}</span></td>
        <td class="px-3 sm:px-4 py-3 text-center admin-only space-x-2 ${isSuperOrDaerah() ? '' : 'hidden'} whitespace-nowrap">
          <button onclick="editJamaah('${j.ID_Jamaah || j.ID}')" class="text-amber-600 hover:text-amber-800 p-1"><i class="fa-solid fa-pen-to-square"></i></button>
          <button onclick="deleteRow('Master_Jamaah', '${j.ID_Jamaah || j.ID}')" class="text-rose-600 hover:text-rose-800 p-1"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join("");
}

// =========================================================================
// RENDER TABEL PRESENSI DENGAN FILTER WILAYAH
// =========================================================================

function getFilteredJamaahForPresensi() {
  const jamaahList = Array.isArray(appData.jamaah) ? appData.jamaah : [];
  const desaFilter = document.getElementById("presensi-filter-desa")?.value || "Semua";
  const kelFilter = document.getElementById("presensi-filter-kelompok")?.value || "Semua";

  return jamaahList.filter(j => {
    const matchStatus = String(j.Keaktifan || j.Status || "Aktif").trim().toLowerCase() === "aktif";
    if (!matchStatus) return false;

    // Filter Wilayah Presensi
    const jKel = String(j.Nama_Kelompok || j.KelompokBinaan || "-").trim();
    const jDesa = String((j.Desa && j.Desa !== "-") ? j.Desa : getDesaByKelompok(jKel)).trim();

    if (desaFilter !== "Semua" && jDesa.toLowerCase() !== desaFilter.toLowerCase()) return false;
    if (kelFilter !== "Semua" && jKel.toLowerCase() !== kelFilter.toLowerCase()) return false;

    // Filter Kelompok Usia / Kelas
    const rawKelasUsia = String(j.Kelas_Usia || j.Kelompok || "").trim();
    const rawKelasUsiaLower = rawKelasUsia.toLowerCase();
    const jGender = String(j.Gender || "").trim().toLowerCase();

    const isItemCaberawit = rawKelasUsiaLower.startsWith("caberawit");
    let detectedKelas = String(j.Kelas || "").trim().toLowerCase();
    if (!detectedKelas && isItemCaberawit) detectedKelas = rawKelasUsiaLower;

    if (currentKelompok === "ASAD") {
      if (currentKelas === "Caberawit Laki-Laki") return isItemCaberawit && jGender === "laki-laki";
      if (currentKelas === "Caberawit Perempuan") return isItemCaberawit && jGender === "perempuan";
      if (currentKelas === "Laki-Laki") return !isItemCaberawit && jGender === "laki-laki";
      if (currentKelas === "Perempuan") return !isItemCaberawit && jGender === "perempuan";
    }

    if (currentKelompok === "Caberawit") {
      if (!isItemCaberawit) return false;
      const targetKelas = currentKelas.trim().toLowerCase();
      const targetSuffix = targetKelas.replace("caberawit", "").trim();
      return detectedKelas === targetKelas || detectedKelas === targetSuffix || rawKelasUsiaLower === targetKelas;
    }

    return rawKelasUsiaLower === currentKelompok.trim().toLowerCase();
  });
}

function renderPresensiTable() {
  const isCaberawit = (currentKelompok === "Caberawit");
  const theadTr = document.getElementById("presensi-table-header");

  if (theadTr) {
    if (isCaberawit) {
      theadTr.innerHTML = `
        <th scope="col" class="px-3 py-3 text-center w-12">NO</th>
        <th scope="col" class="px-4 py-3 min-w-[140px]">NAMA JAMAAH</th>
        <th scope="col" class="px-3 py-3 text-center w-14">HADIR</th>
        <th scope="col" class="px-3 py-3 text-center w-14">IZIN</th>
        <th scope="col" class="px-3 py-3 text-center w-14">ALFA</th>
        <th scope="col" class="px-3 py-3 text-center w-28 text-teal-800">29 KARAKTER</th>
        <th scope="col" class="px-3 py-3 text-left min-w-[160px]">KETERANGAN</th>
      `;
    } else {
      theadTr.innerHTML = `
        <th scope="col" class="px-3 py-3 text-center w-12">NO</th>
        <th scope="col" class="px-4 py-3 min-w-[140px]">NAMA JAMAAH</th>
        <th scope="col" class="px-3 py-3 text-center w-14">HADIR</th>
        <th scope="col" class="px-3 py-3 text-center w-14">IZIN</th>
        <th scope="col" class="px-3 py-3 text-center w-14">ALFA</th>
        <th scope="col" class="px-3 py-3 text-left min-w-[160px]">KETERANGAN</th>
      `;
    }
  }

  const caberawitMateriBox = document.getElementById("caberawit-materi-container");
  const regulerMateriBox = document.getElementById("reguler-materi-container");
  if (caberawitMateriBox && regulerMateriBox) {
    if (isCaberawit) {
      caberawitMateriBox.classList.remove("hidden");
      regulerMateriBox.classList.add("hidden");
    } else {
      caberawitMateriBox.classList.add("hidden");
      regulerMateriBox.classList.remove("hidden");
    }
  }

  const filteredJamaah = getFilteredJamaahForPresensi();
  const presensiList = Array.isArray(appData.presensi) ? appData.presensi : [];
  const tbody = document.getElementById("table-presensi-body");
  if (!tbody) return;

  const isReadOnly = !currentAdmin;

  if (filteredJamaah.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${isCaberawit ? 7 : 6}" class="px-4 py-6 text-center text-slate-400 italic text-xs">
          Belum ada jamaah yang terdaftar pada wilayah & kelompok ini.
        </td>
      </tr>
    `;
    updateRekapHarian();
    return;
  }

  const selectedDateInput = document.getElementById("presensi-date");
  const targetDate = selectedDateInput ? selectedDateInput.value : "";

  // Pemetaan presensi dengan composite key: nama + desa + kelompok binaan
  let existingStatusMap = {};
  presensiList.forEach(p => {
    const rawNama = p.NamaJamaah || p.Nama || p.nama;
    if (!p.Tanggal && !p.tanggal) return;
    if (!rawNama) return;

    const pKel = String(p.Kelompok || p.kelompok || "").trim().toLowerCase();
    const pKls = String(p.Kelas || p.kelas || "Umum").trim().toLowerCase();
    const pKelBinaan = String(p.KelompokBinaan || p.Nama_Kelompok || getKelompokByNama(rawNama)).trim().toLowerCase();
    const pDesa = String(p.Desa || p.desa || getDesaByKelompok(pKelBinaan)).trim().toLowerCase();

    const rawTgl = p.Tanggal || p.tanggal;
    let pDateStr = (rawTgl instanceof Date) ? rawTgl.toISOString().split("T")[0] : String(rawTgl).substring(0, 10);

    const checkKelas = (currentKelompok === "Caberawit" || currentKelompok === "ASAD")
      ? (pKls === String(currentKelas).trim().toLowerCase())
      : true;

    if (pKel === String(currentKelompok).trim().toLowerCase() && checkKelas && pDateStr === targetDate) {
      const compositeLookupKey = `${String(rawNama).trim().toLowerCase()}_${pDesa}_${pKelBinaan}`;
      existingStatusMap[compositeLookupKey] = {
        status: String(p.StatusPresensi || p.Status || p.status || "Hadir").trim(),
        keterangan: String(p.Keterangan || p.keterangan || "").trim(),
        karakter29: String(p.Karakter29 || p.karakter29 || "Belum").trim()
      };
    }
  });

  tbody.innerHTML = filteredJamaah.map((j, idx) => {
    const nama = j.Nama_Lengkap || j.Nama;
    const jKel = String(j.Nama_Kelompok || j.KelompokBinaan || "-").trim().toLowerCase();
    const jDesa = String((j.Desa && j.Desa !== "-") ? j.Desa : getDesaByKelompok(jKel)).trim().toLowerCase();
    const compositeLookupKey = `${String(nama).trim().toLowerCase()}_${jDesa}_${jKel}`;

    const isSaved = Boolean(existingStatusMap[compositeLookupKey]);
    const exData = existingStatusMap[compositeLookupKey] || { status: "Hadir", keterangan: "", karakter29: "Belum" };

    const savedStatus = exData.status;
    const savedKet = exData.keterangan;
    const savedKarakter = exData.karakter29;

    const isIzinChecked = (savedStatus === 'Izin');
    const disabledKet = (isReadOnly || !isIzinChecked) ? "disabled" : "";
    const disabledRadio = isReadOnly ? "disabled cursor-not-allowed opacity-80" : "cursor-pointer";

    let caberawitExtraTd = "";
    if (isCaberawit) {
      caberawitExtraTd = `
        <td class="px-2 py-3 text-center">
          <select id="karakter-${idx}" ${isReadOnly ? 'disabled' : ''} class="text-[11px] px-1.5 py-1 rounded border border-slate-300 bg-white font-semibold ${savedKarakter === 'Sudah' ? 'text-emerald-700 bg-emerald-50 border-emerald-300' : 'text-slate-600'}">
            <option value="Belum" ${savedKarakter === 'Belum' ? 'selected' : ''}>Belum</option>
            <option value="Sudah" ${savedKarakter === 'Sudah' ? 'selected' : ''}>Sudah</option>
          </select>
        </td>
      `;
    }

    const badgeTersimpan = isSaved
      ? `<span class="mt-1 inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
          <i class="fa-solid fa-check"></i> Tersimpan (${savedStatus})
         </span>`
      : `<span class="mt-1 inline-flex items-center text-[9px] px-1 py-0.5 rounded text-slate-400 border border-dashed border-slate-200">Belum Disimpan</span>`;

    return `
      <tr class="bg-white border-b hover:bg-slate-50 transition-colors text-xs sm:text-sm">
        <td class="px-2 sm:px-3 py-3 text-center text-xs font-semibold text-slate-500">${idx + 1}</td>
        <td class="px-3 sm:px-4 py-3 font-medium text-slate-800">
          <div>${nama}</div>
          ${badgeTersimpan}
        </td>
        <td class="px-2 sm:px-3 py-3 text-center">
          <input type="radio" name="presensi-${idx}" value="Hadir" onchange="toggleKetInput(${idx})" ${savedStatus === 'Hadir' ? 'checked' : ''} ${disabledRadio} class="w-4 h-4 text-emerald-600 focus:ring-emerald-500">
        </td>
        <td class="px-2 sm:px-3 py-3 text-center">
          <input type="radio" name="presensi-${idx}" value="Izin" onchange="toggleKetInput(${idx})" ${savedStatus === 'Izin' ? 'checked' : ''} ${disabledRadio} class="w-4 h-4 text-amber-500 focus:ring-amber-500">
        </td>
        <td class="px-2 sm:px-3 py-3 text-center">
          <input type="radio" name="presensi-${idx}" value="Alfa" onchange="toggleKetInput(${idx})" ${savedStatus === 'Alfa' ? 'checked' : ''} ${disabledRadio} class="w-4 h-4 text-rose-600 focus:ring-rose-500">
        </td>
        ${caberawitExtraTd}
        <td class="px-2 sm:px-3 py-3">
          <input type="text" id="ket-${idx}" value="${savedKet}" placeholder="${isReadOnly ? '-' : 'Alasan...'}" ${disabledKet} class="w-full text-xs px-2 py-1 border rounded bg-slate-50 focus:bg-white focus:ring-1 focus:ring-amber-500 transition-all ${!isIzinChecked ? 'opacity-40' : ''}">
        </td>
      </tr>
    `;
  }).join("");

  updateRekapHarian();
}

function toggleKetInput(idx) {
  const radios = document.getElementsByName(`presensi-${idx}`);
  const ketInput = document.getElementById(`ket-${idx}`);
  if (!ketInput || !radios) return;

  let selected = "Hadir";
  for (let r of radios) { if (r.checked) selected = r.value; }

  if (selected === "Izin") {
    ketInput.disabled = false;
    ketInput.classList.remove("opacity-40");
    ketInput.focus();
  } else {
    ketInput.value = "";
    ketInput.disabled = true;
    ketInput.classList.add("opacity-40");
  }
}

function updateRekapHarian() {
  const selectedDateInput = document.getElementById("presensi-date");
  if (!selectedDateInput) return;
  const targetDate = selectedDateInput.value;

  const desaFilter = document.getElementById("presensi-filter-desa")?.value || "Semua";
  const kelFilter = document.getElementById("presensi-filter-kelompok")?.value || "Semua";

  let h = 0, i = 0, a = 0;
  let latestPresensiMap = {};

  const presensiList = Array.isArray(appData.presensi) ? appData.presensi : [];

  presensiList.forEach(p => {
    const rawNama = p.NamaJamaah || p.Nama || p.nama;
    if (!p.Tanggal && !p.tanggal) return;
    if (!rawNama) return;

    const pKel = String(p.Kelompok || p.kelompok || "").trim().toLowerCase();
    const pKelTarget = String(currentKelompok).trim().toLowerCase();
    const pKls = String(p.Kelas || p.kelas || "Umum").trim().toLowerCase();
    const pKlsTarget = String(currentKelas).trim().toLowerCase();

    const pKelBinaan = String(p.KelompokBinaan || p.Nama_Kelompok || getKelompokByNama(rawNama)).trim();
    const pDesa = String((p.Desa && p.Desa !== "-") ? p.Desa : getDesaByKelompok(pKelBinaan)).trim();

    if (desaFilter !== "Semua" && pDesa.toLowerCase() !== desaFilter.toLowerCase()) return;
    if (kelFilter !== "Semua" && pKelBinaan.toLowerCase() !== kelFilter.toLowerCase()) return;

    const rawTgl = p.Tanggal || p.tanggal;
    let pDateStr = (rawTgl instanceof Date) ? rawTgl.toISOString().split("T")[0] : String(rawTgl).substring(0, 10);
    const checkKelas = (currentKelompok === "Caberawit" || currentKelompok === "ASAD") ? (pKls === pKlsTarget) : true;

    if (pKel === pKelTarget && checkKelas && pDateStr === targetDate) {
      const uniqueId = `${String(rawNama).trim().toLowerCase()}_${pDesa.toLowerCase()}_${pKelBinaan.toLowerCase()}`;
      latestPresensiMap[uniqueId] = String(p.StatusPresensi || p.Status || p.status || "Hadir").trim();
    }
  });

  Object.values(latestPresensiMap).forEach(status => {
    if (status === "Hadir") h++;
    else if (status === "Izin") i++;
    else if (status === "Alfa") a++;
  });

  if (document.getElementById("stat-hadir")) document.getElementById("stat-hadir").innerText = h;
  if (document.getElementById("stat-izin")) document.getElementById("stat-izin").innerText = i;
  if (document.getElementById("stat-alfa")) document.getElementById("stat-alfa").innerText = a;

  if (document.getElementById("rekap-mingguan-title")) {
    const displayTitle = (currentKelompok === "Caberawit" || currentKelompok === "ASAD") ? `${currentKelompok} (${currentKelas})` : currentKelompok;
    document.getElementById("rekap-mingguan-title").innerHTML = `<i class="fa-solid fa-calendar-day mr-1"></i> Rekapan: ${displayTitle}`;
  }
}

// =========================================================================
// MONITORING: VALIDASI KETAT NAMA + DESA + KELOMPOK BINAAN + KELAS/JENJANG
// =========================================================================

function initMonitoringDateFilters() {
  const startDateInput = document.getElementById("monitoring-date-start");
  const endDateInput = document.getElementById("monitoring-date-end");

  if (startDateInput && endDateInput) {
    if (currentAdmin) {
      if (!startDateInput.value && !endDateInput.value) {
        const today = new Date();
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(today.getMonth() - 1);

        const formatDate = (d) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        };

        startDateInput.value = formatDate(oneMonthAgo);
        endDateInput.value = formatDate(today);
      }
    } else {
      startDateInput.value = "";
      endDateInput.value = "";
    }
  }
}

function onMonitoringFilterChange() {
  if (!currentAdmin) return alert("Hanya Admin yang dapat merubah rentang tanggal monitoring!");
  renderMonitoringTable();
}

function renderMonitoringTable() {
  const tbody = document.getElementById("table-monitoring-body");
  if (!tbody) return;

  initMonitoringDateFilters();

  const filterKelasUsia = document.getElementById("monitoring-filter-kelompok")?.value || "Semua";
  const desaFilter = document.getElementById("global-filter-desa")?.value || "Semua";
  const kelFilter = document.getElementById("global-filter-kelompok")?.value || "Semua";
  const search = (document.getElementById("global-search-input")?.value || "").toLowerCase().trim();

  const startDateVal = document.getElementById("monitoring-date-start")?.value || "";
  const endDateVal = document.getElementById("monitoring-date-end")?.value || "";

  const jamaahList = Array.isArray(appData.jamaah) ? appData.jamaah : [];
  const presensiList = Array.isArray(appData.presensi) ? appData.presensi : [];

  // Filter tanggal log presensi
  const filteredPresensi = presensiList.filter(p => {
    const rawTgl = p.Tanggal || p.tanggal;
    if (!rawTgl) return false;
    let pDateStr = (rawTgl instanceof Date) ? rawTgl.toISOString().split("T")[0] : String(rawTgl).substring(0, 10);
    if (startDateVal && pDateStr < startDateVal) return false;
    if (endDateVal && pDateStr > endDateVal) return false;
    return true;
  });

  // Filter jamaah target sesuai desa, kelompok, dan kelas usia
  const targetJamaah = jamaahList.filter(j => {
    const isAktif = String(j.Keaktifan || j.Status || "Aktif").trim().toLowerCase() === "aktif";
    if (!isAktif) return false;

    const jKelBinaan = String(j.Nama_Kelompok || j.KelompokBinaan || "-").trim();
    const jDesa = String((j.Desa && j.Desa !== "-") ? j.Desa : getDesaByKelompok(jKelBinaan)).trim();

    const matchDesa = (desaFilter === "Semua") || (jDesa.toLowerCase() === desaFilter.toLowerCase());
    const matchKelBinaan = (kelFilter === "Semua") || (jKelBinaan.toLowerCase() === kelFilter.toLowerCase());

    const namaStr = String(j.Nama_Lengkap || j.Nama || "").toLowerCase();
    const matchSearch = !search || namaStr.includes(search);

    if (!matchDesa || !matchKelBinaan || !matchSearch) return false;
    if (filterKelasUsia === "Semua") return true;

    const rawKelasUsia = String(j.Kelas_Usia || j.Kelompok || "").trim().toLowerCase();
    const filterLower = filterKelasUsia.toLowerCase();

    if (filterLower === "caberawit") return rawKelasUsia.startsWith("caberawit");
    else if (filterLower.startsWith("caberawit ")) return rawKelasUsia === filterLower || String(j.Kelas || "").trim().toLowerCase() === filterLower;
    return rawKelasUsia === filterLower;
  });

  if (targetJamaah.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="px-4 py-6 text-center text-slate-400 italic text-xs sm:text-sm">Tidak ada data jamaah yang sesuai kriteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = targetJamaah.map((j, idx) => {
    const nama = j.Nama_Lengkap || j.Nama;
    const rawKelasUsia = String(j.Kelas_Usia || j.Kelompok || "").trim();
    const isCaberawit = rawKelasUsia.toLowerCase().startsWith("caberawit");

    const jKelBinaan = String(j.Nama_Kelompok || j.KelompokBinaan || "-").trim();
    const jDesa = String((j.Desa && j.Desa !== "-") ? j.Desa : getDesaByKelompok(jKelBinaan)).trim();

    const targetNamaClean = String(nama || "").trim().toLowerCase();
    const targetDesaClean = jDesa.toLowerCase();
    const targetKelClean = jKelBinaan.toLowerCase();
    const targetIdClean = String(j.ID_Jamaah || j.ID || "").trim().toLowerCase();

    let countHadir = 0, countIzin = 0, countAlfa = 0;
    let izinReasons = [];
    let attendedAsad = false;
    let sudahKarakterCount = 0;
    let totalCaberawitPertemuan = 0;

    filteredPresensi.forEach(p => {
      const pNama = String(p.NamaJamaah || p.Nama || p.nama || "").trim().toLowerCase();
      if (pNama !== targetNamaClean) return;

      const pKelBinaan = String(p.KelompokBinaan || p.Nama_Kelompok || getKelompokByNama(pNama)).trim().toLowerCase();
      const pDesa = String(p.Desa || p.desa || getDesaByKelompok(pKelBinaan)).trim().toLowerCase();
      const pIdJamaah = String(p.ID_Jamaah || p.idJamaah || "").trim().toLowerCase();

      // Validasi ketat nama + desa + kelompok binaan
      if (pIdJamaah && targetIdClean && pIdJamaah !== targetIdClean) return;
      if (pKelBinaan && pKelBinaan !== "-" && pKelBinaan !== targetKelClean) return;
      if (pDesa && pDesa !== "-" && pDesa !== targetDesaClean) return;

      const pKel = String(p.Kelompok || p.kelompok || "").trim();
      const pKls = String(p.Kelas || p.kelas || "Umum").trim().toLowerCase();

      if (pKel === "ASAD") {
        const st = String(p.StatusPresensi || p.Status || p.status || "Hadir").trim();
        if (st === "Hadir") attendedAsad = true;
      } else {
        // Validasi kecocokan jenjang/kelas
        const isMatchJenjang = isCaberawit 
          ? (pKel.toLowerCase() === "caberawit" && (pKls === "umum" || pKls === String(j.Kelas || "").trim().toLowerCase() || pKls === rawKelasUsia.toLowerCase()))
          : (pKel.toLowerCase() === rawKelasUsia.toLowerCase());

        if (!isMatchJenjang) return;

        const st = String(p.StatusPresensi || p.Status || p.status || "Hadir").trim();
        if (st === "Hadir") {
          countHadir++;
        } else if (st === "Izin") {
          countIzin++;
          const ketStr = String(p.Keterangan || p.keterangan || "").trim();
          if (ketStr !== "") izinReasons.push(ketStr);
        } else if (st === "Alfa") {
          countAlfa++;
        }

        if (isCaberawit) {
          totalCaberawitPertemuan++;
          if (String(p.Karakter29 || p.karakter29 || "").trim().toLowerCase() === "sudah") {
            sudahKarakterCount++;
          }
        }
      }
    });

    const displayKelas = isCaberawit ? `Caberawit (${j.Kelas || rawKelasUsia})` : rawKelasUsia;
    const reasonsText = izinReasons.length > 0 ? izinReasons.join("; ") : "-";

    let karakterStatusBadge = "-";
    if (isCaberawit) {
      karakterStatusBadge = (totalCaberawitPertemuan > 0 && sudahKarakterCount > 0)
        ? `<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">${sudahKarakterCount}/${totalCaberawitPertemuan} Sudah</span>`
        : `<span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px]">Belum</span>`;
    }

    const asadBadge = attendedAsad
      ? `<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]"><i class="fa-solid fa-check mr-1"></i>Hadir</span>`
      : `<span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px]">Tidak/Belum</span>`;

    return `
      <tr class="bg-white border-b hover:bg-slate-50 text-xs sm:text-sm">
        <td class="px-2 sm:px-3 py-3 text-center font-semibold text-slate-500">${idx + 1}</td>
        <td class="px-3 sm:px-4 py-3 font-semibold text-slate-800">${nama}</td>
        <td class="px-2 sm:px-3 py-3 text-xs text-slate-600">${jDesa}</td>
        <td class="px-2 sm:px-3 py-3 text-xs font-semibold text-slate-700">${jKelBinaan}</td>
        <td class="px-2 sm:px-3 py-3 whitespace-nowrap"><span class="px-2 py-0.5 rounded bg-slate-100 font-medium text-[11px]">${displayKelas}</span></td>
        <td class="px-2 py-3 text-center font-bold text-emerald-600">${countHadir}</td>
        <td class="px-2 py-3 text-center font-bold text-amber-600">${countIzin}</td>
        <td class="px-2 py-3 text-center font-bold text-rose-600">${countAlfa}</td>
        <td class="px-3 py-3 text-xs text-slate-500 max-w-[150px] truncate" title="${reasonsText}">${reasonsText}</td>
        <td class="px-2 py-3 text-center whitespace-nowrap">${asadBadge}</td>
        <td class="px-2 py-3 text-center whitespace-nowrap">${karakterStatusBadge}</td>
      </tr>
    `;
  }).join("");
}
// =========================================================================
// DOWNLOAD / CETAK LEMBAR KERJA FORMAT LANSKAP (DATA DINAMIS LENGKAP)
// =========================================================================

function downloadLembarKerja() {
  const filterKelasUsia = document.getElementById("monitoring-filter-kelompok")?.value || "Semua";
  const desaFilter = document.getElementById("global-filter-desa")?.value || "Semua";
  const kelFilter = document.getElementById("global-filter-kelompok")?.value || "Semua";

  const startDateVal = document.getElementById("monitoring-date-start")?.value || "";
  const endDateVal = document.getElementById("monitoring-date-end")?.value || "";

  const periodeText = (startDateVal && endDateVal) 
    ? `${formatTanggalIndo(startDateVal)} s/d ${formatTanggalIndo(endDateVal)}`
    : "Awal s/d Akhir";

  const jamaahList = Array.isArray(appData.jamaah) ? appData.jamaah : [];
  const presensiList = Array.isArray(appData.presensi) ? appData.presensi : [];

  // 1. Filter Daftar Jamaah yang Berada pada Wilayah & Jenjang Terpilih
  const targetJamaah = jamaahList.filter(j => {
    const isAktif = String(j.Keaktifan || j.Status || "Aktif").trim().toLowerCase() === "aktif";
    if (!isAktif) return false;

    const jKelBinaan = String(j.Nama_Kelompok || j.KelompokBinaan || "-").trim();
    const jDesa = String((j.Desa && j.Desa !== "-") ? j.Desa : getDesaByKelompok(jKelBinaan)).trim();

    const matchDesa = (desaFilter === "Semua") || (jDesa.toLowerCase() === desaFilter.toLowerCase());
    const matchKelBinaan = (kelFilter === "Semua") || (jKelBinaan.toLowerCase() === kelFilter.toLowerCase());

    if (!matchDesa || !matchKelBinaan) return false;
    if (filterKelasUsia === "Semua") return true;

    const rawKelasUsia = String(j.Kelas_Usia || j.Kelompok || "").trim().toLowerCase();
    const filterLower = filterKelasUsia.toLowerCase();

    if (filterLower === "caberawit") return rawKelasUsia.startsWith("caberawit");
    else if (filterLower.startsWith("caberawit ")) return rawKelasUsia === filterLower || String(j.Kelas || "").trim().toLowerCase() === filterLower;
    return rawKelasUsia === filterLower;
  });

  let countLaki = 0;
  let countPerempuan = 0;
  const genderMap = {};
  const validNamaSet = new Set();

  targetJamaah.forEach(j => {
    const namaClean = String(j.Nama_Lengkap || j.Nama || "").trim().toLowerCase();
    validNamaSet.add(namaClean);

    const g = String(j.Gender || "").trim().toLowerCase();
    const isLaki = (g === "laki-laki" || g === "l");
    genderMap[namaClean] = isLaki ? "L" : "P";

    if (isLaki) countLaki++;
    else countPerempuan++;
  });

  const totalJamaah = targetJamaah.length;

  // 2. Ekstraksi Kehadiran L/P & Seluruh Rincian Materi/Kendala
  const relevantJurnal = new Set();
  const sessionPresenceMap = {}; // Key: "YYYY-MM-DD" -> { L: 0, P: 0 }

  presensiList.forEach(p => {
    if (!p.Tanggal && !p.tanggal) return;

    const rawTgl = p.Tanggal || p.tanggal;
    const dateStr = (rawTgl instanceof Date) ? rawTgl.toISOString().split("T")[0] : String(rawTgl).substring(0, 10);

    if (startDateVal && dateStr < startDateVal) return;
    if (endDateVal && dateStr > endDateVal) return;

    const pNama = String(p.NamaJamaah || p.Nama || p.nama || "").trim().toLowerCase();
    const pKel = String(p.Kelompok || p.kelompok || "").trim().toLowerCase();
    const pKls = String(p.Kelas || p.kelas || "Umum").trim().toLowerCase();

    // Validasi kecocokan jenjang/kelas usia
    if (filterKelasUsia !== "Semua") {
      const fLower = filterKelasUsia.toLowerCase();
      if (fLower === "caberawit" && pKel !== "caberawit") return;
      if (fLower.startsWith("caberawit ") && (pKel !== "caberawit" || pKls !== fLower)) return;
      if (!fLower.startsWith("caberawit") && pKel !== fLower) return;
    }

    // Validasi apakah jamaah termasuk dalam wilayah yang difilter
    if (validNamaSet.size > 0 && !validNamaSet.has(pNama)) return;

    // --- Ekstraksi Materi Pembelajaran & Catatan Kendala ---
    const tglLabel = formatTanggalIndo(dateStr);

    // a. Materi reguler / jurnal umum
    const jText = String(p.Jurnal || p.jurnal || "").trim();
    if (jText && jText !== "-" && jText !== "null" && jText !== "undefined") {
      relevantJurnal.add(`<b>[${tglLabel}]</b> ${jText}`);
    }

    // b. Materi khusus Caberawit (JSON)
    const rawCaberawit = p.MateriCaberawit || p.materiCaberawit;
    if (rawCaberawit && String(rawCaberawit).trim() !== "" && String(rawCaberawit) !== "-") {
      try {
        const matObj = (typeof rawCaberawit === "object") ? rawCaberawit : JSON.parse(rawCaberawit);
        const rincian = [];
        if (matObj.akhlak) rincian.push(`Akhlak: ${matObj.akhlak}`);
        if (matObj.tilawati) rincian.push(`Tilawati: ${matObj.tilawati}`);
        if (matObj.bacaan) rincian.push(`Bacaan: ${matObj.bacaan}`);
        if (matObj.tajwid) rincian.push(`Tajwid: ${matObj.tajwid}`);
        if (matObj.maknaQuran) rincian.push(`Al-Qur'an: ${matObj.maknaQuran}`);
        if (matObj.maknaHadist) rincian.push(`Al-Hadist: ${matObj.maknaHadist}`);
        if (matObj.hafalanDalil) rincian.push(`Dalil: ${matObj.hafalanDalil}`);
        if (matObj.hafalanSurat) rincian.push(`Surat: ${matObj.hafalanSurat}`);
        if (matObj.hafalanDoa) rincian.push(`Doa: ${matObj.hafalanDoa}`);
        if (matObj.bcm) rincian.push(`BCM: ${matObj.bcm}`);
        if (matObj.praktek) rincian.push(`Praktek: ${matObj.praktek}`);

        if (rincian.length > 0) {
          relevantJurnal.add(`<b>[${tglLabel} - Capaian Caberawit]</b> ${rincian.join(" | ")}`);
        }
      } catch (e) {
        relevantJurnal.add(`<b>[${tglLabel}]</b> ${rawCaberawit}`);
      }
    }

    // c. Catatan kendala KBM
    const kendalaText = String(p.Kendala || p.kendala || "").trim();
    if (kendalaText && kendalaText !== "-" && kendalaText !== "null" && kendalaText !== "undefined") {
      relevantJurnal.add(`<b>[${tglLabel} - Kendala KBM]</b> ${kendalaText}`);
    }

    // --- Rekap Kehadiran Hadir L dan P ---
    const st = String(p.StatusPresensi || p.Status || p.status || "Hadir").trim();
    if (st === "Hadir") {
      if (!sessionPresenceMap[dateStr]) sessionPresenceMap[dateStr] = { L: 0, P: 0 };
      const g = genderMap[pNama] || "L";
      if (g === "L") sessionPresenceMap[dateStr].L++;
      else sessionPresenceMap[dateStr].P++;
    }
  });

  // 3. Matriks Hari x Minggu 1-5
  const gridAttendance = Array.from({ length: 7 }, () => Array.from({ length: 5 }, () => null));

  Object.keys(sessionPresenceMap).forEach(dStr => {
    const curD = new Date(dStr + "T00:00:00");
    if (isNaN(curD.getTime())) return;

    const dom = curD.getDate();
    const weekIdx = Math.min(Math.floor((dom - 1) / 7), 4);

    const jsDay = curD.getDay(); // 0=Minggu, 1=Senin..6=Sabtu
    const rowDay = (jsDay === 0) ? 6 : (jsDay - 1); // 0=Senin..6=Minggu

    gridAttendance[rowDay][weekIdx] = sessionPresenceMap[dStr];
  });

  // Hitung Nilai Rata-rata Mingguan
  const weekAverages = [0, 1, 2, 3, 4].map(wIdx => {
    let totalHadir = 0;
    let activeDays = 0;
    for (let r = 0; r < 7; r++) {
      const cell = gridAttendance[r][wIdx];
      if (cell) {
        totalHadir += (cell.L + cell.P);
        activeDays++;
      }
    }
    return activeDays > 0 ? (totalHadir / activeDays).toFixed(1) : "-";
  });

  const hariLabels = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
  const tableRowsHtml = hariLabels.map((hari, rIdx) => {
    const cols = [0, 1, 2, 3, 4].map(wIdx => {
      const cell = gridAttendance[rIdx][wIdx];
      return cell ? `<td>${cell.L} L / ${cell.P} P</td>` : `<td>-</td>`;
    }).join("");
    return `<tr><td class="hari-col">${hari}</td>${cols}</tr>`;
  }).join("");

  const rataRataColsHtml = weekAverages.map(avg => `<td>${avg}</td>`).join("");
  const subJudulWilayah = `Desa: ${desaFilter} | Kelompok: ${kelFilter} | Kelas: ${filterKelasUsia} | Periode: ${periodeText}`;
  const todayStr = formatTanggalIndo(new Date().toISOString().split("T")[0]);

  const listMateriHtml = relevantJurnal.size > 0 
    ? Array.from(relevantJurnal).map(item => `<div style="margin-bottom: 5px;">• ${item}</div>`).join("")
    : "Belum ada catatan materi pembelajaran pada periode ini.";

  // 4. Output Pop-up Dokumen Cetak Lanskap
  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>Cetak Lembar Kerja Presensi</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 10mm 12mm;
        }
        body {
          font-family: Arial, Helvetica, sans-serif;
          color: #1e293b;
          margin: 0;
          padding: 10px;
          background: #ffffff;
        }
        .no-print {
          margin-bottom: 12px;
        }
        .btn-print {
          background-color: #0f766e;
          color: #ffffff;
          font-size: 13px;
          font-weight: bold;
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }
        .title {
          font-size: 16px;
          font-weight: 800;
          color: #0f766e;
          margin: 0 0 3px 0;
          text-transform: uppercase;
        }
        .subtitle {
          font-size: 11px;
          color: #475569;
          font-weight: 600;
          margin: 0 0 10px 0;
        }
        .badge-group {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }
        .badge {
          border: 1px solid #cbd5e1;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: bold;
        }
        .badge-total {
          background-color: #ccfbf1;
          border-color: #5eead4;
          color: #0f766e;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
          margin-bottom: 16px;
        }
        th, td {
          border: 1px solid #94a3b8;
          padding: 6px 8px;
          text-align: center;
        }
        th {
          background-color: #f8fafc;
          font-weight: 800;
          text-transform: uppercase;
        }
        td.hari-col {
          font-weight: bold;
          text-align: left;
          width: 110px;
        }
        tr.rata-rata-row {
          font-weight: bold;
          background-color: #f1f5f9;
        }
        .section-title {
          font-size: 12px;
          font-weight: 800;
          color: #0f766e;
          margin-bottom: 6px;
          text-transform: uppercase;
        }
        .jurnal-box {
          font-size: 11px;
          color: #334155;
          border: 1px solid #cbd5e1;
          background-color: #f8fafc;
          border-radius: 6px;
          padding: 8px 12px;
          margin-bottom: 20px;
          line-height: 1.5;
        }
        .footer-sign {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          font-weight: bold;
          margin-top: 15px;
        }
        .sign-col {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 75px;
        }
        @media print {
          .no-print {
            display: none !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="no-print">
        <button class="btn-print" onclick="window.print()">🖨️ Cetak / Simpan sebagai PDF (Lanskap)</button>
      </div>

      <div class="title">LEMBAR KERJA PRESENSI & CAPAIAN PEMBELAJARAN</div>
      <div class="subtitle">${subJudulWilayah}</div>

      <div class="badge-group">
        <div class="badge">Laki-Laki (L): ${countLaki} Org</div>
        <div class="badge">Perempuan (P): ${countPerempuan} Org</div>
        <div class="badge badge-total">Total Jamaah: ${totalJamaah} Org</div>
      </div>

      <table>
        <thead>
          <tr>
            <th>HARI</th>
            <th>MINGGU 1</th>
            <th>MINGGU 2</th>
            <th>MINGGU 3</th>
            <th>MINGGU 4</th>
            <th>MINGGU 5</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
          <tr class="rata-rata-row">
            <td>RATA-RATA</td>
            ${rataRataColsHtml}
          </tr>
        </tbody>
      </table>

      <div class="section-title">REKAPITULASI CAPAIAN MATERI & KENDALA KBM</div>
      <div class="jurnal-box">
        ${listMateriHtml}
      </div>

      <div class="footer-sign">
        <div class="sign-col">
          <span>Mengetahui,</span>
          <span>Ketua Pengurus</span>
        </div>
        <div class="sign-col" style="text-align: right;">
          <span>Dicetak Pada: ${todayStr}</span>
          <span>Pengajar / Admin</span>
        </div>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// =========================================================================
// MODUL PENYAPAAN WILAYAH
// =========================================================================

function buildLocalPenyapaanState() {
  const mk = Array.isArray(appData.master_kelompok) ? appData.master_kelompok : [];
  const sapaanList = Array.isArray(appData.penyapaan) ? appData.penyapaan : [];

  const freqMap = {};
  const lastDateMap = {};

  sapaanList.forEach(s => {
    const kId = String(s.ID_Kelompok || "").trim();
    if (!kId) return;
    freqMap[kId] = (freqMap[kId] || 0) + 1;
    const curDate = new Date(s.Tanggal);
    if (!lastDateMap[kId] || curDate > new Date(lastDateMap[kId])) {
      lastDateMap[kId] = s.Tanggal;
    }
  });

  localPenyapaanData = mk.map(k => {
    const kId = String(k.ID_Kelompok || "").trim();
    const totalCount = freqMap[kId] || 0;
    return {
      id: kId,
      nama_desa: String(k.Nama_Desa || "-").trim(),
      nama_kelompok: String(k.Nama_Kelompok || "-").trim(),
      total_penyapaan: totalCount,
      base_total: totalCount,
      status_sapa: false,
      status_belum_sapa: false,
      is_dirty: false,
      tanggal_terakhir: lastDateMap[kId] || "-",
      is_recommended: false
    };
  });

  calculateRekomendasi16Kelompok();
}

function calculateRekomendasi16Kelompok() {
  localPenyapaanData.forEach(k => k.is_recommended = false);
  const desas = [...new Set(localPenyapaanData.map(k => k.nama_desa))];
  desas.forEach(desa => {
    const kelompokInDesa = localPenyapaanData.filter(k => k.nama_desa === desa);
    if (kelompokInDesa.length === 0) return;
    kelompokInDesa.sort((a, b) => parseInt(a.total_penyapaan || 0, 10) - parseInt(b.total_penyapaan || 0, 10));
    const lowest4 = kelompokInDesa.slice(0, 4);
    lowest4.forEach(item => { item.is_recommended = true; });
  });
}

function toggleLocalSapa(idKelompok, actionType) {
  if (!canWritePenyapaan()) {
    alert("Akun Admin Desa / Admin Kelompok bersifat Read-Only pada modul penyapaan!");
    renderPetaCards();
    return;
  }

  const item = localPenyapaanData.find(k => String(k.id) === String(idKelompok));
  if (!item) return;

  if (actionType === "sapa") {
    item.status_sapa = !item.status_sapa;
    if (item.status_sapa) item.status_belum_sapa = false;
  } else if (actionType === "belum_sapa") {
    item.status_belum_sapa = !item.status_belum_sapa;
    if (item.status_belum_sapa) item.status_sapa = false;
  }

  item.total_penyapaan = item.base_total + (item.status_sapa ? 1 : 0);
  item.is_dirty = (item.status_sapa || item.status_belum_sapa);

  calculateRekomendasi16Kelompok();
  renderPetaCards();
}

async function simpanBatchPenyapaanGrid() {
  if (!canWritePenyapaan()) {
    return alert("Akses ditolak: Admin Desa & Kelompok hanya dapat melihat riwayat penyapaan.");
  }

  const dirtyItems = localPenyapaanData.filter(k => k.is_dirty && k.status_sapa);
  if (dirtyItems.length === 0) {
    return alert("Belum ada kelompok yang ditandai 'Sapa' untuk disimpan.");
  }

  const dateInput = document.getElementById("sapaan-batch-date");
  const agendaInput = document.getElementById("sapaan-batch-agenda");

  const tanggalStr = dateInput && dateInput.value ? dateInput.value : new Date().toISOString().split("T")[0];
  const agendaStr = agendaInput && agendaInput.value.trim() ? agendaInput.value.trim() : "Kunjungan & Evaluasi Pembinaan Rutin";

  showMessage("Menyimpan data penyapaan...", "info");

  try {
    for (const item of dirtyItems) {
      const payload = {
        action: "add_penyapaan",
        tanggal: tanggalStr,
        idKelompok: item.id,
        namaKelompok: item.nama_kelompok,
        namaDesa: item.nama_desa,
        namaPetugas: currentAdmin.nama || currentAdmin.username || "Admin Daerah",
        jenisKegiatan: agendaStr,
        catatan: `Disapa pada kegiatan: ${agendaStr}`
      };

      await fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }

    showMessage("Data penyapaan berhasil disimpan ke database!", "success");
    await loadAllData();
  } catch (err) {
    showMessage("Gagal menyimpan penyapaan: " + err, "error");
  }
}

function switchPenyapaanSubTab(subTabName) {
  ["status-peta", "rekap-riwayat"].forEach(name => {
    const el = document.getElementById(`subtab-${name}`);
    const btn = document.getElementById(`subtab-btn-${name}`);
    if (el) el.classList.add("hidden");
    if (btn) btn.classList.remove("active", "bg-teal-700", "text-white");
  });

  const activeEl = document.getElementById(`subtab-${subTabName}`);
  const activeBtn = document.getElementById(`subtab-btn-${subTabName}`);
  if (activeEl) activeEl.classList.remove("hidden");
  if (activeBtn) activeBtn.classList.add("active", "bg-teal-700", "text-white");
}

function renderPenyapaanModule() {
  const badge = document.getElementById("badge-total-sapaan");
  const total = (analyticsPenyapaan && analyticsPenyapaan.totalSapaan) 
    ? analyticsPenyapaan.totalSapaan 
    : (Array.isArray(appData.penyapaan) ? appData.penyapaan.length : 0);
  if (badge) badge.innerText = total;

  renderPetaCards();
  renderRiwayatPenyapaanTable();
}

function filterPetaCards(filter) {
  currentPetaFilter = filter;
  ["all", "sudah", "belum"].forEach(f => {
    const btn = document.getElementById(`peta-filter-${f}`);
    if (btn) {
      if (f === filter) {
        btn.className = "px-2.5 py-1 text-[11px] rounded bg-teal-600 text-white font-semibold";
      } else {
        btn.className = "px-2.5 py-1 text-[11px] rounded bg-white border border-slate-300 font-semibold text-slate-600 hover:bg-slate-100";
      }
    }
  });
  renderPetaCards();
}

function renderPetaCards() {
  const container = document.getElementById("peta-desa-grid");
  if (!container) return;

  if (!localPenyapaanData || localPenyapaanData.length === 0) {
    buildLocalPenyapaanState();
  }

  const desas = [...new Set(localPenyapaanData.map(m => m.nama_desa))];
  const hasDirty = localPenyapaanData.some(k => k.is_dirty);
  const writeAccess = canWritePenyapaan();
  const selectedSapaDate = document.getElementById("sapaan-batch-date")?.value || new Date().toISOString().split("T")[0];

  container.innerHTML = desas.map(desa => {
    let list = localPenyapaanData.filter(k => k.nama_desa === desa);

    if (currentPetaFilter === "sudah") list = list.filter(k => k.total_penyapaan > 0 || k.status_sapa);
    if (currentPetaFilter === "belum") list = list.filter(k => k.total_penyapaan === 0 && !k.status_sapa);

    list.sort((a, b) => {
      if (a.is_recommended && !b.is_recommended) return -1;
      if (!a.is_recommended && b.is_recommended) return 1;
      return parseInt(a.total_penyapaan || 0, 10) - parseInt(b.total_penyapaan || 0, 10);
    });

    return `
      <div class="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div class="border-b pb-2 flex justify-between items-center">
          <h4 class="font-bold text-slate-800 text-xs sm:text-sm uppercase flex items-center gap-1.5">
            <i class="fa-solid fa-location-dot text-emerald-600"></i> ${desa}
          </h4>
          <span class="text-[11px] text-slate-500 font-semibold">${list.length} Kelompok</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
          ${list.map(k => {
            const isSapaChecked = k.status_sapa;
            const isBelumChecked = k.status_belum_sapa;

            const sapaanList = Array.isArray(appData.penyapaan) ? appData.penyapaan : [];
            const isAlreadySapaToday = sapaanList.some(s => {
              const sDate = s.Tanggal ? String(s.Tanggal).split("T")[0] : "";
              return String(s.ID_Kelompok || "").trim() === String(k.id).trim() && sDate === selectedSapaDate;
            });

            let badgeHtml = "";
            if (isAlreadySapaToday) {
              badgeHtml = `<span class="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-300">Tersimpan</span>`;
            } else if (k.is_dirty) {
              badgeHtml = `<span class="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-300">Draf</span>`;
            } else if (k.total_penyapaan > 0) {
              badgeHtml = `<span class="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-300">${k.total_penyapaan}x Disapa</span>`;
            } else {
              badgeHtml = `<span class="bg-slate-100 text-slate-500 text-[9px] font-semibold px-1.5 py-0.5 rounded">Belum</span>`;
            }

            let rekomBadge = "";
            if (k.is_recommended) {
              rekomBadge = `
                <span class="text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <i class="fa-solid fa-star text-amber-500 text-[8px]"></i> Rekomendasi
                </span>
              `;
            }

            const inputDisabledAttr = writeAccess ? '' : 'disabled';
            const cursorClass = writeAccess ? 'cursor-pointer' : 'cursor-not-allowed opacity-60';

            return `
              <div class="p-3 rounded-xl border flex flex-col justify-between space-y-2 ${k.is_dirty ? 'bg-amber-50/60 border-amber-300' : (k.is_recommended ? 'bg-amber-50/20 border-amber-200' : (k.total_penyapaan > 0 ? 'bg-emerald-50/30 border-emerald-200' : 'bg-slate-50/70 border-slate-200'))}">
                <div>
                  <div class="flex items-start justify-between gap-1 mb-1">
                    <p class="font-extrabold text-xs sm:text-sm text-slate-900 leading-snug truncate" title="${k.nama_kelompok}">${k.nama_kelompok}</p>${badgeHtml}
                  </div>
                  <div class="flex items-center gap-1.5 flex-wrap">
                    ${rekomBadge}
                    <span class="text-[9px] text-slate-400 font-medium">Terakhir: ${k.tanggal_terakhir !== '-' ? String(k.tanggal_terakhir).split('T')[0] : '-'}</span>
                  </div>
                </div>

                <div class="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                  <div class="flex items-center gap-2.5">
                    <label class="flex items-center gap-1 ${cursorClass}">
                      <input type="checkbox" ${isSapaChecked ? 'checked' : ''} ${inputDisabledAttr} onchange="toggleLocalSapa('${k.id}', 'sapa')" class="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5">
                      <span class="text-xs font-bold text-slate-800">Sapa</span>
                    </label>

                    <label class="flex items-center gap-1 ${cursorClass}">
                      <input type="checkbox" ${isBelumChecked ? 'checked' : ''} ${inputDisabledAttr} onchange="toggleLocalSapa('${k.id}', 'belum_sapa')" class="rounded text-rose-600 focus:ring-rose-500 w-3.5 h-3.5">
                      <span class="text-xs font-bold text-slate-500">Belum</span>
                    </label>
                  </div>

                  <div class="text-right pl-1">
                    <span class="text-[8px] text-slate-400 block font-bold uppercase tracking-wider">Total</span>
                    <span class="text-sm font-black text-teal-950">${k.total_penyapaan}x</span>
                  </div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }).join("");

  if (writeAccess && hasDirty) {
    container.innerHTML += `
      <div class="col-span-full bg-amber-50 border border-amber-300 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md sticky bottom-3 z-20">
        <div class="flex items-center gap-2 text-xs font-semibold text-amber-900 text-center sm:text-left">
          <i class="fa-solid fa-triangle-exclamation text-amber-600 text-sm"></i>
          <span>Perubahan tanda sapaan berstatus <b>Draf</b>. Klik simpan untuk mencatat ke server.</span>
        </div>
        <button onclick="simpanBatchPenyapaanGrid()" class="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2">
          <i class="fa-solid fa-floppy-disk"></i> Simpan Sapaan
        </button>
      </div>
    `;
  }
}

function renderRiwayatPenyapaanTable() {
  const container = document.getElementById("subtab-rekap-riwayat");
  if (!container || !analyticsPenyapaan) return;

  let wrapper = document.getElementById("riwayat-cards-grid-wrapper");
  if (!wrapper) {
    container.innerHTML = `
      <div class="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between gap-3 mb-4">
        <input type="text" id="search-riwayat" oninput="renderRiwayatPenyapaanTable()" placeholder="Cari kegiatan atau kelompok..." class="border rounded-lg px-3 py-1.5 text-xs w-full sm:w-80 focus:ring-1 focus:ring-teal-500 outline-none">
        <select id="filter-riwayat-desa" onchange="renderRiwayatPenyapaanTable()" class="border rounded-lg px-2.5 py-1.5 text-xs bg-white font-semibold text-slate-700">
          <option value="ALL">Semua Desa</option>
        </select>
      </div>
      <div id="riwayat-cards-grid-wrapper" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
    `;
    wrapper = document.getElementById("riwayat-cards-grid-wrapper");
  }

  const search = (document.getElementById("search-riwayat")?.value || "").toLowerCase().trim();
  const desaFilter = document.getElementById("filter-riwayat-desa")?.value || "ALL";

  let list = analyticsPenyapaan.riwayat || [];
  const sessionsMap = {};

  list.forEach(r => {
    const agenda = String(r.Jenis_Kegiatan_Sapaan || "Penyapaan Rutin").trim();
    const tanggal = r.Tanggal ? String(r.Tanggal).split("T")[0] : "-";
    const key = `${agenda}_${tanggal}`;

    if (!sessionsMap[key]) {
      sessionsMap[key] = {
        nama_kegiatan: agenda,
        tanggal: tanggal,
        kelompok_disapa: []
      };
    }

    sessionsMap[key].kelompok_disapa.push({
      desa: String(r.Nama_Desa || "-").trim(),
      nama_kelompok: String(r.Nama_Kelompok || "-").trim()
    });
  });

  let sessionsArray = Object.values(sessionsMap);

  if (search) {
    sessionsArray = sessionsArray.filter(s => {
      const matchAgenda = s.nama_kegiatan.toLowerCase().includes(search);
      const matchKelompok = s.kelompok_disapa.some(k => k.nama_kelompok.toLowerCase().includes(search) || k.desa.toLowerCase().includes(search));
      return matchAgenda || matchKelompok;
    });
  }

  if (desaFilter !== "ALL") {
    sessionsArray = sessionsArray.filter(s => {
      return s.kelompok_disapa.some(k => k.desa.toLowerCase() === desaFilter.toLowerCase());
    });
  }

  if (sessionsArray.length === 0) {
    wrapper.innerHTML = `<div class="col-span-full bg-white p-6 text-center text-slate-400 italic rounded-xl border border-slate-200 text-xs">Tidak ada riwayat penyapaan ditemukan.</div>`;
    return;
  }

  const desas = ["Banjarharjo", "Kaling", "Karangmojo", "Jaten"];

  wrapper.innerHTML = sessionsArray.map(session => {
    const totalDisapa = session.kelompok_disapa.length;

    const desaHtmlList = desas.map(desa => {
      const items = session.kelompok_disapa.filter(d => d.desa.toLowerCase() === desa.toLowerCase());
      if (items.length === 0) return '';

      const namesHtml = items.map(i => `
        <span class="inline-block bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md text-[11px] font-semibold">
          ${i.nama_kelompok}
        </span>
      `).join(' ');

      return `
        <div class="space-y-1">
          <p class="text-xs font-bold text-slate-700">Desa ${desa} (${items.length}):</p>
          <div class="flex flex-wrap gap-1.5">${namesHtml}</div>
        </div>
      `;
    }).join('');

    const formattedDateText = formatTanggalIndo(session.tanggal);

    return `
      <div class="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-3 flex flex-col justify-between">
        <div class="flex justify-between items-start border-b border-slate-100 pb-3 gap-2">
          <div>
            <h3 class="font-bold text-sm sm:text-base text-slate-900 leading-snug uppercase">${session.nama_kegiatan}</h3>
            <p class="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <i class="fa-solid fa-calendar-days text-teal-600"></i>
              <span class="font-semibold text-slate-700">${formattedDateText}</span>
            </p>
          </div>
          <div class="bg-teal-50 border border-teal-100 text-teal-800 px-2.5 py-1 rounded-xl text-right shrink-0">
            <span class="text-sm sm:text-base font-black">${totalDisapa}</span>
            <span class="text-[10px] font-bold block sm:inline"> Kelompok</span>
          </div>
        </div>

        <div class="space-y-2.5 pt-1">
          ${desaHtmlList || '<p class="text-xs text-slate-400 italic">Belum ada kelompok yang disapa.</p>'}
        </div>
      </div>
    `;
  }).join("");
}

function formatTanggalIndo(dateString) {
  if (!dateString || dateString === "-") return "-";
  const cleanDate = dateString.substring(0, 10);
  const parts = cleanDate.split('-');
  if (parts.length !== 3) return dateString;

  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const dayNum = parseInt(parts[2], 10);

  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const dateObj = new Date(year, monthIdx, dayNum);
  if (isNaN(dateObj.getTime())) return dateString;

  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const dayName = days[dateObj.getDay()];
  const monthName = months[monthIdx];

  return `${dayName}, ${dayNum} ${monthName} ${year}`;
}
