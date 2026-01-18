-- Bảng Users (Đã có, nhưng chỉnh lại cho chuẩn)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Giao dịch (Tách khỏi JSON)
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'income' hoặc 'expense'
    amount REAL NOT NULL,
    cat_id TEXT,
    cat_name TEXT,
    description TEXT,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Bảng Khoản vay
CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    rate REAL DEFAULT 0,
    term INTEGER DEFAULT 12,
    start_date TIMESTAMP,
    status TEXT DEFAULT 'active', -- 'active' hoặc 'paid'
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);