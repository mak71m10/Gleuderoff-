// Типы для page-flip (StPageFlip): библиотека поставляется без .d.ts
declare module 'page-flip' {
  export interface FlipSettings {
    width: number
    height: number
    size?: 'fixed' | 'stretch'
    showCover?: boolean
    usePortrait?: boolean
    maxShadowOpacity?: number
    flippingTime?: number
    mobileScrollSupport?: boolean
    drawShadow?: boolean
    startPage?: number
  }
  export class PageFlip {
    constructor(el: HTMLElement, settings: FlipSettings)
    loadFromHTML(items: NodeListOf<Element> | HTMLElement[]): void
    on(event: 'flip' | 'changeState' | 'init', cb: (e: { data: unknown }) => void): this
    flip(page: number): void
    flipNext(): void
    flipPrev(): void
    getPageCount(): number
    getCurrentPageIndex(): number
    destroy(): void
  }
}
