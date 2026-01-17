// PATCH_v2
import { AutoRouter, cors } from 'itty-router';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// 1. Định nghĩa Môi trường (Env)
export interface Env {
	my_finances_db: D1Database;
}

// 2. Cấu hình CORS (Cho phép mọi nguồn)
const { preflight, corsify } = cors({
    origin: '*',
    allowMethods: 'GET, POST, PUT, DELETE, OPTIONS',
    allowHeaders: 'Content-Type, Authorization',
});

// 3. Khởi tạo Router (Thêm preflight vào trước để xử lý OPTIONS)
const router = AutoRouter({
	base: '/api',
	before: [preflight], 
});

const SECRET_KEY = "day-la-bi-mat-cua-ban"; // Khóa bí mật để tạo Token (Sau này nên đưa vào .dev.vars)

// --- API ĐĂNG KÝ (Register) ---
router.post('/register', async (req, env: Env) => {
	try {
		const { email, password } = await req.json() as any;

		if (!email || !password) return new Response(JSON.stringify({ error: 'Thiếu email hoặc pass' }), { status: 400 });

		// Mã hóa mật khẩu
		const salt = await bcrypt.genSalt(10);
		const hash = await bcrypt.hash(password, salt);

		// Lưu vào Database
		const res = await env.my_finances_db.prepare(
			'INSERT INTO users (email, password_hash) VALUES (?, ?)'
		).bind(email, hash).run();

		if (res.success) {
			return { success: true, message: 'Đăng ký thành công!' };
		} else {
			throw new Error("DB Error");
		}
	} catch (e) {
		// Bắt lỗi nếu Email đã tồn tại (do ràng buộc UNIQUE trong Database)
		return new Response(JSON.stringify({ success: false, error: 'Email đã tồn tại hoặc lỗi server' }), { status: 409 });
	}
});

// --- API ĐĂNG NHẬP (Login) ---
router.post('/login', async (req, env: Env) => {
	try {
		const { email, password } = await req.json() as any;

		// Tìm user trong DB
		const user: any = await env.my_finances_db.prepare(
			'SELECT * FROM users WHERE email = ?'
		).bind(email).first();

		// Kiểm tra pass (So sánh pass nhập vào với pass đã mã hóa trong DB)
		if (!user || !(await bcrypt.compare(password, user.password_hash))) {
			return new Response(JSON.stringify({ success: false, error: 'Sai tài khoản hoặc mật khẩu' }), { status: 401 });
		}

		// Tạo Token (Vé vào cửa)
		const token = jwt.sign(
			{ id: user.id, email: user.email }, 
			SECRET_KEY, 
			{ expiresIn: '7d' } // Token hết hạn sau 7 ngày
		);

		return { success: true, token, user: { id: user.id, email: user.email } };
	} catch (e) {
		return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
	}
});

// PATCH_v2
// --- MIDDLEWARE & DATA API ---
const checkAuth = async (req: any) => {
	const auth = req.headers.get('Authorization');
	if (!auth) throw new Error('Chưa đăng nhập');
	return jwt.verify(auth.replace('Bearer ', ''), SECRET_KEY);
};

router.get('/data', async (req, env: Env) => {
	try {
		const user: any = await checkAuth(req);
		const rec: any = await env.my_finances_db.prepare('SELECT content FROM user_data WHERE user_id = ?').bind(user.id).first();
		return { success: true, data: rec ? JSON.parse(rec.content) : null };
	} catch (e) { return new Response(JSON.stringify({ error: (e as Error).message }), { status: 401 }); }
});

router.post('/data', async (req, env: Env) => {
	try {
		const user: any = await checkAuth(req);
		const { data } = await req.json() as any;
		await env.my_finances_db.prepare(
			'INSERT INTO user_data (user_id, content) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET content = ?, updated_at = CURRENT_TIMESTAMP'
		).bind(user.id, JSON.stringify(data), JSON.stringify(data)).run();
		return { success: true };
	} catch (e) { return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 }); }
});

// PATCH_v2
// --- XUẤT WORKER (Bọc thêm corsify để gắn header vào response) ---
export default { 
    ...router, 
    fetch: async (req: any, env: any) => router.fetch(req, env).then(corsify)
};