// ==========================================
// FRONTEND LOGIC & INTEGRASI REST API KARANGANYAR BARAT
// ==========================================

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwdXlbzVlxPjo7B_OBSdCF9knc8c9ObeijHCixMBSQh6zidRUcSjsaOSTUALfm2urJY/exec";

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

// State lokal khusus modul penyapaan
let localPenyapaanData = [];

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
currentActiveTab = tabName;
document.querySelectorAll(".view-section").forEach(s => s.classList.add("hidden"));
document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));

const targetView = document.getElementById(`view-${tabName}`);
const targetTab = document.getElementById(`tab-${tabName}`);
if (targetView) targetView.classList.remove("hidden");
if (targetTab) targetTab.classList.add("active");

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
} else if (tabName === "pengurus") {
renderPengurus();
} else if (tabName === "inventaris") {
renderInventaris();
} else if (tabName === "jamaah") {
renderJamaah();
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
selectKelas(currentKelas && classes.includes(currentKelas) ? currentKelas : "Caberawit A");
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

// =========================================================================
// SISTEM FILTER WILAYAH GLOBAL DI NAVBAR
// =========================================================================

function getDesaByKelompok(namaKelompok) {
if (!namaKelompok || namaKelompok === "-") return "-";
const mk = Array.isArray(appData.master_kelompok) ? appData.master_kelompok : [];
const found = mk.find(k => String(k.Nama_Kelompok || "").trim().toLowerCase() === String(namaKelompok).trim().toLowerCase());
return found ? String(found.Nama_Desa || "-").trim() : "-";
}

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

if (desas.size === 0) {
desas = new Set(["Desa 1", "Desa 2", "Desa 3", "Desa 4"]);
}

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

// =========================================================================
// RENDERERS (PENGURUS, INVENTARIS, JAMAAH, PRESENSI)
// =========================================================================

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
const desaFilter = document.getElementById("global-filter-desa") ? document.getElementById("global-filter-desa").value : "Semua";
const kelFilter = document.getElementById("global-filter-kelompok") ? document.getElementById("global-filter-kelompok").value : "Semua";
const search = (document.getElementById("global-search-input") ? document.getElementById("global-search-input").value : "").toLowerCase().trim();

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
tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-center text-slate-400 italic">Tidak ada data pengurus yang sesuai kriteria.</td></tr>`;
return;
}

tbody.innerHTML = filtered.map(p => {
const kel = p.Kelompok || p.Nama_Kelompok || "-";
const desa = (p.Desa && p.Desa !== "-") ? p.Desa : getDesaByKelompok(kel);
const wilayahLabel = (desa !== "-" && kel !== "-") ? `${desa} - ${kel}` : (desa !== "-" ? desa : (kel !== "-" ? kel : "-"));

return `
     <tr class="bg-white border-b hover:bg-slate-50">
       <td class="px-4 sm:px-6 py-3.5 font-semibold text-slate-800">${p.Nama || '-'}</td>
       <td class="px-4 sm:px-6 py-3.5 text-xs text-slate-600 font-medium">${wilayahLabel}</td>
       <td class="px-4 sm:px-6 py-3.5">${p.Jabatan || '-'}</td>
       <td class="px-4 sm:px-6 py-3.5">${p.NoHP || '-'}</td>
       <td class="px-4 sm:px-6 py-3.5"><span class="px-2 py-1 rounded-full text-xs font-semibold ${p.Status === 'Aktif' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">${p.Status || 'Aktif'}</span></td>
       <td class="px-4 sm:px-6 py-3.5 text-center admin-only ${currentAdmin ? '' : 'hidden'}">
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
const desaFilter = document.getElementById("global-filter-desa") ? document.getElementById("global-filter-desa").value : "Semua";
const kelFilter = document.getElementById("global-filter-kelompok") ? document.getElementById("global-filter-kelompok").value : "Semua";
const search = (document.getElementById("global-search-input") ? document.getElementById("global-search-input").value : "").toLowerCase().trim();

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
tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-6 text-center text-slate-400 italic">Tidak ada data inventaris pada wilayah binaan yang dipilih.</td></tr>`;
return;
}

tbody.innerHTML = filtered.map(i => {
const kel = i.Kelompok || i.Nama_Kelompok || "-";
const desa = (i.Desa && i.Desa !== "-") ? i.Desa : getDesaByKelompok(kel);

return `
     <tr class="bg-white border-b hover:bg-slate-50">
       <td class="px-4 sm:px-6 py-3.5 font-semibold text-slate-800">${i.NamaBarang || '-'}</td>
       <td class="px-3 sm:px-4 py-3.5 text-xs text-slate-600">${desa}</td>
       <td class="px-3 sm:px-4 py-3.5 text-xs font-semibold text-slate-700">${kel}</td>
       <td class="px-4 sm:px-6 py-3.5">${i.Jumlah || 0}</td>
       <td class="px-4 sm:px-6 py-3.5"><span class="px-2 py-1 rounded-full text-xs font-semibold ${i.Kondisi === 'Baik' ? 'bg-teal-100 text-teal-800' : 'bg-rose-100 text-rose-800'}">${i.Kondisi || 'Baik'}</span></td>
       <td class="px-4 sm:px-6 py-3.5">${i.TanggalMasuk ? i.TanggalMasuk.toString().split("T")[0] : '-'}</td>
       <td class="px-4 sm:px-6 py-3.5">${i.Keterangan || '-'}</td>
       <td class="px-4 sm:px-6 py-3.5 text-center admin-only ${currentAdmin ? '' : 'hidden'}">
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
const desaFilter = document.getElementById("global-filter-desa") ? document.getElementById("global-filter-desa").value : "Semua";
const kelFilter = document.getElementById("global-filter-kelompok") ? document.getElementById("global-filter-kelompok").value : "Semua";
const search = (document.getElementById("global-search-input") ? document.getElementById("global-search-input").value : "").toLowerCase().trim();

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
if (badgeCount) badgeCount.innerText = `${filtered.length} Jamaah Ditemukan`;

if (filtered.length === 0) {
tbody.innerHTML = `<tr><td colspan="11" class="px-4 py-6 text-center text-slate-400 italic">Tidak ada data jamaah pada kriteria yang dipilih.</td></tr>`;
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
     <tr class="bg-white border-b hover:bg-slate-50">
       <td class="px-3 sm:px-4 py-3 text-xs font-mono text-slate-500">${j.ID_Jamaah || j.ID || '-'}</td>
       <td class="px-3 sm:px-4 py-3 font-semibold text-slate-800">${j.Nama_Lengkap || j.Nama || '-'}</td>
       <td class="px-3 sm:px-4 py-3 text-xs font-semibold text-slate-700">${jDesa}</td>
       <td class="px-3 sm:px-4 py-3 text-xs font-semibold text-slate-900">${jKel}</td>
       <td class="px-3 sm:px-4 py-3 whitespace-nowrap">${j.TanggalLahir ? j.TanggalLahir.toString().split("T")[0] : '-'} <span class="text-xs text-emerald-600 font-bold">(${calculateAge(j.TanggalLahir)})</span></td>
       <td class="px-3 sm:px-4 py-3"><span class="px-2 py-1 rounded bg-teal-50 text-teal-700 font-semibold text-xs">${displayKelompok}</span></td>
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
if (!matchStatus) return false;

const rawKelasUsia = String(j.Kelas_Usia || j.Kelompok || "").trim();
const rawKelasUsiaLower = rawKelasUsia.toLowerCase();
const jGender = String(j.Gender || "").trim().toLowerCase();

const isItemCaberawit = rawKelasUsiaLower.startsWith("caberawit");
let detectedKelas = String(j.Kelas || "").trim().toLowerCase();
if (!detectedKelas && isItemCaberawit) {
detectedKelas = rawKelasUsiaLower;
}

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

const checkKelas = (currentKelompok === "Caberawit" || currentKelompok === "ASAD")
? (pKls === String(currentKelas).trim().toLowerCase())
: true;

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
if (!matchStatus) return false;

const rawKelasUsia = String(j.Kelas_Usia || j.Kelompok || "").trim();
const rawKelasUsiaLower = rawKelasUsia.toLowerCase();
const jGender = String(j.Gender || "").trim().toLowerCase();

const isItemCaberawit = rawKelasUsiaLower.startsWith("caberawit");
let detectedKelas = String(j.Kelas || "").trim().toLowerCase();
if (!detectedKelas && isItemCaberawit) {
detectedKelas = rawKelasUsiaLower;
}

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

const filterKelasUsia = document.getElementById("monitoring-filter-kelompok") ? document.getElementById("monitoring-filter-kelompok").value : "Semua";
const desaFilter = document.getElementById("global-filter-desa") ? document.getElementById("global-filter-desa").value : "Semua";
const kelFilter = document.getElementById("global-filter-kelompok") ? document.getElementById("global-filter-kelompok").value : "Semua";
const search = (document.getElementById("global-search-input") ? document.getElementById("global-search-input").value : "").toLowerCase().trim();

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

// Filter Wilayah
const jKelBinaan = String(j.Nama_Kelompok || j.KelompokBinaan || "-").trim();
const jDesa = String((j.Desa && j.Desa !== "-") ? j.Desa : getDesaByKelompok(jKelBinaan)).trim();

const matchDesa = (desaFilter === "Semua") || (jDesa.toLowerCase() === desaFilter.toLowerCase());
const matchKelBinaan = (kelFilter === "Semua") || (jKelBinaan.toLowerCase() === kelFilter.toLowerCase());

const namaStr = String(j.Nama_Lengkap || j.Nama || "").toLowerCase();
const matchSearch = !search || namaStr.includes(search);

if (!matchDesa || !matchKelBinaan || !matchSearch) return false;

// Filter Kelas Usia
if (filterKelasUsia === "Semua") return true;

const rawKelasUsia = String(j.Kelas_Usia || j.Kelompok || "").trim();
const rawLower = rawKelasUsia.toLowerCase();
const filterLower = filterKelasUsia.toLowerCase();

if (filterLower === "caberawit") {
return rawLower.startsWith("caberawit");
} else if (filterLower.startsWith("caberawit ")) {
return rawLower === filterLower || String(j.Kelas || "").trim().toLowerCase() === filterLower;
} else {
return rawLower === filterLower;
}
});

if (targetJamaah.length === 0) {
tbody.innerHTML = `<tr><td colspan="11" class="px-4 py-6 text-center text-slate-400 italic">Tidak ada data jamaah pada wilayah/kelas usia yang dipilih.</td></tr>`;
return;
}

tbody.innerHTML = targetJamaah.map((j, idx) => {
const nama = j.Nama_Lengkap || j.Nama;
const namaKey = String(nama || "").trim().toLowerCase();
const rawKelasUsia = String(j.Kelas_Usia || j.Kelompok || "").trim();
const isCaberawit = rawKelasUsia.toLowerCase().startsWith("caberawit");

const jKelBinaan = j.Nama_Kelompok || j.KelompokBinaan || "-";
const jDesa = (j.Desa && j.Desa !== "-") ? j.Desa : getDesaByKelompok(jKelBinaan);

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

const displayKelas = isCaberawit ? `Caberawit (${j.Kelas || rawKelasUsia})` : rawKelasUsia;
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
       <td class="px-3 py-3 text-xs text-slate-600">${jDesa}</td>
       <td class="px-3 py-3 text-xs font-semibold text-slate-700">${jKelBinaan}</td>
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
// MODUL PENYAPAAN (REKOMENDASI DI ATAS, FONT KELOMPOK & TOTAL DIPERBESAR)
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
lowest4.forEach(item => {
item.is_recommended = true;
});
});
}

function toggleLocalSapa(idKelompok, actionType) {
if (!currentAdmin) {
alert("Hanya Admin yang berwenang mengubah status penyapaan kegiatan!");
renderPetaCards();
return;
}

const item = localPenyapaanData.find(k => String(k.id) === String(idKelompok));
if (!item) return;

if (actionType === "sapa") {
if (item.status_sapa) {
item.status_sapa = false;
} else {
item.status_sapa = true;
item.status_belum_sapa = false;
}
} else if (actionType === "belum_sapa") {
if (item.status_belum_sapa) {
item.status_belum_sapa = false;
} else {
item.status_belum_sapa = true;
item.status_sapa = false;
}
}

item.total_penyapaan = item.base_total + (item.status_sapa ? 1 : 0);
item.is_dirty = (item.status_sapa || item.status_belum_sapa);

calculateRekomendasi16Kelompok();
renderPetaCards();
}

async function simpanBatchPenyapaanGrid() {
if (!currentAdmin) {
return alert("Akses Admin diperlukan untuk menyimpan penyapaan!");
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
namaPetugas: currentAdmin.nama || "Admin Daerah",
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
if (btn) btn.classList.remove("active");
});

const activeEl = document.getElementById(`subtab-${subTabName}`);
const activeBtn = document.getElementById(`subtab-btn-${subTabName}`);
if (activeEl) activeEl.classList.remove("hidden");
if (activeBtn) activeBtn.classList.add("active");
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

// Render kartu kelompok: Rekomendasi di urutan paling atas di tiap desa, font diperbesar
function renderPetaCards() {
const container = document.getElementById("peta-desa-grid");
if (!container) return;

if (!localPenyapaanData || localPenyapaanData.length === 0) {
buildLocalPenyapaanState();
}

const desas = [...new Set(localPenyapaanData.map(m => m.nama_desa))];
const hasDirty = localPenyapaanData.some(k => k.is_dirty);

container.innerHTML = desas.map(desa => {
let list = localPenyapaanData.filter(k => k.nama_desa === desa);

if (currentPetaFilter === "sudah") list = list.filter(k => k.total_penyapaan > 0 || k.status_sapa);
if (currentPetaFilter === "belum") list = list.filter(k => k.total_penyapaan === 0 && !k.status_sapa);

// SORTING: Kelompok rekomendasi diangkat ke urutan teratas desa
list.sort((a, b) => {
if (a.is_recommended && !b.is_recommended) return -1;
if (!a.is_recommended && b.is_recommended) return 1;
return parseInt(a.total_penyapaan || 0, 10) - parseInt(b.total_penyapaan || 0, 10);
});

return `
     <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
       <div class="border-b pb-2 flex justify-between items-center">
         <h4 class="font-bold text-slate-800 text-sm uppercase flex items-center gap-1.5">
           <i class="fa-solid fa-location-dot text-emerald-600"></i> ${desa}
         </h4>
         <span class="text-xs text-slate-500 font-semibold">${list.length} Kelompok</span>
       </div>
       <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
         ${list.map(k => {
           const isSapaChecked = k.status_sapa;
           const isBelumChecked = k.status_belum_sapa;

           let badgeHtml = "";
           if (k.is_dirty) {
             badgeHtml = `<span class="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-300">Draf</span>`;
           } else if (k.total_penyapaan > 0) {
             badgeHtml = `<span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-300">Disapa</span>`;
           } else {
             badgeHtml = `<span class="bg-slate-100 text-slate-500 text-[10px] font-semibold px-2 py-0.5 rounded">Belum</span>`;
           }

           let rekomBadge = "";
           if (k.is_recommended) {
             rekomBadge = `
               <span class="text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                 <i class="fa-solid fa-star text-amber-500 text-[9px]"></i> Rekomendasi
               </span>
             `;
           }

           return `
             <div class="p-3.5 rounded-xl border flex flex-col justify-between space-y-2.5 transition-all ${k.is_dirty ? 'bg-amber-50/60 border-amber-300 shadow-xs' : (k.is_recommended ? 'bg-amber-50/25 border-amber-200 shadow-xs' : (k.total_penyapaan > 0 ? 'bg-emerald-50/30 border-emerald-200' : 'bg-slate-50/70 border-slate-200'))}">
               <div>
                 <div class="flex items-start justify-between gap-1 mb-1">
                   <!-- FONT NAMA KELOMPOK DIPERBESAR -->
                   <p class="font-extrabold text-sm sm:text-base text-slate-900 leading-snug truncate" title="${k.nama_kelompok}">${k.nama_kelompok}</p>
                   ${badgeHtml}
                 </div>
                 <div class="flex items-center gap-1.5 flex-wrap mt-0.5">
                   ${rekomBadge}
                   <span class="text-[10px] text-slate-400 font-medium">Terakhir: ${k.tanggal_terakhir !== '-' ? String(k.tanggal_terakhir).split('T')[0] : '-'}</span>
                 </div>
               </div>

               <div class="pt-2.5 border-t border-slate-200/80 flex items-center justify-between">
                 <div class="flex items-center gap-3">
                   <label class="flex items-center gap-1.5 ${currentAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}">
                     <input type="checkbox" ${isSapaChecked ? 'checked' : ''} ${!currentAdmin ? 'disabled' : ''} onchange="toggleLocalSapa('${k.id}', 'sapa')" class="rounded text-teal-600 focus:ring-teal-500 w-4 h-4">
                     <span class="text-xs font-bold text-slate-800">Sapa</span>
                   </label>

                   <label class="flex items-center gap-1.5 ${currentAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}">
                     <input type="checkbox" ${isBelumChecked ? 'checked' : ''} ${!currentAdmin ? 'disabled' : ''} onchange="toggleLocalSapa('${k.id}', 'belum_sapa')" class="rounded text-rose-600 focus:ring-rose-500 w-4 h-4">
                     <span class="text-xs font-bold text-slate-500">Belum</span>
                   </label>
                 </div>

                 <!-- FONT NILAI TOTAL PENYAPAAN DIPERBESAR -->
                 <div class="text-right pl-2">
                   <span class="text-[9px] text-slate-400 block leading-none font-bold uppercase tracking-wider">Total Sapa</span>
                   <span class="text-base sm:text-lg font-black text-teal-950 leading-tight">${k.total_penyapaan}x</span>
                 </div>
               </div>
             </div>
           `;
         }).join("")}
       </div>
     </div>
   `;
}).join("");

if (currentAdmin && hasDirty) {
container.innerHTML += `
     <div class="col-span-full bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm sticky bottom-4 z-20">
       <div class="flex items-center gap-2 text-xs font-semibold text-amber-900">
         <i class="fa-solid fa-triangle-exclamation text-amber-600 text-sm"></i>
         <span>Perubahan tanda sapaan berstatus <b>Draf</b>. Klik simpan untuk merekam data ke server.</span>
       </div>
       <button onclick="simpanBatchPenyapaanGrid()" class="bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2 shrink-0">
         <i class="fa-solid fa-floppy-disk"></i> Simpan Sapaan Terpilih
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
const oldContent = document.getElementById("subtab-rekap-riwayat");
oldContent.innerHTML = `
     <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between gap-3">
       <input type="text" id="search-riwayat" oninput="renderRiwayatPenyapaanTable()" placeholder="Cari agenda kegiatan atau kelompok..." class="border rounded-lg px-3 py-1.5 text-xs w-full sm:w-80 focus:ring-1 focus:ring-teal-500 focus:outline-none">
       <select id="filter-riwayat-desa" onchange="renderRiwayatPenyapaanTable()" class="border rounded-lg px-3 py-1.5 text-xs bg-white font-semibold text-slate-700">
         <option value="ALL">Semua Desa</option>
       </select>
     </div>
     <div id="riwayat-cards-grid-wrapper" class="grid grid-cols-1 md:grid-cols-2 gap-5"></div>
   `;
wrapper = document.getElementById("riwayat-cards-grid-wrapper");
populateSapaanSelectors();
}

const search = (document.getElementById("search-riwayat") ? document.getElementById("search-riwayat").value : "").toLowerCase().trim();
const desaFilter = document.getElementById("filter-riwayat-desa") ? document.getElementById("filter-riwayat-desa").value : "ALL";

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
wrapper.innerHTML = `<div class="col-span-full bg-white p-8 text-center text-slate-400 italic rounded-xl border border-slate-200">Tidak ada riwayat penyapaan kegiatan yang ditemukan.</div>`;
return;
}

const desas = ["Banjarharjo", "Kaling", "Karangmojo", "Jaten"];

wrapper.innerHTML = sessionsArray.map(session => {
const totalDisapa = session.kelompok_disapa.length;

const desaHtmlList = desas.map(desa => {
const items = session.kelompok_disapa.filter(d => d.desa.toLowerCase() === desa.toLowerCase());
if (items.length === 0) return '';

const namesHtml = items.map(i => `
       <span class="inline-block bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-md text-xs font-semibold">
         ${i.nama_kelompok}
       </span>
     `).join(' ');

return `
       <div class="space-y-1.5">
         <p class="text-xs font-bold text-slate-700">Desa ${desa} (${items.length}):</p>
         <div class="flex flex-wrap gap-1.5">${namesHtml}</div>
       </div>
     `;
}).join('');

const formattedDateText = formatTanggalIndo(session.tanggal);

return `
     <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 flex flex-col justify-between">
       <div class="flex justify-between items-start border-b border-slate-100 pb-4 gap-3">
         <div>
           <h3 class="font-extrabold text-lg text-slate-900 leading-snug uppercase">${session.nama_kegiatan}</h3>
           <p class="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
             <i class="fa-solid fa-calendar-days text-blue-600"></i>
             <span class="font-semibold text-slate-700">${formattedDateText}</span>
           </p>
         </div>
         <div class="bg-blue-50 border border-blue-100 text-blue-700 px-3.5 py-1.5 rounded-xl text-right shrink-0">
           <span class="text-base sm:text-lg font-black">${totalDisapa}</span>
           <span class="text-xs font-bold"> Kelompok Disapa</span>
         </div>
       </div>

       <div class="space-y-3.5 pt-1">
         ${desaHtmlList || '<p class="text-xs text-slate-400 italic">Belum ada kelompok yang disapa pada kegiatan ini.</p>'}
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
