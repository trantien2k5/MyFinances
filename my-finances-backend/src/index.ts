import { AutoRouter } from 'itty-router';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// 1. Định nghĩa Môi trường (Env) - Khai báo biến Database
export interface Env {
	my_finances_db: D1Database;
}

// 2. Khởi tạo Router (Có sẵn xử lý CORS để trình duyệt không chặn)
const router = AutoRouter({
	base: '/api', // Mọi API sẽ bắt đầu bằng /api
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

// --- XUẤT WORKER ---
export default { ...router };