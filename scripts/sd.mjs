// Общий доступ к локальной нейросети для портретов. Раньше каждый портрет запускал sd-cli заново, и 10 с из
// каждого уходило на загрузку модели; теперь модель один раз загружается в sd-server (stable-diffusion.cpp)
// и остаётся в памяти, а скрипты шлют ему запросы. Сервер поднимается сам и гасится при выходе;
// уже запущенный (например, другим скриптом) переиспользуется.
// На этом компьютере (AMD R9 380, 4 ГБ): денойзинг и VAE — на AMD, текст — на процессоре; flash-attention
// здесь в 3 раза медленнее — выключен. Изображение декодирует TAESD (0,3 с вместо 2,3 с); SD_FULL_VAE=1 — полный VAE.
import { spawn } from 'child_process'

const PORT = Number(process.env.SD_PORT ?? 7861)
const URL_ = `http://127.0.0.1:${PORT}`
const ARGS = [
  '-m', 'tools/sd/models/dreamshaper8.safetensors',
  ...(process.env.SD_FULL_VAE ? [] : ['--taesd', 'tools/sd/models/taesd.safetensors']),
  '--flash-attn', 'off',
  '--backend', process.env.SD_BACKEND ?? 'diffusion=vulkan0,te=cpu,vae=vulkan0', '--vae-tiling',
  // LoRA-ускорители вшиваются в веса сразу (иначе каждый шаг в 4 раза медленнее)
  '--lora-model-dir', 'tools/sd/lora', '--lora-apply-mode', 'immediately', '--batched-cfg', 'off',
  '--listen-port', String(PORT)
]

let server = null
const alive = () => fetch(`${URL_}/sdapi/v1/samplers`).then((r) => r.ok, () => false)

export async function startSd() {
  if (await alive()) return
  server = spawn('tools/sd/bin/sd-server.exe', ARGS, { stdio: ['ignore', 'pipe', 'pipe'] })
  const kill = () => server && !server.killed && server.kill()
  process.on('exit', kill)
  process.on('SIGINT', () => (kill(), process.exit(130)))
  await new Promise((resolve, reject) => {
    const onData = (d) => /listening on/.test(String(d)) && resolve()
    server.stdout.on('data', onData)
    server.stderr.on('data', onData)
    server.once('exit', (c) => reject(new Error(`sd-server завершился с кодом ${c}`)))
  })
}

export function stopSd() {
  if (server && !server.killed) server.kill()
  server = null
}

/**
 * Картинка по описанию → PNG (Buffer). Два ускорителя (LoRA в tools/sd/lora):
 * - fast: Hyper-SD 2-step на силе 0,6 + сэмплер TCD, 3 шага без отрицательного запроса (cfg 1) — вдвое быстрее
 *   (депутат 384×448: 5,5 с против 11,5 с), лица не хуже; негатив игнорируется, поэтому всё нужное — в запросе;
 * - иначе LCM: steps 5–7, cfg 1.5–1.8, отрицательный запрос работает (cfg 1 с LCM — мыльно).
 * SD_FAST=1 / SD_FAST=0 в окружении переопределяет выбор скрипта.
 */
export async function txt2img({ prompt, negative = '', width = 512, height = 640, steps = 7, cfg = 1.8, seed = 1, fast = false }) {
  if (process.env.SD_FAST) fast = process.env.SD_FAST === '1'
  const opts = fast
    ? { steps: 3, cfg_scale: 1, sampler_name: 'tcd', lora: [{ path: 'hyper-sd15-2step.safetensors', multiplier: 0.6 }] }
    : { steps, cfg_scale: cfg, sampler_name: 'lcm', lora: [{ path: 'lcm-sd15.safetensors', multiplier: 1 }] }
  const r = await fetch(`${URL_}/sdapi/v1/txt2img`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // LoRA серверу передаётся отдельным полем: тег <lora:…> в тексте запроса sd-server молча игнорирует
    body: JSON.stringify({ prompt, negative_prompt: negative, width, height, seed, batch_size: 1, ...opts })
  })
  const j = await r.json()
  if (!j.images?.[0]) throw new Error(`sd-server: ${JSON.stringify(j).slice(0, 300)}`)
  return Buffer.from(j.images[0], 'base64')
}
