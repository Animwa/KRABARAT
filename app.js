// ==========================================
// FRONTEND LOGIC & INTEGRASI REST API KARANGANYAR BARAT
// ==========================================

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx6k1B4aoY4S9NAd3VSCPsWYNAqAe5wimrzAiEDRdIZKkZqChoAQXP-MM_rPNXS1wee/exec";

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

function setDefaultDate() {
  const today = new Date();
  const dateInput = document.getElementById("presensi-date");
  if (dateInput) {
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    dateInput.value = `${year}-${month}-${day}`;
    updateDayLabel();
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

      await loadPenyapaanAnalytics();
      initJamaahWilayahFilters();
      renderAllViews();
      hideMessage();
    } else {
      showMessage("Gagal memuat data: " + (json.error || json.message), "error");
    }
  } catch (err) {
    console.error("CORS / Network Error:", err);
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
  document.querySelectorAll(".view-section").forEach(s => s.classList.add("hidden"));
  document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));

  const targetView = document.getElementById(`view-${tabName}`);
  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetView) targetView.classList.remove("hidden");
  if (targetTab) targetTab.classList.add("active");

  const subnav = document.getElementById("subnav-container");
  const classnav = document.getElementById("classnav-container");

  if (tabName === "kelompok") {
    if (subnav) subnav.classList.remove("hidden");
    selectKelompok(currentKelompok);
  } else {
    if (subnav) subnav.classList.add("hidden");
    if (classnav) classnav.classList.add("hidden");
  }

  if (tabName === "monitoring") {
    renderMonitoringTable();
  } else if (tabName === "penyapaan") {
    renderPenyapaanModule();
  } else if (tabName === "beranda") {
    renderBerandaKegiatan();
  }

  const menuContainer = document.getElementById("nav-menu-container");
  const icon = document.getElementById("hamburger-icon");
  if (window.innerWidth < 768 && menuContainer && menuContainer.classList.contains("show-mobile-menu")) {
    menuContainer.classList.remove("show-mobile-menu");
    if (icon) {
      icon.classList.remove("fa-xmark");
      icon.classList.add("fa-bars");
    }
  }
}

function selectKelompok(kelompok) {
  currentKelompok = kelompok;
  document.querySelectorAll(".subnav-btn").forEach(b => b.classList.remove("active"));

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
    document.getElementById(idMap[kelompok]).classList.add("active");
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
        btn.className = `classnav-btn px-3 py-1 rounded-md bg-white border border-slate-300 hover:bg-teal-50 text-xs shrink-0 ${idx === 0 ? 'active' : ''}`;
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
        btn.className = `classnav-btn px-3 py-1 rounded-md bg-white border border-slate-300 hover:bg-teal-50 text-xs shrink-0 ${idx === 0 ? 'active' : ''}`;
        btn.innerText = cls;
        btn.onclick = () => selectKelas(cls, btn);
        classBtnContainer.appendChild(btn);
      });
    }
    selectKelas("Caberawit A");
  } else {
    if (classnav) classnav.classList.add("hidden");
    selectKelas("Umum");
  }
}

function selectKelas(kelas, btnEl) {
  currentKelas = kelas;
  if (btnEl) {
    document.querySelectorAll(".classnav-btn").forEach(b => b.classList.remove("active"));
    btnEl.classList.add("active");
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

function renderBerandaKegiatan() {
  const container = document.getElementById("kegiatan-cards-container");
  if (!container) return;

  const kegiatanList = Array.isArray(appData.kegiatan) ? appData.kegiatan : [];

  if (kegiatanList.length === 0) {
    container.innerHTML = `
      <div class="col-span-full bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400">
        <i class="fa-solid fa-calendar-xmark text-4xl mb-2 text-slate-300"></i>
        <p class="text-sm font-medium">Belum ada agenda kegiatan mendatang yang ditambahkan.</p>
      </div>
    `;
  } else {
    container.innerHTML = kegiatanList.map(k => `
      <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4">
        <div>
          <div class="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
            <span class="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-full border border-emerald-200 flex items-center gap-1">
              <i class="fa-solid fa-calendar-day"></i> ${k.Hari || '-'}, ${k.Tanggal ? k.Tanggal.toString().split("T")[0] : '-'}
            </span>
            <span class="text-xs text-amber-600 font-bold flex items-center gap-1">
              <i class="fa-solid fa-clock"></i> ${k.Jam || 'WIB'}
            </span>
          </div>
          <h3 class="font-bold text-slate-800 text-base mb-1">${k.Kegiatan || k.Nama_Kegiatan || '-'}</h3>
          <p class="text-xs text-slate-600 flex items-center gap-1 mb-2">
            <i class="fa-solid fa-user-tie text-teal-600"></i> <b>Pemateri:</b> ${k.Pemateri || '-'}
          </p>
          <p class="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            ${k.Keterangan || k.Target_Usia || 'Tidak ada catatan tambahan.'}
          </p>
        </div>
        <div class="admin-only ${currentAdmin ? '' : 'hidden'} flex justify-end pt-2 border-t border-slate-100">
          <button onclick="deleteRow('Kegiatan', '${k.ID || k.ID_Kegiatan}')" class="text-rose-600 hover:text-rose-800 text-xs font-semibold flex items-center gap-1 p-1">
            <i class="fa-solid fa-trash"></i> Hapus Agenda
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
  tbody.innerHTML = data.map(p => `
    <tr class="bg-white border-b hover:bg-slate-50">
      <td class="px-4 sm:px-6 py-3.5 font-semibold text-slate-800">${p.Nama || '-'}</td>
      <td class="px-4 sm:px-6 py-3.5">${p.Jabatan || '-'}</td>
      <td class="px-4 sm:px-6 py-3.5">${p.NoHP || '-'}</td>
      <td class="px-4 sm:px-6 py-3.5"><span class="px-2 py-1 rounded-full text-xs font-semibold ${p.Status === 'Aktif' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">${p.Status || 'Aktif'}</span></td>
      <td class="px-4 sm:px-6 py-3.5 text-center admin-only ${currentAdmin ? '' : 'hidden'}">
        <button onclick="deleteRow('Pengurus', '${p.ID}')" class="text-rose-600 hover:text-rose-800 p-1"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join("");
}

function renderInventaris() {
  const tbody = document.getElementById("table-inventaris-body");
  if (!tbody) return;
  const data = Array.isArray(appData.inventaris) ? appData.inventaris : [];
  tbody.innerHTML = data.map(i => `
    <tr class="bg-white border-b hover:bg-slate-50">
      <td class="px-4 sm:px-6 py-3.5 font-semibold text-slate-800">${i.NamaBarang || '-'}</td>
      <td class="px-4 sm:px-6 py-3.5">${i.Jumlah || 0}</td>
      <td class="px-4 sm:px-6 py-3.5"><span class="px-2 py-1 rounded-full text-xs font-semibold ${i.Kondisi === 'Baik' ? 'bg-teal-100 text-teal-800' : 'bg-rose-100 text-rose-800'}">${i.Kondisi || 'Baik'}</span></td>
      <td class="px-4 sm:px-6 py-3.5">${i.TanggalMasuk ? i.TanggalMasuk.toString().split("T")[0] : '-'}</td>
      <td class="px-4 sm:px-6 py-3.5">${i.Keterangan || '-'}</td>
      <td class="px-4 sm:px-6 py-3.5 text-center admin-only ${currentAdmin ? '' : 'hidden'}">
        <button onclick="deleteRow('Inventaris', '${i.ID}')" class="text-rose-600 hover:text-rose-800 p-1"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join("");
}

// =========================================================================
// SISTEM PILIHAN KELOMPOK PER DESA PADA DATA JAMAAH
// =========================================================================
function initJamaahWilayahFilters() {
  const desaSelect = document.getElementById("jamaah-filter-desa");
  if (!desaSelect) return;

  const data = Array.isArray(appData.jamaah) ? appData.jamaah : [];
  const mk = Array.isArray(appData.master_kelompok) ? appData.master_kelompok : [];

  let desas = new Set();
  data.forEach(j => { if (j.Desa) desas.add(String(j.Desa).trim()); });
  mk.forEach(m => { if (m.Nama_Desa) desas.add(String(m.Nama_Desa).trim()); });

  if (desas.size === 0) {
    desas = new Set(["Desa 1", "Desa 2", "Desa 3", "Desa 4"]);
  }

  desaSelect.innerHTML = `<option value="Semua">Semua Desa</option>` +
    Array.from(desas).map(d => `<option value="${d}">${d}</option>`).join("");

  onJamaahDesaFilterChange();
}

function onJamaahDesaFilterChange() {
  const desaSelect = document.getElementById("jamaah-filter-desa");
  const kelSelect = document.getElementById("jamaah-filter-kelompok");
  if (!desaSelect || !kelSelect) return;

  const selectedDesa = desaSelect.value;
  const data = Array.isArray(appData.jamaah) ? appData.jamaah : [];
  const mk = Array.isArray(appData.master_kelompok) ? appData.master_kelompok : [];

  let kelompokSet = new Set();

  if (selectedDesa === "Semua") {
    data.forEach(j => {
      const kel = j.Nama_Kelompok || j.KelompokBinaan;
      if (kel) kelompokSet.add(String(kel).trim());
    });
    mk.forEach(m => { if (m.Nama_Kelompok) kelompokSet.add(String(m.Nama_Kelompok).trim()); });
  } else {
    data.forEach(j => {
      if (String(j.Desa || "").trim().toLowerCase() === selectedDesa.toLowerCase()) {
        const kel = j.Nama_Kelompok || j.KelompokBinaan;
        if (kel) kelompokSet.add(String(kel).trim());
      }
    });
    mk.forEach(m => {
      if (String(m.Nama_Desa || "").trim().toLowerCase() === selectedDesa.toLowerCase()) {
        if (m.Nama_Kelompok) kelompokSet.add(String(m.Nama_Kelompok).trim());
      }
    });
  }

  kelSelect.innerHTML = `<option value="Semua">Semua Kelompok</option>` +
    Array.from(kelompokSet).map(k => `<option value="${k}">${k}</option>`).join("");

  renderJamaah();
}

function renderJamaah() {
  const tbody = document.getElementById("table-jamaah-body");
  if (!tbody) return;

  const data = Array.isArray(appData.jamaah) ? appData.jamaah : [];
  const desaFilter = document.getElementById("jamaah-filter-desa") ? document.getElementById("jamaah-filter-desa").value : "Semua";
  const kelFilter = document.getElementById("jamaah-filter-kelompok") ? document.getElementById("jamaah-filter-kelompok").value : "Semua";

  const filtered = data.filter(j => {
    const jDesa = String(j.Desa || "-").trim();
    const jKelBinaan = String(j.Nama_Kelompok || j.KelompokBinaan || "-").trim();

    const matchDesa = (desaFilter === "Semua") || (jDesa.toLowerCase() === desaFilter.toLowerCase());
    const matchKel = (kelFilter === "Semua") || (jKelBinaan.toLowerCase() === kelFilter.toLowerCase());

    return matchDesa && matchKel;
  });

  const badgeCount = document.getElementById("jamaah-count-badge");
  if (badgeCount) badgeCount.innerText = `${filtered.length} Jamaah Ditemukan`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="px-4 py-6 text-center text-slate-400 italic">Tidak ada data jamaah pada desa / kelompok yang dipilih.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(j => {
    const kelompokUsia = String(j.Kelas_Usia || j.Kelompok || "Unassigned").trim();
    let displayKelas = (kelompokUsia === "Caberawit") ? (j.Kelas || "Caberawit A") : "-";

    return `
      <tr class="bg-white border-b hover:bg-slate-50">
        <td class="px-3 sm:px-4 py-3 text-xs font-mono text-slate-500">${j.ID_Jamaah || j.ID || '-'}</td>
        <td class="px-3 sm:px-4 py-3 font-semibold text-slate-800">${j.Nama_Lengkap || j.Nama || '-'}</td>
        <td class="px-3 sm:px-4 py-3 text-xs font-semibold text-slate-700">${j.Desa || '-'}</td>
        <td class="px-3 sm:px-4 py-3 text-xs font-semibold text-slate-900">${j.Nama_Kelompok || j.KelompokBinaan || '-'}</td>
        <td class="px-3 sm:px-4 py-3 whitespace-nowrap">${j.TanggalLahir ? j.TanggalLahir.toString().split("T")[0] : '-'} <span class="text-xs text-emerald-600 font-bold">(${calculateAge(j.TanggalLahir)})</span></td>
        <td class="px-3 sm:px-4 py-3"><span class="px-2 py-1 rounded bg-teal-50 text-teal-700 font-semibold text-xs">${kelompokUsia}</span></td>
        <td class="px-3 sm:px-4 py-3"><span class="px-2 py-1 rounded bg-slate-100 text-slate-700 font-semibold text-xs">${displayKelas}</span></td>
        <td class="px-3 sm:px-4 py-3">${j.Gender || '-'}</td>
        <td class="px-3 sm:px-4 py-3">${j.Alamat || '-'}</td>
        <td class="px-3 sm:px-4 py-3"><span class="px-2 py-1 rounded-full text-xs font-semibold ${j.Keaktifan === 'Aktif' || j.Status === 'Aktif' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">${j.Keaktifan || j.Status || 'Aktif'}</span></td>
        <td class="px-3 sm:px-4 py-3 text-center admin-only space-x-2 ${currentAdmin ? '' : 'hidden'}">
          <button onclick="editJamaah('${j.ID_Jamaah || j.ID}')" class="text-amber-600 hover:text-amber-800 font-semibold p-1"><i class="fa-solid fa-pen-to-square"></i></button>
          <button onclick="deleteRow('Master_Jamaah', '${j.ID_Jamaah || j.ID}')" class="text-rose-600 hover:text-rose-800 p-1"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join("");
}

function renderPresensiTable() {
  const isCaberawit = (currentKelompok === "Caberawit");
  const theadTr = document.getElementById("presensi-table-header");

  if (theadTr) {
    if (isCaberawit) {
      theadTr.innerHTML = `
        <th scope="col" class="px-3 py-3 text-center w-12">NO</th>
        <th scope="col" class="px-4 py-3">NAMA JAMAAH</th>
        <th scope="col" class="px-3 py-3 text-center w-16">HADIR</th>
        <th scope="col" class="px-3 py-3 text-center w-16">IZIN</th>
        <th scope="col" class="px-3 py-3 text-center w-16">ALFA</th>
        <th scope="col" class="px-3 py-3 text-center w-36 text-teal-800">29 KARAKTER</th>
        <th scope="col" class="px-3 py-3 text-left w-48">KETERANGAN</th>
      `;
    } else {
      theadTr.innerHTML = `
        <th scope="col" class="px-3 py-3 text-center w-12">NO</th>
        <th scope="col" class="px-4 py-3">NAMA JAMAAH</th>
        <th scope="col" class="px-3 py-3 text-center w-16">HADIR</th>
        <th scope="col" class="px-3 py-3 text-center w-16">IZIN</th>
        <th scope="col" class="px-3 py-3 text-center w-16">ALFA</th>
        <th scope="col" class="px-3 py-3 text-left w-48">KETERANGAN</th>
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

  const jamaahList = Array.isArray(appData.jamaah) ? appData.jamaah : [];
  const presensiList = Array.isArray(appData.presensi) ? appData.presensi : [];

  const filteredJamaah = jamaahList.filter(j => {
    const matchStatus = String(j.Keaktifan || j.Status || "Aktif").trim().toLowerCase() === "aktif";
    const jKelompok = String(j.Kelas_Usia || j.Kelompok || "").trim();
    const jGender = String(j.Gender || "").trim().toLowerCase();

    if (currentKelompok === "ASAD") {
      if (currentKelas === "Caberawit Laki-Laki") return matchStatus && jKelompok === "Caberawit" && jGender === "laki-laki";
      if (currentKelas === "Caberawit Perempuan") return matchStatus && jKelompok === "Caberawit" && jGender === "perempuan";
      if (currentKelas === "Laki-Laki") return matchStatus && ["Pra Remaja", "Remaja", "Muda-Mudi", "Bapak-Bapak"].includes(jKelompok) && jGender === "laki-laki";
      if (currentKelas === "Perempuan") return matchStatus && ["Pra Remaja", "Remaja", "Muda-Mudi", "Ibu-Ibu"].includes(jKelompok) && jGender === "perempuan";
    }

    const matchKelompok = String(jKelompok || "Caberawit").trim().toLowerCase() === String(currentKelompok).trim().toLowerCase();
    let matchKelas = (currentKelompok === "Caberawit") ? (String(j.Kelas || "").trim().toLowerCase() === String(currentKelas).trim().toLowerCase()) : true;
    return matchStatus && matchKelompok && matchKelas;
  });

  const tbody = document.getElementById("table-presensi-body");
  if (!tbody) return;

  const displayTitle = (currentKelompok === "Caberawit" || currentKelompok === "ASAD") ? `${currentKelompok} (${currentKelas})` : currentKelompok;
  const isReadOnly = !currentAdmin;

  if (filteredJamaah.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${isCaberawit ? 7 : 6}" class="px-4 py-6 text-center text-slate-400 italic">
          Belum ada jamaah yang terdaftar di kelompok <b>${displayTitle}</b>.<br>
          <span class="text-xs text-slate-500">Buka menu <b>Data Jamaah</b> untuk menambahkan jamaah.</span>
        </td>
      </tr>
    `;
  } else {
    const selectedDateInput = document.getElementById("presensi-date");
    const targetDate = selectedDateInput ? selectedDateInput.value : "";

    let existingStatusMap = {};
    presensiList.forEach(p => {
      if (!p.Tanggal || !p.NamaJamaah) return;
      const pKel = String(p.Kelompok || "").trim().toLowerCase();
      const pKls = String(p.Kelas || "Umum").trim().toLowerCase();
      let pDateStr = (p.Tanggal instanceof Date) ? p.Tanggal.toISOString().split("T")[0] : String(p.Tanggal).split("T")[0].trim();

      const checkKelas = (currentKelompok === "Caberawit" || currentKelompok === "ASAD") ? (pKls === String(currentKelas).trim().toLowerCase()) : true;

      if (pKel === String(currentKelompok).trim().toLowerCase() && checkKelas && pDateStr === targetDate) {
        existingStatusMap[String(p.NamaJamaah).trim().toLowerCase()] = {
          status: String(p.StatusPresensi || "Hadir").trim(),
          keterangan: String(p.Keterangan || "").trim(),
          karakter29: String(p.Karakter29 || p.karakter29 || "Belum").trim()
        };
      }
    });

    tbody.innerHTML = filteredJamaah.map((j, idx) => {
      const nama = j.Nama_Lengkap || j.Nama;
      const namaKey = String(nama).trim().toLowerCase();
      const exData = existingStatusMap[namaKey] || { status: "Hadir", keterangan: "", karakter29: "Belum" };
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
            <select id="karakter-${idx}" ${isReadOnly ? 'disabled' : ''} class="text-[11px] px-2 py-1 rounded border border-slate-300 bg-white font-semibold ${savedKarakter === 'Sudah' ? 'text-emerald-700 bg-emerald-50' : 'text-slate-600'}">
              <option value="Belum" ${savedKarakter === 'Belum' ? 'selected' : ''}>Belum</option>
              <option value="Sudah" ${savedKarakter === 'Sudah' ? 'selected' : ''}>Sudah</option>
            </select>
          </td>
        `;
      }

      return `
        <tr class="bg-white border-b hover:bg-slate-50">
          <td class="px-3 py-3 text-center text-xs font-semibold text-slate-500">${idx + 1}</td>
          <td class="px-4 py-3 font-medium text-slate-800">
            ${nama}
            ${existingStatusMap[namaKey] ? `<span class="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">Tersimpan</span>` : ''}
          </td>
          <td class="px-3 py-3 text-center">
            <input type="radio" name="presensi-${idx}" value="Hadir" onchange="toggleKetInput(${idx})" ${savedStatus === 'Hadir' ? 'checked' : ''} ${disabledRadio} class="w-4 h-4 text-emerald-600 focus:ring-emerald-500">
          </td>
          <td class="px-3 py-3 text-center">
            <input type="radio" name="presensi-${idx}" value="Izin" onchange="toggleKetInput(${idx})" ${savedStatus === 'Izin' ? 'checked' : ''} ${disabledRadio} class="w-4 h-4 text-amber-500 focus:ring-amber-500">
          </td>
          <td class="px-3 py-3 text-center">
            <input type="radio" name="presensi-${idx}" value="Alfa" onchange="toggleKetInput(${idx})" ${savedStatus === 'Alfa' ? 'checked' : ''} ${disabledRadio} class="w-4 h-4 text-rose-600 focus:ring-rose-500">
          </td>
          ${caberawitExtraTd}
          <td class="px-3 py-3">
            <input type="text" id="ket-${idx}" value="${savedKet}" placeholder="${isReadOnly ? '-' : 'Alasan izin...'}" ${disabledKet} class="w-full text-xs px-2 py-1 border rounded bg-slate-50 focus:bg-white focus:ring-1 focus:ring-amber-500 transition-all ${!isIzinChecked ? 'opacity-40' : ''}">
          </td>
        </tr>
      `;
    }).join("");
  }

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

  let h = 0, i = 0, a = 0;
  let latestPresensiMap = {};

  const presensiList = Array.isArray(appData.presensi) ? appData.presensi : [];

  presensiList.forEach(p => {
    if (!p.Tanggal || !p.NamaJamaah) return;

    const pKel = String(p.Kelompok || "").trim().toLowerCase();
    const pKelTarget = String(currentKelompok).trim().toLowerCase();
    const pKls = String(p.Kelas || "Umum").trim().toLowerCase();
    const pKlsTarget = String(currentKelas).trim().toLowerCase();

    let pDateStr = (p.Tanggal instanceof Date) ? p.Tanggal.toISOString().split("T")[0] : String(p.Tanggal).split("T")[0].trim();
    const checkKelas = (currentKelompok === "Caberawit" || currentKelompok === "ASAD") ? (pKls === pKlsTarget) : true;

    if (pKel === pKelTarget && checkKelas && pDateStr === targetDate) {
      latestPresensiMap[String(p.NamaJamaah).trim().toLowerCase()] = String(p.StatusPresensi || "Hadir").trim();
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
    document.getElementById("rekap-mingguan-title").innerHTML = `<i class="fa-solid fa-calendar-day mr-2"></i> Rekapan Presensi Hari Ini (${targetDate}): ${displayTitle}`;
  }
}

async function submitPresensi() {
  if (!currentAdmin) return alert("Akses Admin diperlukan untuk menyimpan presensi!");

  const dateInput = document.getElementById("presensi-date");
  const dayInput = document.getElementById("presensi-day");
  if (!dateInput || !dayInput) return;

  const date = dateInput.value;
  const day = dayInput.value;
  const isCaberawit = (currentKelompok === "Caberawit");

  const jenisKegiatan = document.getElementById("presensi-jenis-kegiatan") ? document.getElementById("presensi-jenis-kegiatan").value : "";
  const pemateri = document.getElementById("presensi-pemateri") ? document.getElementById("presensi-pemateri").value : "";
  const kendala = document.getElementById("presensi-kendala") ? document.getElementById("presensi-kendala").value : "";

  let jurnalText = "";
  let materiCaberawitObj = null;

  if (isCaberawit) {
    materiCaberawitObj = {
      akhlak: document.getElementById("mat-akhlak") ? document.getElementById("mat-akhlak").value : "",
      tilawati: document.getElementById("mat-tilawati") ? document.getElementById("mat-tilawati").value : "",
      bacaan: document.getElementById("mat-bacaan") ? document.getElementById("mat-bacaan").value : "",
      tajwid: document.getElementById("mat-tajwid") ? document.getElementById("mat-tajwid").value : "",
      maknaQuran: document.getElementById("mat-makna-quran") ? document.getElementById("mat-makna-quran").value : "",
      maknaHadist: document.getElementById("mat-makna-hadist") ? document.getElementById("mat-makna-hadist").value : "",
      hafalanDalil: document.getElementById("mat-hafalan-dalil") ? document.getElementById("mat-hafalan-dalil").value : "",
      hafalanSurat: document.getElementById("mat-hafalan-surat") ? document.getElementById("mat-hafalan-surat").value : "",
      hafalanDoa: document.getElementById("mat-hafalan-doa") ? document.getElementById("mat-hafalan-doa").value : "",
      bcm: document.getElementById("mat-bcm") ? document.getElementById("mat-bcm").value : "",
      praktek: document.getElementById("mat-praktek") ? document.getElementById("mat-praktek").value : ""
    };
    jurnalText = `Akhlak: ${materiCaberawitObj.akhlak || '-'} | Tilawati: ${materiCaberawitObj.tilawati || '-'}`;
  } else {
    jurnalText = document.getElementById("presensi-jurnal") ? document.getElementById("presensi-jurnal").value : "";
  }

  const jamaahList = Array.isArray(appData.jamaah) ? appData.jamaah : [];
  const filteredJamaah = jamaahList.filter(j => {
    const matchStatus = String(j.Keaktifan || j.Status || "Aktif").trim().toLowerCase() === "aktif";
    const jKelompok = String(j.Kelas_Usia || j.Kelompok || "").trim();
    const jGender = String(j.Gender || "").trim().toLowerCase();

    if (currentKelompok === "ASAD") {
      if (currentKelas === "Caberawit Laki-Laki") return matchStatus && jKelompok === "Caberawit" && jGender === "laki-laki";
      if (currentKelas === "Caberawit Perempuan") return matchStatus && jKelompok === "Caberawit" && jGender === "perempuan";
      if (currentKelas === "Laki-Laki") return matchStatus && ["Pra Remaja", "Remaja", "Muda-Mudi", "Bapak-Bapak"].includes(jKelompok) && jGender === "laki-laki";
      if (currentKelas === "Perempuan") return matchStatus && ["Pra Remaja", "Remaja", "Muda-Mudi", "Ibu-Ibu"].includes(jKelompok) && jGender === "perempuan";
    }

    const matchKelompok = String(jKelompok || "Caberawit").trim().toLowerCase() === String(currentKelompok).trim().toLowerCase();
    let matchKelas = (currentKelompok === "Caberawit") ? (String(j.Kelas || "").trim().toLowerCase() === String(currentKelas).trim().toLowerCase()) : true;
    return matchStatus && matchKelompok && matchKelas;
  });

  if (filteredJamaah.length === 0) return alert("Tidak ada jamaah untuk disimpan.");

  const records = filteredJamaah.map((j, idx) => {
    const radios = document.getElementsByName(`presensi-${idx}`);
    const ketInput = document.getElementById(`ket-${idx}`);
    const karakterSelect = document.getElementById(`karakter-${idx}`);

    let selectedStatus = "Hadir";
    for (let r of radios) { if (r.checked) selectedStatus = r.value; }

    return {
      kelompok: currentKelompok,
      kelas: (currentKelompok === "Caberawit" || currentKelompok === "ASAD") ? currentKelas : "Umum",
      tanggal: date,
      hari: day,
      nama: j.Nama_Lengkap || j.Nama,
      status: selectedStatus,
      keterangan: ketInput ? ketInput.value : "",
      karakter29: isCaberawit && karakterSelect ? karakterSelect.value : "Belum",
      jenisKegiatan: jenisKegiatan,
      pemateri: pemateri,
      jurnal: jurnalText,
      materiCaberawit: materiCaberawitObj ? JSON.stringify(materiCaberawitObj) : "",
      kendala: kendala,
      admin: currentAdmin ? currentAdmin.nama : "Admin"
    };
  });

  showMessage("Menyimpan presensi...", "info");
  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "save_presensi_batch", records: records })
    });
    const json = await res.json();
    if (json.success) {
      showMessage("Presensi berhasil diperbarui!", "success");
      await loadAllData();
    } else {
      showMessage("Gagal menyimpan: " + json.error, "error");
    }
  } catch (err) {
    showMessage("Gagal menyimpan presensi.", "error");
  }
}

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

  const filterSelect = document.getElementById("monitoring-filter-kelompok");
  const selectedFilter = filterSelect ? filterSelect.value : "Semua";

  const startDateInput = document.getElementById("monitoring-date-start");
  const endDateInput = document.getElementById("monitoring-date-end");
  const startDateVal = startDateInput ? startDateInput.value : "";
  const endDateVal = endDateInput ? endDateInput.value : "";

  const jamaahList = Array.isArray(appData.jamaah) ? appData.jamaah : [];
  const presensiList = Array.isArray(appData.presensi) ? appData.presensi : [];

  const filteredPresensi = presensiList.filter(p => {
    if (!p.Tanggal) return false;
    let pDateStr = (p.Tanggal instanceof Date) ? p.Tanggal.toISOString().split("T")[0] : String(p.Tanggal).split("T")[0].trim();
    if (startDateVal && pDateStr < startDateVal) return false;
    if (endDateVal && pDateStr > endDateVal) return false;
    return true;
  });

  const targetJamaah = jamaahList.filter(j => {
    const isAktif = String(j.Keaktifan || j.Status || "Aktif").trim().toLowerCase() === "aktif";
    if (!isAktif) return false;
    if (selectedFilter === "Semua") return true;

    const jKel = String(j.Kelas_Usia || j.Kelompok || "").trim();
    const jKls = String(j.Kelas || "").trim();

    if (selectedFilter === "Caberawit") {
      return jKel.toLowerCase() === "caberawit";
    } else if (selectedFilter.startsWith("Caberawit ")) {
      return jKel.toLowerCase() === "caberawit" && jKls.toLowerCase() === selectedFilter.toLowerCase();
    } else {
      return jKel.toLowerCase() === selectedFilter.toLowerCase();
    }
  });

  if (targetJamaah.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="px-4 py-6 text-center text-slate-400 italic">Tidak ada data jamaah pada filter ini.</td></tr>`;
    return;
  }

  tbody.innerHTML = targetJamaah.map((j, idx) => {
    const nama = j.Nama_Lengkap || j.Nama;
    const namaKey = String(nama || "").trim().toLowerCase();
    const isCaberawit = String(j.Kelas_Usia || j.Kelompok || "").trim().toLowerCase() === "caberawit";

    let countHadir = 0, countIzin = 0, countAlfa = 0;
    let izinReasons = [];
    let attendedAsad = false;
    let sudahKarakterCount = 0;
    let totalCaberawitPertemuan = 0;

    filteredPresensi.forEach(p => {
      const pNama = String(p.NamaJamaah || "").trim().toLowerCase();
      if (pNama === namaKey) {
        const pKel = String(p.Kelompok || "").trim();
        const st = String(p.StatusPresensi || "Hadir").trim();

        if (pKel === "ASAD") {
          if (st === "Hadir") attendedAsad = true;
        } else {
          if (st === "Hadir") countHadir++;
          else if (st === "Izin") {
            countIzin++;
            if (p.Keterangan && p.Keterangan.trim() !== "") izinReasons.push(p.Keterangan.trim());
          } else if (st === "Alfa") {
            countAlfa++;
          }

          if (isCaberawit) {
            totalCaberawitPertemuan++;
            if (String(p.Karakter29 || p.karakter29 || "").trim().toLowerCase() === "sudah") sudahKarakterCount++;
          }
        }
      }
    });

    const displayKelas = isCaberawit ? `${j.Kelompok || 'Caberawit'} (${j.Kelas || 'Caberawit A'})` : (j.Kelas_Usia || j.Kelompok);
    const reasonsText = izinReasons.length > 0 ? izinReasons.join("; ") : "-";

    let karakterStatusBadge = "-";
    if (isCaberawit) {
      karakterStatusBadge = (totalCaberawitPertemuan > 0 && sudahKarakterCount > 0)
        ? `<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">${sudahKarakterCount}/${totalCaberawitPertemuan} Sudah</span>`
        : `<span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Belum</span>`;
    }

    const asadBadge = attendedAsad
      ? `<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold"><i class="fa-solid fa-check mr-1"></i>Hadir</span>`
      : `<span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Tidak/Belum</span>`;

    return `
      <tr class="bg-white border-b hover:bg-slate-50">
        <td class="px-3 py-3 text-center font-semibold text-slate-500">${idx + 1}</td>
        <td class="px-4 py-3 font-semibold text-slate-800">${nama}</td>
        <td class="px-3 py-3 whitespace-nowrap"><span class="px-2 py-0.5 rounded bg-slate-100 font-medium">${displayKelas}</span></td>
        <td class="px-2 py-3 text-center font-bold text-emerald-600">${countHadir}</td>
        <td class="px-2 py-3 text-center font-bold text-amber-600">${countIzin}</td>
        <td class="px-2 py-3 text-center font-bold text-rose-600">${countAlfa}</td>
        <td class="px-4 py-3 text-xs text-slate-500 max-w-xs truncate" title="${reasonsText}">${reasonsText}</td>
        <td class="px-3 py-3 text-center whitespace-nowrap">${asadBadge}</td>
        <td class="px-3 py-3 text-center whitespace-nowrap">${karakterStatusBadge}</td>
      </tr>
    `;
  }).join("");
}

// =========================================================================
// MODUL PENYAPAAN KEGIATAN
// =========================================================================
function switchPenyapaanSubTab(subTabName) {
  ["status-peta", "rekap-riwayat", "input-sapaan"].forEach(name => {
    const el = document.getElementById(`subtab-${name}`);
    const btn = document.getElementById(`subtab-btn-${name}`);
    if (el) el.classList.add("hidden");
    if (btn) btn.classList.remove("active");
  });

  const activeEl = document.getElementById(`subtab-${subTabName}`);
  const activeBtn = document.getElementById(`subtab-btn-${subTabName}`);
  if (activeEl) activeEl.classList.remove("hidden");
  if (activeBtn) activeBtn.classList.add("active");
}

function renderPenyapaanModule() {
  if (!analyticsPenyapaan) return;

  const recGrid = document.getElementById("rekomendasi-grid");
  if (recGrid && analyticsPenyapaan.rekomendasi) {
    recGrid.innerHTML = analyticsPenyapaan.rekomendasi.map(r => `
      <div class="bg-white p-3 rounded-xl border border-amber-300 shadow-sm">
        <span class="text-[10px] font-bold uppercase text-amber-700 block">${r.nama_desa}</span>
        <p class="font-black text-slate-800 text-xs mt-0.5">${r.nama_kelompok}</p>
        <div class="flex justify-between items-center mt-2 text-[10px]">
          <span class="text-slate-500">Sapaan: <b>${r.frekuensi}x</b></span>
          <span class="px-2 py-0.5 rounded ${r.frekuensi === 0 ? 'bg-rose-100 text-rose-700 font-bold' : 'bg-amber-100 text-amber-800 font-bold'}">
            ${r.frekuensi === 0 ? 'Belum Pernah' : 'Terkecil'}
          </span>
        </div>
      </div>
    `).join("");
  }

  renderPetaCards();
  renderRiwayatPenyapaanTable();
  populateSapaanSelectors();
}

function filterPetaCards(filter) {
  currentPetaFilter = filter;
  renderPetaCards();
}

function renderPetaCards() {
  const container = document.getElementById("peta-desa-grid");
  if (!container || !analyticsPenyapaan) return;

  const mapping = analyticsPenyapaan.kelompokMapping || [];
  const desas = [...new Set(mapping.map(m => m.nama_desa))];

  container.innerHTML = desas.map(desa => {
    let list = mapping.filter(k => k.nama_desa === desa);
    if (currentPetaFilter === "sudah") list = list.filter(k => k.frekuensi > 0);
    if (currentPetaFilter === "belum") list = list.filter(k => k.frekuensi === 0);

    return `
      <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div class="border-b pb-2 flex justify-between items-center">
          <h4 class="font-bold text-slate-800 text-xs uppercase"><i class="fa-solid fa-location-dot text-emerald-600 mr-1"></i>${desa}</h4>
          <span class="text-[10px] text-slate-500 font-medium">${list.length} Kelompok</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          ${list.map(k => `
            <div class="p-2.5 rounded-xl border flex flex-col justify-between space-y-1.5 ${k.frekuensi > 0 ? 'bg-emerald-50/70 border-emerald-300' : 'bg-slate-50 border-slate-200'}">
              <div>
                <p class="font-bold text-xs text-slate-800">${k.nama_kelompok}</p>
                <span class="text-[10px] ${k.frekuensi > 0 ? 'text-emerald-700 font-bold' : 'text-slate-400 font-medium'}">
                  ${k.frekuensi > 0 ? `<i class="fa-solid fa-check"></i> ${k.frekuensi}x Disapa` : 'Belum Pernah Disapa'}
                </span>
              </div>
              <p class="text-[9px] text-slate-400 border-t pt-1 border-slate-200">
                Terakhir: ${k.tanggal_terakhir !== '-' ? String(k.tanggal_terakhir).split('T')[0] : '-'}
              </p>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");
}

function renderRiwayatPenyapaanTable() {
  const tbody = document.getElementById("table-riwayat-sapaan-body");
  if (!tbody || !analyticsPenyapaan) return;

  const search = (document.getElementById("search-riwayat").value || "").toLowerCase();
  const desaFilter = document.getElementById("filter-riwayat-desa") ? document.getElementById("filter-riwayat-desa").value : "ALL";

  let list = analyticsPenyapaan.riwayat || [];
  if (desaFilter !== "ALL") list = list.filter(r => r.Nama_Desa === desaFilter);
  if (search) {
    list = list.filter(r =>
      String(r.Nama_Petugas).toLowerCase().includes(search) ||
      String(r.Nama_Kelompok).toLowerCase().includes(search) ||
      String(r.Jenis_Kegiatan_Sapaan).toLowerCase().includes(search)
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400 italic">Tidak ada catatan riwayat penyapaan kegiatan.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(r => `
    <tr class="bg-white hover:bg-slate-50 border-b">
      <td class="px-3 py-2.5 whitespace-nowrap font-medium text-slate-600">${String(r.Tanggal).split('T')[0]}</td>
      <td class="px-3 py-2.5 font-semibold text-slate-700">${r.Nama_Desa}</td>
      <td class="px-3 py-2.5 font-bold text-slate-900">${r.Nama_Kelompok}</td>
      <td class="px-3 py-2.5 text-teal-700 font-semibold">${r.Jenis_Kegiatan_Sapaan}</td>
      <td class="px-3 py-2.5 font-medium text-slate-700">${r.Nama_Petugas}</td>
      <td class="px-4 py-2.5 text-slate-500 max-w-xs leading-relaxed">${r.Catatan_Hasil_Solusi}</td>
    </tr>
  `).join("");
}

function populateSapaanSelectors() {
  const desaSelect = document.getElementById("sapaan-desa-select");
  const filterDesa = document.getElementById("filter-riwayat-desa");
  if (!desaSelect) return;

  const mk = Array.isArray(appData.master_kelompok) ? appData.master_kelompok : [];
  const desas = [...new Set(mk.map(m => m.Nama_Desa))];

  if (desas.length === 0) desas.push("Desa 1", "Desa 2", "Desa 3", "Desa 4");

  desaSelect.innerHTML = desas.map(d => `<option value="${d}">${d}</option>`).join("");
  if (filterDesa) {
    filterDesa.innerHTML = `<option value="ALL">Semua Desa</option>` + desas.map(d => `<option value="${d}">${d}</option>`).join("");
  }

  handleSapaanDesaChange();
}

function handleSapaanDesaChange() {
  const desa = document.getElementById("sapaan-desa-select").value;
  const kelSelect = document.getElementById("sapaan-kelompok-select");
  if (!kelSelect) return;
  const mk = Array.isArray(appData.master_kelompok) ? appData.master_kelompok : [];
  const list = mk.filter(k => k.Nama_Desa === desa);
  kelSelect.innerHTML = list.map(k => `<option value="${k.ID_Kelompok}">${k.Nama_Kelompok}</option>`).join("");
}

async function handlePenyapaanSubmit(e) {
  e.preventDefault();
  if (!currentAdmin) return alert("Hanya Admin yang berwenang mencatat sapaan kegiatan!");

  const kelId = document.getElementById("sapaan-kelompok-select").value;
  const mk = Array.isArray(appData.master_kelompok) ? appData.master_kelompok : [];
  const kelObj = mk.find(k => String(k.ID_Kelompok) === String(kelId));

  const payload = {
    action: "add_penyapaan",
    tanggal: document.getElementById("sapaan-tanggal").value,
    idKelompok: kelId,
    namaKelompok: kelObj ? kelObj.Nama_Kelompok : "-",
    namaDesa: document.getElementById("sapaan-desa-select").value,
    namaPetugas: document.getElementById("sapaan-petugas").value,
    jenisKegiatan: document.getElementById("sapaan-agenda").value,
    catatan: document.getElementById("sapaan-catatan").value
  };

  showMessage("Menyimpan laporan penyapaan...", "info");
  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      showMessage(json.message, "success");
      document.getElementById("form-penyapaan").reset();
      await loadAllData();
      switchPenyapaanSubTab("status-peta");
    } else {
      showMessage(json.message, "error");
    }
  } catch (err) {
    showMessage("Gagal menyimpan penyapaan.", "error");
  }
}

function downloadLembarKerja() {
  window.print();
}

// =========================================================================
// MODAL & CRUD HANDLERS
// =========================================================================
function openFormKegiatan() {
  activeFormType = "Kegiatan";
  const titleEl = document.getElementById("modal-form-title");
  const fieldsEl = document.getElementById("modal-form-fields");
  if (titleEl) titleEl.innerText = "Tambah Agenda Kegiatan Baru";
  if (fieldsEl) {
    fieldsEl.innerHTML = `
      <input type="hidden" name="ID" value="">
      <div><label class="block text-xs font-semibold mb-1">Nama Kegiatan</label><input type="text" name="Kegiatan" required class="w-full border rounded px-3 py-1.5 text-sm" placeholder="Misal: Pengajian Akbar"></div>
      <div class="grid grid-cols-2 gap-2">
        <div><label class="block text-xs font-semibold mb-1">Tanggal</label><input type="date" id="modal-kegiatan-tanggal" name="Tanggal" required onchange="updateModalHari()" class="w-full border rounded px-3 py-1.5 text-sm"></div>
        <div><label class="block text-xs font-semibold mb-1">Hari</label><input type="text" id="modal-kegiatan-hari" name="Hari" readonly class="w-full border rounded px-3 py-1.5 text-sm bg-slate-100 font-semibold text-slate-700" placeholder="Otomatis"></div>
      </div>
      <div><label class="block text-xs font-semibold mb-1">Jam / Waktu</label><input type="text" name="Jam" required class="w-full border rounded px-3 py-1.5 text-sm" placeholder="Misal: 19:30 - Selesai"></div>
      <div><label class="block text-xs font-semibold mb-1">Pemateri</label><input type="text" name="Pemateri" class="w-full border rounded px-3 py-1.5 text-sm" placeholder="Nama Ustaz / Penceramah"></div>
      <div><label class="block text-xs font-semibold mb-1">Keterangan / Lokasi</label><textarea name="Keterangan" class="w-full border rounded px-3 py-1.5 text-sm"></textarea></div>
    `;
  }
  openModal("modal-form");
}

function updateModalHari() {
  const dateInput = document.getElementById("modal-kegiatan-tanggal");
  const hariInput = document.getElementById("modal-kegiatan-hari");
  if (!dateInput || !hariInput || !dateInput.value) return;
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const d = new Date(dateInput.value + "T00:00:00");
  if (!isNaN(d.getTime())) hariInput.value = days[d.getDay()];
}

function openFormPengurus() {
  activeFormType = "Pengurus";
  const titleEl = document.getElementById("modal-form-title");
  const fieldsEl = document.getElementById("modal-form-fields");
  if (titleEl) titleEl.innerText = "Tambah Data Pengurus";
  if (fieldsEl) {
    fieldsEl.innerHTML = `
      <input type="hidden" name="ID" value="">
      <div><label class="block text-xs font-semibold mb-1">Nama Lengkap</label><input type="text" name="Nama" required class="w-full border rounded px-3 py-1.5 text-sm"></div>
      <div><label class="block text-xs font-semibold mb-1">Jabatan</label><input type="text" name="Jabatan" required class="w-full border rounded px-3 py-1.5 text-sm"></div>
      <div><label class="block text-xs font-semibold mb-1">No. HP</label><input type="text" name="NoHP" class="w-full border rounded px-3 py-1.5 text-sm"></div>
      <div><label class="block text-xs font-semibold mb-1">Status</label><select name="Status" class="w-full border rounded px-3 py-1.5 text-sm"><option>Aktif</option><option>Non-Aktif</option></select></div>
    `;
  }
  openModal("modal-form");
}

function openFormInventaris() {
  activeFormType = "Inventaris";
  const titleEl = document.getElementById("modal-form-title");
  const fieldsEl = document.getElementById("modal-form-fields");
  if (titleEl) titleEl.innerText = "Tambah Inventaris Barang";
  if (fieldsEl) {
    fieldsEl.innerHTML = `
      <input type="hidden" name="ID" value="">
      <div><label class="block text-xs font-semibold mb-1">Nama Barang</label><input type="text" name="NamaBarang" required class="w-full border rounded px-3 py-1.5 text-sm"></div>
      <div><label class="block text-xs font-semibold mb-1">Jumlah</label><input type="number" name="Jumlah" required class="w-full border rounded px-3 py-1.5 text-sm" value="1"></div>
      <div><label class="block text-xs font-semibold mb-1">Kondisi</label><select name="Kondisi" class="w-full border rounded px-3 py-1.5 text-sm"><option>Baik</option><option>Rusak Ringan</option><option>Rusak Berat</option></select></div>
      <div><label class="block text-xs font-semibold mb-1">Tanggal Masuk</label><input type="date" name="TanggalMasuk" class="w-full border rounded px-3 py-1.5 text-sm"></div>
      <div><label class="block text-xs font-semibold mb-1">Keterangan</label><textarea name="Keterangan" class="w-full border rounded px-3 py-1.5 text-sm"></textarea></div>
    `;
  }
  openModal("modal-form");
}

function openFormJamaah(data = null) {
  activeFormType = "Jamaah";
  const titleEl = document.getElementById("modal-form-title");
  const fieldsEl = document.getElementById("modal-form-fields");
  if (titleEl) titleEl.innerText = data ? "Edit Data Jamaah" : "Tambah Data Jamaah";

  let formattedDob = "";
  if (data && data.TanggalLahir) {
    formattedDob = (data.TanggalLahir instanceof Date) ? data.TanggalLahir.toISOString().split("T")[0] : data.TanggalLahir.toString().split("T")[0].trim();
  }

  const mk = Array.isArray(appData.master_kelompok) ? appData.master_kelompok : [];
  let desas = [...new Set(mk.map(m => m.Nama_Desa))];
  if (desas.length === 0) desas = ["Desa 1", "Desa 2", "Desa 3", "Desa 4"];

  if (fieldsEl) {
    fieldsEl.innerHTML = `
      <input type="hidden" name="ID" value="${data ? (data.ID_Jamaah || data.ID || '') : ''}">
      <div><label class="block text-xs font-semibold mb-1">Nama Lengkap</label><input type="text" name="Nama_Lengkap" value="${data ? (data.Nama_Lengkap || data.Nama || '') : ''}" required class="w-full border rounded px-3 py-1.5 text-sm"></div>
      
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-semibold mb-1">Desa Binaan</label>
          <select name="Desa" id="form-modal-desa" onchange="onModalDesaChange()" class="w-full border rounded px-3 py-1.5 text-sm">
            ${desas.map(d => `<option value="${d}" ${data && data.Desa === d ? 'selected' : ''}>${d}</option>`).join("")}
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold mb-1">Kelompok Binaan</label>
          <select name="Nama_Kelompok" id="form-modal-kelompok" class="w-full border rounded px-3 py-1.5 text-sm"></select>
        </div>
      </div>

      <div><label class="block text-xs font-semibold mb-1">Tanggal Lahir</label><input type="date" name="TanggalLahir" value="${formattedDob}" required class="w-full border rounded px-3 py-1.5 text-sm"></div>

      <div>
        <label class="block text-xs font-semibold mb-1">Kelompok Usia</label>
        <select name="Kelas_Usia" id="field-kelompok" onchange="onKelompokChange()" class="w-full border rounded px-3 py-1.5 text-sm">
          <option value="Caberawit" ${data && (data.Kelas_Usia === 'Caberawit' || data.Kelompok === 'Caberawit') ? 'selected' : ''}>Caberawit (SD)</option>
          <option value="Pra Remaja" ${data && (data.Kelas_Usia === 'Pra Remaja' || data.Kelompok === 'Pra Remaja') ? 'selected' : ''}>Pra Remaja (SMP)</option>
          <option value="Remaja" ${data && (data.Kelas_Usia === 'Remaja' || data.Kelompok === 'Remaja') ? 'selected' : ''}>Remaja (SMA)</option>
          <option value="Muda-Mudi" ${data && (data.Kelas_Usia === 'Muda-Mudi' || data.Kelompok === 'Muda-Mudi') ? 'selected' : ''}>Muda-Mudi</option>
          <option value="Bapak-Bapak" ${data && (data.Kelas_Usia === 'Bapak-Bapak' || data.Kelompok === 'Bapak-Bapak') ? 'selected' : ''}>Bapak-Bapak</option>
          <option value="Ibu-Ibu" ${data && (data.Kelas_Usia === 'Ibu-Ibu' || data.Kelompok === 'Ibu-Ibu') ? 'selected' : ''}>Ibu-Ibu</option>
        </select>
      </div>

      <div id="form-kelas-wrapper">
        <label class="block text-xs font-semibold mb-1">Kelas/Tingkat</label>
        <select name="Kelas" id="field-kelas" class="w-full border rounded px-3 py-1.5 text-sm"></select>
      </div>

      <div>
        <label class="block text-xs font-semibold mb-1">Gender</label>
        <select name="Gender" class="w-full border rounded px-3 py-1.5 text-sm">
          <option value="Laki-Laki" ${data && data.Gender === 'Laki-Laki' ? 'selected' : ''}>Laki-Laki</option>
          <option value="Perempuan" ${data && data.Gender === 'Perempuan' ? 'selected' : ''}>Perempuan</option>
        </select>
      </div>

      <div><label class="block text-xs font-semibold mb-1">Alamat</label><textarea name="Alamat" class="w-full border rounded px-3 py-1.5 text-sm">${data ? (data.Alamat || '') : ''}</textarea></div>
      <div>
        <label class="block text-xs font-semibold mb-1">Status Keaktifan</label>
        <select name="Keaktifan" class="w-full border rounded px-3 py-1.5 text-sm">
          <option value="Aktif" ${!data || data.Keaktifan === 'Aktif' || data.Status === 'Aktif' ? 'selected' : ''}>Aktif</option>
          <option value="Non-Aktif" ${data && (data.Keaktifan === 'Non-Aktif' || data.Status === 'Non-Aktif') ? 'selected' : ''}>Non-Aktif</option>
        </select>
      </div>
    `;
  }

  onModalDesaChange(data ? (data.Nama_Kelompok || data.KelompokBinaan) : null);
  onKelompokChange(data ? data.Kelas : null);
  openModal("modal-form");
}

function onModalDesaChange(selectedKel = null) {
  const desaSel = document.getElementById("form-modal-desa");
  const kelSel = document.getElementById("form-modal-kelompok");
  if (!desaSel || !kelSel) return;

  const mk = Array.isArray(appData.master_kelompok) ? appData.master_kelompok : [];
  const list = mk.filter(k => k.Nama_Desa === desaSel.value);

  kelSel.innerHTML = list.map(k => `
    <option value="${k.Nama_Kelompok}" ${selectedKel && selectedKel === k.Nama_Kelompok ? 'selected' : ''}>
      ${k.Nama_Kelompok}
    </option>
  `).join("");
}

function onKelompokChange(selectedKelas = null) {
  const kValEl = document.getElementById("field-kelompok");
  const kelasSelect = document.getElementById("field-kelas");
  const kelasWrapper = document.getElementById("form-kelas-wrapper");
  if (!kValEl || !kelasSelect) return;

  const kVal = kValEl.value;
  kelasSelect.innerHTML = "";

  if (kVal === "Caberawit") {
    if (kelasWrapper) kelasWrapper.style.display = "block";
    const options = ["Caberawit A", "Caberawit B", "Caberawit C", "Caberawit D"];
    options.forEach(opt => {
      const isSelected = (selectedKelas && selectedKelas === opt) ? "selected" : "";
      kelasSelect.innerHTML += `<option value="${opt}" ${isSelected}>${opt}</option>`;
    });
  } else {
    if (kelasWrapper) kelasWrapper.style.display = "none";
    kelasSelect.innerHTML = `<option value="Umum" selected>Umum</option>`;
  }
}

function editJamaah(id) {
  const jamaahList = Array.isArray(appData.jamaah) ? appData.jamaah : [];
  const item = jamaahList.find(j => String(j.ID_Jamaah || j.ID) === String(id));
  if (item) openFormJamaah(item);
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const dataObj = {};
  formData.forEach((value, key) => dataObj[key] = value);

  if (activeFormType === "Jamaah") {
    const mk = Array.isArray(appData.master_kelompok) ? appData.master_kelompok : [];
    const matched = mk.find(k => k.Nama_Kelompok === dataObj.Nama_Kelompok);
    dataObj.ID_Kelompok = matched ? matched.ID_Kelompok : "KLP-000";
    dataObj.Usia = calculateAge(dataObj.TanggalLahir);
  }

  const actionName = (activeFormType === "Jamaah") ? "save_jamaah" : `save_${activeFormType.toLowerCase()}`;
  showMessage("Menyimpan data...", "info");

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: actionName, data: dataObj })
    });
    const json = await res.json();
    if (json.success) {
      showMessage(json.message || "Data berhasil disimpan!", "success");
      closeModal("modal-form");
      loadAllData();
    } else {
      showMessage("Gagal menyimpan: " + json.error, "error");
    }
  } catch (err) {
    showMessage("Gagal menyimpan data.", "error");
  }
}

async function deleteRow(sheetName, id) {
  if (!confirm("Apakah Anda yakin ingin menghapus data ini?")) return;
  showMessage("Menghapus data...", "info");

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "delete_row", sheetName: sheetName, id: id })
    });
    const json = await res.json();
    if (json.success) {
      showMessage(json.message || "Data berhasil dihapus.", "success");
      loadAllData();
    } else {
      showMessage("Gagal menghapus: " + json.error, "error");
    }
  } catch (err) {
    showMessage("Gagal menghapus data.", "error");
  }
}

function openLoginModal() { openModal("modal-login"); }
function openAddAdminModal() { openModal("modal-add-admin"); }
function openModal(id) { const modal = document.getElementById(id); if (modal) modal.classList.remove("hidden"); }
function closeModal(id) { const modal = document.getElementById(id); if (modal) modal.classList.add("hidden"); }

async function handleLogin(e) {
  e.preventDefault();
  const nama = document.getElementById("login-nama").value;
  const pin = document.getElementById("login-pin").value;

  showMessage("Memverifikasi...", "info");
  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "login", username: nama, password: pin, nama: nama, pin: pin })
    });
    const json = await res.json();
    if (json.success) {
      currentAdmin = json.admin || json.user || { nama: nama, role: "Admin" };
      sessionStorage.setItem("currentAdmin", JSON.stringify(currentAdmin));
      updateAdminUI();
      closeModal("modal-login");
      showMessage(`Selamat datang, ${currentAdmin.nama}!`, "success");
    } else {
      showMessage(json.message || "Login gagal.", "error");
    }
  } catch (err) {
    showMessage("Gagal login.", "error");
  }
}

function logoutAdmin() {
  currentAdmin = null;
  sessionStorage.removeItem("currentAdmin");
  updateAdminUI();
  showMessage("Anda telah logout.", "info");
}

function updateAdminUI() {
  const adminElements = document.querySelectorAll(".admin-only");
  if (currentAdmin) {
    adminElements.forEach(el => el.classList.remove("hidden"));
    if (document.getElementById("btn-login-modal")) document.getElementById("btn-login-modal").classList.add("hidden");
    if (document.getElementById("btn-logout")) document.getElementById("btn-logout").classList.remove("hidden");
    if (document.getElementById("admin-badge")) document.getElementById("admin-badge").classList.remove("hidden");
    if (document.getElementById("admin-name-display")) document.getElementById("admin-name-display").innerText = currentAdmin.nama;
  } else {
    adminElements.forEach(el => el.classList.add("hidden"));
    if (document.getElementById("btn-login-modal")) document.getElementById("btn-login-modal").classList.remove("hidden");
    if (document.getElementById("btn-logout")) document.getElementById("btn-logout").classList.add("hidden");
    if (document.getElementById("admin-badge")) document.getElementById("admin-badge").classList.add("hidden");
  }
  renderPresensiTable();
}

async function handleAddAdmin(e) {
  e.preventDefault();
  const nama = document.getElementById("new-admin-nama").value;
  const pin = document.getElementById("new-admin-pin").value;

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "save_user", username: nama, password: pin, nama: nama, role: "Admin Desa", scopeDesa: "ALL", scopeKelompok: "ALL" })
    });
    const json = await res.json();
    if (json.success) {
      showMessage("Admin berhasil ditambahkan!", "success");
      closeModal("modal-add-admin");
    } else {
      showMessage(json.message, "error");
    }
  } catch (err) {
    showMessage("Gagal menambahkan admin.", "error");
  }
}

function showMessage(msg, type) {
  const el = document.getElementById("status-message");
  if (!el) return;
  el.innerText = msg;
  el.className = "mb-4 p-3.5 sm:p-4 rounded-xl font-medium text-xs sm:text-sm border shadow-sm flex items-center justify-between";
  if (type === "success") el.classList.add("bg-emerald-100", "text-emerald-800", "border-emerald-300");
  else if (type === "error") el.classList.add("bg-rose-100", "text-rose-800", "border-rose-300");
  else el.classList.add("bg-amber-100", "text-amber-800", "border-amber-300");
  el.classList.remove("hidden");
}

function hideMessage() {
  const el = document.getElementById("status-message");
  if (el) el.classList.add("hidden");
}

function toggleMobileMenu() {
  const menuContainer = document.getElementById("nav-menu-container");
  const icon = document.getElementById("hamburger-icon");
  if (menuContainer) {
    menuContainer.classList.toggle("show-mobile-menu");
    if (icon) {
      icon.classList.toggle("fa-bars");
      icon.classList.toggle("fa-xmark");
    }
  }
}
