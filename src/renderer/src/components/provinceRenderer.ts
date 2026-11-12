import L from 'leaflet'
import { getSprite, SETTLEMENT_MIN_PX, SETTLEMENT_SCALE, SPRITE_LOGICAL, type SettlementType } from '../settlements3d'
import { getMiniSprite } from '../settlementPlans'
import type { CityPlan } from '../city3d'
import { loadPlan } from './ui'

/**
 * WebGL-слой провинций в духе Paradox: каждый пиксель берёт номер провинции из текстуры карты провинций,
 * цвет — из маленькой таблицы (меняется при смене даты или режима), границы и свечение
 * считаются в шейдере сравнением соседних пикселей.
 * Войны: таблица знает, когда и у кого провинцию отняли. Между шагами даты время течёт непрерывно (uShift),
 * захваченная провинция перекрашивается «чернилами» за uTrans дней, граница с прежним владельцем первый
 * год рисуется линией фронта, а свежезахваченная земля — штриховкой в цвет прежнего хозяина.
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
uniform float uShift;       // дней от даты таблицы до показываемого момента (во время перехода между датами < 0)
uniform float uTrans;       // за сколько дней захваченная провинция перекрашивается
uniform float uFront;       // сколько дней после захвата держится линия фронта и штриховка
uniform float uHover;       // ключ группы под мышкой (-1 — нет)
out vec4 outColor;

int idAt(vec2 rp) {
  ivec2 ip = ivec2(clamp(rp, vec2(0.0), uRaster - 1.0));
  vec4 t = texelFetch(uProv, ip, 0);
  if (t.a < 0.5) return 0;
  return int(t.r * 255.0 + 0.5) * 256 + int(t.g * 255.0 + 0.5);
}
vec4 lut(int id, int row) { return texelFetch(uLut, ivec2(id, row), 0); }
float keyOf(int id, int row) { if (id == 0) return -1.0; vec4 v = lut(id, row); return v.r * 255.0 + v.g * 255.0 * 256.0; }
// дней с последней смены владельца на показываемый момент (огромное — смены не было)
float ageOf(int id) {
  if (id == 0) return 1e6;
  vec4 v = lut(id, 4);
  float d = floor(v.r * 255.0 + 0.5) + floor(v.g * 255.0 + 0.5) * 256.0;
  if (d >= 32768.0) d -= 65536.0;
  if (d <= -32767.0) return 1e6;
  return uShift - d;
}
float prevKeyOf(int id) { vec4 v = lut(id, 4); return floor(v.b * 255.0 + 0.5) + floor(v.a * 255.0 + 0.5) * 256.0; }
// группа провинции на показываемый момент: до середины перехода — прежний владелец
float grpOf(int id) {
  if (id == 0) return -1.0;
  float age = ageOf(id);
  if (age < uTrans * 0.5) return prevKeyOf(id);
  return keyOf(id, 1);
}
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x), u.y);
}

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
    grp[i] = grpOf(ids[i]);
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
  float wId = 0.0, wOwn = 0.0, wSel = 0.0;
  for (int i = 0; i < NS; i++) {
    if (ids[i] == id) wId += wOf(i);
    if (ids[i] != 0 && keyOf(ids[i], 2) == own) wOwn += wOf(i);
    if (ids[i] != 0 && lut(ids[i], 1).b > 0.5) wSel += wOf(i);
  }
  float fSel = wSel / max(land, 0.001);
  float dSel = (fSel - 0.5) / max(fwidth(fSel), 0.004);
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
  float glow = 0.0, selNear = 0.0;
  if (id != 0 && uGlowPx > 0.0) {
    float gr = uGlowPx * texPx * uPixel;
    float foreign = 0.0, cnt = 0.0, selCnt = 0.0;
    for (int i = 1; i < NS; i++) {
      for (int s = 0; s < 2; s++) {
        vec2 o = DISK[i] * gr * (s == 0 ? 1.0 : 0.55);
        int n = idAt(rp + o);
        if (n == 0) continue;
        cnt += 1.0;
        if (grpOf(n) != bestKey) foreign += 1.0;
        if (lut(n, 1).b > 0.5) selCnt += s == 0 ? 0.6 : 1.4;
      }
    }
    glow = cnt > 0.0 ? smoothstep(0.0, 0.5, foreign / cnt) : 0.0;
    selNear = cnt > 0.0 ? smoothstep(0.0, 0.6, selCnt / cnt) : 0.0;
  }

  if (id == 0 || coast <= 0.0 || logical.x < 0.0 || logical.y < 0.0 || logical.x > uMapSize.x || logical.y > uMapSize.y) {
    outColor = vec4(0.0);
    return;
  }
  vec4 fill = lut(id, 0);
  vec4 meta = lut(id, 1);
  // захват: новый цвет растекается пятнами, как чернила, за uTrans дней
  float age = ageOf(id);
  vec4 prevFill = lut(id, 3);
  if (age < uTrans) {
    float n = vnoise(logical / 26.0) * 0.65 + vnoise(logical / 7.0) * 0.35;
    float p = clamp(age / uTrans, 0.0, 1.0) * 1.3 - 0.15;
    fill = mix(prevFill, fill, smoothstep(n - 0.12, n + 0.12, p));
  }
  vec3 col = fill.rgb;
  float a = uOpacity * fill.a;
  // свежезахваченная земля — косая штриховка в цвет прежнего владельца, гаснет за uFront дней
  float fresh = age >= 0.0 && age < uFront ? 1.0 - age / uFront : 0.0;
  if (fresh > 0.0 && age >= uTrans) {
    float stripe = smoothstep(0.42, 0.5, abs(fract((frag.x + frag.y) / (11.0 * uPixel)) - 0.5) * 2.0);
    col = mix(col, prevFill.rgb, stripe * 0.4 * fresh);
  }
  bool selected = meta.b > 0.5;
  bool hovered = uHover >= 0.0 && abs(floor(keyOf(id, 1) + 0.5) - uHover) < 0.5;
  if (hovered) { a += 0.07; col = mix(col, vec3(1.0), 0.1); }
  vec3 gold = vec3(0.98, 0.84, 0.45);
  if (selected) { a = max(a + 0.16, 0.3); col = mix(col, vec3(1.0, 0.92, 0.7), 0.22); }
  vec3 glowCol = mix(col, vec3(1.0), 0.18);
  col = mix(col, glowCol, glow * 0.5);
  a = max(a, glow * min(0.5, uOpacity * 1.3 + 0.12));
  // ореол выделения: золотое сияние по обе стороны его границы (внутри — тише)
  float halo = selected ? (1.0 - selNear) * 0.8 : selNear;
  if (halo > 0.0) {
    col = mix(col, gold, halo * 0.55);
    a = max(a, halo * 0.55);
  }

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
    // линия фронта: граница с тем, у кого провинцию недавно отняли (или кто отнял у соседа)
    float front = 0.0;
    if (abs(dGrp) < 4.0 * px) {
      for (int i = 1; i < NS; i++) {
        if (ids[i] == 0 || grp[i] == bestKey) continue;
        float ai = ageOf(ids[i]);
        if (fresh > 0.0 && prevKeyOf(id) == grp[i]) front = max(front, fresh);
        if (ai >= 0.0 && ai < uFront && prevKeyOf(ids[i]) == bestKey) front = max(front, 1.0 - ai / uFront);
      }
    }
    if (front > 0.0) {
      float fl = 1.0 - smoothstep(0.9 * px, 2.1 * px, abs(dGrp));
      float fg = 1.0 - smoothstep(1.5 * px, 6.0 * px, abs(dGrp));
      vec3 red = vec3(0.62, 0.09, 0.07);
      col = mix(col, red, fg * 0.35 * front);
      a = max(a, fg * 0.4 * front);
      lg = max(lg, fl * front);
      dark = mix(dark, red, front);
    }
    col = mix(col, dark, sh * 0.35);
    a = max(a, sh * 0.32);
    float line = max(lg, lo);
    col = mix(col, dark, line);
    a = mix(a, 0.88, line);
  }
  // граница выделения: яркая золотая линия с тёмной каймой — поверх всех прочих линий
  if (wSel > 0.0 && wSel < land) {
    float ls = 1.0 - smoothstep(0.9 * px, 2.0 * px, abs(dSel));
    float lk = 1.0 - smoothstep(2.0 * px, 3.2 * px, abs(dSel));
    col = mix(col, vec3(0.12, 0.08, 0.02), (lk - ls) * 0.6);
    col = mix(col, gold, ls);
    a = max(a, max(ls * 0.97, lk * 0.7));
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
    for (const n of ['uProv', 'uLut', 'uOrigin', 'uScale', 'uMapSize', 'uRaster', 'uHeight', 'uOpacity', 'uBorders', 'uProvLines', 'uGlowPx', 'uPixel', 'uShift', 'uTrans', 'uFront', 'uHover'])
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

  /**
   * Новая таблица цветов (при смене даты, режима, выделения). date — дата таблицы: если она недалеко от прежней,
   * показываемое время плавно доезжает до неё за долю секунды, и захваты растекаются, а не прыгают.
   */
  setLut(this: any, data: Uint8Array, width: number, rows: number, date: number) {
    const gl = this._gl as WebGL2RenderingContext
    if (!gl) return
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this._lutTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
    this._lutReady = true
    const from = this._now ?? date
    this._lutDate = date
    cancelAnimationFrame(this._raf ?? 0)
    if (Math.abs(date - from) > 400 || date === from) {
      this._now = date
      this._draw()
      return
    }
    // шаг проигрывания (0,12 с) — доезжаем чуть дольше, чтобы между шагами не было остановок
    const t0 = performance.now(), dur = 160
    const step = (): void => {
      const k = Math.min(1, (performance.now() - t0) / dur)
      this._now = from + (date - from) * k
      this._draw()
      if (k < 1) this._raf = requestAnimationFrame(step)
    }
    step()
  },

  setView(this: any, view: Partial<ProvinceView>) {
    this._view = { ...this._view, ...view }
    this._draw()
  },

  /** Подсветка группы под мышкой: k — номер ключа из buildLut (-1 — нет). Перерисовка — не чаще кадра. */
  setHover(this: any, k: number) {
    if (this._hover === k) return
    this._hover = k
    if (this._hoverRaf) return
    this._hoverRaf = requestAnimationFrame(() => {
      this._hoverRaf = 0
      this._draw()
    })
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
    gl.uniform1f(u.uShift, (this._now ?? this._lutDate ?? 0) - (this._lutDate ?? 0))
    gl.uniform1f(u.uTrans, 45)
    gl.uniform1f(u.uFront, 420)
    gl.uniform1f(u.uHover, this._hover ?? -1)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }
}) as unknown as new (mapW: number, mapH: number, image: HTMLImageElement, options?: L.RendererOptions) => L.Renderer & {
  setLut: (data: Uint8Array, width: number, rows: number, date: number) => void
  setView: (v: Partial<ProvinceView>) => void
  setHover: (k: number) => void
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
  /** 'prov:<id>' или 'place:<id>' — что выбрать по клику */
  key?: string
  /** множитель размера (в горах селения мельче) */
  scale?: number
  /** план поселения: миниатюра строится по нему, как в 3D-виде */
  plan?: string
  /** местность провинции: цвет поляны под поселением */
  terrain?: number
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
  /** Какое видимое поселение под точкой (логические координаты) — ближние перекрывают дальние */
  hit(this: any, x: number, y: number): SettlementItem | null {
    const scale = Math.pow(2, this._map?.getZoom() ?? 0)
    const items = this._items as SettlementItem[]
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i]
      const logical = SPRITE_LOGICAL * SETTLEMENT_SCALE[it.type] * (it.scale ?? 1)
      if (logical * scale < SETTLEMENT_MIN_PX[it.type]) continue
      if (Math.abs(x - it.x) < logical * 0.28 && y - it.y > -logical * 0.3 && y - it.y < logical * 0.16) return it
    }
    return null
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
      const size = SPRITE_LOGICAL * SETTLEMENT_SCALE[it.type] * (it.scale ?? 1) * scale
      if (size < SETTLEMENT_MIN_PX[it.type] || size > 1400) continue
      const pt = map.latLngToLayerPoint(L.latLng(-it.y, it.x))
      const x = (pt.x - b.min!.x) * dpr
      const y = (pt.y - b.min!.y) * dpr
      const s = size * dpr
      if (x < -s || y < -s || x > W + s || y > H + s) continue
      // пока миниатюра строится — старый значок, чтобы поселение не пропадало
      const sp = getMiniSprite(it, (rel) => loadPlan<CityPlan>(rel)) ?? getSprite(it.type, it.culture, it.variant)
      if (!sp) continue
      // плавное появление при приближении
      ctx.globalAlpha = Math.min(1, (size - SETTLEMENT_MIN_PX[it.type]) / 18)
      ctx.drawImage(sp.canvas, x - sp.ax * s, y - sp.ay * s, s, s)
    }
    ctx.globalAlpha = 1
  }
}) as unknown as new (options?: L.RendererOptions) => L.Renderer & {
  setItems: (i: SettlementItem[]) => void
  redraw: () => void
  hit: (x: number, y: number) => SettlementItem | null
}
