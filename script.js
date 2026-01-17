// PATCH_v2
// --- CORE: STATE MANAGEMENT ---
const APP_DATA = {



    loans: [],
    transactions: []
};

// --- CONFIG BACKEND ---
const API_URL = "http://localhost:8787/api"; // Địa chỉ Server Cloudflare của bạn
let AUTH_TOKEN = localStorage.getItem('myfinances_token');

// --- AUTH LOGIC ---
let isLoginMode = true;

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('btn-auth').innerText = isLoginMode ? "Đăng nhập" : "Đăng ký";
    document.getElementById('link-auth').innerText = isLoginMode ? "Đăng ký ngay" : "Quay lại Đăng nhập";
    document.getElementById('auth-error').classList.add('hidden');
}

async function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    const btn = document.getElementById('btn-auth');
    const errBox = document.getElementById('auth-error');

    // Loading State
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';
    errBox.classList.add('hidden');

    try {
        const endpoint = isLoginMode ? '/login' : '/register';
        const res = await fetch(API_URL + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: pass })
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Lỗi kết nối');

        if (isLoginMode) {
            // Đăng nhập thành công -> Lưu Token & Vào App
            localStorage.setItem('myfinances_token', data.token);
            AUTH_TOKEN = data.token;
            document.getElementById('auth-modal').classList.add('hidden'); // Ẩn màn hình login
            showToast(`Xin chào ${data.user.email}!`, 'success');
            initApp(); // Load dữ liệu
        } else {
            // Đăng ký thành công -> Chuyển sang đăng nhập
            showToast('Đăng ký thành công! Hãy đăng nhập.', 'success');
            toggleAuthMode();
        }

    } catch (err) {
        errBox.innerText = err.message;
        errBox.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.innerText = isLoginMode ? "Đăng nhập" : "Đăng ký";
    }
}

// PATCH_v2
// PATCH_v2
// PATCH_v2
function initApp() {
    // Check First Time
    if (!localStorage.getItem('myfinances_data') && !localStorage.getItem('myfinances_setup')) {
        document.getElementById('setup-wizard').classList.remove('hidden');
    } else {
        checkLock(); // Only check PIN if set up already
    }

    try {
        const saved = localStorage.getItem('myfinances_data');
        if (saved) Object.assign(APP_DATA, JSON.parse(saved));
    } catch (e) {
        console.warn("Dữ liệu lỗi, tự động reset:", e);
        // Không xóa localStorage ngay để user còn cơ hội cứu, chỉ load default
    }

    // Render an toàn
    renderLoans();
    renderBudget();
    updateDashboard();

    // Mặc định vào Dashboard cho đẹp
    switchTab('dashboard');
}

// PATCH_v2
// PATCH_v2
// --- LOGIC: GOALS ---
if (!APP_DATA.goals) APP_DATA.goals = []; // Init goals if missing

function handleAddGoal(e) {
    e.preventDefault();
    APP_DATA.goals.push({
        id: Date.now(),
        name: document.getElementById('goalName').value,
        target: Number(document.getElementById('goalTarget').value),
        saved: 0
    });
    saveData();
    e.target.reset();
    renderGoals();
    showToast('Đã thêm mục tiêu mới!', 'success');
}

function depositGoal(id, amount) {
    const g = APP_DATA.goals.find(g => g.id === id);
    if (g) {
        g.saved += amount;
        saveData(); renderGoals(); showToast(`Đã thêm vào quỹ: ${formatMoney(amount)}`);
    }
}

function deleteGoal(id) {
    if (confirm('Xóa mục tiêu này?')) {
        APP_DATA.goals = APP_DATA.goals.filter(g => g.id !== id);
        saveData(); renderGoals();
    }
}

function renderGoals() {
    const list = document.getElementById('goal-list');
    if (!list) return;
    list.innerHTML = APP_DATA.goals.map(g => {
        const percent = Math.min(100, Math.round((g.saved / g.target) * 100));
        return `
        <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-100 relative">
             <button onclick="deleteGoal(${g.id})" class="absolute top-2 right-2 text-slate-300 hover:text-red-500"><i class="fa-solid fa-trash"></i></button>
             <h3 class="font-bold text-slate-700">${g.name}</h3>
             <div class="text-xs text-slate-500 mb-2">Đã có: ${formatMoney(g.saved)} / ${formatMoney(g.target)}</div>
             <div class="w-full bg-slate-100 rounded-full h-2.5 mb-3">
                 <div class="bg-indigo-600 h-2.5 rounded-full" style="width: ${percent}%"></div>
             </div>
             <div class="flex gap-2">
                 <button onclick="depositGoal(${g.id}, 100000)" class="flex-1 bg-indigo-50 text-indigo-600 text-xs font-bold py-2 rounded-lg hover:bg-indigo-100">+100k</button>
                 <button onclick="depositGoal(${g.id}, 500000)" class="flex-1 bg-indigo-50 text-indigo-600 text-xs font-bold py-2 rounded-lg hover:bg-indigo-100">+500k</button>
             </div>
        </div>`;
    }).join('');
}

// PATCH_v2
// PATCH_v2
// --- LOGIC: REPORTING ---
function openReport() {
    document.getElementById('report-modal').classList.remove('hidden');
    // Generate Month Options
    const months = [...new Set(APP_DATA.transactions.map(t => t.date.slice(0, 7)))].sort().reverse();
    const sel = document.getElementById('reportMonth');
    if (months.length === 0) {
        sel.innerHTML = `<option value="${new Date().toISOString().slice(0, 7)}">Tháng này</option>`;
    } else {
        sel.innerHTML = months.map(m => `<option value="${m}">Tháng ${m.split('-')[1]}/${m.split('-')[0]}</option>`).join('');
    }
    renderReportDetail();
}

function renderReportDetail() {
    const month = document.getElementById('reportMonth').value;
    const trans = APP_DATA.transactions.filter(t => t.date.startsWith(month));

    // 1. Calc Totals
    let income = 0, expense = 0;
    const cats = {};

    trans.forEach(t => {
        if (t.type === 'income') income += t.amount;
        else {
            expense += t.amount;
            const k = t.catName || 'Khác';
            if (!cats[k]) cats[k] = { amount: 0, icon: t.icon || '💸' };
            cats[k].amount += t.amount;
        }
    });

    // 2. Render Breakdown (Sorted)
    const sortedCats = Object.entries(cats).sort((a, b) => b[1].amount - a[1].amount);
    document.getElementById('report-breakdown').innerHTML = sortedCats.map(([name, data]) => {
        const pct = Math.round((data.amount / expense) * 100) || 0;
        return `
        <div class="flex items-center justify-between text-sm">
            <div class="flex items-center w-1/3"><span class="mr-2">${data.icon}</span> ${name}</div>
            <div class="flex-1 mx-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div class="h-full bg-red-400" style="width: ${pct}%"></div>
            </div>
            <div class="w-24 text-right font-bold text-slate-700">${formatMoney(data.amount)} <span class="text-xs font-normal text-slate-400">(${pct}%)</span></div>
        </div>`;
    }).join('') || '<div class="text-center text-slate-400 py-4">Không có chi tiêu</div>';

    // 3. Render Summary
    document.getElementById('report-savings').innerText = formatMoney(income - expense);
    document.getElementById('report-in').innerText = `Thu: ${formatMoney(income)}`;
    document.getElementById('report-out').innerText = `Chi: ${formatMoney(expense)}`;

    const total = income + expense;
    const inPct = total ? (income / total) * 100 : 50;
    document.getElementById('report-bar').innerHTML = `
        <div class="h-full bg-green-500" style="width: ${inPct}%"></div>
        <div class="h-full bg-red-500 flex-1"></div>
    `;
}

// PATCH_v2
// --- CORE: DIALOG SYSTEM ---
// PATCH_v2
function showDialog(type, msg, callback, defaultVal = '') {
    const el = document.getElementById('custom-dialog');
    const inp = document.getElementById('dialog-input');
    const actions = document.getElementById('dialog-actions');
    if (!el) return alert(msg);

    el.classList.remove('hidden');
    document.getElementById('dialog-msg').innerText = msg;
    document.getElementById('dialog-title').innerText = type === 'prompt' ? "Nhập thông tin" : (type === 'confirm' ? "Xác nhận" : "Thông báo");
    document.getElementById('dialog-icon').innerHTML = `<i class="fa-solid ${type === 'prompt' ? 'fa-pen-to-square' : (type === 'confirm' ? 'fa-circle-question' : 'fa-circle-info')} text-blue-500"></i>`;

    inp.classList.toggle('hidden', type !== 'prompt');
    if (type === 'prompt') { inp.value = defaultVal; setTimeout(() => inp.focus(), 100); }

    let btns = `<button onclick="closeDialog()" class="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 font-bold hover:bg-slate-200">${type === 'alert' ? 'Đóng' : 'Hủy'}</button>`;
    if (type !== 'alert') {
        btns += `<button id="dialog-yes" class="px-4 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30">Đồng ý</button>`;
    }
    actions.innerHTML = btns;

    const yesBtn = document.getElementById('dialog-yes');
    if (yesBtn) yesBtn.onclick = () => {
        if (type === 'prompt' && !inp.value) return inp.focus();
        callback(type === 'prompt' ? inp.value : true);
        closeDialog();
    };
}

function closeDialog() { document.getElementById('custom-dialog').classList.add('hidden'); }

// PATCH_v2
// --- LOGIC: SETUP ---
function finishSetup() {
    const bal = Number(document.getElementById('initBalance').value);
    const pin = document.getElementById('initPin').value;

    if (bal > 0) {
        // Create initial deposit
        APP_DATA.transactions.push({
            id: Date.now(),
            type: 'income',
            amount: bal,
            catId: 'salary', catName: 'Vốn đầu kỳ', icon: '💰',
            desc: 'Số dư ban đầu',
            date: new Date().toISOString()
        });
    }

    if (pin && pin.length === 4) {
        localStorage.setItem('myfinances_pin', pin);
    }

    localStorage.setItem('myfinances_setup', 'true'); // Mark as done
    saveData();

    // Hide Wizard
    document.getElementById('setup-wizard').classList.add('hidden');
    initApp(); // Reload to apply changes
}

// --- LOGIC: SECURITY ---
function checkLock() {
    const pin = localStorage.getItem('myfinances_pin');
    if (pin) {
        document.getElementById('pin-lock').classList.remove('hidden');
        document.getElementById('pinInput').focus();
    }
}

function unlockApp() {
    const pin = localStorage.getItem('myfinances_pin');
    const input = document.getElementById('pinInput').value;
    if (input === pin) {
        document.getElementById('pin-lock').classList.add('hidden');
    } else {
        document.getElementById('pin-msg').innerText = "Sai mã PIN!";
        document.getElementById('pinInput').value = '';
    }
}

function setPin() {
    const newPin = prompt("Đặt mã PIN mới (4 số):");
    if (newPin && newPin.length === 4) {
        localStorage.setItem('myfinances_pin', newPin);
        alert("Đã bật bảo mật PIN!");
    }
}

// --- LOGIC: SYSTEM / DATA ---
// PATCH_v2
function exportCSV() {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // UTF-8 BOM
    csvContent += "Ngay,Loai,SoTien,DanhMuc,MoTa\n";
    APP_DATA.transactions.forEach(t => {
        csvContent += `${new Date(t.date).toLocaleDateString('vi-VN')},${t.type},${t.amount},${t.catName},"${t.desc}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "MyFinances_Report.csv");
    document.body.appendChild(link);
    link.click();
}

function exportData() {
    const dataStr = JSON.stringify(APP_DATA, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MyFinances_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importData(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.loans && data.transactions) {
                if (confirm('Dữ liệu hiện tại sẽ bị ghi đè. Tiếp tục?')) {
                    Object.assign(APP_DATA, data);
                    saveData();
                    initApp(); // Reload UI
                    alert('Khôi phục thành công!');
                }
            } else {
                alert('File không hợp lệ!');
            }
        } catch (err) { alert('Lỗi đọc file!'); }
    };
    reader.readAsText(file);
    input.value = ''; // Reset input
}

// PATCH_v2
// PATCH_v2
function resetApp() {
    showDialog('confirm', 'CẢNH BÁO: Xóa toàn bộ dữ liệu sẽ không thể phục hồi. Bạn chắc chứ?', () => {
        localStorage.removeItem('myfinances_data');
        localStorage.removeItem('myfinances_setup');
        location.reload();
    });
}

function clearTransactions() {
    showDialog('confirm', 'Chỉ xóa lịch sử Thu/Chi, giữ lại Nợ & Mục tiêu?', () => {
        APP_DATA.transactions = [];
        saveData();
        showToast('Đã dọn dẹp lịch sử giao dịch!', 'success');
        setTimeout(() => location.reload(), 1000);
    });
}

function handleAdjustBalance() {
    const real = Number(document.getElementById('realBalance').value);
    if (isNaN(real)) return;

    const current = getSummary().balance;
    const diff = real - current;

    if (diff === 0) {
        showToast('Số dư đã khớp, không cần chỉnh!', 'success');
        return;
    }

    APP_DATA.transactions.unshift({
        id: Date.now(),
        type: diff > 0 ? 'income' : 'expense',
        amount: Math.abs(diff),
        catId: 'other', catName: 'Hệ thống', icon: '⚙️',
        desc: 'Điều chỉnh số dư ví',
        date: new Date().toISOString()
    });

    // PATCH_v2
    saveData();
    // Sync toàn bộ UI các tab khác
    renderBudget();
    updateDashboard();

    document.getElementById('acc-app-balance').innerText = formatMoney(real);
    document.getElementById('realBalance').value = '';
    showToast(`Đã điều chỉnh: ${diff > 0 ? '+' : ''}${formatMoney(diff)}`, 'success');
}

// PATCH_v2
// --- LOGIC: BUDGET ---
// PATCH_v2
const CATS = {
    expense: [
        { id: 'live', icon: '🍜', name: 'Ăn uống/Sinh hoạt' }, // Tiền sống 
        { id: 'move', icon: '🛵', name: 'Đi lại/Xăng xe' },
        { id: 'bill', icon: '⚡', name: 'Hóa đơn/Bắt buộc' }, // 
        { id: 'debt', icon: '🏦', name: 'Trả nợ' }, // 
        { id: 'stupid', icon: '🤡', name: 'Phí ngu/Bốc đồng' }, // 
        { id: 'other', icon: '💸', name: 'Khác' }
    ],
    income: [
        { id: 'salary', icon: '💰', name: 'Lương' },
        { id: 'bonus', icon: '🎁', name: 'Thưởng' },
        { id: 'invest', icon: '📈', name: 'Đầu tư' },
        { id: 'other', icon: '📥', name: 'Khác' }
    ]
};

function updateCategories() {
    const type = document.getElementById('transType').value;
    const sel = document.getElementById('transCat');
    sel.innerHTML = CATS[type].map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
}

function handleAddTransaction(e) {
    e.preventDefault();
    const type = document.getElementById('transType').value;
    const catId = document.getElementById('transCat').value;
    const cat = CATS[type].find(c => c.id === catId) || CATS[type][0];
    const amount = Number(document.getElementById('transAmount').value);

    APP_DATA.transactions.unshift({
        id: Date.now(),
        type, amount,
        catId: cat.id,
        catName: cat.name,
        icon: cat.icon,
        desc: document.getElementById('transDesc').value || cat.name,
        date: new Date().toISOString()
    });

    saveData();
    e.target.reset();
    updateCategories(); // Reset cat select
    renderBudget();
    updateDashboard();
    showToast(`Đã thêm: ${formatMoney(amount)}`, 'success');
}

function showToast(msg, type = 'info') {
    const box = document.createElement('div');
    box.className = `p-3 rounded-lg shadow-lg text-white font-medium text-sm animate-bounce ${type === 'success' ? 'bg-green-600' : 'bg-slate-800'}`;
    box.innerHTML = `<i class="fa-solid fa-circle-check mr-2"></i> ${msg}`;
    document.getElementById('toast-container').appendChild(box);
    setTimeout(() => box.remove(), 3000);
}

// PATCH_v2
function editTrans(id) {
    const t = APP_DATA.transactions.find(t => t.id === id);
    if (!t) return;
    const newAmount = prompt("Sửa số tiền:", t.amount);
    if (newAmount !== null) {
        const newDesc = prompt("Sửa mô tả:", t.desc);
        t.amount = Number(newAmount);
        if (newDesc) t.desc = newDesc;
        saveData(); renderBudget(); updateDashboard();
    }
}

// PATCH_v2
function deleteTrans(id) {
    showDialog('confirm', 'Bạn muốn xóa giao dịch này?', () => {
        APP_DATA.transactions = APP_DATA.transactions.filter(t => t.id !== id);
        saveData(); renderBudget(); updateDashboard();
        showToast('Đã xóa giao dịch');
    });
}

// PATCH_v2
function renderBudget() {
    const list = document.getElementById('transaction-list');
    let income = 0, expense = 0;

    // Auto-init categories if needed
    if (document.getElementById('transCat') && document.getElementById('transCat').children.length === 0) updateCategories();

    // PATCH_v2
    if (list) {
        // Filter Logic
        const keyword = (document.getElementById('searchTrans')?.value || '').toLowerCase();
        const filtered = APP_DATA.transactions.filter(t =>
            t.desc.toLowerCase().includes(keyword) ||
            (t.catName && t.catName.toLowerCase().includes(keyword))
        );

        list.innerHTML = filtered.map(t => {
            if (t.type === 'income') income += t.amount; else expense += t.amount;
            const isInc = t.type === 'income';
            // Fallback for old data without icon
            const icon = t.icon || (isInc ? '💰' : '💸');

            return `
            <div class="flex items-center bg-white p-3 rounded-xl shadow-sm border border-slate-100 mb-2">
                <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg ${isInc ? 'bg-green-100' : 'bg-orange-100'} mr-3">
                    ${icon}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="font-bold text-slate-800 truncate">${t.catName || t.desc}</div>
                    <div class="text-xs text-slate-400 truncate">${t.desc} • ${new Date(t.date).toLocaleDateString('vi-VN')}</div>
                </div>
                <div class="text-right ml-2">
                    <div class="font-bold ${isInc ? 'text-green-600' : 'text-slate-800'}">
                        ${isInc ? '+' : '-'}${formatMoney(t.amount)}
                    </div>
                    <div class="flex gap-2 justify-end mt-1">
                        <button onclick="editTrans(${t.id})" class="text-xs text-slate-400 hover:text-blue-500"><i class="fa-solid fa-pen"></i> Sửa</button>
                        <button onclick="deleteTrans(${t.id})" class="text-xs text-slate-400 hover:text-red-500"><i class="fa-solid fa-trash"></i> Xóa</button>
                    </div>
                </div>
            </div>`;
        }).join('') || '<div class="flex flex-col items-center justify-center text-slate-300 py-10"><i class="fa-solid fa-receipt text-4xl mb-2"></i><p>Chưa có giao dịch</p></div>';
    }

    // Update Summary
    const balance = income - expense;
    ['wallet-balance', 'total-income', 'total-expense'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === 'wallet-balance') el.innerText = formatMoney(balance);
            if (id === 'total-income') el.innerText = formatMoney(income);
            if (id === 'total-expense') el.innerText = formatMoney(expense);
        }
    });
}

// PATCH_v2
let chartAsset = null, chartFlow = null;

function getSummary() {
    let debt = 0, monthlyPay = 0, income = 0, expense = 0;

    // Calc Debt
    APP_DATA.loans.forEach(l => {
        const r = l.rate / 100 / 12;
        const n = l.term;
        const emi = (r === 0) ? (l.amount / n) : (l.amount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        debt += l.amount;
        monthlyPay += emi;
    });

    // Calc Budget
    APP_DATA.transactions.forEach(t => {
        if (t.type === 'income') income += t.amount;
        else expense += t.amount;
    });

    return { debt, monthlyPay, income, expense, balance: income - expense };
}

// PATCH_v2
// PATCH_v2
function updateDashboard() {
    renderGoals();
    const data = getSummary();

    // --- WEEKLY LOGIC  ---
    const now = new Date();
    // Start of week (Monday)
    const day = now.getDay() || 7;
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(now.getDate() - day + 1);

    const weeklySpent = APP_DATA.transactions
        .filter(t => t.type === 'expense' && new Date(t.date) >= startOfWeek)
        .reduce((sum, t) => sum + t.amount, 0);

    // Update Dashboard UI (3 Key Numbers )
    if (document.getElementById('wallet-balance')) {
        // Override budget summary with "Survival Mode"
        document.getElementById('wallet-balance').innerHTML = `
            ${formatMoney(data.balance)}
            <div class="text-xs font-normal opacity-70 mt-1">
                Ví Sống (50%): ${formatMoney(data.balance * 0.5)} | 
                Nợ (30%): ${formatMoney(data.balance * 0.3)} | 
                Khẩn cấp (20%): ${formatMoney(data.balance * 0.2)}
            </div>
         `;
        // PATCH_v2
        // PATCH_v2
        // Replace Total Expense with Weekly Spend (Safe Mode)
        const expEl = document.getElementById('total-expense');
        if (expEl) {
            // Chỉ thay nội dung bên trong, giữ lại ID 'total-expense' cho lần sau
            expEl.parentElement.innerHTML = `
                <div class="text-xs opacity-80"><i class="fa-solid fa-calendar-week"></i> Chi tuần này</div>
                <div class="font-bold text-lg text-orange-200" id="total-expense">${formatMoney(weeklySpent)}</div>`;
        }

        // Update Weekly Bar (Target: 1.5tr/week)
        const limit = 1500000;
        const pct = Math.min(100, (weeklySpent / limit) * 100);
        const bar = document.getElementById('weekly-bar');
        if (bar) {
            bar.style.width = `${pct}%`;
            bar.className = `h-full transition-all duration-500 ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-orange-500' : 'bg-blue-600'}`;
        }
    }

    // --- HEALTH CHECK LOGIC ---
    const healthMsg = document.getElementById('health-msg');
    const healthCard = document.getElementById('health-card');

    if (healthMsg) {
        let status = "Ổn định", color = "from-indigo-500 to-purple-600";
        let advice = "Hãy duy trì thói quen ghi chép tài chính đều đặn.";

        // Rule: Nợ > 40% Thu nhập ròng (Giả định thu nhập = income trong app)
        if (data.income > 0 && (data.monthlyPay / data.income) > 0.4) {
            status = "CẢNH BÁO NỢ";
            color = "from-red-500 to-orange-600";
            advice = `Bạn đang dành ${Math.round((data.monthlyPay / data.income) * 100)}% thu nhập để trả nợ. Mức an toàn là <30%. Hãy hạn chế chi tiêu!`;
        } else if (data.balance < 0) {
            status = "THÂM HỤT";
            color = "from-orange-500 to-amber-500";
            advice = "Chi tiêu đang vượt quá thu nhập. Hãy cắt giảm các khoản không cần thiết.";
        } else if (data.balance > data.income * 0.2) {
            status = "TỐT";
            color = "from-green-500 to-emerald-600";
            advice = "Bạn đang tiết kiệm rất tốt (>20% thu nhập). Hãy cân nhắc đầu tư!";
        }

        healthCard.className = `text-white p-5 rounded-xl shadow-lg mb-6 flex items-start gap-4 bg-gradient-to-r ${color}`;
        healthMsg.innerHTML = `<strong>${status}:</strong> ${advice}`;
    }

    const ctx1 = document.getElementById('chartAssets');
    const ctx2 = document.getElementById('chartExpense');

    if (chartAsset) chartAsset.destroy();
    if (chartFlow) chartFlow.destroy();

    if (ctx1) {
        chartAsset = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: ['Số dư ví', 'Tổng nợ'],
                datasets: [{
                    label: 'VND', data: [data.balance, data.debt],
                    backgroundColor: ['#3b82f6', '#ef4444'], borderRadius: 6
                }]
            },
            options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });
    }

    if (ctx2) {
        const savings = Math.max(0, data.income - data.expense - data.monthlyPay);
        chartFlow = new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: ['Chi tiêu', 'Trả nợ (Tháng)', 'Dư ra'],
                datasets: [{
                    data: [data.expense, Math.round(data.monthlyPay), savings],
                    backgroundColor: ['#f97316', '#ef4444', '#22c55e'], borderWidth: 0
                }]
            },
            options: { cutout: '70%' }
        });
    }
}

// --- LOGIC: DEBTS ---
// PATCH_v2
// PATCH_v2
function openModal(editId = null) {
    const modal = document.getElementById('modal');
    modal.classList.remove('hidden');
    if (editId) {
        const l = APP_DATA.loans.find(i => i.id === editId);
        document.getElementById('modal-title').innerText = "Cập nhật khoản vay";
        document.getElementById('loanId').value = l.id;
        document.getElementById('loanName').value = l.name;
        document.getElementById('loanCode').value = l.code || '';
        document.getElementById('loanStart').value = l.startDate || new Date().toISOString().split('T')[0];
        document.getElementById('loanAmount').value = l.amount;
        document.getElementById('loanRate').value = l.rate;
        document.getElementById('loanTerm').value = l.term;
        document.getElementById('loanDay').value = l.day || 1;
    } else {
        document.getElementById('modal-title').innerText = "Thêm khoản vay mới";
        document.querySelector('form').reset();
        document.getElementById('loanId').value = '';
        document.getElementById('loanStart').value = new Date().toISOString().split('T')[0];
    }
    setTimeout(() => document.getElementById('loanName').focus(), 100);
}
function closeModal() { document.getElementById('modal').classList.add('hidden'); }

function handleSaveLoan(e) {
    e.preventDefault();
    const id = document.getElementById('loanId').value;
    const loanData = {
        name: document.getElementById('loanName').value,
        code: document.getElementById('loanCode').value,
        startDate: document.getElementById('loanStart').value,
        day: Number(document.getElementById('loanDay').value),
        amount: Number(document.getElementById('loanAmount').value),
        rate: Number(document.getElementById('loanRate').value),
        term: Number(document.getElementById('loanTerm').value),
    };

    if (id) { // Edit Mode
        const idx = APP_DATA.loans.findIndex(l => l.id == id);
        if (idx !== -1) APP_DATA.loans[idx] = { ...APP_DATA.loans[idx], ...loanData };
        showToast('Đã cập nhật thông tin!', 'success');
    } else { // Add Mode
        APP_DATA.loans.push({ id: Date.now(), paid: 0, date: new Date().toISOString(), ...loanData });
        showToast('Đã thêm khoản vay mới!', 'success');
    }
    saveData(); closeModal(); renderLoans();
}

// PATCH_v2
// PATCH_v2
// PATCH_v2
// PATCH_v2
// PATCH_v2
function payDebt(id, name, amount) {
    showDialog('confirm', `Xác nhận trả ${formatMoney(amount)} cho "${name}"?\nTiền sẽ được trừ tự động trong ví.`, () => {
        // 1. Record Expense
        APP_DATA.transactions.unshift({
            id: Date.now(),
            type: 'expense', amount: amount,
            catId: 'debt', catName: 'Trả nợ', icon: '🏦',
            desc: `Trả nợ: ${name}`, date: new Date().toISOString()
        });

        // 2. Update Loan Progress
        const loan = APP_DATA.loans.find(l => l.id === id);
        if (loan) {
            loan.paid = (loan.paid || 0) + amount;
        }

        saveData();
        renderBudget();
        renderLoans(); // Re-render debt list
        updateDashboard();
        showToast(`Đã trả: ${formatMoney(amount)}`, 'success');
    });
}

// PATCH_v2
// PATCH_v2
function deleteLoan(id) {
    showDialog('confirm', 'Xóa khoản nợ này khỏi danh sách?', () => {
        APP_DATA.loans = APP_DATA.loans.filter(l => l.id !== id);
        saveData(); renderLoans();
        showToast('Đã xóa khoản vay');
    });
}

let debtStrategy = 'snowball';
function toggleStrategy() {
    debtStrategy = debtStrategy === 'snowball' ? 'avalanche' : 'snowball';
    renderLoans();
    showToast(`Đã chuyển: ${debtStrategy === 'snowball' ? 'Snowball (Nhỏ trước)' : 'Avalanche (Lãi cao trước)'}`);
}

// PATCH_v2
// PATCH_v2
function renderLoans() {
    const list = document.getElementById('debt-list');
    let totalRemaining = 0, totalMonthly = 0;
    const loans = [...APP_DATA.loans].sort((a, b) => {
        const remA = a.amount - (a.paid || 0), remB = b.amount - (b.paid || 0);
        return debtStrategy === 'snowball' ? remA - remB : b.rate - a.rate;
    });

    const header = `<div class="flex justify-between items-center mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100"><div class="text-sm text-blue-800 font-bold"><i class="fa-solid ${debtStrategy === 'snowball' ? 'fa-snowflake' : 'fa-mountain'} mr-1"></i> ${debtStrategy === 'snowball' ? 'Snowball (Trả nhỏ trước)' : 'Avalanche (Trả lãi cao trước)'}</div><button onclick="toggleStrategy()" class="text-xs bg-white border border-blue-200 text-blue-600 px-2 py-1 rounded">Đổi</button></div>`;

    list.innerHTML = header + (loans.map(loan => {
        const r = loan.rate / 100 / 12, n = loan.term;
        const emi = (r === 0) ? (loan.amount / n) : (loan.amount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        const paid = loan.paid || 0, remaining = Math.max(0, loan.amount - paid);
        totalRemaining += remaining; totalMonthly += emi;

        // Advanced Calc
        const pct = Math.min(100, Math.round((paid / loan.amount) * 100));
        const paidMonths = Math.floor((paid / loan.amount) * n);

        // Next Due Date Logic
        const today = new Date();
        let nextDue = new Date();
        nextDue.setDate(loan.day || 1);
        if (today.getDate() > (loan.day || 1)) nextDue.setMonth(today.getMonth() + 1);
        const dateStr = `${nextDue.getDate().toString().padStart(2, '0')}/${(nextDue.getMonth() + 1).toString().padStart(2, '0')}`;

        return `
        <div class="bg-white p-4 rounded-xl shadow-sm border ${remaining === 0 ? 'border-green-200 bg-green-50' : 'border-slate-100'} relative group mb-3 transition-all hover:shadow-md">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <div class="font-bold text-slate-800 text-lg ${remaining === 0 ? 'line-through opacity-50' : ''}">${loan.name}</div>
                    <div class="text-xs text-slate-400 font-mono mt-0.5">HĐ: ${loan.code || '---'} • GN: ${loan.startDate ? new Date(loan.startDate).toLocaleDateString('vi-VN') : '---'}</div>
                </div>
                <div class="flex gap-1">
                    <button onclick="openModal(${loan.id})" class="text-slate-300 hover:text-blue-500 p-1.5"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="deleteLoan(${loan.id})" class="text-slate-300 hover:text-red-500 p-1.5"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
            
            <div class="flex justify-between items-center text-sm mb-1">
                <span class="text-slate-500">Kỳ hạn: <span class="font-bold text-slate-700">${paidMonths}/${n}</span></span>
                <span class="text-orange-600 font-bold text-xs bg-orange-50 px-2 py-1 rounded">Đến hạn: ${dateStr}</span>
            </div>
            
            <div class="w-full bg-slate-100 rounded-full h-2.5 mb-2 overflow-hidden">
                <div class="bg-gradient-to-r from-orange-400 to-orange-600 h-2.5 rounded-full transition-all duration-700" style="width: ${pct}%"></div>
            </div>
            
            <div class="flex justify-between items-end">
                <div class="text-xs text-slate-500">
                    <div>Gốc: ${formatMoney(loan.amount)}</div>
                    <div>Đã trả: ${formatMoney(paid)}</div>
                </div>
                <div class="text-right">
                     <div class="text-xs text-slate-400 mb-1">Thanh toán tháng</div>
                     ${remaining > 0 ?
                `<button onclick="payDebt(${loan.id}, '${loan.name}', ${Math.round(emi)})" class="bg-blue-600 text-white text-sm font-bold px-3 py-1.5 rounded-lg shadow-md hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-1">
                        Trả ${formatMoney(Math.round(emi))} <i class="fa-solid fa-angle-right"></i>
                     </button>` :
                '<span class="text-green-600 font-bold border border-green-600 px-2 py-1 rounded text-xs">ĐÃ TẤT TOÁN</span>'}
                </div>
            </div>
        </div>`;
    }).join('') || '<div class="text-center text-slate-400 py-10"><i class="fa-solid fa-file-invoice-dollar text-4xl mb-3"></i><p>Chưa có khoản vay nào</p></div>');

    if (document.getElementById('total-debt')) document.getElementById('total-debt').innerText = formatMoney(totalRemaining);
    if (document.getElementById('monthly-pay')) document.getElementById('monthly-pay').innerText = formatMoney(Math.round(totalMonthly));
}

function payDebt(id, name, defaultAmount) {
    showDialog('prompt', `Nhập số tiền trả cho "${name}":`, (val) => {
        const amount = Number(val);
        if (!amount || amount <= 0) return showToast('Số tiền không hợp lệ!', 'error');

        APP_DATA.transactions.unshift({
            id: Date.now(),
            type: 'expense', amount: amount,
            catId: 'debt', catName: 'Trả nợ', icon: '🏦',
            desc: `Trả nợ: ${name}`, date: new Date().toISOString()
        });

        const loan = APP_DATA.loans.find(l => l.id === id);
        if (loan) loan.paid = (loan.paid || 0) + amount;

        saveData();
        renderBudget(); renderLoans(); updateDashboard();
        showToast(`Đã trả: ${formatMoney(amount)}`, 'success');
    }, defaultAmount);
}

function saveData() {
    localStorage.setItem('myfinances_data', JSON.stringify(APP_DATA));
}

function formatMoney(num) {
    return num.toLocaleString('vi-VN') + ' ₫';
}

// PATCH_v2
// (Deleted duplicate payDebt function)

// PATCH_v2
// --- UI: NAVIGATION ---
function switchTab(tabId) {
    // Update Account Balance Display if entering Account tab
    if (tabId === 'account') {
        const data = getSummary();
        const el = document.getElementById('acc-app-balance');
        if (el) el.innerText = formatMoney(data.balance);
    }

    // 1. Hide all tabs
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.remove('active');
    });

    // 2. Show selected tab
    document.getElementById(tabId).classList.add('active');

    // 3. Update Active State for Buttons (Desktop & Mobile)
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.dataset.target === tabId) {
            btn.classList.add('text-blue-600', 'bg-blue-50');
            btn.classList.remove('text-slate-500', 'text-slate-600');
        } else {
            btn.classList.remove('text-blue-600', 'bg-blue-50');
            btn.classList.add('text-slate-500'); // Default styling reset
        }
    });
}

// PATCH_v2
// --- CORE: REAL-TIME SYNC (Cross-Tab) ---
window.addEventListener('storage', (e) => {
    if (e.key === 'myfinances_data' || e.key === 'myfinances_pin') {
        console.log('Detected data change from another tab. Syncing...');
        // Reload data silently
        try {
            const saved = localStorage.getItem('myfinances_data');
            if (saved) Object.assign(APP_DATA, JSON.parse(saved));

            // Re-render current active view
            renderLoans();
            renderBudget();
            updateDashboard();

            // Notify user
            showToast('🔄 Dữ liệu đã được đồng bộ từ tab khác!', 'info');
        } catch (err) { console.error('Sync failed', err); }
    }
});

// Start
document.addEventListener('DOMContentLoaded', initApp);