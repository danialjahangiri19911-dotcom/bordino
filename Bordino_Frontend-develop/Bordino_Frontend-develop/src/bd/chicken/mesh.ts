/**
 * The approved chicken artwork, animated as one texture deformed on a 28×28 WebGL mesh (wing,
 * legs, tail, breathing; a continuous 640 ms hop). Ported from the Chicken-Game-Design package
 * (source/chicken-mesh.js) without changes to the shaders or the motion. Returns null when WebGL
 * is unavailable: the plain artwork with CSS motion stays visible then.
 */
export interface ChickenMesh {
	canvas: HTMLCanvasElement;
	update: (phase: string, moving: boolean, hidden: boolean) => void;
	destroy: () => void;
}

const VERTEX = `attribute vec2 position;uniform vec4 motion;uniform float flattened;varying vec2 uv;
 float weight(vec2 p,vec2 center,vec2 radius){vec2 d=(p-center)/radius;return exp(-dot(d,d)*2.0);}
 vec2 turn(vec2 p,vec2 pivot,float angle){float c=cos(angle),s=sin(angle);vec2 d=p-pivot;return vec2(c*d.x-s*d.y,s*d.x+c*d.y)+pivot;}
 void main(){vec2 p=position,q=p;
 if(flattened<0.5){
 vec2 wd=(p-vec2(.67,.66))/vec2(.26,.24);
 float wing=exp(-dot(wd,wd)*.65)*smoothstep(.43,.56,p.x)*smoothstep(.43,.55,p.y)*(1.0-smoothstep(.80,.90,p.y));
 q+=(turn(p,vec2(.53,.55),motion.x)-p)*wing;
 q+=vec2(.075,-.025)*wing*motion.y;
 float front=weight(p,vec2(.37,.91),vec2(.17,.11));
 float back=weight(p,vec2(.63,.92),vec2(.17,.11));
 q+=vec2(-.035,-.055)*motion.y*front+vec2(.035,-.045)*motion.y*back;
 float tail=weight(p,vec2(.84,.51),vec2(.16,.27));q.x+=tail*motion.z*.012;q.y-=tail*motion.y*.025;
 float body=weight(p,vec2(.48,.65),vec2(.5,.4));q.y-=body*motion.w*.006;q.x+=(p.x-.5)*body*motion.w*.008;
 }
 vec2 display=q*.84+vec2(.08,.02+flattened*.12);gl_Position=vec4(display.x*2.0-1.0,1.0-display.y*2.0,0.0,1.0);
 uv=p*vec2(.25,.5)+vec2(flattened*.75,flattened*.5);}`;
const FRAGMENT = `precision mediump float;uniform sampler2D artwork;varying vec2 uv;void main(){gl_FragColor=texture2D(artwork,uv);}`;
const N = 28;

export function createChickenMesh(canvas: HTMLCanvasElement, url: string): ChickenMesh | null {
	if (typeof window === "undefined" || !window.requestAnimationFrame || !canvas.getContext) return null;
	let gl: WebGLRenderingContext | null = null;
	try {
		gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
	} catch {
		return null;
	}
	if (!gl) return null;
	const g = gl;
	const shader = (type: number, source: string) => {
		const s = g.createShader(type)!;
		g.shaderSource(s, source);
		g.compileShader(s);
		if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw Error(g.getShaderInfoLog(s) ?? "shader");
		return s;
	};
	let program: WebGLProgram;
	let buffer: WebGLBuffer;
	let texture: WebGLTexture;
	try {
		program = g.createProgram()!;
		const vs = shader(g.VERTEX_SHADER, VERTEX);
		const fs = shader(g.FRAGMENT_SHADER, FRAGMENT);
		g.attachShader(program, vs);
		g.attachShader(program, fs);
		g.linkProgram(program);
		g.deleteShader(vs);
		g.deleteShader(fs);
		if (!g.getProgramParameter(program, g.LINK_STATUS)) throw Error(g.getProgramInfoLog(program) ?? "link");
		g.useProgram(program);
		const points: number[] = [];
		for (let y = 0; y < N; y++)
			for (let x = 0; x < N; x++) {
				const a = x / N, b = y / N, c = (x + 1) / N, d = (y + 1) / N;
				points.push(a, b, c, b, a, d, a, d, c, b, c, d);
			}
		buffer = g.createBuffer()!;
		g.bindBuffer(g.ARRAY_BUFFER, buffer);
		g.bufferData(g.ARRAY_BUFFER, new Float32Array(points), g.STATIC_DRAW);
		const at = g.getAttribLocation(program, "position");
		g.enableVertexAttribArray(at);
		g.vertexAttribPointer(at, 2, g.FLOAT, false, 0, 0);
		texture = g.createTexture()!;
		g.bindTexture(g.TEXTURE_2D, texture);
		g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
		g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
		g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
		g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
		g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
		g.enable(g.BLEND);
		g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
	} catch {
		g.getExtension("WEBGL_lose_context")?.loseContext();
		return null;
	}
	const uMotion = g.getUniformLocation(program, "motion");
	const uFlat = g.getUniformLocation(program, "flattened");
	let phase = "ready";
	let start = 0;
	let enabled = true;
	let paused = false;
	let ready = false;
	let dead = false;
	let raf = 0;
	const time = () => performance.now();
	function draw(now: number) {
		if (dead || !ready) return;
		const elapsed = now - start;
		const p = Math.max(0, Math.min(1, elapsed / 640));
		const jump = phase === "jumping";
		const flat = phase === "lost" || (phase === "colliding" && (elapsed >= 380 || !enabled));
		const lift = jump && enabled ? Math.sin(p * Math.PI) : 0;
		const breath = enabled && !flat ? Math.sin(now * 0.003) : 0;
		const flap = enabled && !flat ? (jump ? -1.15 * Math.pow(lift, 0.75) * (1 + 0.08 * Math.sin(p * Math.PI * 4)) : 0.055 * Math.sin(now * 0.004)) : 0;
		g.viewport(0, 0, 256, 256);
		g.clearColor(0, 0, 0, 0);
		g.clear(g.COLOR_BUFFER_BIT);
		g.useProgram(program);
		g.uniform4f(uMotion, flap, lift, breath, breath);
		g.uniform1f(uFlat, flat ? 1 : 0);
		g.drawArrays(g.TRIANGLES, 0, N * N * 6);
		canvas.dataset.pose = flat ? "flat" : "original";
		if (enabled && !paused && !flat) raf = requestAnimationFrame(draw);
		else raf = 0;
	}
	function refresh() {
		cancelAnimationFrame(raf);
		raf = 0;
		if (!paused) draw(time());
	}
	const lostContext = () => {
		ready = false;
		cancelAnimationFrame(raf);
		canvas.classList.remove("ck-mesh-ready");
	};
	canvas.addEventListener("webglcontextlost", lostContext);
	const img = new Image();
	img.onload = () => {
		if (dead) return;
		try {
			g.bindTexture(g.TEXTURE_2D, texture);
			g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, img);
			ready = true;
			canvas.classList.add("ck-mesh-ready");
			refresh();
		} catch {
			canvas.classList.remove("ck-mesh-ready");
		}
	};
	img.onerror = () => canvas.classList.remove("ck-mesh-ready");
	img.src = url;
	return {
		canvas,
		update(next, moving, hidden) {
			if (next !== phase) {
				phase = next;
				start = time();
			}
			enabled = moving;
			paused = hidden;
			refresh();
		},
		destroy() {
			dead = true;
			cancelAnimationFrame(raf);
			canvas.removeEventListener("webglcontextlost", lostContext);
			img.onload = img.onerror = null;
			g.deleteTexture(texture);
			g.deleteBuffer(buffer);
			g.deleteProgram(program);
			g.getExtension("WEBGL_lose_context")?.loseContext();
		},
	};
}
