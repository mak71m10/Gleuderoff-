// картинки, подключаемые через import (Vite отдаёт адрес файла)
declare module '*.webp' {
  const src: string
  export default src
}
