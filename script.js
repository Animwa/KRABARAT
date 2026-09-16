/**
 * FRONTEND SINGLE PAGE APPLICATION (SPA) ENGINE
 * Terintegrasi dengan Google Apps Script Backend (Code.gs)
 */

// Ganti nilai SCRIPT_URL di bawah ini jika telah mendistribusikan Apps Script baru
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx6k1B4aoY4S9NAd3VSCPsWYNAqAe5wimrzAiEDRdIZKkZqChoAQXP-MM_rPNXS1wee/exec";

// Global Application State
let appData = {
  users: [],
  kegiatan: [],
  master_kelompok: [],
  jamaah: [],
  presensi: [],
  penyapaan: []
};

let currentUser = null;
let analyticsData = null;
let currentPetaFilter = "all";

// Konfigurasi Kategori Usia (Pra Remaja & Remaja)
const USIA_CATEGORIES = [
  { key: "Caberawit", label: "Caberawit (SD)", field: "Target_Caberawit" },
  { key: "Pra Remaja", label: "Pra Remaja (SMP)", field: "Target_Pra_Remaja" },
  { key: "Remaja", label: "Remaja (SMA)", field: "Target_REMAJA" },
  { key: "Bapak-Bapak", label: "Bapak-Bapak", field: "Target_Bapak" },
  { key: "Ibu-Ibu", label: "Ibu-Ibu", field: "Target_Ibu" }
];

document.addEventListener("DOMContentLoaded", () => {
  const session = sessionStorage.getItem("activeUserSession");
  if (session) {
    try {
      currentUser = JSON.parse(session);
    } catch (e) {
      currentUser = null;
    }
  }

  loadAllSystemData();
  updateUIForRole();
  switchTab("dashboard");
});

// ==========================================
// 1. DATA FETCHING & SYNCHRONIZATION
// ==========================================

async function loadAllSystemData() {
  showToast("Memperbarui data dari cloud...", "info");
  try {
    const res = await fetch(`${SCRIPT_URL}?action=get_all_data`);
    const json = await res.json();
    if (json.success) {
      appData = {
        users: json.users || [],
        kegiatan: json.kegiatan || [],
        master_kelompok: json.master_kelompok || [],
        jamaah: json.jamaah || [],
        presensi: json.presensi || [],
        penyapaan: json.penyapaan || []
      };

      await loadPenyapaanAnalytics();
      renderAllViews();
      showToast("Data berhasil dimuat.", "success");
    } else {
      showToast("Gagal memuat data: " + (json.error || json.message), "error");
    }
  } catch (err) {
    console.error(err);
    showToast("Gagal terhubung ke Google Apps Script.", "error");
  }
}

async function loadPenyapaanAnalytics() {
  try {
    const res = await fetch(`${SCRIPT_URL}?action=get_penyapaan_analytics`);
    const json = await res.json();
    if (json.success) {
      analyticsData = json;
      const badge = document.getElementById("badge-total-sapaan");
      const grandStat = document.getElementById("stat-grand-sapaan");
      if (badge) badge.innerText = json.totalSapaan || 0;
      if (grandStat) grandStat.innerText = json.totalSapaan || 0;
    }
  } catch (e) {
    console.warn("Gagal memuat analitik penyapaan:", e);
  }
}

function renderAllViews() {
  renderDashboardMetrics();
  renderMasterTargetTable();
  populatePresensiSelectors();
  populateMatrixSelectors();
  renderStatusMatrix();
  renderPenyapaanModule();
  populateNewUserSelectors();
}

// ==========================================
// 2. NAVIGASI TABS & RESPONSIVE MENU
// ==========================================

function switchTab(tabName) {
  document.querySelectorAll(".view-section").forEach(el => el.classList.add("hidden"));
  document.querySelectorAll(".nav-tab").forEach(el => el.classList.remove("active"));

  const targetView = document.getElementById(`view-${tabName}`);
  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetView) targetView.classList.remove("hidden");
  if (targetTab) targetTab.classList.add("active");

  const menu = document.getElementById("nav-container");
  if (window.innerWidth < 768 && menu && !menu.classList.contains("hidden")) {
    menu.classList.add("hidden");
  }
}

function toggleMobileMenu() {
  const menu = document.getElementById("nav-container");
  if (menu) menu.classList.toggle("hidden");
}

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

// ==========================================
// 3. ROLE-BASED ACCESS CONTROL (RBAC)
// ==========================================

function updateUIForRole() {
  const btnOpenLogin = document.getElementById("btn-open-login");
  const userProfileBadge = document.getElementById("user-profile-badge");
  const userDisplayName = document.getElementById("user-display-name");
  const userDisplayRole = document.getElementById("user-display-role");
  const superOnlyElements = document.querySelectorAll(".admin-super-only");

  if (currentUser) {
    if (btnOpenLogin) btnOpenLogin.classList.add("hidden");
    if (userProfileBadge) userProfileBadge.classList.remove("hidden");
    if (userDisplayName) userDisplayName.innerText = currentUser.nama;
    if (userDisplayRole) userDisplayRole.innerText = `${currentUser.role} (${currentUser.scopeDesa})`;

    if (currentUser.role === "Super Admin") {
      superOnlyElements.forEach(el => el.classList.remove("hidden"));
    } else {
      superOnlyElements.forEach(el => el.classList.add("hidden"));
    }
  } else {
    if (btnOpenLogin) btnOpenLogin.classList.remove("hidden");
    if (userProfileBadge) userProfileBadge.classList.add("hidden");
    superOnlyElements.forEach(el => el.classList.add("hidden"));
  }
}

// ==========================================
// 4. METRIK DASHBOARD & MASTER DATA
// ==========================================

function renderDashboardMetrics() {
  let totalTarget = 0;
  appData.master_kelompok.forEach(k => {
    totalTarget += Number(k.Target_Caberawit || 0) +
                   Number(k.Target_Pra_Remaja || 0) +
                   Number(k.Target_REMAJA || 0) +
                   Number(k.Target_Bapak || 0) +
                   Number(k.Target_Ibu || 0);
  });

  let totalHadir = 0;
  let totalIzinSakit = 0;
  let totalAlpa = 0;

  const activeKegiatan = appData.kegiatan.find(k => String(k.Status).toLowerCase() === "aktif");
  const activeEventLabel = document.getElementById("active-event-name");

  if (activeKegiatan) {
    if (activeEventLabel) activeEventLabel.innerText = `Kegiatan Aktif: ${activeKegiatan.Nama_Kegiatan}`;
    const activeLogs = appData.presensi.filter(p => String(p.ID_Kegiatan) === String(activeKegiatan.ID_Kegiatan));
    activeLogs.forEach(l => {
      totalHadir += Number(l.Hadir || 0);
      totalIzinSakit += Number(l.Izin || 0) + Number(l.Sakit || 0);
      totalAlpa += Number(l.Alpa || 0);
    });
  } else {
    if (activeEventLabel) activeEventLabel.innerText = "Tidak ada kegiatan aktif";
  }

  document.getElementById("stat-total-target").innerText = totalTarget.toLocaleString();
  document.getElementById("stat-total-hadir").innerText = totalHadir.toLocaleString();
  document.getElementById("stat-total-izinsakit").innerText = totalIzinSakit.toLocaleString();
  document.getElementById("stat-total-alpa").innerText = totalAlpa.toLocaleString();

  const pct = totalTarget > 0 ? ((totalHadir / totalTarget) * 100).toFixed(1) : 0;
  document.getElementById("stat-pct-hadir").innerText = `${pct}% Rasio Kehadiran Target`;
}

function renderMasterTargetTable() {
  const tbody = document.getElementById("table-target-body");
  if (!tbody) return;
  const filterDesa = document.getElementById("filter-jamaah-desa").value;

  const list = appData.master_kelompok.filter(k => {
    if (filterDesa === "ALL") return true;
    return String(k.Nama_Desa).trim() === filterDesa.trim();
  });

  tbody.innerHTML = list.map(k => {
    const subtotal = Number(k.Target_Caberawit || 0) +
                     Number(k.Target_Pra_Remaja || 0) +
                     Number(k.Target_REMAJA || 0) +
                     Number(k.Target_Bapak || 0) +
                     Number(k.Target_Ibu || 0);
    return `
      <tr class="bg-white hover:bg-slate-50 border-b">
        <td class="px-3 py-2.5 font-mono text-slate-400 text-center">${k.ID_Kelompok}</td>
        <td class="px-4 py-2.5 font-semibold text-slate-700">${k.Nama_Desa}</td>
        <td class="px-4 py-2.5 font-bold text-slate-900">${k.Nama_Kelompok}</td>
        <td class="px-3 py-2.5 text-center">${k.Target_Caberawit}</td>
        <td class="px-3 py-2.5 text-center">${k.Target_Pra_Remaja}</td>
        <td class="px-3 py-2.5 text-center">${k.Target_REMAJA}</td>
        <td class="px-3 py-2.5 text-center">${k.Target_Bapak}</td>
        <td class="px-3 py-2.5 text-center">${k.Target_Ibu}</td>
        <td class="px-3 py-2.5 text-center font-extrabold text-emerald-700 bg-emerald-50/50">${subtotal}</td>
      </tr>
    `;
  }).join("");
}

// ==========================================
// 5. INPUT PRESENSI DENGAN SELECTOR PER DESA
// ==========================================

function populatePresensiSelectors() {
  const actSelect = document.getElementById("presensi-kegiatan-select");
  const desaSelect = document.getElementById("presensi-desa-select");

  if (actSelect) {
    actSelect.innerHTML = appData.kegiatan.map(k => `
      <option value="${k.ID_Kegiatan}" ${String(k.Status).toLowerCase() === 'aktif' ? 'selected' : ''}>
        ${k.Nama_Kegiatan} (${k.Status})
      </option>
    `).join("");
  }

  const desas = [...new Set(appData.master_kelompok.map(k => k.Nama_Desa))];
  if (desaSelect) {
    if (currentUser && currentUser.role === "Admin Kelompok") {
      desaSelect.innerHTML = `<option value="${currentUser.scopeDesa}">${currentUser.scopeDesa}</option>`;
      desaSelect.disabled = true;
    } else if (currentUser && currentUser.role === "Admin Desa") {
      desaSelect.innerHTML = `<option value="${currentUser.scopeDesa}">${currentUser.scopeDesa}</option>`;
      desaSelect.disabled = true;
    } else {
      desaSelect.innerHTML = desas.map(d => `<option value="${d}">${d}</option>`).join("");
      desaSelect.disabled = false;
    }
  }
  handlePresensiDesaChange();
}

function handlePresensiDesaChange() {
  const desaSelect = document.getElementById("presensi-desa-select");
  const kelSelect = document.getElementById("presensi-kelompok-select");
  if (!desaSelect || !kelSelect) return;

  const selectedDesa = desaSelect.value;
  const kelompokInDesa = appData.master_kelompok.filter(k => k.Nama_Desa === selectedDesa);

  if (currentUser && currentUser.role === "Admin Kelompok") {
    const myKel = kelompokInDesa.filter(k => String(k.ID_Kelompok) === String(currentUser.scopeKelompok));
    kelSelect.innerHTML = myKel.map(k => `<option value="${k.ID_Kelompok}">${k.Nama_Kelompok}</option>`).join("");
    kelSelect.disabled = true;
  } else {
    kelSelect.innerHTML = kelompokInDesa.map(k => `<option value="${k.ID_Kelompok}">${k.Nama_Kelompok}</option>`).join("");
    kelSelect.disabled = false;
  }
  handlePresensiKelompokChange();
}

function handlePresensiKelompokChange() {
  const kelSelect = document.getElementById("presensi-kelompok-select");
  const tbody = document.getElementById("presensi-input-tbody");
  if (!kelSelect || !tbody) return;

  const selectedId = kelSelect.value;
  const kelObj = appData.master_kelompok.find(k => String(k.ID_Kelompok) === String(selectedId));

  tbody.innerHTML = USIA_CATEGORIES.map(cat => {
    const targetVal = kelObj ? (kelObj[cat.field] || 0) : 0;
    return `
      <tr>
        <td class="px-3 py-2.5 font-bold text-slate-800">${cat.label}</td>
        <td class="px-3 py-2.5 text-center font-semibold text-slate-500">
          <input type="hidden" id="target-${cat.key}" value="${targetVal}">
          ${targetVal} Org
        </td>
        <td class="px-2 py-2 text-center">
          <input type="number" id="hadir-${cat.key}" min="0" value="0" class="w-20 border rounded px-2 py-1 text-center font-bold text-emerald-700 bg-emerald-50 focus:bg-white">
        </td>
        <td class="px-2 py-2 text-center">
          <input type="number" id="izin-${cat.key}" min="0" value="0" class="w-20 border rounded px-2 py-1 text-center font-semibold text-amber-700 bg-amber-50 focus:bg-white">
        </td>
        <td class="px-2 py-2 text-center">
          <input type="number" id="sakit-${cat.key}" min="0" value="0" class="w-20 border rounded px-2 py-1 text-center font-semibold text-sky-700 bg-sky-50 focus:bg-white">
        </td>
        <td class="px-2 py-2 text-center">
          <input type="number" id="alpa-${cat.key}" min="0" value="0" class="w-20 border rounded px-2 py-1 text-center font-semibold text-rose-700 bg-rose-50 focus:bg-white">
        </td>
      </tr>
    `;
  }).join("");
}

async function submitPresensiAgregat() {
  if (!currentUser) {
    showToast("Silakan login terlebih dahulu untuk mengisi presensi.", "error");
    openModal("modal-login");
    return;
  }

  const idKegiatan = document.getElementById("presensi-kegiatan-select").value;
  const idKelompok = document.getElementById("presensi-kelompok-select").value;
  const btn = document.getElementById("btn-submit-presensi");

  if (!idKegiatan || !idKelompok) {
    showToast("Kegiatan atau kelompok tidak valid.", "error");
    return;
  }

  const records = USIA_CATEGORIES.map(cat => ({
    kategoriUsia: cat.key,
    hadir: Number(document.getElementById(`hadir-${cat.key}`).value || 0),
    izin: Number(document.getElementById(`izin-${cat.key}`).value || 0),
    sakit: Number(document.getElementById(`sakit-${cat.key}`).value || 0),
    alpa: Number(document.getElementById(`alpa-${cat.key}`).value || 0),
    totalTarget: Number(document.getElementById(`target-${cat.key}`).value || 0)
  }));

  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...`;
  showToast("Menyimpan rekap presensi...", "info");

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "save_presensi_batch",
        idKegiatan: idKegiatan,
        idKelompok: idKelompok,
        records: records,
        inputBy: currentUser.nama
      })
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, "success");
      await loadAllSystemData();
      switchTab("status-presensi");
    } else {
      showToast("Gagal: " + json.message, "error");
    }
  } catch (err) {
    showToast("Terjadi gangguan jaringan.", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Simpan Rekap Kehadiran`;
  }
}

// ==========================================
// 6. MATRIKS STATUS PRESENSI 44 KELOMPOK
// ==========================================

function populateMatrixSelectors() {
  const filterKegiatan = document.getElementById("matrix-kegiatan-filter");
  if (filterKegiatan) {
    filterKegiatan.innerHTML = appData.kegiatan.map(k => `
      <option value="${k.ID_Kegiatan}" ${String(k.Status).toLowerCase() === 'aktif' ? 'selected' : ''}>
        ${k.Nama_Kegiatan}
      </option>
    `).join("");
  }
}

function renderStatusMatrix() {
  const grid = document.getElementById("matrix-desa-grid");
  if (!grid) return;

  const actId = document.getElementById("matrix-kegiatan-filter").value;
  const desaFilter = document.getElementById("matrix-desa-filter").value;

  const logsInAct = appData.presensi.filter(p => String(p.ID_Kegiatan) === String(actId));
  const reportedSet = new Set(logsInAct.map(l => String(l.ID_Kelompok)));

  const desas = ["Desa 1", "Desa 2", "Desa 3", "Desa 4"].filter(d => {
    if (desaFilter === "ALL") return true;
    return d === desaFilter;
  });

  grid.innerHTML = desas.map(desaName => {
    const kelompokList = appData.master_kelompok.filter(k => k.Nama_Desa === desaName);
    const countSudah = kelompokList.filter(k => reportedSet.has(String(k.ID_Kelompok))).length;

    return `
      <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div class="flex justify-between items-center border-b pb-2">
          <h3 class="font-bold text-slate-800 text-sm flex items-center gap-2">
            <i class="fa-solid fa-mosque text-emerald-700"></i> ${desaName}
          </h3>
          <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full ${countSudah === kelompokList.length ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
            ${countSudah}/${kelompokList.length} Lapor
          </span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
          ${kelompokList.map(k => {
            const isReported = reportedSet.has(String(k.ID_Kelompok));
            return `
              <div class="p-2.5 rounded-xl border text-center transition-all ${isReported ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'}">
                <p class="font-bold text-xs truncate">${k.Nama_Kelompok}</p>
                <span class="text-[10px] block mt-0.5 font-semibold">
                  ${isReported ? '<i class="fa-solid fa-circle-check"></i> Sudah' : '<i class="fa-solid fa-circle-xmark"></i> Belum'}
                </span>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }).join("");
}

// ==========================================
// 7. PENYAPAAN DAERAH
// ==========================================

function renderPenyapaanModule() {
  if (!analyticsData) return;

  const recGrid = document.getElementById("rekomendasi-grid");
  if (recGrid && analyticsData.rekomendasi) {
    recGrid.innerHTML = analyticsData.rekomendasi.map(r => `
      <div class="bg-white p-3 rounded-xl border border-amber-300 shadow-sm">
        <span class="text-[10px] font-bold uppercase text-amber-700 block">${r.nama_desa}</span>
        <p class="font-black text-slate-800 text-xs mt-0.5">${r.nama_kelompok}</p>
        <div class="flex justify-between items-center mt-2 text-[10px]">
          <span class="text-slate-500">Frekuensi: <b>${r.frekuensi}x</b></span>
          <span class="px-2 py-0.5 rounded ${r.frekuensi === 0 ? 'bg-rose-100 text-rose-700 font-bold' : 'bg-amber-100 text-amber-800'}">
            ${r.frekuensi === 0 ? 'Belum Pernah' : 'Kunjungan Minim'}
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
  if (!container || !analyticsData) return;

  const mapping = analyticsData.kelompokMapping || [];
  const desas = ["Desa 1", "Desa 2", "Desa 3", "Desa 4"];

  container.innerHTML = desas.map(desa => {
    let list = mapping.filter(k => k.nama_desa === desa);
    if (currentPetaFilter === "sudah") list = list.filter(k => k.frekuensi > 0);
    if (currentPetaFilter === "belum") list = list.filter(k => k.frekuensi === 0);

    return `
      <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div class="border-b pb-2 flex justify-between items-center">
          <h4 class="font-bold text-slate-800 text-xs uppercase">${desa}</h4>
          <span class="text-[10px] text-slate-500 font-medium">${list.length} Kelompok Ditampilkan</span>
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
  if (!tbody || !analyticsData) return;

  const search = (document.getElementById("search-riwayat").value || "").toLowerCase();
  const desaFilter = document.getElementById("filter-riwayat-desa").value;

  let list = analyticsData.riwayat || [];
  if (desaFilter !== "ALL") list = list.filter(r => r.Nama_Desa === desaFilter);
  if (search) {
    list = list.filter(r =>
      String(r.Nama_Petugas).toLowerCase().includes(search) ||
      String(r.Nama_Kelompok).toLowerCase().includes(search) ||
      String(r.Jenis_Kegiatan_Sapaan).toLowerCase().includes(search)
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400 italic">Tidak ada data penyapaan ditemukan.</td></tr>`;
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
  if (!desaSelect) return;
  const desas = ["Desa 1", "Desa 2", "Desa 3", "Desa 4"];
  desaSelect.innerHTML = desas.map(d => `<option value="${d}">${d}</option>`).join("");
  handleSapaanDesaChange();
}

function handleSapaanDesaChange() {
  const desa = document.getElementById("sapaan-desa-select").value;
  const kelSelect = document.getElementById("sapaan-kelompok-select");
  if (!kelSelect) return;
  const list = appData.master_kelompok.filter(k => k.Nama_Desa === desa);
  kelSelect.innerHTML = list.map(k => `<option value="${k.ID_Kelompok}">${k.Nama_Kelompok}</option>`).join("");
}

async function handlePenyapaanSubmit(e) {
  e.preventDefault();
  if (!currentUser || currentUser.role !== "Super Admin") {
    showToast("Hanya Super Admin yang berwenang mencatat sapaan daerah.", "error");
    return;
  }

  const kelId = document.getElementById("sapaan-kelompok-select").value;
  const kelObj = appData.master_kelompok.find(k => String(k.ID_Kelompok) === String(kelId));

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

  showToast("Menyimpan laporan penyapaan...", "info");
  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, "success");
      document.getElementById("form-penyapaan").reset();
      await loadAllSystemData();
      switchPenyapaanSubTab("status-peta");
    } else {
      showToast(json.message, "error");
    }
  } catch (err) {
    showToast("Gagal menyimpan penyapaan.", "error");
  }
}

// ==========================================
// 8. MANAJEMEN PENGGUNA & KEGIATAN
// ==========================================

function populateNewUserSelectors() {
  const desaSelect = document.getElementById("new-user-desa");
  if (!desaSelect) return;
  const desas = ["ALL", "Desa 1", "Desa 2", "Desa 3", "Desa 4"];
  desaSelect.innerHTML = desas.map(d => `<option value="${d}">${d}</option>`).join("");
  handleNewUserDesaChange();
}

function handleNewUserRoleChange() {
  const role = document.getElementById("new-user-role").value;
  const desaSelect = document.getElementById("new-user-desa");
  const kelSelect = document.getElementById("new-user-kelompok");

  if (role === "Super Admin") {
    desaSelect.value = "ALL";
    kelSelect.innerHTML = `<option value="ALL">ALL (Semua Kelompok)</option>`;
    desaSelect.disabled = true;
    kelSelect.disabled = true;
  } else {
    desaSelect.disabled = false;
    kelSelect.disabled = false;
    handleNewUserDesaChange();
  }
}

function handleNewUserDesaChange() {
  const desa = document.getElementById("new-user-desa").value;
  const kelSelect = document.getElementById("new-user-kelompok");
  if (!kelSelect) return;

  if (desa === "ALL") {
    kelSelect.innerHTML = `<option value="ALL">ALL (Semua Kelompok)</option>`;
  } else {
    const list = appData.master_kelompok.filter(k => k.Nama_Desa === desa);
    kelSelect.innerHTML = `<option value="ALL">Semua Kelompok di ${desa}</option>` +
      list.map(k => `<option value="${k.ID_Kelompok}">${k.Nama_Kelompok}</option>`).join("");
  }
}

async function handleCreateKegiatan(e) {
  e.preventDefault();
  const form = e.target;
  const payload = {
    action: "save_kegiatan",
    namaKegiatan: form.namaKegiatan.value,
    tanggalMulai: form.tanggalMulai.value,
    tanggalSelesai: form.tanggalSelesai.value,
    targetUsia: form.targetUsia.value
  };

  showToast("Membuka sesi kegiatan...", "info");
  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, "success");
      form.reset();
      await loadAllSystemData();
    } else {
      showToast(json.message, "error");
    }
  } catch (e) {
    showToast("Gagal membuka kegiatan.", "error");
  }
}

async function handleCreateUser(e) {
  e.preventDefault();
  const form = e.target;
  const payload = {
    action: "save_user",
    username: form.username.value,
    password: form.password.value,
    nama: form.nama.value,
    role: form.role.value,
    scopeDesa: form.scopeDesa.value,
    scopeKelompok: form.scopeKelompok.value
  };

  showToast("Mendaftarkan admin...", "info");
  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, "success");
      form.reset();
      await loadAllSystemData();
    } else {
      showToast(json.message, "error");
    }
  } catch (e) {
    showToast("Gagal mendaftarkan admin.", "error");
  }
}

// ==========================================
// 9. AUTENTIKASI PENGGUNA (LOGIN / LOGOUT)
// ==========================================

async function handleLoginSubmit(e) {
  e.preventDefault();
  const u = document.getElementById("login-username").value;
  const p = document.getElementById("login-password").value;
  const btn = document.getElementById("btn-submit-login");

  btn.disabled = true;
  btn.innerText = "Memverifikasi...";

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "login", username: u, password: p })
    });
    const json = await res.json();
    if (json.success) {
      currentUser = json.user;
      sessionStorage.setItem("activeUserSession", JSON.stringify(currentUser));
      updateUIForRole();
      populatePresensiSelectors();
      closeModal("modal-login");
      showToast(`Selamat datang, ${currentUser.nama}!`, "success");
    } else {
      showToast(json.message, "error");
    }
  } catch (err) {
    showToast("Koneksi login bermasalah.", "error");
  } finally {
    btn.disabled = false;
    btn.innerText = "Masuk ke Sistem";
  }
}

function handleLogout() {
  currentUser = null;
  sessionStorage.removeItem("activeUserSession");
  updateUIForRole();
  populatePresensiSelectors();
  showToast("Berhasil keluar dari akun.", "info");
  switchTab("dashboard");
}

// ==========================================
// 10. HELPER MODAL & TOAST
// ==========================================

function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove("hidden");
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add("hidden");
}

function showToast(msg, type) {
  const t = document.getElementById("toast-message");
  if (!t) return;
  t.innerText = msg;
  t.className = "fixed top-20 right-4 z-50 max-w-sm p-4 rounded-xl border shadow-xl text-xs font-semibold transition-all";
  if (type === "success") {
    t.classList.add("bg-emerald-100", "border-emerald-300", "text-emerald-800");
  } else if (type === "error") {
    t.classList.add("bg-rose-100", "border-rose-300", "text-rose-800");
  } else {
    t.classList.add("bg-sky-100", "border-sky-300", "text-sky-800");
  }
  t.classList.remove("hidden");
  setTimeout(() => {
    t.classList.add("hidden");
  }, 4000);
}
