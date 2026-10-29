import L from 'leaflet'
import { getSprite, SETTLEMENT_MIN_PX, SETTLEMENT_SCALE, SPRITE_LOGICAL, type SettlementType } from '../settlements3d'

/**
 * WebGL-слой провинций в духе Paradox: каждый пиксель берёт номер провинции из текстуры карты провинций,
 * цвет — из маленькой таблицы (меняется мгновенно при смене даты или режима), границы и свечение
 * считаются в шейдере сравнением соседних пикселей.
 */

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`

const FRAG = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uProv;    // RGBA: R*256+G = номер провинции, A = суша
uniform sampler2D uLut;     // строки: 0 цвет, 1 ключ группы + выделение, 2 ключ владельца
uniform vec2 uOrigin;       // логические координаты левого верхнего угла холста
uniform float uScale;       // логических единиц на пиксель холста
uniform vec2 uMapSize;      // логический размер карты
uniform vec2 uRaster;       // размер растра провинций
uniform float uHeight;      // высота холста в пикселях
uniform float uOpacity;     // сила заливки
uniform float uBorders;     // 1 — рисовать границы
uniform float uProvLines;   // 0..1 — тонкие линии провинций
uniform float uGlowPx;      // ширина свечения у границы, пиксели экрана
uniform float uPixel;       // пикселей холста на пиксель экрана
out vec4 outColor;

int idAt(vec2 rp) {
  ivec2 ip = ivec2(clamp(rp, vec2(0.0), uRaster - 1.0));
  vec4 t = texelFetch(uProv, ip, 0);
  if (t.a < 0.5) return 0;
  return int(t.r * 255.0 + 0.5) * 256 + int(t.g * 255.0 + 0.5);
}
vec4 lut(int id, int row) { return texelFetch(uLut, ivec2(id, row), 0); }
float keyOf(int id, int row) { if (id == 0) return -1.0; vec4 v = lut(id, row); return v.r * 255.0 + v.g * 255.0 * 256.0; }

// «голосование» соседних точек: принадлежность пикселя считается по кругу вокруг него —
// границы получаются плавными кривыми без ступенек растра, а доля голосов даёт расстояние до границы
const int NS = 19;
const vec2 DISK[19] = vec2[19](
  vec2(0.0, 0.0),
  vec2(0.5, 0.0), vec2(0.25, 0.433), vec2(-0.25, 0.433), vec2(-0.5, 0.0), vec2(-0.25, -0.433), vec2(0.25, -0.433),
  vec2(1.0, 0.0), vec2(0.866, 0.5), vec2(0.5, 0.866), vec2(0.0, 1.0), vec2(-0.5, 0.866), vec2(-0.866, 0.5),
  vec2(-1.0, 0.0), vec2(-0.866, -0.5), vec2(-0.5, -0.866), vec2(0.0, -1.0), vec2(0.5, -0.866), vec2(0.866, -0.5)
);
float wOf(int i) { return i == 0 ? 1.6 : i < 7 ? 1.2 : 0.6; }

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uHeight - gl_FragCoord.y);
  vec2 logical = uOrigin + frag * uScale;
  vec2 k = uRaster / uMapSize;
  vec2 rp = logical * k;
  float texPx = uScale * k.x;          // пикселей растра на пиксель холста
  float rad = max(0.9, texPx * 1.7);   // радиус голосования, пиксели растра

  int ids[NS];
  float grp[NS];
  float total = 0.0, land = 0.0;
  for (int i = 0; i < NS; i++) {
    ids[i] = idAt(rp + DISK[i] * rad);
    grp[i] = keyOf(ids[i], 1);
    total += wOf(i);
    if (ids[i] != 0) land += wOf(i);
  }
  // группа-победитель (страна в политическом режиме) и её самая близкая к центру провинция
  float bestKey = -1.0, bestW = 0.0;
  for (int i = 0; i < NS; i++) {
    if (ids[i] == 0) continue;
    float w = 0.0;
    for (int j = 0; j < NS; j++) if (grp[j] == grp[i]) w += wOf(j);
    if (w > bestW + 0.001) { bestW = w; bestKey = grp[i]; }
  }
  int id = 0;
  for (int i = 0; i < NS; i++) if (id == 0 && ids[i] != 0 && grp[i] == bestKey) id = ids[i];
  float own = keyOf(id, 2);
  float wId = 0.0, wOwn = 0.0;
  for (int i = 0; i < NS; i++) {
    if (ids[i] == id) wId += wOf(i);
    if (ids[i] != 0 && keyOf(ids[i], 2) == own) wOwn += wOf(i);
  }
  // доли «своих» среди суши: 1 — глубоко внутри, 0.5 — на границе
  float fGrp = bestW / max(land, 0.001);
  float fOwn = wOwn / max(land, 0.001);
  float fId = wId / max(land, 0.001);
  // расстояние до границы в пикселях холста — через производные экрана
  float dGrp = (fGrp - 0.5) / max(fwidth(fGrp), 0.004);
  float dOwn = (fOwn - 0.5) / max(fwidth(fOwn), 0.004);
  float dId = (fId - 0.5) / max(fwidth(fId), 0.004);
  float fLand = land / total;
  float coast = clamp((fLand - 0.5) / max(fwidth(fLand), 0.004) + 0.5, 0.0, 1.0);

  // мягкое свечение внутрь от границы страны (без моря): доля чужих на большом круге
  float glow = 0.0;
  if (id != 0 && uGlowPx > 0.0) {
    float gr = uGlowPx * texPx * uPixel;
    float foreign = 0.0, cnt = 0.0;
    for (int i = 1; i < NS; i++) {
      for (int s = 0; s < 2; s++) {
        vec2 o = DISK[i] * gr * (s == 0 ? 1.0 : 0.55);
        int n = idAt(rp + o);
        if (n == 0) continue;
        cnt += 1.0;
        if (keyOf(n, 1) != bestKey) foreign += 1.0;
      }
    }
    glow = cnt > 0.0 ? smoothstep(0.0, 0.5, foreign / cnt) : 0.0;
  }

  if (id == 0 || coast <= 0.0 || logical.x < 0.0 || logical.y < 0.0 || logical.x > uMapSize.x || logical.y > uMapSize.y) {
    outColor = vec4(0.0);
    return;
  }
  vec4 fill = lut(id, 0);
  vec4 meta = lut(id, 1);
  vec3 col = fill.rgb;
  float a = uOpacity * fill.a;
  bool selected = meta.b > 0.5;
  bool hovered = meta.a > 0.5;
  if (hovered) { a += 0.07; col = mix(col, vec3(1.0), 0.1); }
  if (selected) { a += 0.16; col = mix(col, vec3(1.0, 0.9, 0.6), 0.18); }
  vec3 glowCol = selected ? vec3(0.96, 0.86, 0.56) : mix(col, vec3(1.0), 0.18);
  col = mix(col, glowCol, glow * 0.5);
  a = max(a, glow * (selected ? 0.6 : min(0.5, uOpacity * 1.3 + 0.12)));

  float px = uPixel; // пикселей холста на пиксель экрана
  // линии провинций — едва заметные, тоньше волоса
  if (uProvLines > 0.0) {
    float l = 1.0 - smoothstep(0.35 * px, 0.95 * px, abs(dId));
    col = mix(col, col * 0.35, l * 0.55);
    a = max(a, l * 0.3 * uProvLines);
  }
  if (uBorders > 0.5) {
    // граница группы: тонкая тёмная линия с мягкой тенью
    float lg = 1.0 - smoothstep(0.55 * px, 1.25 * px, abs(dGrp));
    float sh = 1.0 - smoothstep(1.0 * px, 3.0 * px, abs(dGrp));
    // граница владельцев (в режимах культур и т. п. — страны)
    float lo = 1.0 - smoothstep(0.6 * px, 1.4 * px, abs(dOwn));
    vec3 dark = mix(fill.rgb, vec3(0.04, 0.03, 0.02), 0.72);
    col = mix(col, dark, sh * 0.35);
    a = max(a, sh * 0.32);
    float line = max(lg, lo);
    col = mix(col, selected ? vec3(0.96, 0.86, 0.56) : dark, line);
    a = mix(a, 0.88, line);
  }
  a *= coast;
  outColor = vec4(col * a, a);
}`

interface Uniforms {
  [k: string]: WebGLUniformLocation | null
}

export interface ProvinceView {
  opacity: number
  borders: boolean
  provLines: number
  glowPx: number
}

export const ProvinceRenderer = L.Renderer.extend({
  options: { padding: 0.15 },

  initialize(this: any, mapW: number, mapH: number, image: HTMLImageElement, options?: L.RendererOptions) {
    (L.Renderer.prototype as any).initialize.call(this, options)
    this._mapW = mapW
    this._mapH = mapH
    this._image = image
    this._view = { opacity: 0.35, borders: true, provLines: 0, glowPx: 10 } as ProvinceView
  },

  _initContainer(this: any) {
    const c = (this._container = document.createElement('canvas'))
    c.className = 'province-canvas'
    c.style.pointerEvents = 'none'
    const gl = (this._gl = c.getContext('webgl2', { premultipliedAlpha: true, antialias: false })) as WebGL2RenderingContext
    if (!gl) throw new Error('WebGL2 недоступен')
    const sh = (type: number, src: string): WebGLShader => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
      return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link')
    this._prog = prog
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const u: Uniforms = {}
    for (const n of ['uProv', 'uLut', 'uOrigin', 'uScale', 'uMapSize', 'uRaster', 'uHeight', 'uOpacity', 'uBorders', 'uProvLines', 'uGlowPx', 'uPixel'])
      u[n] = gl.getUniformLocation(prog, n)
    this._u = u
    const tex = (unit: number): WebGLTexture => {
      const t = gl.createTexture()!
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      return t
    }
    this._provTex = tex(0)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, this._image)
    this._lutTex = tex(1)
    this._lutReady = false
  },

  _destroyContainer(this: any) {
    const gl = this._gl as WebGL2RenderingContext | undefined
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    L.DomUtil.remove(this._container)
    this._gl = null
  },

  /** Новая таблица цветов (при смене даты, режима, выделения) */
  setLut(this: any, data: Uint8Array, width: number) {
    const gl = this._gl as WebGL2RenderingContext
    if (!gl) return
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this._lutTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, 3, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
    this._lutReady = true
    this._draw()
  },

  setView(this: any, view: Partial<ProvinceView>) {
    this._view = { ...this._view, ...view }
    this._draw()
  },

  _update(this: any) {
    if (this._map._animatingZoom && this._bounds) return
    (L.Renderer.prototype as any)._update.call(this)
    const b = this._bounds as L.Bounds
    const size = b.getSize()
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const c = this._container as HTMLCanvasElement
    L.DomUtil.setPosition(c, b.min!)
    c.width = Math.round(size.x * dpr)
    c.height = Math.round(size.y * dpr)
    c.style.width = `${size.x}px`
    c.style.height = `${size.y}px`
    this._dpr = dpr
    this._draw()
  },

  _draw(this: any) {
    const gl = this._gl as WebGL2RenderingContext
    if (!gl || !this._map || !this._bounds || !this._lutReady) return
    const map = this._map as L.Map
    const b = this._bounds as L.Bounds
    const tl = map.layerPointToLatLng(b.min!)
    const zoom = map.getZoom()
    const scaleCss = Math.pow(2, -zoom) // логических единиц на CSS-пиксель
    const c = this._container as HTMLCanvasElement
    gl.viewport(0, 0, c.width, c.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this._prog)
    const u = this._u as Uniforms
    const v = this._view as ProvinceView
    gl.uniform1i(u.uProv, 0)
    gl.uniform1i(u.uLut, 1)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this._provTex)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this._lutTex)
    gl.uniform2f(u.uOrigin, tl.lng, -tl.lat)
    gl.uniform1f(u.uScale, scaleCss / this._dpr)
    gl.uniform2f(u.uMapSize, this._mapW, this._mapH)
    gl.uniform2f(u.uRaster, this._image.naturalWidth, this._image.naturalHeight)
    gl.uniform1f(u.uHeight, c.height)
    gl.uniform1f(u.uOpacity, v.opacity)
    gl.uniform1f(u.uBorders, v.borders ? 1 : 0)
    gl.uniform1f(u.uProvLines, v.provLines)
    gl.uniform1f(u.uGlowPx, v.glowPx)
    gl.uniform1f(u.uPixel, this._dpr)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }
}) as unknown as new (mapW: number, mapH: number, image: HTMLImageElement, options?: L.RendererOptions) => L.Renderer & {
  setLut: (data: Uint8Array, width: number) => void
  setView: (v: Partial<ProvinceView>) => void
}

/** Подписи на 2D-холсте: тысячи названий провинций рисуются быстро, только видимые */
export interface TextLabel {
  x: number
  y: number
  text: string
  size: number
  color: string
  italic?: boolean
  caps?: boolean
  minPx?: number
}

export const TextRenderer = L.Renderer.extend({
  options: { padding: 0.1 },
  initialize(this: any, options?: L.RendererOptions) {
    (L.Renderer.prototype as any).initialize.call(this, options)
    this._labels = [] as TextLabel[]
  },
  _initContainer(this: any) {
    const c = (this._container = document.createElement('canvas'))
    c.className = 'text-canvas'
    c.style.pointerEvents = 'none'
    this._ctx = c.getContext('2d')
  },
  _destroyContainer(this: any) {
    L.DomUtil.remove(this._container)
    this._ctx = null
  },
  setLabels(this: any, labels: TextLabel[]) {
    this._labels = labels
    this._draw()
  },
  _update(this: any) {
    if (this._map._animatingZoom && this._bounds) return
    (L.Renderer.prototype as any)._update.call(this)
    const b = this._bounds as L.Bounds
    const size = b.getSize()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const c = this._container as HTMLCanvasElement
    L.DomUtil.setPosition(c, b.min!)
    c.width = Math.round(size.x * dpr)
    c.height = Math.round(size.y * dpr)
    c.style.width = `${size.x}px`
    c.style.height = `${size.y}px`
    this._dpr = dpr
    this._draw()
  },
  _draw(this: any) {
    const ctx = this._ctx as CanvasRenderingContext2D
    if (!ctx || !this._map || !this._bounds) return
    const map = this._map as L.Map
    const b = this._bounds as L.Bounds
    const dpr = this._dpr
    const scale = Math.pow(2, map.getZoom())
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    const placed: [number, number, number, number][] = []
    for (const l of this._labels as TextLabel[]) {
      const px = l.size * scale
      if (px < (l.minPx ?? 9) || px > 60) continue
      const pt = map.latLngToLayerPoint(L.latLng(-l.y, l.x))
      const x = (pt.x - b.min!.x) * dpr
      const y = (pt.y - b.min!.y) * dpr
      if (x < -200 || y < -50 || x > ctx.canvas.width + 200 || y > ctx.canvas.height + 50) continue
      const fs = px * dpr
      ctx.font = `${l.italic ? 'italic ' : ''}600 ${fs}px "Cormorant Garamond", serif`
      const text = l.caps ? l.text.toUpperCase() : l.text
      const w = ctx.measureText(text).width
      // не даём подписям налезать друг на друга
      const box: [number, number, number, number] = [x - w / 2, y - fs / 2, x + w / 2, y + fs / 2]
      if (placed.some((q) => box[0] < q[2] && box[2] > q[0] && box[1] < q[3] && box[3] > q[1])) continue
      placed.push(box)
      ctx.lineWidth = Math.max(2, fs * 0.22)
      ctx.strokeStyle = 'rgba(8, 7, 5, 0.85)'
      ctx.strokeText(text, x, y)
      ctx.fillStyle = l.color
      ctx.fillText(text, x, y)
    }
  }
}) as unknown as new (options?: L.RendererOptions) => L.Renderer & { setLabels: (l: TextLabel[]) => void }

/** Объёмные поселения: спрайты-миниатюры в своей точке карты, растут вместе с масштабом */
export interface SettlementItem {
  x: number
  y: number
  type: SettlementType
  culture: string
  variant: number
}

export const SettlementRenderer = L.Renderer.extend({
  options: { padding: 0.1 },
  initialize(this: any, options?: L.RendererOptions) {
    ;(L.Renderer.prototype as any).initialize.call(this, options)
    this._items = [] as SettlementItem[]
  },
  _initContainer(this: any) {
    const c = (this._container = document.createElement('canvas'))
    c.className = 'settlement-canvas'
    c.style.pointerEvents = 'none'
    this._ctx = c.getContext('2d')
  },
  _destroyContainer(this: any) {
    L.DomUtil.remove(this._container)
    this._ctx = null
  },
  setItems(this: any, items: SettlementItem[]) {
    this._items = [...items].sort((a, b) => a.y - b.y) // дальние раньше — ближние перекрывают
    this._draw()
  },
  redraw(this: any) {
    this._draw()
  },
  _update(this: any) {
    if (this._map._animatingZoom && this._bounds) return
    ;(L.Renderer.prototype as any)._update.call(this)
    const b = this._bounds as L.Bounds
    const size = b.getSize()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const c = this._container as HTMLCanvasElement
    L.DomUtil.setPosition(c, b.min!)
    c.width = Math.round(size.x * dpr)
    c.height = Math.round(size.y * dpr)
    c.style.width = `${size.x}px`
    c.style.height = `${size.y}px`
    this._dpr = dpr
    this._draw()
  },
  _draw(this: any) {
    const ctx = this._ctx as CanvasRenderingContext2D
    if (!ctx || !this._map || !this._bounds) return
    const map = this._map as L.Map
    const b = this._bounds as L.Bounds
    const dpr = this._dpr
    const scale = Math.pow(2, map.getZoom())
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.imageSmoothingQuality = 'high'
    const W = ctx.canvas.width, H = ctx.canvas.height
    for (const it of this._items as SettlementItem[]) {
      const size = SPRITE_LOGICAL * SETTLEMENT_SCALE[it.type] * scale
      if (size < SETTLEMENT_MIN_PX[it.type] || size > 1400) continue
      const pt = map.latLngToLayerPoint(L.latLng(-it.y, it.x))
      const x = (pt.x - b.min!.x) * dpr
      const y = (pt.y - b.min!.y) * dpr
      const s = size * dpr
      if (x < -s || y < -s || x > W + s || y > H + s) continue
      const sp = getSprite(it.type, it.culture, it.variant)
      if (!sp) continue
      // плавное появление при приближении
      ctx.globalAlpha = Math.min(1, (size - SETTLEMENT_MIN_PX[it.type]) / 18)
      ctx.drawImage(sp.canvas, x - sp.ax * s, y - sp.ay * s, s, s)
    }
    ctx.globalAlpha = 1
  }
}) as unknown as new (options?: L.RendererOptions) => L.Renderer & { setItems: (i: SettlementItem[]) => void; redraw: () => void }
