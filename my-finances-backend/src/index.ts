// PATCH_v2
import { AutoRouter, cors } from 'itty-router';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// PATCH_v2
export interface Env { my_finances_db: D1Database; JWT_SECRET: string; }

const { preflight, corsify } = cors({ origin: '*', allowMethods: 'GET, POST, PUT, DELETE, OPTIONS', allowHeaders: 'Content-Type, Authorization' });
const router = AutoRouter({ base: '/api', before: [preflight] });

const checkAuth = async (req: any, env: Env) => {
	const auth = req.headers.get('Authorization');
	if (!auth) throw new Error('Chưa đăng nhập');
	return jwt.verify(auth.replace('Bearer ', ''), env.JWT_SECRET);
};

router.post('/register', async (req, env: Env) => {
	try {
		const { email, password } = await req.json() as any;
		if (!email || !password) return new Response(JSON.stringify({ error: 'Thiếu thông tin' }), { status: 400 });
		const hash = await bcrypt.hash(password, 10);
		await env.my_finances_db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').bind(email, hash).run();
		return { success: true };
	} catch (e) { return new Response(JSON.stringify({ success: false, error: 'Email đã tồn tại' }), { status: 409 }); }
});

router.post('/login', async (req, env: Env) => {
	try {
		const { email, password } = await req.json() as any;
		const user: any = await env.my_finances_db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
		if (!user || !(await bcrypt.compare(password, user.password_hash))) return new Response(JSON.stringify({ success: false, error: 'Sai thông tin' }), { status: 401 });
		const token = jwt.sign({ id: user.id, email: user.email }, env.JWT_SECRET, { expiresIn: '7d' });
		return { success: true, token, user: { id: user.id, email: user.email } };
	} catch (e) { return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 }); }
});

// PATCH_v2
router.get('/data', async (req, env: Env) => {
	try {
		const user: any = await checkAuth(req, env);
		const rec: any = await env.my_finances_db.prepare('SELECT content, updated_at FROM user_data WHERE user_id = ?').bind(user.id).first();
		return { success: true, data: rec ? JSON.parse(rec.content) : null, version: rec ? rec.updated_at : 0 };
	} catch (e) { return new Response(JSON.stringify({ error: (e as Error).message }), { status: 401 }); }
});

// PATCH_v2
router.post('/data', async (req, env: Env) => {
	try {
		const user: any = await checkAuth(req, env);
		const { data } = await req.json() as any;
		await env.my_finances_db.prepare('INSERT INTO user_data (user_id, content) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET content = ?, updated_at = CURRENT_TIMESTAMP').bind(user.id, JSON.stringify(data), JSON.stringify(data)).run();
		return { success: true };
	} catch (e) { return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 }); }
});

export default { ...router, fetch: async (req: any, env: any) => router.fetch(req, env).then(corsify) };