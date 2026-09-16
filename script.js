/**
 * FRONTEND CONTROLLER - PORTAL MONITORING & PRESENSI AGREGAT
 * Pure ES6 Architecture, Chart.js Visualizations, and Dynamic Modals
 */

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx6k1B4aoY4S9NAd3VSCPsWYNAqAe5wimrzAiEDRdIZKkZqChoAQXP-MM_rPNXS1wee/exec";

const KATEGORI_USIA = ["Caberawit", "Pra Remaja", "REMAJA", "Bapak-bapak", "Ibu-ibu"];

let appData = {
  users: [],
  kegiatan: [],
  master_kelompok: [],
  jamaah: [],
  presensi: [],
  penyapaan: []
};

let currentAdmin = null;
let currentSapaanFilter = "ALL";
let chartInstances = {};

if (typeof ChartDataLabels !== 'undefined') {
  Chart.register(ChartDataLabels);
}

document.addEventListener("DOMContentLoaded", () => {
  const savedAdmin = sessionStorage.getItem("currentAdmin");
  if (savedAdmin) {
    try {
      currentAdmin = JSON.parse(savedAdmin);
    } catch (e) {
      currentAdmin = null;
    }
  }

  loadAllData();
  updateAdminUI();
  switchTab("beranda");
});

// ==========================================
// DATA FETCHING & SYNCHRONIZATION
// ==========================================

async function loadAllData() {
  showMessage("Menghubungkan ke Google Apps Script...", "info");
  try {
    const res = await fetch(`${SCRIPT_URL}?action=get_all_data`);
    const json = await res.json();
    if (json.success) {
      appData = {
        users: Array.isArray(json.users) ? json.users : [],
        kegiatan: Array.isArray(json.kegiatan) ? json.kegiatan : [],
        master_kelompok: Array.isArray(json.master_kelompok) ? json.master_kelompok : [],
        jamaah: Array.isArray(json.jamaah) ? json.jamaah : [],
        presensi: Array.isArray(json.presensi) ? json.presensi : [],
        penyapaan: Array.isArray(json.penyapaan) ? json.penyapaan : []
      };

      setupDropdowns();
      renderAllViews();
      hideMessage();
    } else {
      showMessage("Gagal memuat data: " + (json.error || json.message), "error");
    }
  } catch (err) {
    showMessage("Gagal terhubung ke Google Sheets API.", "error");
  }
}

function renderAllViews() {
  renderBeranda();
  renderJamaahTable();
  renderMonitoringMatrix();
  renderPenyapaanModule();
  renderPresensiFormUI();
  renderCharts();
}

function setupDropdowns() {
  const desaSet = [...new Set(appData.master_kelompok.map(k => k.Nama_Desa))];

  // Dropdown filter jamaah
  const filterJamaah = document.getElementById("filter-jamaah-kelompok");
  if (filterJamaah) {
    filterJamaah.innerHTML = '<option value="ALL">Semua Kelompok</option>' +
      appData.master_kelompok.map(k => `<option value="${k.ID_Kelompok}">${k.Nama_Desa} - ${k.Nama_Kelompok}</option>`).join("");
  }

  // Dropdown form modal jamaah
  const formJmpKel = document.getElementById("form-jamaah-kelompok");
  if (formJmpKel) {
    formJmpKel.innerHTML = appData.master_kelompok.map(k => `<option value="${k.ID_Kelompok}">${k.Nama_Desa} - ${k.Nama_Kelompok}</option>`).join("");
  }

  // Dropdown monitoring status kegiatan
  const monKeg = document.getElementById("filter-monitoring-kegiatan");
  const aktifKegiatan = appData.kegiatan.filter(k => String(k.Status).toLowerCase() === "aktif");
  if (monKeg) {
    monKeg.innerHTML = aktifKegiatan.map(k => `<option value="${k.ID_Kegiatan}">${k.Nama_Kegiatan}</option>`).join("");
  }

  // Dropdown form input presensi
  const inputPresKeg = document.getElementById("presensi-input-kegiatan");
  if (inputPresKeg) {
    inputPresKeg.innerHTML = aktifKegiatan.map(k => `<option value="${k.ID_Kegiatan}">${k.Nama_Kegiatan}</option>`).join("");
  }

  // Dropdown input sapaan
  const sapaanDesa = document.getElementById("sapaan-form-desa");
  if (sapaanDesa) {
    sapaanDesa.innerHTML = '<option value="">Pilih Desa...</option>' +
      desaSet.map(d => `<option value="${d}">${d}</option>`).join("");
  }
}

function syncKelompokSapaanForm(desa) {
  const selectKel = document.getElementById("sapaan-form-kelompok");
  if (!selectKel) return;
  const filtered = appData.master_kelompok.filter(k => k.Nama_Desa === desa);
  selectKel.innerHTML = filtered.map(k => `<option value="${k.ID_Kelompok}">${k.Nama_Kelompok}</option>`).join("");
}

// ==========================================
// TAB NAVIGATION & RBAC UI
// ==========================================

function switchTab(tabName) {
  document.querySelectorAll(".view-section").forEach(s => s.classList.add("hidden"));
  document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));

  const targetView = document.getElementById(`view-${tabName}`);
  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetView) targetView.classList.remove("hidden");
  if (targetTab) targetTab.classList.add("active");

  if (tabName === "rekapitulasi") renderCharts();
  if (tabName === "status") renderMonitoringMatrix();

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

function updateAdminUI() {
  const adminElements = document.querySelectorAll(".admin-only");
  const tabAdmin = document.getElementById("tab-admin");
  const subSapaanInput = document.getElementById("sub-sapaan-input");

  if (currentAdmin) {
    adminElements.forEach(el => el.classList.remove("hidden"));
    if (document.getElementById("btn-login-modal")) document.getElementById("btn-login-modal").classList.add("hidden");
    if (document.getElementById("btn-logout")) document.getElementById("btn-logout").classList.remove("hidden");
    if (document.getElementById("admin-badge")) document.getElementById("admin-badge").classList.remove("hidden");
    if (document.getElementById("admin-name-display")) document.getElementById("admin-name-display").innerText = currentAdmin.nama;

    if (currentAdmin.role === "Super Admin") {
      if (tabAdmin) tabAdmin.classList.remove("hidden");
      if (subSapaanInput) subSapaanInput.classList.remove("hidden");
    } else {
      if (tabAdmin) tabAdmin.classList.add("hidden");
      if (subSapaanInput) subSapaanInput.classList.add("hidden");
    }
  } else {
    adminElements.forEach(el => el.classList.add("hidden"));
    if (document.getElementById("btn-login-modal")) document.getElementById("btn-login-modal").classList.remove("hidden");
    if (document.getElementById("btn-logout")) document.getElementById("btn-logout").classList.add("hidden");
    if (document.getElementById("admin-badge")) document.getElementById("admin-badge").classList.add("hidden");
    if (tabAdmin) tabAdmin.classList.add("hidden");
    if (subSapaanInput) subSapaanInput.classList.add("hidden");
  }

  renderPresensiFormUI();
}

// ==========================================
// VIEW RENDERING LOGIC
// ==========================================

function renderBeranda() {
  const aktifKeg = appData.kegiatan.filter(k => String(k.Status).toLowerCase() === "aktif");
  document.getElementById("dash-stat-kegiatan").innerText = aktifKeg.length;
  document.getElementById("dash-stat-sapaan").innerText = appData.penyapaan.length;
  document.getElementById("badge-sapaan-total").innerText = `${appData.penyapaan.length} Sapaan`;

  const container = document.getElementById("beranda-kegiatan-container");
  if (!container) return;

  if (aktifKeg.length === 0) {
    container.innerHTML = `<div class="col-span-full py-6 text-center text-slate-400 italic text-xs">Tidak ada kegiatan yang aktif saat ini.</div>`;
    return;
  }

  container.innerHTML = aktifKeg.map(k => `
    <div class="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
      <div class="flex justify-between items-center text-xs font-bold text-slate-500">
        <span class="text-emerald-700"><i class="fa-solid fa-calendar-day mr-1"></i> ${String(k.Tanggal_Mulai).slice(0, 10)}</span>
        <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">Aktif</span>
      </div>
      <h4 class="font-bold text-slate-800 text-sm">${k.Nama_Kegiatan}</h4>
      <p class="text-[11px] text-slate-500">Target Usia: <span class="font-semibold text-slate-700">${k.Target_Usia}</span></p>
    </div>
  `).join("");
}

function renderJamaahTable() {
  const tbody = document.getElementById("table-jamaah-body");
  if (!tbody) return;

  const filterK = document.getElementById("filter-jamaah-kelompok") ? document.getElementById("filter-jamaah-kelompok").value : "ALL";
  let list = appData.jamaah;
  if (filterK && filterK !== "ALL") {
    list = list.filter(j => String(j.ID_Kelompok) === String(filterK));
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-6 text-center text-slate-400 italic">Tidak ada data jamaah pada filter ini.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(j => `
    <tr class="bg-white border-b hover:bg-slate-50">
      <td class="px-4 py-3 font-semibold text-slate-800">${j.Nama_Lengkap}</td>
      <td class="px-4 py-3 text-slate-500">${String(j.Tanggal_Lahir).slice(0, 10)} (${j.Usia || '-'} Thn)</td>
      <td class="px-4 py-3">${j.Gender || '-'}</td>
      <td class="px-4 py-3"><span class="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px]">${j.Kelas_Usia}</span></td>
      <td class="px-4 py-3 text-slate-700">${j.Nama_Kelompok || '-'}</td>
      <td class="px-4 py-3">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${String(j.Keaktifan).toLowerCase() === 'aktif' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
          ${j.Keaktifan || 'Aktif'}
        </span>
      </td>
      <td class="px-4 py-3 text-center admin-only ${currentAdmin ? '' : 'hidden'} space-x-1">
        <button onclick="editJamaah('${j.ID_Jamaah}')" class="text-amber-600 hover:text-amber-800 p-1"><i class="fa-solid fa-pen-to-square"></i></button>
        <button onclick="deleteRow('Master_Jamaah', '${j.ID_Jamaah}')" class="text-rose-600 hover:text-rose-800 p-1"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join("");
}

function renderMonitoringMatrix() {
  const kegSelect = document.getElementById("filter-monitoring-kegiatan");
  if (!kegSelect || !kegSelect.value) return;

  const targetKegiatanId = kegSelect.value;
  const reportedSet = new Set(
    appData.presensi.filter(p => String(p.ID_Kegiatan) === String(targetKegiatanId)).map(p => String(p.ID_Kelompok))
  );

  const container = document.getElementById("monitoring-matrix-grid");
  if (!container) return;

  const selectedDesa = document.getElementById("filter-monitoring-desa").value;
  let targetKelompok = appData.master_kelompok;
  if (selectedDesa !== "ALL") {
    targetKelompok = targetKelompok.filter(k => k.Nama_Desa === selectedDesa);
  }

  if (currentAdmin && currentAdmin.role === "Admin Desa") {
    targetKelompok = targetKelompok.filter(k => k.Nama_Desa === currentAdmin.scopeDesa);
  }

  container.innerHTML = targetKelompok.map(k => {
    const isReported = reportedSet.has(String(k.ID_Kelompok));
    return `
      <div class="p-3 rounded-xl border ${
        isReported ? "bg-emerald-50 border-emerald-300 text-emerald-900" : "bg-rose-50 border-rose-300 text-rose-900"
      } flex flex-col justify-between h-24 shadow-xs transition-all">
        <div>
          <span class="text-[9px] uppercase font-bold tracking-wider opacity-70">${k.Nama_Desa}</span>
          <div class="text-xs font-bold leading-tight mt-0.5 truncate" title="${k.Nama_Kelompok}">${k.Nama_Kelompok}</div>
        </div>
        <div class="flex items-center gap-1.5 mt-2">
          <span class="w-2.5 h-2.5 rounded-full ${isReported ? "bg-emerald-500" : "bg-rose-500"}"></span>
          <span class="text-[10px] font-bold">${isReported ? "Sudah Lapor" : "Belum Lapor"}</span>
        </div>
      </div>
    `;
  }).join("");
}

function filterMonitoringDisplay() {
  renderMonitoringMatrix();
}

// ==========================================
// MODUL PENYAPAAN DAERAH
// ==========================================

function switchSubSapaan(tab) {
  document.getElementById("tab-sapaan-pemetaan").classList.add("hidden");
  document.getElementById("tab-sapaan-riwayat").classList.add("hidden");
  document.getElementById("tab-sapaan-input").classList.add("hidden");

  document.querySelectorAll("#view-penyapaan .subnav-btn").forEach(b => b.classList.remove("active"));

  if (tab === "pemetaan") {
    document.getElementById("tab-sapaan-pemetaan").classList.remove("hidden");
    document.getElementById("sub-sapaan-pemetaan").classList.add("active");
  } else if (tab === "riwayat") {
    document.getElementById("tab-sapaan-riwayat").classList.remove("hidden");
    document.getElementById("sub-sapaan-riwayat").classList.add("active");
  } else if (tab === "input") {
    document.getElementById("tab-sapaan-input").classList.remove("hidden");
    document.getElementById("sub-sapaan-input").classList.add("active");
  }
}

function renderPenyapaanModule() {
  const freqMap = {};
  const lastDateMap = {};

  appData.penyapaan.forEach(s => {
    const kId = String(s.ID_Kelompok);
    freqMap[kId] = (freqMap[kId] || 0) + 1;
    const curDate = new Date(s.Tanggal);
    if (!lastDateMap[kId] || curDate > new Date(lastDateMap[kId])) {
      lastDateMap[kId] = s.Tanggal;
    }
  });

  const kelompokMapping = appData.master_kelompok.map(k => {
    const kId = String(k.ID_Kelompok);
    const count = freqMap[kId] || 0;
    return {
      id_kelompok: kId,
      nama_desa: k.Nama_Desa,
      nama_kelompok: k.Nama_Kelompok,
      frekuensi: count,
      status_sapa: count > 0 ? "Sudah Disapa" : "Belum Disapa",
      tanggal_terakhir: lastDateMap[kId] ? String(lastDateMap[kId]).slice(0, 10) : "-"
    };
  });

  // 1. Rekomendasi 1 terendah per desa
  const desaGroups = {};
  kelompokMapping.forEach(k => {
    if (!desaGroups[k.nama_desa]) desaGroups[k.nama_desa] = [];
    desaGroups[k.nama_desa].push(k);
  });

  const rekomendasi = [];
  Object.keys(desaGroups).forEach(d => {
    desaGroups[d].sort((a, b) => a.frekuensi - b.frekuensi);
    if (desaGroups[d].length > 0) rekomendasi.push(desaGroups[d][0]);
  });

  const rekomBox = document.getElementById("rekomendasi-cards-container");
  if (rekomBox) {
    rekomBox.innerHTML = rekomendasi.map(r => `
      <div class="bg-white p-3 rounded-xl border border-amber-300 shadow-xs flex flex-col justify-between">
        <div>
          <span class="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">${r.nama_desa}</span>
          <div class="text-xs font-bold text-slate-800 mt-1.5 truncate">${r.nama_kelompok}</div>
        </div>
        <div class="text-[11px] text-slate-500 mt-2 flex justify-between items-center">
          <span>Kunjungan:</span>
          <span class="font-bold text-rose-600">${r.frekuensi} Kali</span>
        </div>
      </div>
    `).join("");
  }

  // 2. Peta Wilayah 4 Kontainer Desa
  renderPetaDesaSapaan(desaGroups);

  // 3. Tabel Riwayat
  renderRiwayatSapaanTable(appData.penyapaan);
}

function filterSapaanDisplay(type) {
  currentSapaanFilter = type;
  document.querySelectorAll(".filter-sapaan-btn").forEach(b => b.classList.remove("active"));
  event.target.classList.add("active");
  renderPenyapaanModule();
}

function renderPetaDesaSapaan(desaGroups) {
  const container = document.getElementById("sapaan-desa-grid-container");
  if (!container) return;

  container.innerHTML = Object.keys(desaGroups).map(desa => {
    let list = desaGroups[desa];
    if (currentSapaanFilter === "SUDAH") list = list.filter(k => k.frekuensi > 0);
    if (currentSapaanFilter === "BELUM") list = list.filter(k => k.frekuensi === 0);

    return `
      <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div class="flex justify-between items-center border-b pb-2">
          <h4 class="text-xs sm:text-sm font-bold text-slate-800">${desa}</h4>
          <span class="text-xs text-slate-400 font-semibold">${list.length} Kelompok</span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          ${list.map(k => `
            <div class="p-2 rounded-xl border ${
              k.frekuensi > 0 ? "bg-emerald-50/70 border-emerald-200 text-emerald-950" : "bg-slate-50 border-slate-200 text-slate-700"
            } flex flex-col justify-between h-20">
              <div class="text-[11px] font-semibold truncate" title="${k.nama_kelompok}">${k.nama_kelompok}</div>
              <div class="text-[10px] ${k.frekuensi > 0 ? "text-emerald-700 font-bold" : "text-slate-400"} flex justify-between">
                <span>${k.frekuensi > 0 ? `${k.frekuensi}x Disapa` : "Belum Ada"}</span>
                <span>${k.tanggal_terakhir}</span>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");
}

function renderRiwayatSapaanTable(list) {
  const tbody = document.getElementById("table-sapaan-body");
  if (!tbody) return;

  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400 italic">Belum ada rekam jejak penyapaan.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(r => `
    <tr class="hover:bg-slate-50">
      <td class="p-3 text-slate-500 whitespace-nowrap">${String(r.Tanggal).slice(0, 10)}</td>
      <td class="p-3 font-semibold text-slate-800 whitespace-nowrap">${r.Nama_Desa} - ${r.Nama_Kelompok}</td>
      <td class="p-3"><span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[11px] font-semibold">${r.Jenis_Kegiatan_Sapaan}</span></td>
      <td class="p-3 text-slate-600">${r.Nama_Petugas}</td>
      <td class="p-3 text-slate-500 max-w-xs truncate" title="${r.Catatan_Hasil_Solusi}">${r.Catatan_Hasil_Solusi}</td>
    </tr>
  `).join("");
}

function filterRiwayatSapaanTable() {
  const q = document.getElementById("search-sapaan-input").value.toLowerCase();
  const filtered = appData.penyapaan.filter(r =>
    String(r.Nama_Kelompok).toLowerCase().includes(q) ||
    String(r.Nama_Desa).toLowerCase().includes(q) ||
    String(r.Nama_Petugas).toLowerCase().includes(q) ||
    String(r.Jenis_Kegiatan_Sapaan).toLowerCase().includes(q)
  );
  renderRiwayatSapaanTable(filtered);
}

// ==========================================
// FORM INPUT PRESENSI AGREGAT
// ==========================================

function renderPresensiFormUI() {
  const warn = document.getElementById("presensi-auth-warning");
  const formBox = document.getElementById("presensi-form-box");

  if (!currentAdmin || currentAdmin.role !== "Admin Kelompok") {
    if (warn) warn.classList.remove("hidden");
    if (formBox) formBox.classList.add("hidden");
    return;
  }

  if (warn) warn.classList.add("hidden");
  if (formBox) formBox.classList.remove("hidden");

  const lockedInput = document.getElementById("presensi-input-kelompok-locked");
  const kData = appData.master_kelompok.find(k => String(k.ID_Kelompok) === String(currentAdmin.scopeKelompok));
  if (lockedInput) {
    lockedInput.value = kData ? `${kData.Nama_Desa} - ${kData.Nama_Kelompok}` : currentAdmin.scopeKelompok;
  }

  const rowsContainer = document.getElementById("presensi-agregat-rows");
  if (!rowsContainer) return;

  rowsContainer.innerHTML = KATEGORI_USIA.map(kat => {
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
        <td class="py-2 px-1"><input type="number" min="0" value="0" class="input-hadir w-14 sm:w-16 text-center border rounded-lg p-1.5 mx-auto block"></td>
        <td class="py-2 px-1"><input type="number" min="0" value="0" class="input-izin w-14 sm:w-16 text-center border rounded-lg p-1.5 mx-auto block"></td>
        <td class="py-2 px-1"><input type="number" min="0" value="0" class="input-sakit w-14 sm:w-16 text-center border rounded-lg p-1.5 mx-auto block"></td>
        <td class="py-2 px-1"><input type="number" min="0" value="0" class="input-alpa w-14 sm:w-16 text-center border rounded-lg p-1.5 mx-auto block"></td>
        <td class="py-2 px-1 text-center text-slate-500 font-bold target-val">${target}</td>
      </tr>
    `;
  }).join("");
}

async function handleSubmitPresensiAgregat(e) {
  e.preventDefault();
  if (!currentAdmin || currentAdmin.role !== "Admin Kelompok") {
    return alert("Akses Admin Kelompok diperlukan!");
  }

  const btn = document.getElementById("btn-submit-presensi");
  toggleBtnLoading(btn, true);

  const records = [];
  document.querySelectorAll("#presensi-agregat-rows tr").forEach(row => {
    records.push({
      kategoriUsia: row.dataset.kategori,
      hadir: row.querySelector(".input-hadir").value,
      izin: row.querySelector(".input-izin").value,
      sakit: row.querySelector(".input-sakit").value,
      alpa: row.querySelector(".input-alpa").value,
      totalTarget: row.querySelector(".target-val").innerText
    });
  });

  const payload = {
    action: "save_presensi_batch",
    idKegiatan: document.getElementById("presensi-input-kegiatan").value,
    idKelompok: currentAdmin.scopeKelompok,
    inputBy: currentAdmin.nama,
    records: records
  };

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      showMessage(json.message, "success");
      await loadAllData();
    } else {
      showMessage("Gagal: " + json.error, "error");
    }
  } catch (err) {
    showMessage("Koneksi gagal saat menyimpan presensi.", "error");
  } finally {
    toggleBtnLoading(btn, false, "Kirim Rekapitulasi Presensi");
  }
}

// ==========================================
// STATISTIK GRAFIK (CHART.JS)
// ==========================================

function renderCharts() {
  const container = document.getElementById("charts-wrapper");
  if (!container) return;

  Object.values(chartInstances).forEach(c => c && typeof c.destroy === 'function' && c.destroy());
  chartInstances = {};

  const filterDesa = document.getElementById("chart-filter-desa") ? document.getElementById("chart-filter-desa").value : "ALL";

  container.innerHTML = KATEGORI_USIA.map((kat, idx) => `
    <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
      <div class="flex items-center justify-between border-b pb-2">
        <h4 class="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> ${kat}
        </h4>
        <span class="text-[11px] font-semibold text-slate-500">${filterDesa === 'ALL' ? 'Semua Desa' : filterDesa}</span>
      </div>
      <div class="relative h-56 sm:h-64">
        <canvas id="chart-canvas-${idx}"></canvas>
      </div>
    </div>
  `).join("");

  KATEGORI_USIA.forEach((kat, idx) => {
    buildSingleChart(`chart-canvas-${idx}`, kat, filterDesa);
  });
}

function buildSingleChart(canvasId, kategori, filterDesa) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  let filteredPresensi = appData.presensi.filter(p => String(p.Kategori_Usia) === String(kategori));
  if (filterDesa !== "ALL") {
    const validKelompokIds = new Set(
      appData.master_kelompok.filter(k => k.Nama_Desa === filterDesa).map(k => String(k.ID_Kelompok))
    );
    filteredPresensi = filteredPresensi.filter(p => validKelompokIds.has(String(p.ID_Kelompok)));
  }

  // Akumulasi per kegiatan
  const activityMap = {};
  filteredPresensi.forEach(p => {
    const kegId = p.ID_Kegiatan;
    if (!activityMap[kegId]) {
      activityMap[kegId] = { hadir: 0, target: 0 };
    }
    activityMap[kegId].hadir += Number(p.Hadir || 0);
    activityMap[kegId].target += Number(p.Total_Target || 0);
  });

  const labels = [];
  const percentages = [];

  Object.keys(activityMap).forEach(kegId => {
    const kegObj = appData.kegiatan.find(k => String(k.ID_Kegiatan) === String(kegId));
    labels.push(kegObj ? kegObj.Nama_Kegiatan : kegId);
    const data = activityMap[kegId];
    const pct = data.target > 0 ? Number(((data.hadir / data.target) * 100).toFixed(1)) : 0;
    percentages.push(pct);
  });

  chartInstances[canvasId] = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: labels.length > 0 ? labels : ["Belum Ada Data"],
      datasets: [{
        label: "Kehadiran (%)",
        data: percentages.length > 0 ? percentages : [0],
        backgroundColor: "rgba(16, 185, 129, 0.8)",
        borderColor: "#059669",
        borderWidth: 1.5,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { callback: v => v + "%", font: { size: 10 } }
        },
        x: { ticks: { font: { size: 10 } } }
      },
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: "end",
          align: "top",
          formatter: v => v > 0 ? v + "%" : "",
          font: { weight: "bold", size: 10 },
          color: "#065f46"
        }
      }
    }
  });
}

// ==========================================
// CETAK LEMBAR KERJA FORMAT LANSKAP
// ==========================================

function downloadLembarKerja() {
  const printWindow = window.open('', '_blank');
  const targetKegiatan = appData.kegiatan.find(k => String(k.Status).toLowerCase() === "aktif") || { Nama_Kegiatan: "Kegiatan Rutin" };

  let rowsHtml = appData.master_kelompok.map((k, idx) => `
    <tr>
      <td style="text-align:center;">${idx + 1}</td>
      <td style="text-align:left;font-weight:bold;">${k.Nama_Kelompok}</td>
      <td>${k.Nama_Desa}</td>
      <td>${k.Target_Caberawit}</td>
      <td>${k.Target_Pra_Remaja}</td>
      <td>${k.Target_REMAJA}</td>
      <td>${k.Target_Bapak}</td>
      <td>${k.Target_Ibu}</td>
      <td></td>
    </tr>
  `).join("");

  const html = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>Lembar Kerja Presensi Agregat - 44 Kelompok</title>
      <style>
        @page { size: landscape; margin: 10mm; }
        body { font-family: Arial, sans-serif; font-size: 10px; color: #1e293b; margin: 10px; }
        .header { border-bottom: 2px solid #0f766e; padding-bottom: 6px; margin-bottom: 12px; }
        h1 { margin: 0; font-size: 16px; color: #0f766e; text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; }
        th { background-color: #f1f5f9; font-weight: bold; text-transform: uppercase; }
        @media print { button { display: none; } }
      </style>
    </head>
    <body>
      <button onclick="window.print()" style="background:#0f766e;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-weight:bold;margin-bottom:10px;">
        🖨️ Cetak / Simpan PDF
      </button>
      <div class="header">
        <h1>Lembar Rekapitulasi Presensi Agregat Wilayah</h1>
        <p>Sesi Kegiatan: <b>${targetKegiatan.Nama_Kegiatan}</b> | Dicetak: ${new Date().toLocaleDateString('id-ID')}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th rowspan="2" style="width:4%;">No</th>
            <th rowspan="2" style="width:20%;">Nama Kelompok</th>
            <th rowspan="2" style="width:12%;">Desa</th>
            <th colspan="5">Target Alokasi Kuota Kehadiran</th>
            <th rowspan="2" style="width:16%;">Tanda Tangan Pembina</th>
          </tr>
          <tr>
            <th>Caberawit</th>
            <th>Pra Remaja</th>
            <th>REMAJA</th>
            <th>Bapak</th>
            <th>Ibu</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

// ==========================================
// SUBMIT AKSI POST & MODAL HANDLERS
// ==========================================

async function handleLoginSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById("btn-submit-login");
  toggleBtnLoading(btn, true);

  const payload = {
    action: "login",
    username: document.getElementById("login-username").value,
    password: document.getElementById("login-password").value
  };

  try {
    const res = await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify(payload) });
    const json = await res.json();
    if (json.success) {
      currentAdmin = json.user;
      sessionStorage.setItem("currentAdmin", JSON.stringify(currentAdmin));
      updateAdminUI();
      closeModal("modal-login");
      showMessage(`Selamat datang, ${currentAdmin.nama}!`, "success");
    } else {
      showMessage(json.message, "error");
    }
  } catch (err) {
    showMessage("Gagal verifikasi login.", "error");
  } finally {
    toggleBtnLoading(btn, false, "Masuk");
  }
}

function logoutAdmin() {
  currentAdmin = null;
  sessionStorage.removeItem("currentAdmin");
  updateAdminUI();
  showMessage("Anda telah logout dari sesi.", "info");
  switchTab("beranda");
}

async function handleSubmitSapaan(e) {
  e.preventDefault();
  const btn = document.getElementById("btn-submit-sapaan");
  toggleBtnLoading(btn, true);

  const kelSel = document.getElementById("sapaan-form-kelompok");
  const payload = {
    action: "add_penyapaan",
    tanggal: document.getElementById("sapaan-form-tanggal").value,
    idKelompok: kelSel.value,
    namaKelompok: kelSel.options[kelSel.selectedIndex].text,
    namaDesa: document.getElementById("sapaan-form-desa").value,
    namaPetugas: document.getElementById("sapaan-form-petugas").value,
    jenisKegiatan: document.getElementById("sapaan-form-agenda").value,
    catatan: document.getElementById("sapaan-form-catatan").value
  };

  try {
    const res = await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify(payload) });
    const json = await res.json();
    if (json.success) {
      showMessage(json.message, "success");
      await loadAllData();
      switchSubSapaan("pemetaan");
    } else {
      showMessage("Gagal: " + json.error, "error");
    }
  } catch (err) {
    showMessage("Gagal menyimpan log penyapaan.", "error");
  } finally {
    toggleBtnLoading(btn, false, "Simpan Laporan Penyapaan");
  }
}

async function handleCreateKegiatan(e) {
  e.preventDefault();
  const payload = {
    action: "save_kegiatan",
    namaKegiatan: document.getElementById("admin-kegiatan-nama").value,
    tanggalMulai: document.getElementById("admin-kegiatan-mulai").value,
    tanggalSelesai: document.getElementById("admin-kegiatan-selesai").value,
    targetUsia: document.getElementById("admin-kegiatan-target").value
  };

  try {
    const res = await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify(payload) });
    const json = await res.json();
    if (json.success) {
      showMessage(json.message, "success");
      loadAllData();
    }
  } catch (err) {
    showMessage("Gagal membuat kegiatan.", "error");
  }
}

async function handleCreateUser(e) {
  e.preventDefault();
  const payload = {
    action: "save_user",
    nama: document.getElementById("admin-user-nama").value,
    username: document.getElementById("admin-user-username").value,
    password: document.getElementById("admin-user-password").value,
    role: document.getElementById("admin-user-role").value,
    scopeDesa: document.getElementById("admin-user-scope-desa").value,
    scopeKelompok: document.getElementById("admin-user-scope-kelompok").value
  };

  try {
    const res = await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify(payload) });
    const json = await res.json();
    if (json.success) {
      showMessage(json.message, "success");
    }
  } catch (err) {
    showMessage("Gagal membuat akun admin.", "error");
  }
}

function adjustScopeAdminInputs(role) {
  const d = document.getElementById("admin-user-scope-desa");
  const k = document.getElementById("admin-user-scope-kelompok");
  if (role === "Super Admin") {
    d.value = "ALL"; k.value = "ALL";
    d.disabled = true; k.disabled = true;
  } else if (role === "Admin Desa") {
    d.disabled = false; k.value = "ALL"; k.disabled = true;
  } else {
    d.disabled = false; k.disabled = false;
  }
}

function openFormJamaahModal() {
  document.getElementById("form-jamaah-id").value = "";
  document.getElementById("form-jamaah-nama").value = "";
  document.getElementById("form-jamaah-tgl").value = "";
  document.getElementById("form-jamaah-usia").value = "";
  openModal("modal-jamaah");
}

function editJamaah(id) {
  const item = appData.jamaah.find(j => String(j.ID_Jamaah) === String(id));
  if (!item) return;

  document.getElementById("form-jamaah-id").value = item.ID_Jamaah;
  document.getElementById("form-jamaah-nama").value = item.Nama_Lengkap;
  document.getElementById("form-jamaah-tgl").value = String(item.Tanggal_Lahir).slice(0, 10);
  document.getElementById("form-jamaah-usia").value = item.Usia || "";
  document.getElementById("form-jamaah-gender").value = item.Gender || "Laki-laki";
  document.getElementById("form-jamaah-kategori").value = item.Kelas_Usia || "REMAJA";
  document.getElementById("form-jamaah-kelompok").value = item.ID_Kelompok;

  openModal("modal-jamaah");
}

function calcFormJamaahUsia() {
  const val = document.getElementById("form-jamaah-tgl").value;
  if (!val) return;
  const d = new Date(val);
  const age = Math.floor((Date.now() - d.getTime()) / (365.25 * 86400000));
  document.getElementById("form-jamaah-usia").value = isNaN(age) ? 0 : age;
}

async function handleSaveJamaahSubmit(e) {
  e.preventDefault();
  const kelSel = document.getElementById("form-jamaah-kelompok");
  const payload = {
    action: "save_jamaah",
    data: {
      ID: document.getElementById("form-jamaah-id").value,
      Nama_Lengkap: document.getElementById("form-jamaah-nama").value,
      Tanggal_Lahir: document.getElementById("form-jamaah-tgl").value,
      Usia: document.getElementById("form-jamaah-usia").value,
      Gender: document.getElementById("form-jamaah-gender").value,
      Kelas_Usia: document.getElementById("form-jamaah-kategori").value,
      ID_Kelompok: kelSel.value,
      Nama_Kelompok: kelSel.options[kelSel.selectedIndex].text,
      Keaktifan: "Aktif"
    }
  };

  try {
    const res = await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify(payload) });
    const json = await res.json();
    if (json.success) {
      showMessage(json.message, "success");
      closeModal("modal-jamaah");
      loadAllData();
    }
  } catch (err) {
    showMessage("Gagal menyimpan data jamaah.", "error");
  }
}

async function deleteRow(sheetName, id) {
  if (!confirm("Hapus baris data ini dari database?")) return;
  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "delete_row", sheetName: sheetName, id: id })
    });
    const json = await res.json();
    if (json.success) {
      showMessage(json.message, "success");
      loadAllData();
    }
  } catch (err) {
    showMessage("Gagal menghapus data.", "error");
  }
}

// ==========================================
// MODAL & UI UTILITY
// ==========================================

function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove("hidden");
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add("hidden");
}

function openLoginModal() {
  openModal("modal-login");
}

function toggleMobileMenu() {
  const c = document.getElementById("nav-menu-container");
  const ic = document.getElementById("hamburger-icon");
  if (!c) return;
  c.classList.toggle("show-mobile-menu");
  if (ic) {
    if (c.classList.contains("show-mobile-menu")) {
      ic.classList.remove("fa-bars"); ic.classList.add("fa-xmark");
    } else {
      ic.classList.remove("fa-xmark"); ic.classList.add("fa-bars");
    }
  }
}

function showMessage(msg, type) {
  const el = document.getElementById("status-message");
  if (!el) return;
  el.innerText = msg;
  el.classList.remove("hidden", "bg-emerald-100", "text-emerald-800", "bg-rose-100", "text-rose-800", "bg-amber-100", "text-amber-800");

  if (type === "success") el.classList.add("bg-emerald-100", "text-emerald-800");
  else if (type === "error") el.classList.add("bg-rose-100", "text-rose-800");
  else el.classList.add("bg-amber-100", "text-amber-800");
}

function hideMessage() {
  const el = document.getElementById("status-message");
  if (el) el.classList.add("hidden");
}

function toggleBtnLoading(btn, isLoading, defaultText = "") {
  if (!btn) return;
  if (isLoading) {
    btn.disabled = true;
    btn.dataset.oldHtml = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span>';
  } else {
    btn.disabled = false;
    btn.innerHTML = defaultText ? `<span>${defaultText}</span>` : btn.dataset.oldHtml;
  }
}
