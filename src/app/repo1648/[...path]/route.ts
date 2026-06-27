import type { NextRequest } from "next/server";

const GITHUB_REF = "main";

type ProxyRole = "readonly" | "readwrite";

interface ProxyUser {
	username: string;
	password: string;
	role: ProxyRole;
}

const READ_METHODS = new Set(["GET", "HEAD"]);
const WRITE_METHODS = new Set(["PUT"]);

function unauthorized(): Response {
	return new Response("Unauthorized", {
		status: 401,
		headers: { "WWW-Authenticate": 'Basic realm="Maven Proxy"' },
	});
}

function forbidden(): Response {
	return new Response("Forbidden", { status: 403 });
}

function parseBasicAuth(header: string | null): { username: string; password: string } | null {
	if (!header?.startsWith("Basic ")) return null;
	try {
		const decoded = atob(header.slice(6));
		const idx = decoded.indexOf(":");
		if (idx === -1) return null;
		return {
			username: decoded.slice(0, idx),
			password: decoded.slice(idx + 1),
		};
	} catch {
		return null;
	}
}

function loadUsers(raw: string | undefined): ProxyUser[] {
	if (!raw) return [];
	try {
		const json = atob(raw);
		return JSON.parse(json) as ProxyUser[];
	} catch {
		return [];
	}
}

function authenticate(
	authHeader: string | null,
	users: ProxyUser[],
): ProxyUser | null {
	const creds = parseBasicAuth(authHeader);
	if (!creds) return null;
	return (
		users.find(
			(u) => u.username === creds.username && u.password === creds.password,
		) ?? null
	);
}

function authorize(user: ProxyUser, method: string): boolean {
	if (READ_METHODS.has(method)) return true;
	if (WRITE_METHODS.has(method)) return user.role === "readwrite";
	return false;
}

function isPathAllowed(segments: string[]): boolean {
	if (segments.length < 2) return false;
	for (const seg of segments) {
		if (seg.startsWith(".")) return false;
	}
	return true;
}

function buildRawUrl(owner: string, repo: string, path: string): string {
	return `https://raw.githubusercontent.com/${owner}/${repo}/${GITHUB_REF}/${path}`;
}

function buildApiUrl(owner: string, repo: string, path: string): string {
	return `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

async function handleRead(
	request: NextRequest,
	path: string,
	githubToken: string,
	owner: string,
	repo: string,
): Promise<Response> {
	const upstream = new Request(buildRawUrl(owner, repo, path), {
		method: request.method,
		headers: {
			Authorization: `token ${githubToken}`,
			"User-Agent": "shinyrepowoker",
		},
	});

	const upstreamResp = await fetch(upstream);

	if (upstreamResp.status === 404) {
		return new Response("Not Found", { status: 404 });
	}
	if (!upstreamResp.ok) {
		return new Response(`Upstream error: ${upstreamResp.status}`, {
			status: 502,
		});
	}

	const headers = new Headers();
	for (const key of [
		"Content-Type",
		"Content-Length",
		"ETag",
		"Last-Modified",
	]) {
		const val = upstreamResp.headers.get(key);
		if (val) headers.set(key, val);
	}

	return new Response(upstreamResp.body, {
		status: upstreamResp.status,
		headers,
	});
}

async function handlePut(
	request: NextRequest,
	path: string,
	githubToken: string,
	owner: string,
	repo: string,
): Promise<Response> {
	const body = await request.arrayBuffer();
	const content = arrayBufferToBase64(body);

	const apiResp = await fetch(buildApiUrl(owner, repo, path), {
		method: "PUT",
		headers: {
			Authorization: `token ${githubToken}`,
			Accept: "application/vnd.github+json",
			"User-Agent": "shinyrepowoker",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			message: `deploy: ${path}`,
			content,
			branch: GITHUB_REF,
		}),
	});

	if (apiResp.status === 201) {
		return new Response("Created", { status: 201 });
	}
	if (apiResp.status === 409) {
		return new Response("Conflict: file already exists", { status: 409 });
	}
	const text = await apiResp.text();
	return new Response(`Upload failed: ${apiResp.status} ${text}`, {
		status: 502,
	});
}

async function handleRequest(
	request: NextRequest,
	params: Promise<{ path: string[] }>,
): Promise<Response> {
	const resolved = await params;
	const pathSegments = resolved.path;
	const path = (pathSegments ?? []).join("/");
	const method = request.method.toUpperCase();

	if (!isPathAllowed(pathSegments)) {
		return new Response("Forbidden path", { status: 403 });
	}

	const githubToken = process.env.GITHUB_TOKEN;
	const owner = process.env.GITHUB_OWNER;
	const repo = process.env.GITHUB_REPO;
	const proxyUsersRaw = process.env.PROXY_USERS;

	if (!githubToken || !owner || !repo || !proxyUsersRaw) {
		return new Response("Server misconfigured: missing environment variables", {
			status: 500,
		});
	}

	const users = loadUsers(proxyUsersRaw);
	const user = authenticate(request.headers.get("Authorization"), users);
	if (!user) return unauthorized();

	if (!authorize(user, method)) return forbidden();

	if (READ_METHODS.has(method)) {
		return handleRead(request, path, githubToken, owner, repo);
	}
	if (WRITE_METHODS.has(method)) {
		return handlePut(request, path, githubToken, owner, repo);
	}
	return new Response("Method Not Allowed", { status: 405 });
}

export async function GET(
	request: NextRequest,
	context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
	return handleRequest(request, context.params);
}

export async function HEAD(
	request: NextRequest,
	context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
	return handleRequest(request, context.params);
}

export async function PUT(
	request: NextRequest,
	context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
	return handleRequest(request, context.params);
}
