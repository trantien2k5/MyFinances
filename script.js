// FINAL CLEAN VERSION - MyFinances
// --- CONFIG ---
const API_URL = "https://my-finances-backend.trantien.workers.dev/api"; // Link Worker Cloudflare
let AUTH_TOKEN = localStorage.getItem('myfinances_token');

const APP_DATA = { loans: [], transactions: [], goals: [] };

// --- AUTH & SYNC ---
let isLoginMode = true;

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    const btn = document.getElementById('btn-auth');
    const link = document.getElementById('link-auth');
    
    // Cập nhật text UI
    if (btn) btn.innerText = isLoginMode ? "Đăng nhập" : "Đăng ký";
    if (link) link.innerText = isLoginMode ? "Chưa có tài khoản? Đăng ký" : "Quay lại Đăng nhập";
    
    // Ẩn thông báo lỗi nếu có
    const err = document.getElementById('auth-error');
    if (err) err.classList.add('hidden');
    
    // Log để debug
    console.log("🔄 Toggle Mode:", isLoginMode ? "LOGIN" : "REGISTER");
}

async function handleAuth(e) {
    e.preventDefault();
    const form = e.target;
    // Tìm input chính xác trong form này
    const emailInp = form.querySelector('#auth-email') || document.getElementById('auth-email');
    const passInp = form.querySelector('#auth-pass') || document.getElementById('auth-pass');
    
    const email = emailInp.value.trim();
    const password = passInp.value.trim();
    
    const btn = document.getElementById('btn-auth');
    const errBox = document.getElementById('auth-error');

    if (!email || !password) {
        showToast("Vui lòng điền đủ thông tin!", "error");
        return;
    }

    btn.disabled = true; 
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';
    errBox.classList.add('hidden');

    try {
        console.log("📤 Sending:", { email, mode: isLoginMode ? 'LOGIN' : 'REGISTER' });
        
        const res = await fetch(API_URL + (isLoginMode ? '/login' : '/register'), {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.error || `Lỗi server (${res.status})`);
        }

        if (isLoginMode) {
            // Đăng nhập thành công
            localStorage.setItem('myfinances_token', data.token);
            AUTH_TOKEN = data.token;
            document.getElementById('auth-modal').classList.add('hidden');
            showToast(`Xin chào ${data.user.email}!`, 'success');
            initApp();
        } else {
            // Đăng ký thành công -> Chuyển qua login
            showToast('Đăng ký thành công! Hãy đăng nhập.', 'success');
            toggleAuthMode();
            // Tự điền lại email cho tiện
            if(emailInp) emailInp.value = email;
            if(passInp) passInp.value = '';
        }
    } catch (err) {
        errBox.innerText = err.message; 
        errBox.classList.remove('hidden');
        showToast(err.message, 'error'); // Hiện thông báo đỏ
    } finally { 
        btn.disabled = false; 
        btn.innerText = isLoginMode ? "Đăng nhập" : "Đăng ký"; 
    }
}

async function saveData() {
    localStorage.setItem('myfinances_data', JSON.stringify(APP_DATA));
    if (AUTH_TOKEN) {
        try {
            await fetch(API_URL + '/data', {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AUTH_TOKEN },
                body: JSON.stringify({ data: APP_DATA })
            });
            console.log("Cloud saved ✅");
            updateSyncStatus();
        } catch (e) { console.warn("Cloud save failed ❌"); }
    }
}

function updateSyncStatus() {
    const el = document.getElementById('sync-status');
    if (el) {
        el.innerText = `Đã đồng bộ lúc ${new Date().toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}`;
        el.parentElement.classList.remove('hidden');
    }
}

// PATCH_v2
// PATCH_v2
function logout() {
    if (confirm('Đăng xuất khỏi thiết bị này?')) {
        localStorage.removeItem('myfinances_token');
        localStorage.removeItem('myfinances_data');
        location.reload();
    }
}

function clearTransactions() {
    if (confirm('Bạn có chắc muốn xóa TOÀN BỘ lịch sử giao dịch?')) {
        APP_DATA.transactions = [];
        saveData();
        renderBudget();
        updateDashboard();
        showToast('Đã xóa sạch lịch sử giao dịch!', 'success');
    }
}

function resetApp() {
    const code = prompt('Nhập "DELETE" để xác nhận xóa toàn bộ dữ liệu:');
    if (code === 'DELETE') {
        localStorage.clear();
        location.reload();
    } else if (code !== null) {
        alert('Mã xác nhận không đúng!');
    }
}

function clearTransactions() {
    showDialog('confirm', 'Xóa toàn bộ lịch sử giao dịch?', () => {
        APP_DATA.transactions = [];
        saveData(); renderBudget(); updateDashboard();
        showToast('Đã xóa sạch giao dịch', 'success');
    });
}

function resetApp() {
    showDialog('confirm', '⚠️ NGUY HIỂM: Xóa TOÀN BỘ dữ liệu?', () => {
        APP_DATA.loans = []; APP_DATA.transactions = []; APP_DATA.goals = [];
        localStorage.removeItem('myfinances_data');
        localStorage.removeItem('myfinances_setup');
        saveData();
        showToast('Đã reset app!', 'success');
        setTimeout(() => location.reload(), 1000);
    });
}

// --- CORE APP ---
async function initApp() {
    if (!AUTH_TOKEN) return document.getElementById('auth-modal').classList.remove('hidden');
    document.getElementById('auth-modal').classList.add('hidden');

    try { // Load Local
        const saved = localStorage.getItem('myfinances_data');
        if (saved) Object.assign(APP_DATA, JSON.parse(saved));
    } catch (e) {}

    renderLoans(); renderBudget(); updateDashboard();

    try { // Load Cloud
        const res = await fetch(API_URL + '/data', { headers: { 'Authorization': 'Bearer ' + AUTH_TOKEN } });
        const json = await res.json();
        if (json.success && json.data) {
            Object.assign(APP_DATA, json.data);
            localStorage.setItem('myfinances_data', JSON.stringify(APP_DATA));
            renderLoans(); renderBudget(); updateDashboard();
            updateSyncStatus();
            showToast('Đã đồng bộ dữ liệu!', 'success');
        }
    } catch (e) {
        if (e.status === 401) logout(); 
    }

    if (!APP_DATA.transactions.length && !localStorage.getItem('myfinances_setup')) {
        document.getElementById('setup-wizard').classList.remove('hidden');
    }
    switchTab('dashboard');
}

function finishSetup() {
    const inp = document.getElementById('initBalance');
    const bal = inp ? Number(inp.value) : 0; // Fix lỗi null
    
    if (bal > 0) {
        APP_DATA.transactions.push({
            id: Date.now(), type: 'income', amount: bal,
            catId: 'salary', catName: 'Vốn đầu kỳ', icon: '💰',
            desc: 'Số dư ban đầu', date: new Date().toISOString()
        });
    }
    localStorage.setItem('myfinances_setup', 'true');
    saveData();
    document.getElementById('setup-wizard').classList.add('hidden');
    initApp();
}

// --- LOGIC: UI HELPERS ---
const CATS = {
    expense: [
        { id: 'live', icon: '🍜', name: 'Ăn uống/Sinh hoạt' },
        { id: 'move', icon: '🛵', name: 'Đi lại/Xăng xe' },
        { id: 'bill', icon: '⚡', name: 'Hóa đơn/Bắt buộc' },
        { id: 'debt', icon: '🏦', name: 'Trả nợ' },
        { id: 'stupid', icon: '🤡', name: 'Phí ngu/Bốc đồng' },
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
        id: Date.now(), type, amount, catId: cat.id, catName: cat.name, icon: cat.icon,
        desc: document.getElementById('transDesc').value || cat.name, date: new Date().toISOString()
    });
    saveData(); e.target.reset(); updateCategories(); renderBudget(); updateDashboard(); showToast(`Đã thêm: ${formatMoney(amount)}`, 'success');
}

function deleteTrans(id) {
    showDialog('confirm', 'Xóa giao dịch này?', () => {
        APP_DATA.transactions = APP_DATA.transactions.filter(t => t.id !== id);
        saveData(); renderBudget(); updateDashboard();
        showToast('Đã xóa');
    });
}

function handleAddGoal(e) {
    e.preventDefault();
    APP_DATA.goals.push({
        id: Date.now(), name: document.getElementById('goalName').value,
        target: Number(document.getElementById('goalTarget').value), saved: 0
    });
    saveData(); e.target.reset(); renderGoals(); showToast('Đã thêm mục tiêu');
}

function depositGoal(id, amount) {
    const g = APP_DATA.goals.find(g => g.id === id);
    if (g) { g.saved += amount; saveData(); renderGoals(); showToast(`Đã thêm: ${formatMoney(amount)}`); }
}

function deleteGoal(id) {
    if (confirm('Xóa mục tiêu?')) { APP_DATA.goals = APP_DATA.goals.filter(g => g.id !== id); saveData(); renderGoals(); }
}

function handleSaveLoan(e) {
    e.preventDefault();
    const id = document.getElementById('loanId').value;
    const loanData = {
        name: document.getElementById('loanName').value, code: document.getElementById('loanCode').value,
        startDate: document.getElementById('loanStart').value, day: Number(document.getElementById('loanDay').value),
        amount: Number(document.getElementById('loanAmount').value), rate: Number(document.getElementById('loanRate').value),
        term: Number(document.getElementById('loanTerm').value),
    };
    if (id) {
        const idx = APP_DATA.loans.findIndex(l => l.id == id);
        if (idx !== -1) APP_DATA.loans[idx] = { ...APP_DATA.loans[idx], ...loanData };
    } else {
        APP_DATA.loans.push({ id: Date.now(), paid: 0, date: new Date().toISOString(), ...loanData });
    }
    saveData(); closeModal(); renderLoans(); showToast('Đã lưu khoản vay');
}

function payDebt(id, name, amount) {
    showDialog('confirm', `Trả ${formatMoney(amount)} cho "${name}"?`, () => {
        APP_DATA.transactions.unshift({
            id: Date.now(), type: 'expense', amount: amount, catId: 'debt', catName: 'Trả nợ', icon: '🏦',
            desc: `Trả nợ: ${name}`, date: new Date().toISOString()
        });
        const loan = APP_DATA.loans.find(l => l.id === id);
        if (loan) loan.paid = (loan.paid || 0) + amount;
        saveData(); renderBudget(); renderLoans(); updateDashboard(); showToast('Đã thanh toán');
    });
}

function deleteLoan(id) {
    showDialog('confirm', 'Xóa khoản nợ?', () => {
        APP_DATA.loans = APP_DATA.loans.filter(l => l.id !== id);
        saveData(); renderLoans(); showToast('Đã xóa');
    });
}

// --- RENDER FUNCTIONS ---
function renderGoals() {
    const list = document.getElementById('goal-list'); if (!list) return;
    list.innerHTML = APP_DATA.goals.map(g => {
        const percent = Math.min(100, Math.round((g.saved / g.target) * 100));
        return `<div class="bg-white p-4 rounded-xl shadow-sm border border-slate-100 relative">
             <button onclick="deleteGoal(${g.id})" class="absolute top-2 right-2 text-slate-300 hover:text-red-500"><i class="fa-solid fa-trash"></i></button>
             <h3 class="font-bold text-slate-700">${g.name}</h3>
             <div class="text-xs text-slate-500 mb-2">Đã có: ${formatMoney(g.saved)} / ${formatMoney(g.target)}</div>
             <div class="w-full bg-slate-100 rounded-full h-2.5 mb-3"><div class="bg-indigo-600 h-2.5 rounded-full" style="width: ${percent}%"></div></div>
             <div class="flex gap-2">
                 <button onclick="depositGoal(${g.id}, 100000)" class="flex-1 bg-indigo-50 text-indigo-600 text-xs font-bold py-2 rounded-lg hover:bg-indigo-100">+100k</button>
                 <button onclick="depositGoal(${g.id}, 500000)" class="flex-1 bg-indigo-50 text-indigo-600 text-xs font-bold py-2 rounded-lg hover:bg-indigo-100">+500k</button>
             </div></div>`;
    }).join('');
}

function renderBudget() {
    const list = document.getElementById('transaction-list');
    let income = 0, expense = 0;
    if (document.getElementById('transCat') && document.getElementById('transCat').children.length === 0) updateCategories();
    if (list) {
        const keyword = (document.getElementById('searchTrans')?.value || '').toLowerCase();
        const filtered = APP_DATA.transactions.filter(t => t.desc.toLowerCase().includes(keyword) || (t.catName && t.catName.toLowerCase().includes(keyword)));
        list.innerHTML = filtered.map(t => {
            if (t.type === 'income') income += t.amount; else expense += t.amount;
            const isInc = t.type === 'income'; const icon = t.icon || (isInc ? '💰' : '💸');
            return `<div class="flex items-center bg-white p-3 rounded-xl shadow-sm border border-slate-100 mb-2">
                <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg ${isInc ? 'bg-green-100' : 'bg-orange-100'} mr-3">${icon}</div>
                <div class="flex-1 min-w-0"><div class="font-bold text-slate-800 truncate">${t.catName || t.desc}</div><div class="text-xs text-slate-400 truncate">${t.desc} • ${new Date(t.date).toLocaleDateString('vi-VN')}</div></div>
                <div class="text-right ml-2"><div class="font-bold ${isInc ? 'text-green-600' : 'text-slate-800'}">${isInc ? '+' : '-'}${formatMoney(t.amount)}</div>
                <div class="flex gap-2 justify-end mt-1"><button onclick="deleteTrans(${t.id})" class="text-xs text-slate-400 hover:text-red-500"><i class="fa-solid fa-trash"></i> Xóa</button></div></div>
            </div>`;
        }).join('') || '<div class="text-center text-slate-300 py-10">Chưa có giao dịch</div>';
    }
    const balance = income - expense;
    if(document.getElementById('wallet-balance')) document.getElementById('wallet-balance').innerText = formatMoney(balance);
    if(document.getElementById('total-income')) document.getElementById('total-income').innerText = formatMoney(income);
    if(document.getElementById('total-expense')) document.getElementById('total-expense').innerText = formatMoney(expense);
}

function getSummary() {
    let debt = 0, monthlyPay = 0, income = 0, expense = 0;
    APP_DATA.loans.forEach(l => {
        const r = l.rate / 100 / 12, n = l.term;
        const emi = (r === 0) ? (l.amount / n) : (l.amount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        debt += l.amount; monthlyPay += emi;
    });
    APP_DATA.transactions.forEach(t => { if (t.type === 'income') income += t.amount; else expense += t.amount; });
    return { debt, monthlyPay, income, expense, balance: income - expense };
}

let chartAsset = null, chartFlow = null;
function updateDashboard() {
    renderGoals(); const data = getSummary();
    const now = new Date(); const day = now.getDay() || 7;
    const startOfWeek = new Date(now); startOfWeek.setHours(0, 0, 0, 0); startOfWeek.setDate(now.getDate() - day + 1);
    const weeklySpent = APP_DATA.transactions.filter(t => t.type === 'expense' && new Date(t.date) >= startOfWeek).reduce((sum, t) => sum + t.amount, 0);
    
    if (document.getElementById('wallet-balance')) {
        document.getElementById('wallet-balance').innerHTML = `${formatMoney(data.balance)}<div class="text-xs font-normal opacity-70 mt-1">Ví Sống: ${formatMoney(data.balance * 0.5)} | Nợ: ${formatMoney(data.balance * 0.3)}</div>`;
        const expEl = document.getElementById('total-expense');
        if (expEl) expEl.parentElement.innerHTML = `<div class="text-xs opacity-80"><i class="fa-solid fa-calendar-week"></i> Chi tuần này</div><div class="font-bold text-lg text-orange-200">${formatMoney(weeklySpent)}</div>`;
        const bar = document.getElementById('weekly-bar');
        if (bar) { const pct = Math.min(100, (weeklySpent / 1500000) * 100); bar.style.width = `${pct}%`; bar.className = `h-full transition-all duration-500 ${pct > 90 ? 'bg-red-500' : 'bg-blue-600'}`; }
    }
    
    const ctx1 = document.getElementById('chartAssets'), ctx2 = document.getElementById('chartExpense');
    if (chartAsset) chartAsset.destroy(); if (chartFlow) chartFlow.destroy();
    if (ctx1) chartAsset = new Chart(ctx1, { type: 'bar', data: { labels: ['Ví', 'Nợ'], datasets: [{ label: 'VND', data: [data.balance, data.debt], backgroundColor: ['#3b82f6', '#ef4444'] }] }, options: { plugins: { legend: { display: false } } } });
    if (ctx2) chartFlow = new Chart(ctx2, { type: 'doughnut', data: { labels: ['Chi', 'Trả Nợ', 'Dư'], datasets: [{ data: [data.expense, Math.round(data.monthlyPay), Math.max(0, data.income - data.expense - data.monthlyPay)], backgroundColor: ['#f97316', '#ef4444', '#22c55e'] }] }, options: { cutout: '70%' } });
}

// --- UTILS ---
let debtStrategy = 'snowball';
function toggleStrategy() { debtStrategy = debtStrategy === 'snowball' ? 'avalanche' : 'snowball'; renderLoans(); showToast(`Đổi: ${debtStrategy}`); }
function renderLoans() {
    const list = document.getElementById('debt-list');
    let totalRemaining = 0, totalMonthly = 0;
    const loans = [...APP_DATA.loans].sort((a, b) => debtStrategy === 'snowball' ? (a.amount - (a.paid||0)) - (b.amount - (b.paid||0)) : b.rate - a.rate);
    const header = `<div class="flex justify-between items-center mb-4 bg-blue-50 p-3 rounded-lg"><div class="text-sm font-bold text-blue-800">${debtStrategy === 'snowball' ? 'Snowball' : 'Avalanche'}</div><button onclick="toggleStrategy()" class="text-xs border border-blue-200 px-2 py-1 rounded bg-white text-blue-600">Đổi</button></div>`;
    list.innerHTML = header + (loans.map(loan => {
        const r = loan.rate / 100 / 12, n = loan.term;
        const emi = (r === 0) ? (loan.amount / n) : (loan.amount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        const paid = loan.paid || 0, remaining = Math.max(0, loan.amount - paid);
        totalRemaining += remaining; totalMonthly += emi;
        const pct = Math.min(100, Math.round((paid / loan.amount) * 100));
        return `<div class="bg-white p-4 rounded-xl shadow-sm border ${remaining === 0 ? 'border-green-200 bg-green-50' : 'border-slate-100'} mb-3">
            <div class="flex justify-between items-start mb-2"><div><div class="font-bold text-slate-800 text-lg ${remaining === 0 ? 'line-through opacity-50' : ''}">${loan.name}</div><div class="text-xs text-slate-400 font-mono">HĐ: ${loan.code || '---'}</div></div>
            <div class="flex gap-1"><button onclick="openModal(${loan.id})" class="text-slate-300 hover:text-blue-500 p-1.5"><i class="fa-solid fa-pen"></i></button><button onclick="deleteLoan(${loan.id})" class="text-slate-300 hover:text-red-500 p-1.5"><i class="fa-solid fa-trash"></i></button></div></div>
            <div class="w-full bg-slate-100 rounded-full h-2.5 mb-2 overflow-hidden"><div class="bg-orange-500 h-2.5 rounded-full" style="width: ${pct}%"></div></div>
            <div class="flex justify-between items-end"><div class="text-xs text-slate-500"><div>Gốc: ${formatMoney(loan.amount)}</div><div>Đã trả: ${formatMoney(paid)}</div></div>
            <div class="text-right">${remaining > 0 ? `<button onclick="payDebt(${loan.id}, '${loan.name}', ${Math.round(emi)})" class="bg-blue-600 text-white text-sm font-bold px-3 py-1.5 rounded-lg">Trả ${formatMoney(Math.round(emi))}</button>` : '<span class="text-green-600 font-bold border border-green-600 px-2 py-1 rounded text-xs">ĐÃ TẤT TOÁN</span>'}</div></div>
        </div>`;
    }).join('') || '<div class="text-center text-slate-400 py-10">Chưa có khoản vay</div>');
    if (document.getElementById('total-debt')) document.getElementById('total-debt').innerText = formatMoney(totalRemaining);
    if (document.getElementById('monthly-pay')) document.getElementById('monthly-pay').innerText = formatMoney(Math.round(totalMonthly));
}

function showDialog(type, msg, callback, defaultVal = '') {
    const el = document.getElementById('custom-dialog');
    const inp = document.getElementById('dialog-input');
    const actions = document.getElementById('dialog-actions');
    if (!el) return alert(msg);
    el.classList.remove('hidden');
    document.getElementById('dialog-msg').innerText = msg;
    document.getElementById('dialog-title').innerText = type === 'prompt' ? "Nhập thông tin" : "Xác nhận";
    document.getElementById('dialog-icon').innerHTML = `<i class="fa-solid ${type === 'prompt' ? 'fa-pen-to-square' : 'fa-circle-question'} text-blue-500"></i>`;
    inp.classList.toggle('hidden', type !== 'prompt'); if (type === 'prompt') { inp.value = defaultVal; setTimeout(() => inp.focus(), 100); }
    let btns = `<button onclick="closeDialog()" class="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 font-bold hover:bg-slate-200">Hủy</button>`;
    btns += `<button id="dialog-yes" class="px-4 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30">Đồng ý</button>`;
    actions.innerHTML = btns;
    const yesBtn = document.getElementById('dialog-yes');
    if (yesBtn) yesBtn.onclick = () => { if (type === 'prompt' && !inp.value) return inp.focus(); callback(type === 'prompt' ? inp.value : true); closeDialog(); };
}
function closeDialog() { document.getElementById('custom-dialog').classList.add('hidden'); }
function formatMoney(num) { return num.toLocaleString('vi-VN') + ' ₫'; }
function showToast(msg, type = 'info') {
    const color = type === 'success' ? 'bg-green-600' : (type === 'error' ? 'bg-red-600' : 'bg-slate-800');
    const icon = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info');
    const box = document.createElement('div'); box.className = `p-3 rounded-lg shadow-lg text-white font-medium text-sm animate-bounce ${color}`;
    box.innerHTML = `<i class="fa-solid ${icon} mr-2"></i> ${msg}`; document.getElementById('toast-container').appendChild(box); setTimeout(() => box.remove(), 3000);
}
function openModal(editId = null) {
    const modal = document.getElementById('modal'); modal.classList.remove('hidden');
    if (editId) {
        const l = APP_DATA.loans.find(i => i.id === editId); document.getElementById('modal-title').innerText = "Cập nhật khoản vay";
        document.getElementById('loanId').value = l.id; document.getElementById('loanName').value = l.name; document.getElementById('loanCode').value = l.code || '';
        document.getElementById('loanStart').value = l.startDate || new Date().toISOString().split('T')[0]; document.getElementById('loanAmount').value = l.amount;
        document.getElementById('loanRate').value = l.rate; document.getElementById('loanTerm').value = l.term; document.getElementById('loanDay').value = l.day || 1;
    } else {
        document.getElementById('modal-title').innerText = "Thêm khoản vay mới"; document.querySelector('form').reset();
        document.getElementById('loanId').value = ''; document.getElementById('loanStart').value = new Date().toISOString().split('T')[0];
    }
}
function closeModal() { document.getElementById('modal').classList.add('hidden'); }
function switchTab(tabId) {
    if (tabId === 'account') { const data = getSummary(); if (document.getElementById('acc-app-balance')) document.getElementById('acc-app-balance').innerText = formatMoney(data.balance); }
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active')); document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(btn => { if (btn.dataset.target === tabId) { btn.classList.add('text-blue-600', 'bg-blue-50'); btn.classList.remove('text-slate-500'); } else { btn.classList.remove('text-blue-600', 'bg-blue-50'); btn.classList.add('text-slate-500'); } });
}
function exportCSV() {
    let csv = "data:text/csv;charset=utf-8,\uFEFFNgay,Loai,SoTien,DanhMuc,MoTa\n";
    APP_DATA.transactions.forEach(t => csv += `${new Date(t.date).toLocaleDateString('vi-VN')},${t.type},${t.amount},${t.catName},"${t.desc}"\n`);
    const link = document.createElement("a"); link.href = encodeURI(csv); link.download = "MyFinances_Report.csv"; document.body.appendChild(link); link.click();
}
function openReport() { document.getElementById('report-modal').classList.remove('hidden'); renderReportDetail(); }
function renderReportDetail() { /* Logic report đơn giản */ }

window.addEventListener('storage', (e) => { if (e.key === 'myfinances_data') { const saved = localStorage.getItem('myfinances_data'); if (saved) Object.assign(APP_DATA, JSON.parse(saved)); renderLoans(); renderBudget(); updateDashboard(); showToast('🔄 Đã đồng bộ từ tab khác!'); } });
document.addEventListener('DOMContentLoaded', initApp);