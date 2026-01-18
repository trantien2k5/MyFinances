
// PATCH_v2
// --- CONFIG & STATE ---
const $ = document.querySelector.bind(document);
const KEY = 'transactions_v2';

// 1. Utils (Khai báo đầu tiên để tránh lỗi Hoisting)
const formatMoney = (num) => {
    return num.toLocaleString('vi-VN') + ' ₫';
};

// 2. State
let transactions = JSON.parse(localStorage.getItem(KEY)) || [];
let budget = +localStorage.getItem('budget_limit') || 5000000; 
let editId = null; 
let currentType = 'expense'; // expense | income | transfer
let chartInstance = null;

// 3. Config
const CAT_ICONS = {
    food: { icon: 'fa-burger', color: 'text-orange-500', bg: 'bg-orange-100' },
    shopping: { icon: 'fa-shirt', color: 'text-blue-500', bg: 'bg-blue-100' },
    transport: { icon: 'fa-motorcycle', color: 'text-purple-500', bg: 'bg-purple-100' },
    bill: { icon: 'fa-file-invoice-dollar', color: 'text-red-500', bg: 'bg-red-100' },
    salary: { icon: 'fa-sack-dollar', color: 'text-emerald-500', bg: 'bg-emerald-100' },
    other: { icon: 'fa-star', color: 'text-gray-500', bg: 'bg-gray-100' },
    transfer: { icon: 'fa-right-left', color: 'text-blue-500', bg: 'bg-blue-100' }
};

const WALLETS = {
    cash: { name: 'Tiền mặt', icon: 'fa-money-bill-wave', color: 'text-green-500', bg: 'bg-green-100' },
    bank: { name: 'Ngân hàng', icon: 'fa-university', color: 'text-blue-500', bg: 'bg-blue-100' },
    ewallet: { name: 'Ví điện tử', icon: 'fa-qrcode', color: 'text-purple-500', bg: 'bg-purple-100' }
};
// PATCH_v2
// (Deleted duplicate config block)

// PATCH_v2
// --- CORE FUNCTIONS (Logic) ---

// PATCH_v2
let save = () => {
    localStorage.setItem(KEY, JSON.stringify(transactions));
    render(); 
    updateChart();
    renderWallet(); 
    renderWalletList(); 
};

const saveBudget = () => {
    const val = +$('#budget-input').value;
    if (val > 0) {
        budget = val;
        localStorage.setItem('budget_limit', budget);
        renderWallet();
        alert('Đã cập nhật ngân sách!');
        $('#budget-input').value = '';
    }
};

const renderWallet = () => {
    // Tính tổng chi tiêu tháng này (Expenses only)
    const currentMonth = new Date().toISOString().slice(0, 7);
    const spent = transactions
        .filter(t => t.amount < 0 && t.id && new Date(t.id).toISOString().startsWith(currentMonth))
        .reduce((acc, t) => acc + Math.abs(t.amount), 0);

    const percent = Math.min((spent / budget) * 100, 100);
    const remain = budget - spent;

    $('#budget-spent').innerText = formatMoney(spent);
    $('#budget-limit').innerText = formatMoney(budget);
    $('#budget-progress').style.width = `${percent}%`;
    $('#budget-progress').className = `h-3 rounded-full transition-all duration-500 ${percent > 90 ? 'bg-red-500' : 'bg-indigo-600'}`;
    
    $('#budget-msg').innerHTML = remain >= 0 
        ? `Còn lại: <span class="text-emerald-600 font-bold">${formatMoney(remain)}</span>` 
        : `Vượt hạn mức: <span class="text-red-500 font-bold">${formatMoney(Math.abs(remain))}</span>`;
};

// PATCH_v2
// PATCH_v2
// PATCH_v2
// PATCH_v2
// Helper UI Functions
window.setTxType = (type) => {
    currentType = type;
    const types = ['expense', 'income', 'transfer'];
    const colors = { expense: 'text-rose-500', income: 'text-emerald-500', transfer: 'text-blue-500' };
    const bgColors = { expense: 'bg-rose-500', income: 'bg-emerald-500', transfer: 'bg-blue-500' };
    const btnText = { expense: 'Chi Tiền Ngay', income: 'Thu Tiền Ngay', transfer: 'Chuyển Tiền Ngay' };

    types.forEach(t => {
        $(`#type-${t}`).className = t === type 
            ? `flex-1 text-center py-1 rounded-md text-sm font-bold cursor-pointer transition-all bg-white shadow-sm ${colors[t]}`
            : `flex-1 text-center py-1 rounded-md text-sm font-bold cursor-pointer transition-all text-gray-500 hover:text-gray-700`;
    });

    $('#amount').className = `w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 font-bold text-2xl text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 ${colors[type]}`;
    $('#btn-submit').className = `w-full text-white font-bold py-3 rounded-lg shadow-md transition-colors ${bgColors[type]} hover:opacity-90`;
    $('#btn-submit').innerText = btnText[type];

    // PATCH_v2
    // Transfer Logic UI
    const dest = $('#transfer-dest');
    const arrow = $('#arrow-icon');
    const cat = $('#category');
    
    if (type === 'transfer') {
        dest.classList.remove('hidden');
        arrow.classList.remove('hidden');
        cat.parentElement.classList.add('opacity-0', 'pointer-events-none'); 
        $('#label-from').innerText = 'Từ Ví';
    } else {
        dest.classList.add('hidden');
        arrow.classList.add('hidden');
        cat.parentElement.classList.remove('opacity-0', 'pointer-events-none');
        $('#label-from').innerText = 'Nguồn Tiền';
    }
};

window.setAmount = (val) => { $('#amount').value = val; };

// Set Default Date Today
$('#date').valueAsDate = new Date();

// CORE: ADD TRANSACTION
const addTransaction = (e) => {
    e.preventDefault();
    const text = $('#text').value.trim();
    let rawAmount = +$('#amount').value;
    const category = $('#category').value;
    const wallet = $('#wallet').value;
    const toWallet = $('#to-wallet').value;
    const dateVal = $('#date').value || new Date().toISOString().slice(0, 10);
    const dateId = new Date(dateVal).getTime(); // Use selected date timestamp

    if (!rawAmount || rawAmount <= 0) return alert('Vui lòng nhập số tiền!');

    let finalAmount = rawAmount;
    if (currentType === 'expense' || currentType === 'transfer') finalAmount = -rawAmount;

    // Auto Note for Transfer
    let finalNote = text;
    if (currentType === 'transfer' && !text) {
        finalNote = `Chuyển: ${WALLETS[wallet].name} ➡ ${WALLETS[toWallet].name}`;
    } else if (!text) {
        finalNote = 'Không có ghi chú';
    }

    const transactionData = { 
        id: editId || dateId + Math.floor(Math.random() * 1000), // Unique ID based on date
        text: finalNote, 
        amount: finalAmount, 
        category: currentType === 'transfer' ? 'transfer' : category, 
        wallet: wallet,
        type: currentType, 
        to_wallet: currentType === 'transfer' ? toWallet : null,
        created_at: dateVal // Lưu ngày hiển thị
    };

    if (editId) {
        const index = transactions.findIndex(t => t.id === editId);
        if (index !== -1) transactions[index] = transactionData;
        editId = null;
        $('#btn-submit').innerText = 'Thêm Giao Dịch';
    } else {
        transactions.push(transactionData);
    }
    
    // Reset Form
    $('#text').value = '';
    $('#amount').value = '';
    save();
};

// Sửa lại hàm fill form khi Edit để chọn đúng Ví cũ
window.editTransaction = (id) => {
    const item = transactions.find(t => t.id === id);
    if (!item) return;

    editId = id;
    $('#text').value = item.text;
    $('#amount').value = item.amount;
    $('#category').value = item.category || 'other';
    $('#wallet').value = item.wallet || 'cash'; // Fill wallet
    
    $('#btn-submit').innerText = 'Lưu Thay Đổi';
    $('#btn-submit').classList.add('bg-green-600', 'hover:bg-green-700');
    switchTab('home');
    $('#amount').focus();
};

// PATCH_v2
// (Deleted duplicate function)

// Hàm vẽ biểu đồ (Chart.js)
const updateChart = () => {
    const ctx = document.getElementById('expenseChart');
    if (!ctx) return;

    // Lọc ra các khoản CHI (số âm) để vẽ
    const expenses = transactions.filter(t => t.amount < 0);
    
    // Gom nhóm theo category
    const dataMap = {};
    expenses.forEach(t => {
        if (!dataMap[t.category]) dataMap[t.category] = 0;
        dataMap[t.category] += Math.abs(t.amount);
    });

    const labels = Object.keys(dataMap).map(k => k.toUpperCase());
    const data = Object.values(dataMap);

    if (chartInstance) chartInstance.destroy(); // Xóa chart cũ

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#f97316', '#3b82f6', '#a855f7', '#ef4444', '#10b981', '#6b7280'],
                borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
};


// --- NAVIGATION LOGIC ---
const views = ['home', 'report', 'wallet', 'me'];

function switchTab(tabName) {
    // 1. Ẩn tất cả view
    views.forEach(v => {
        const el = $(`#view-${v}`);
        if (el) el.classList.add('hidden');
    });

    // 2. Hiện view được chọn
    const target = $(`#view-${tabName}`);
    if (target) target.classList.remove('hidden');

    // 3. Logic riêng từng tab
    if (tabName === 'home') {
        $('#form').classList.remove('hidden');
    } else {
        $('#form').classList.add('hidden'); // Các tab khác ẩn form nhập
    }

    if (tabName === 'report') updateChart();

    // 4. Update style active cho Nav Item
    document.querySelectorAll('.nav-item').forEach(item => {
        const icon = item.querySelector('i');
        const text = item; // text color nằm ở parent
        
        if (item.dataset.tab === tabName) {
            text.classList.add('text-indigo-600');
            text.classList.remove('text-gray-400');
        } else {
            text.classList.remove('text-indigo-600');
            text.classList.add('text-gray-400');
        }
    });
}

// Event Listeners cho Tab
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => switchTab(item.dataset.tab));
});

// PATCH_v2
// Event Listener cho nút Plus (+)
$('#btn-plus').addEventListener('click', () => {
    switchTab('home'); 
    $('#amount').focus(); 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
});

// --- SETTINGS LOGIC ---
const toggleDarkMode = () => {
    document.body.classList.toggle('bg-gray-900'); // Demo simple dark bg
    document.body.classList.toggle('text-white');
    alert('Chế độ tối đang được cập nhật thêm CSS...'); 
};

// PATCH_v2
const resetApp = () => {
    const code = prompt('CẢNH BÁO: Dữ liệu sẽ mất vĩnh viễn!\nNhập chữ "XOA" để xác nhận:');
    if(code === 'XOA') {
        localStorage.clear();
        location.reload();
    } else if (code !== null) {
        alert('Mã xác nhận không đúng.');
    }
};

// Hook renderRecent vào save
const originalSave = save;
save = () => {
    localStorage.setItem(KEY, JSON.stringify(transactions));
    render(); 
    updateChart();
    renderWallet(); 
    renderWalletList(); 
    renderRecent(); // New hook
};

const editName = () => {
    const name = prompt('Nhập tên hiển thị:', $('#user-name-display').innerText);
    if(name) {
        $('#user-name-display').innerText = name;
        localStorage.setItem('user_name', name);
    }
};

// --- INIT APP ---
// Load tên user
const savedName = localStorage.getItem('user_name');
if(savedName && $('#user-name-display')) $('#user-name-display').innerText = savedName;

// PATCH_v2
// (Code block removed - Fixed in Init section)

// Xóa giao dịch (Re-declared cleanly)
const removeTransaction = (id) => {
    if(confirm('Bạn có chắc muốn xóa giao dịch này?')) {
        transactions = transactions.filter(t => t.id !== id);
        save();
    }
};


// PATCH_v2
// PATCH_v2
// PATCH_v2
// PATCH_v2
// --- RENDER FUNCTIONS (Giao diện) ---
const renderRecent = () => {
    const list = $('#recent-list');
    const block = $('#recent-block');
    if (!list || !block) return;

    if (transactions.length === 0) {
        block.classList.add('hidden');
        return;
    }

    block.classList.remove('hidden');
    // Lấy 3 giao dịch mới nhất
    const recent = [...transactions].reverse().slice(0, 3);
    
    list.innerHTML = recent.map(t => {
        const catConfig = CAT_ICONS[t.category] || CAT_ICONS['other'];
        const isExpense = t.amount < 0;
        return `
            <li class="bg-white p-3 rounded-lg border border-gray-100 flex justify-between items-center shadow-sm">
                <div class="flex items-center">
                    <div class="${catConfig.bg} w-8 h-8 rounded-full flex items-center justify-center mr-3 text-xs">
                        <i class="fas ${catConfig.icon} ${catConfig.color}"></i>
                    </div>
                    <div>
                        <p class="font-bold text-sm text-gray-700">${t.text}</p>
                        <p class="text-[10px] text-gray-400">${new Date(t.created_at || t.id).toLocaleDateString('vi-VN')}</p>
                    </div>
                </div>
                <span class="font-bold text-sm ${isExpense ? 'text-rose-600' : 'text-emerald-600'}">
                    ${t.amount < 0 ? '-' : '+'}${formatMoney(Math.abs(t.amount))}
                </span>
            </li>
        `;
    }).join('');
};

const renderWalletList = () => {
    const container = $('#wallet-list');
    if (!container) return;

    // 1. Tính số dư từng ví
    const walletBalances = {};
    Object.keys(WALLETS).forEach(key => walletBalances[key] = 0);

    transactions.forEach(t => {
        // Logic ví nguồn
        const wKey = t.wallet || 'cash';
        if (walletBalances[wKey] !== undefined) {
            walletBalances[wKey] += t.amount;
        }

        // Logic ví đích (Nếu là chuyển khoản)
        if (t.type === 'transfer' && t.to_wallet && walletBalances[t.to_wallet] !== undefined) {
            walletBalances[t.to_wallet] += Math.abs(t.amount); // Cộng tiền vào ví đích
        }
    });

    // 2. Render HTML
    container.innerHTML = Object.keys(WALLETS).map(key => {
        const wConfig = WALLETS[key];
        const balance = walletBalances[key];
        
        return `
            <div class="min-w-[140px] bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center items-center transform transition hover:scale-105">
                <div class="w-10 h-10 rounded-full ${wConfig.bg} text-${wConfig.color.split('-')[1]}-600 flex items-center justify-center mb-2">
                    <i class="fas ${wConfig.icon}"></i>
                </div>
                <span class="text-xs text-gray-500 font-medium">${wConfig.name}</span>
                <span class="text-sm font-bold text-gray-800 mt-1">${formatMoney(balance)}</span>
            </div>
        `;
    }).join('');
};

const render = () => {
    const list = $('#list');
    const search = $('#search').value.toLowerCase();
    const filterDate = $('#filter-date').value; // format: YYYY-MM

    // 1. Lọc dữ liệu
    const filtered = transactions.filter(t => {
        const matchText = t.text.toLowerCase().includes(search);
        const matchDate = filterDate ? new Date(t.id).toISOString().slice(0, 7) === filterDate : true;
        return matchText && matchDate;
    });

    // 2. Tính toán (Trên danh sách đã lọc)
    const amounts = filtered.map(t => t.amount);
    const total = amounts.reduce((acc, item) => acc + item, 0);
    const income = amounts.filter(item => item > 0).reduce((acc, item) => acc + item, 0);
    const expense = amounts.filter(item => item < 0).reduce((acc, item) => acc + item, 0) * -1;

    // Hiển thị số liệu
    $('#balance').innerText = formatMoney(total);
    $('#money-plus').innerText = `+${formatMoney(income)}`;
    $('#money-minus').innerText = `-${formatMoney(expense)}`;

    // 3. Hiển thị danh sách
    if (filtered.length === 0) {
        list.innerHTML = '<li class="text-center text-gray-400 text-sm py-4">Không tìm thấy giao dịch nào.</li>';
        return;
    }

    list.innerHTML = filtered.map(t => {
        const sign = t.amount < 0 ? '-' : '+';
        const catConfig = CAT_ICONS[t.category] || CAT_ICONS['other'];
        const isExpense = t.amount < 0;

        return `
            <li class="bg-white p-3 rounded-lg shadow-sm flex justify-between items-center border-r-4 ${isExpense ? 'border-rose-500' : 'border-emerald-500'} group relative">
                <div class="flex items-center">
                    <div class="${catConfig.bg} p-3 rounded-full mr-3 w-10 h-10 flex items-center justify-center">
                        <i class="fas ${catConfig.icon} ${catConfig.color}"></i>
                    </div>
                    <div>
                        <p class="font-medium text-gray-800">${t.text}</p>
                        <p class="text-xs text-gray-400">
                            ${new Date(t.id).toLocaleDateString('vi-VN')} • <span class="capitalize">${t.category || 'Khác'}</span>
                        </p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-bold ${isExpense ? 'text-rose-600' : 'text-emerald-600'}">
                        ${sign}${formatMoney(Math.abs(t.amount))}
                    </p>
                </div>
                
                <div class="absolute -right-2 -top-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="window.editTransaction(${t.id})" class="bg-blue-500 text-white w-6 h-6 rounded-full shadow-md flex items-center justify-center" title="Sửa"><i class="fas fa-pen text-xs"></i></button>
                    <button onclick="removeTransaction(${t.id})" class="bg-red-500 text-white w-6 h-6 rounded-full shadow-md flex items-center justify-center" title="Xóa">&times;</button>
                </div>
            </li>
        `;
    }).join('');
};

// PATCH_v2
// --- DATA TOOLS ---
const exportData = () => {
    const dataStr = JSON.stringify(transactions, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_finance_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
};

const importData = (input) => {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (Array.isArray(data)) {
                if(confirm(`Bạn có muốn thay thế dữ liệu hiện tại bằng ${data.length} giao dịch từ file backup?`)) {
                    transactions = data;
                    save();
                    alert('Khôi phục dữ liệu thành công!');
                }
            } else {
                alert('File backup không hợp lệ!');
            }
        } catch (err) {
            alert('Lỗi đọc file: ' + err.message);
        }
    };
    reader.readAsText(file);
    input.value = ''; // Reset input
};

// PATCH_v2
// --- INIT & HOOKS ---

// Hook: Cập nhật data khi chuyển Tab
const originalSwitch = switchTab;
switchTab = (tabName) => {
    originalSwitch(tabName);
    if (tabName === 'wallet') renderWallet(); // Tab Ngân sách
    if (tabName === 'home') renderWalletList(); // Tab Home (Danh sách ví)
};

// App Start
$('#form').addEventListener('submit', addTransaction);

// Initial Render
render(); 
updateChart();
renderWallet();
renderWalletList();

console.log("App Ready v1.2 - Wallet Supported");
// --- END ---