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


function mergeData(cloudData) {
    if (!cloudData) return;
    const mergeArr = (local, cloud) => {
        const map = new Map();
        (cloud || []).forEach(i => map.set(i.id, i));
        (local || []).forEach(i => map.set(i.id, i)); // Local ưu tiên
        return Array.from(map.values());
    };
    APP_DATA.transactions = mergeArr(APP_DATA.transactions, cloudData.transactions);
    APP_DATA.loans = mergeArr(APP_DATA.loans, cloudData.loans);
    APP_DATA.goals = mergeArr(APP_DATA.goals, cloudData.goals);
}

async function saveData() {
    localStorage.setItem('myfinances_data', JSON.stringify(APP_DATA));
    if (!AUTH_TOKEN) return;
    try {
        const check = await fetch(API_URL + '/data', { headers: { 'Authorization': 'Bearer ' + AUTH_TOKEN } });
        const json = await check.json();
        if (json.success && json.data) mergeData(json.data); // Pull & Merge

        await fetch(API_URL + '/data', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AUTH_TOKEN },
            body: JSON.stringify({ data: APP_DATA })
        });
        console.log("Sync Smart ✅"); updateSyncStatus();
    } catch (e) { console.warn("Sync failed ❌", e); }
}

function updateSyncStatus() {
    const el = document.getElementById('sync-status');
    if (el) {
        el.innerText = `Đã đồng bộ lúc ${new Date().toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}`;
        el.parentElement.classList.remove('hidden');
    }
}




function logout() {
    showDialog('confirm', 'Đăng xuất khỏi thiết bị này?', () => {
        localStorage.removeItem('myfinances_token');
        localStorage.removeItem('myfinances_data');
        location.reload();
    });
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

    // 1. Load Local FIRST (Fast UI)
    try {
        const saved = localStorage.getItem('myfinances_data');
        if (saved) Object.assign(APP_DATA, JSON.parse(saved));
    } catch (e) {}
    renderLoans(); renderBudget(); updateDashboard(); switchTab('dashboard');

    // 2. Sync Cloud (Background)
    try {
        const res = await fetch(API_URL + '/data', { headers: { 'Authorization': 'Bearer ' + AUTH_TOKEN } });
        const json = await res.json();
        
        const localTime = localStorage.getItem('myfinances_last_sync') || '0';
        const cloudTime = json.version || '0';

        if (json.success && json.data) {
            if (cloudTime > localTime) {
                // Cloud mới hơn -> Update Local
                Object.assign(APP_DATA, json.data);
                localStorage.setItem('myfinances_data', JSON.stringify(APP_DATA));
                localStorage.setItem('myfinances_last_sync', cloudTime);
                renderLoans(); renderBudget(); updateDashboard();
                showToast('⬇️ Đã tải dữ liệu mới từ Cloud', 'success');
            } else {
                console.log("✅ Local is up-to-date");
            }
            updateSyncStatus();
        }
    } catch (e) { console.warn("Offline mode or Sync error", e); if (e.status === 401) logout(); }

    if (!APP_DATA.transactions.length && !localStorage.getItem('myfinances_setup')) document.getElementById('setup-wizard').classList.remove('hidden');
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



function setType(type) {
    document.getElementById('transType').value = type;
    const isExp = type === 'expense';
    document.getElementById('btn-expense').className = `flex-1 py-2 rounded-lg font-bold text-sm transition-all shadow ${isExp ? 'bg-white text-red-600' : 'text-slate-500 hover:bg-white/50'}`;
    document.getElementById('btn-income').className = `flex-1 py-2 rounded-lg font-bold text-sm transition-all shadow ${!isExp ? 'bg-white text-green-600' : 'text-slate-500 hover:bg-white/50'}`;
    updateCategories();
}

function addQuick(amount) {
    const el = document.getElementById('transAmount');
    let current = Number(el.value.replace(/\D/g, '')) || 0;
    el.value = (current + amount).toLocaleString('vi-VN');
    onAmountInput(el);
}

function onAmountInput(el) {
    let val = Number(el.value.replace(/\D/g, ''));
    el.value = val ? val.toLocaleString('vi-VN') : '';
    const btn = document.getElementById('btn-save');
    btn.disabled = !val;
    if (val) {
        btn.classList.remove('bg-slate-200', 'text-slate-400', 'cursor-not-allowed');
        btn.classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700', 'shadow-lg');
    } else {
        btn.classList.add('bg-slate-200', 'text-slate-400', 'cursor-not-allowed');
        btn.classList.remove('bg-blue-600', 'text-white', 'hover:bg-blue-700', 'shadow-lg');
    }
}

function updateCategories() {
    const type = document.getElementById('transType').value;
    const grid = document.getElementById('cat-grid');
    grid.innerHTML = CATS[type].map(c => 
        `<div onclick="selectCat('${c.id}')" id="cat-${c.id}" class="cat-item cursor-pointer p-2 rounded-xl border text-center hover:bg-blue-50 transition-all select-none active:scale-95">
            <div class="text-2xl mb-1">${c.icon}</div><div class="text-[10px] font-bold text-slate-600 truncate">${c.name}</div>
        </div>`
    ).join('');
    // Auto select first but don't focus description yet
    if(CATS[type].length > 0) selectCat(CATS[type][0].id);
}


const PLACEHOLDERS = {
    'live': 'Cơm trưa, cafe, trà sữa...', 'move': 'Đổ xăng, gửi xe, Grab...', 'bill': 'Điện, nước, net...', 
    'debt': 'Trả nợ ai, khoản nào...', 'salary': 'Lương tháng 10, thưởng...', 'bonus': 'Lì xì, trúng số...'
};

function selectCat(id) {
    document.getElementById('transCat').value = id;
    document.querySelectorAll('.cat-item').forEach(el => {
        el.classList.remove('bg-blue-100', 'border-blue-500', 'ring-1', 'ring-blue-500');
        el.classList.add('border-slate-100');
    });
    const el = document.getElementById(`cat-${id}`);
    if(el) {
        el.classList.remove('border-slate-100');
        el.classList.add('bg-blue-100', 'border-blue-500', 'ring-1', 'ring-blue-500');
    }
    document.getElementById('transDesc').placeholder = PLACEHOLDERS[id] || 'Ghi chú thêm...';
}

// Gọi hàm này trong initApp() và switchTab()
function initBudgetForm() {
    document.getElementById('transDate').value = new Date().toISOString().split('T')[0];
    setType('expense');
    onAmountInput(document.getElementById('transAmount')); // Reset button state
}


// (Deleted dead code)

function handleAddTransaction(e) {
    e.preventDefault();
    const type = document.getElementById('transType').value;
    const catId = document.getElementById('transCat').value;
    const cat = CATS[type].find(c => c.id === catId) || CATS[type][0];
    const amountRaw = document.getElementById('transAmount').value.replace(/\./g, ''); // Remove dots
    const amount = Number(amountRaw);

    if (!amount) return showToast('Vui lòng nhập số tiền', 'error');

    APP_DATA.transactions.unshift({
        id: Date.now(), type, amount, catId: cat.id, catName: cat.name, icon: cat.icon,
        desc: document.getElementById('transDesc').value || cat.name, date: new Date().toISOString()
    });
    saveData(); e.target.reset(); updateCategories(); renderBudget(); updateDashboard(); showToast(`Đã thêm: ${formatMoney(amount)}`, 'success');
    document.getElementById('transAmount').focus(); // Keep focus for fast input
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



function initLoanForm() {
    const sel = document.getElementById('loanDay');
    if(sel && sel.children.length === 0) {
        sel.innerHTML = Array.from({length: 31}, (_, i) => `<option value="${i+1}">Ngày ${i+1}</option>`).join('');
    }
}




// (Deleted unused calcLoanPreview function)


function handleSaveLoan(e) {
    e.preventDefault();
    const id = document.getElementById('loanId').value;
    const loanData = {
        name: document.getElementById('loanName').value, 
        code: document.getElementById('loanCode').value,
        startDate: document.getElementById('loanStart').value || new Date().toISOString().split('T')[0],
        day: Number(document.getElementById('loanDay').value),
        amount: Number(document.getElementById('loanAmount').value.replace(/\D/g, '')),
        
        // PATCH_v2
        monthlyPayment: Number(document.getElementById('loanMonthly').value.replace(/\D/g, '')),
        totalInterest: Number(document.getElementById('loanInterest').value.replace(/\D/g, '')),
    };
    if (id) {
        const idx = APP_DATA.loans.findIndex(l => l.id == id);
        if (idx !== -1) {
            // Cho phép sửa Paid khi edit
            const manualPaid = Number(document.getElementById('loanPaid').value.replace(/\D/g, ''));
            APP_DATA.loans[idx] = { ...APP_DATA.loans[idx], ...loanData, paid: manualPaid };
        }
    } else {
        APP_DATA.loans.push({ id: Date.now(), paid: 0, ...loanData });
    }
    saveData(); closeModal(); renderLoans(); showToast('Đã lưu khoản vay', 'success');
}


// (Deleted monkey-patch)


// (Đã xóa block code bị lặp và gây lỗi logic handleSaveLoan cũ tại đây)


// (Deleted monkey-patch - Logic moved to main function below)

// PATCH_v2
function payDebt(id, name, defaultAmount) {
    showDialog('prompt', `Nhập số tiền thực trả cho "${name}":`, (val) => {
        const amount = Number(val.replace(/\D/g, ''));
        if (!amount) return;

        APP_DATA.transactions.unshift({
            id: Date.now(), type: 'expense', amount: amount, catId: 'debt', catName: 'Trả nợ', icon: '🏦',
            desc: `Trả nợ: ${name}`, date: new Date().toISOString()
        });
        
        const loan = APP_DATA.loans.find(l => l.id === id);
        if (loan) loan.paid = (loan.paid || 0) + amount;
        
        saveData(); renderBudget(); renderLoans(); updateDashboard(); showToast(`Đã trả: ${formatMoney(amount)}`, 'success');
    }, defaultAmount.toLocaleString('vi-VN'));
}

function deleteLoan(id) {
    showDialog('confirm', 'Xóa khoản nợ?', () => {
        APP_DATA.loans = APP_DATA.loans.filter(l => l.id !== id);
        saveData(); renderLoans(); showToast('Đã xóa');
    });
}


function handleAdjustBalance() {
    const realBal = Number(document.getElementById('realBalance').value);
    if (!realBal && realBal !== 0) return showToast('Nhập số dư thực tế!', 'error');
    
    const curBal = getSummary().balance;
    const diff = realBal - curBal;
    
    if (diff === 0) return showToast('Số dư đã khớp!');
    
    APP_DATA.transactions.unshift({
        id: Date.now(), type: diff > 0 ? 'income' : 'expense',
        amount: Math.abs(diff), catId: 'other', catName: 'Điều chỉnh số dư',
        icon: '⚖️', desc: 'Cập nhật số dư thực tế', date: new Date().toISOString()
    });
    
    saveData(); renderBudget(); updateDashboard();
    document.getElementById('realBalance').value = '';
    showToast(`Đã điều chỉnh: ${formatMoney(diff)}`, 'success');
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
    const BUDGET = 1500000;
    const now = new Date(); const dayOfWeek = now.getDay() || 7; // 1 (Mon) -> 7 (Sun)
    const daysLeft = 8 - dayOfWeek;
    const startOfWeek = new Date(now); startOfWeek.setHours(0, 0, 0, 0); startOfWeek.setDate(now.getDate() - dayOfWeek + 1);
    
    // 1. Weekly Logic
    const weeklyTrans = APP_DATA.transactions.filter(t => t.type === 'expense' && new Date(t.date) >= startOfWeek);
    const weeklySpent = weeklyTrans.reduce((sum, t) => sum + t.amount, 0);
    const remaining = BUDGET - weeklySpent;
    const dailyAvg = remaining > 0 ? Math.round(remaining / daysLeft) : 0;
    
    const pct = Math.min(100, (weeklySpent / BUDGET) * 100);
    if(document.getElementById('weekly-bar')) {
        document.getElementById('weekly-spent').innerText = formatMoney(weeklySpent);
        document.getElementById('weekly-remain').innerText = formatMoney(remaining);
        document.getElementById('weekly-remain').className = `text-2xl font-bold ${remaining < 0 ? 'text-red-500' : 'text-blue-600'}`;
        document.getElementById('daily-avg').innerText = remaining > 0 ? `TB: ${formatMoney(dailyAvg)}/ngày` : 'Hết ngân sách!';
        const bar = document.getElementById('weekly-bar');
        bar.style.width = `${pct}%`;
        bar.className = `h-2 rounded-full transition-all duration-500 ${pct > 90 ? 'bg-red-500' : 'bg-blue-600'}`;
    }

    
    // 2. Insight & Header (Stats Logic)
    const todaySpent = APP_DATA.transactions.filter(t => t.type === 'expense' && new Date(t.date).toDateString() === now.toDateString()).reduce((s, t) => s + t.amount, 0);
    
    // Tính thêm tháng này
    const monthlySpent = APP_DATA.transactions
        .filter(t => t.type === 'expense' && new Date(t.date).getMonth() === now.getMonth() && new Date(t.date).getFullYear() === now.getFullYear())
        .reduce((sum, t) => sum + t.amount, 0);

    // Render Stats Grid (Rút gọn ' ₫' để số thoáng hơn)
    if(document.getElementById('stat-today')) {
        document.getElementById('stat-today').innerText = formatMoney(todaySpent).replace(' ₫','');
        document.getElementById('stat-week').innerText = formatMoney(weeklySpent).replace(' ₫','');
        document.getElementById('stat-month').innerText = formatMoney(monthlySpent).replace(' ₫','');
    }

    document.getElementById('daily-insight').innerText = todaySpent > 0 
        ? `📉 Hôm nay bạn đã chi ${formatMoney(todaySpent)}` 
        : '✨ Hôm nay chưa tiêu gì. Tuyệt vời!';
    
    const topCat = Object.entries(weeklyTrans.reduce((acc, t) => { acc[t.catName] = (acc[t.catName]||0) + t.amount; return acc; }, {}))
                         .sort((a,b) => b[1] - a[1])[0];
    document.getElementById('health-msg').innerHTML = topCat 
        ? `Tuần này chi nhiều nhất vào <b>${topCat[0]}</b> (${formatMoney(topCat[1])}). ${pct > 80 ? '⚠️ Sắp lố ngân sách!' : '✅ Vẫn trong tầm kiểm soát.'}`
        : 'Chưa có đủ dữ liệu để phân tích chi tiêu tuần này.';

    // 3. Charts Logic
    // Asset vs Debt
    const hasDebt = data.debt > 0;
    document.getElementById('chart-asset-container').classList.toggle('hidden', !hasDebt);
    document.getElementById('no-debt-view').classList.toggle('hidden', hasDebt);
    if (!hasDebt) {
        document.getElementById('dash-asset').innerText = formatMoney(data.balance);
    } else {
        const ctx1 = document.getElementById('chartAssets');
        if (chartAsset) chartAsset.destroy();
        if (ctx1) chartAsset = new Chart(ctx1, { type: 'bar', data: { labels: ['Tài sản', 'Nợ'], datasets: [{ label: 'VND', data: [data.balance, data.debt], backgroundColor: ['#3b82f6', '#ef4444'], borderRadius: 8 }] }, options: { plugins: { legend: { display: false } }, maintainAspectRatio: false } });
    }

    // Allocation
    const savings = Math.max(0, data.income - data.expense - data.monthlyPay);
    const totalFlow = data.expense + data.monthlyPay + savings;
    const pExp = totalFlow ? Math.round(data.expense/totalFlow*100) : 0;
    const pDebt = totalFlow ? Math.round(data.monthlyPay/totalFlow*100) : 0;
    const pSave = totalFlow ? Math.round(savings/totalFlow*100) : 0;

    const ctx2 = document.getElementById('chartExpense');
    if (chartFlow) chartFlow.destroy();
    if (ctx2) chartFlow = new Chart(ctx2, { type: 'doughnut', data: { labels: ['Chi', 'Nợ', 'Dư'], datasets: [{ data: [data.expense, Math.round(data.monthlyPay), savings], backgroundColor: ['#f97316', '#ef4444', '#22c55e'], borderWidth: 0 }] }, options: { cutout: '75%', plugins: { legend: { display: false } }, maintainAspectRatio: false } });
    
    document.getElementById('expense-legend').innerHTML = `
        <div class="flex justify-between items-center"><div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-orange-500"></span> Chi tiêu</div><div class="font-bold">${formatMoney(data.expense)} (${pExp}%)</div></div>
        <div class="flex justify-between items-center"><div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-red-500"></span> Trả nợ</div><div class="font-bold">${formatMoney(Math.round(data.monthlyPay))} (${pDebt}%)</div></div>
        <div class="flex justify-between items-center"><div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-green-500"></span> Dư ra</div><div class="font-bold">${formatMoney(savings)} (${pSave}%)</div></div>
    `;
    
    if(document.getElementById('wallet-balance')) document.getElementById('wallet-balance').innerText = formatMoney(data.balance);
    if(document.getElementById('total-income')) document.getElementById('total-income').innerText = formatMoney(data.income);
    if(document.getElementById('total-expense')) document.getElementById('total-expense').innerText = formatMoney(data.expense);
}

// --- UTILS ---
let debtStrategy = 'snowball';
function toggleStrategy() { debtStrategy = debtStrategy === 'snowball' ? 'avalanche' : 'snowball'; renderLoans(); showToast(`Đổi: ${debtStrategy}`); }

// PATCH_v2
function renderLoans() {
    const list = document.getElementById('debt-list');
    const empty = document.getElementById('debt-empty');
    if (APP_DATA.loans.length === 0) {
        list.innerHTML = ''; list.classList.add('hidden');
        if(empty) empty.classList.remove('hidden'); 
        if(document.getElementById('total-debt')) document.getElementById('total-debt').innerText = '0 ₫';
        return;
    }
    list.classList.remove('hidden'); if(empty) empty.classList.add('hidden');
    
    let totalRemaining = 0, totalMonthly = 0, closestDate = null;
    const today = new Date().getDate();

    // Sort: Ưu tiên ngày trả nợ sắp đến (Ngày nhỏ -> Lớn)
    const loans = [...APP_DATA.loans].sort((a, b) => {
        if (a.amount <= (a.paid||0)) return 1; // Đã trả xong đẩy xuống đáy
        if (b.amount <= (b.paid||0)) return -1;
        
        // Tính khoảng cách ngày đến hạn so với hôm nay
        let distA = a.day - today; if (distA < 0) distA += 30;
        let distB = b.day - today; if (distB < 0) distB += 30;
        return distA - distB;
    });

    list.innerHTML = loans.map(loan => {
        const monthly = loan.monthlyPayment || 0;
        const paid = loan.paid || 0, remaining = Math.max(0, loan.amount - paid);
        totalRemaining += remaining; totalMonthly += remaining > 0 ? monthly : 0;
        if (remaining > 0) { let d = loan.day; if (!closestDate || (d >= today && d < closestDate)) closestDate = d; }
        const pct = Math.min(100, Math.round((paid / loan.amount) * 100));

        return `<div class="bg-white p-4 rounded-xl shadow-sm border ${remaining === 0 ? 'border-green-200 bg-green-50 opacity-70' : 'border-slate-100 relative'}">
            ${remaining > 0 ? `<div class="absolute top-0 right-0 ${loan.day === today ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-blue-50 text-blue-600'} text-[10px] font-bold px-3 py-1 rounded-bl-xl border-l border-b">Hạn: Ngày ${loan.day}</div>` : ''}
            
            <div class="flex justify-between items-end mb-3 mt-1">
                <div class="flex-1">
                    <div class="font-bold text-slate-800 text-lg ${remaining === 0 ? 'line-through' : ''}">${loan.name}</div>
                    <div class="text-xs text-slate-500 font-bold mt-1">Còn lại: <span class="text-red-600 text-base">${formatMoney(remaining)}</span></div>
                </div>
                <button onclick="openModal(${loan.id})" class="text-slate-300 hover:text-blue-500 p-2"><i class="fa-solid fa-pen-to-square"></i></button>
            </div>
            
            <div class="w-full bg-slate-100 rounded-full h-1.5 mb-3 overflow-hidden"><div class="${remaining === 0 ? 'bg-green-500' : 'bg-blue-600'} h-1.5 rounded-full" style="width: ${pct}%"></div></div>
            
            ${remaining > 0 ? `
            <div class="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-dashed border-slate-200">
                <div class="text-xs font-bold text-slate-500">Mỗi tháng: ${formatMoney(monthly)}</div>
                <button onclick="payDebt(${loan.id}, '${loan.name}', ${remaining < monthly ? remaining : monthly})" class="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm hover:bg-blue-700 active:scale-95">Trả ngay</button>
            </div>` 
            : '<div class="text-center text-xs font-bold text-green-600 uppercase py-2 border-t border-dashed">✅ Đã tất toán</div>'}
        </div>`;
    }).join('');

    document.getElementById('total-debt').innerText = formatMoney(totalRemaining);
    document.getElementById('monthly-pay').innerText = formatMoney(totalMonthly);
    document.getElementById('next-due-date').innerText = closestDate ? `Ngày ${closestDate}` : '---';
}

// PATCH_v2
function showDialog(type, msg, callback, defaultVal = '') {
    const el = document.getElementById('custom-dialog');
    const wrap = document.getElementById('dialog-input-wrapper');
    const inp = document.getElementById('dialog-input');
    
    el.classList.remove('hidden');
    document.getElementById('dialog-msg').innerText = msg;
    document.getElementById('dialog-title').innerText = type === 'prompt' ? "Thanh toán" : "Xác nhận";
    document.getElementById('dialog-icon').innerHTML = `<i class="fa-solid ${type === 'prompt' ? 'fa-pen-to-square' : 'fa-circle-question'} text-blue-500"></i>`;
    
    wrap.classList.toggle('hidden', type !== 'prompt');
    if (type === 'prompt') { inp.value = defaultVal; setTimeout(() => { inp.focus(); inp.select(); }, 100); }
    
    const actions = document.getElementById('dialog-actions');
    actions.innerHTML = `
        <button onclick="closeDialog()" class="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 font-bold hover:bg-slate-200">Hủy</button>
        <button id="dialog-yes" class="px-4 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg">Xác nhận</button>
    `;
    document.getElementById('dialog-yes').onclick = () => { 
        if (type === 'prompt' && !inp.value) return inp.focus(); 
        callback(type === 'prompt' ? inp.value : true); 
        closeDialog(); 
    };
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
    initLoanForm(); 
    const modal = document.getElementById('modal'); modal.classList.remove('hidden');
    if (editId) {
        const l = APP_DATA.loans.find(i => i.id === editId); document.getElementById('modal-title').innerText = "Cập nhật khoản vay";
        document.getElementById('loanId').value = l.id; document.getElementById('loanName').value = l.name; document.getElementById('loanCode').value = l.code || '';
        document.getElementById('loanStart').value = l.startDate || new Date().toISOString().split('T')[0]; 
        
        // PATCH_v2
        document.getElementById('loanAmount').value = l.amount.toLocaleString('vi-VN');
        document.getElementById('loanPaid').value = (l.paid || 0).toLocaleString('vi-VN');
        document.getElementById('loanMonthly').value = (l.monthlyPayment || 0).toLocaleString('vi-VN');
        document.getElementById('loanInterest').value = (l.totalInterest || 0).toLocaleString('vi-VN');
        document.getElementById('loanDay').value = l.day || 1;
        
        document.getElementById('field-paid').classList.remove('hidden');
        document.getElementById('btn-delete-loan').classList.remove('hidden');
    } else {
        document.getElementById('modal-title').innerText = "Thêm khoản vay mới"; document.querySelector('form').reset();
        document.getElementById('loanId').value = ''; document.getElementById('loanStart').value = new Date().toISOString().split('T')[0];
        document.getElementById('field-paid').classList.add('hidden');
        document.getElementById('btn-delete-loan').classList.add('hidden');
    }
}

function deleteLoanFromModal() {
    const id = Number(document.getElementById('loanId').value);
    if(id) { closeModal(); deleteLoan(id); }
}

// --- SECURITY UTILS ---
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
function closeModal() { document.getElementById('modal').classList.add('hidden'); }


function switchTab(tabId) {
    // 1. FAB Control
    const fab = document.querySelector('button[onclick="openQuickAdd()"]');
    if(fab) fab.classList.toggle('hidden', tabId === 'account');

    // 2. Account Logic
    if (tabId === 'account') { 
        const data = getSummary(); 
        if (document.getElementById('acc-app-balance')) document.getElementById('acc-app-balance').innerText = formatMoney(data.balance);
        
        // Populate User Info
        try {
            const token = localStorage.getItem('myfinances_token');
            const payload = token ? JSON.parse(atob(token.split('.')[1])) : { email: 'Guest' };
            document.getElementById('acc-email').innerText = payload.email;
            document.getElementById('acc-tx-count').innerText = APP_DATA.transactions.length;
        } catch(e) { document.getElementById('acc-email').innerText = 'Offline User'; }
    }

    // 3. UI Switch
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active')); 
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(btn => { 
        if (btn.dataset.target === tabId) { btn.classList.add('text-blue-600', 'bg-blue-50'); btn.classList.remove('text-slate-500'); } 
        else { btn.classList.remove('text-blue-600', 'bg-blue-50'); btn.classList.add('text-slate-500'); } 
    });
}



function toggleQuickMenu() { document.getElementById('quick-menu').classList.toggle('hidden'); }

function handleQuickAction(type) {
    if (type === 'loan') {
        openModal();
    } else {
        switchTab('budget');
        setType(type);
        openQuickAdd(); // Gọi hàm focus input
    }
}

function openQuickAdd() {
    // Hàm này giờ chỉ thuần túy focus vào ô nhập tiền
    switchTab('budget');
    setTimeout(() => {
        const el = document.getElementById('transAmount');
        if(el) { el.focus(); window.scrollTo({ top: el.offsetTop - 100, behavior: 'smooth' }); }
    }, 100);
}

function formatRealBal(el) {
    let val = el.value.replace(/\D/g, '');
    el.value = val ? parseInt(val).toLocaleString('vi-VN') : '';
    const btn = document.getElementById('btn-sync-bal');
    btn.disabled = !val;
    btn.className = val ? "bg-blue-600 text-white px-5 rounded-xl font-bold transition-all shadow-lg hover:bg-blue-700 active:scale-95" 
                        : "bg-slate-200 text-slate-400 px-5 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed";
}


// (Deleted duplicate)
function exportCSV() {
    let csv = "data:text/csv;charset=utf-8,\uFEFFNgay,Loai,SoTien,DanhMuc,MoTa\n";
    APP_DATA.transactions.forEach(t => csv += `${new Date(t.date).toLocaleDateString('vi-VN')},${t.type},${t.amount},${t.catName},"${t.desc}"\n`);
    const link = document.createElement("a"); link.href = encodeURI(csv); link.download = "MyFinances_Report.csv"; document.body.appendChild(link); link.click();
}
function openReport() { document.getElementById('report-modal').classList.remove('hidden'); renderReportDetail(); }
function renderReportDetail() { /* Logic report đơn giản */ }

window.addEventListener('storage', (e) => { if (e.key === 'myfinances_data') { const saved = localStorage.getItem('myfinances_data'); if (saved) Object.assign(APP_DATA, JSON.parse(saved)); renderLoans(); renderBudget(); updateDashboard(); showToast('🔄 Đã đồng bộ từ tab khác!'); } });
document.addEventListener('DOMContentLoaded', initApp);