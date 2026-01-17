// PATCH_v2
import { AutoRouter, cors } from 'itty-router';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export interface Env { my_finances_db: D1Database; }

// 1. Cấu hình CORS
const { preflight, corsify } = cors({
    origin: '*',
    allowMethods: 'GET, POST, PUT, DELETE, OPTIONS',
    allowHeaders: 'Content-Type, Authorization',
});

const router = AutoRouter({ base: '/api', before: [preflight] });
const SECRET_KEY = "day-la-bi-mat-cua-ban"; 

// --- MIDDLEWARE ---
const checkAuth = async (req: any) => {
	const auth = req.headers.get('Authorization');
	if (!auth) throw new Error('Chưa đăng nhập');
	return jwt.verify(auth.replace('Bearer ', ''), SECRET_KEY);
};

// --- AUTH ---
router.post('/register', async (req, env: Env) => {
	try {
		const { email, password } = await req.json() as any;
		if (!email || !password) return new Response(JSON.stringify({ error: 'Thiếu thông tin' }), { status: 400 });
		const salt = await bcrypt.genSalt(10);
		const hash = await bcrypt.hash(password, salt);
		await env.my_finances_db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').bind(email, hash).run();
		return { success: true, message: 'Đăng ký thành công!' };
	} catch (e) { return new Response(JSON.stringify({ success: false, error: 'Email đã tồn tại' }), { status: 409 }); }
});

router.post('/login', async (req, env: Env) => {
	try {
		const { email, password } = await req.json() as any;
		const user: any = await env.my_finances_db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
		if (!user || !(await bcrypt.compare(password, user.password_hash))) return new Response(JSON.stringify({ success: false, error: 'Sai tài khoản/mật khẩu' }), { status: 401 });
		
		const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '7d' });
		return { success: true, token, user: { id: user.id, email: user.email } };
	} catch (e) { return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 }); }
});

// --- DATA SYNC ---
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
		await env.my_finances_db.prepare('INSERT INTO user_data (user_id, content) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET content = ?, updated_at = CURRENT_TIMESTAMP').bind(user.id, JSON.stringify(data), JSON.stringify(data)).run();
		return { success: true };
	} catch (e) { return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 }); }
});

export default { ...router, fetch: async (req: any, env: any) => router.fetch(req, env).then(corsify) };