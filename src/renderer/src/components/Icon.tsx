const paths: Record<string, string> = {
  map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15',
  crown: 'M3 8l4 4 5-7 5 7 4-4-2 11H5z',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6',
  sun: 'M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  flame: 'M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-4 5-4 8-1-1-2-2-2-4-2 2-3 5-3 8 0 4 3 7 7 7z',
  tree: 'M12 3v18M12 8H6v5M12 8h6v5M6 13H3v4M6 13h3v4M18 13h-3v4M18 13h3v4',
  people: 'M8 11a3 3 0 100-6 3 3 0 000 6zM16 11a3 3 0 100-6 3 3 0 000 6zM2 20c0-3 3-5 6-5s6 2 6 5M14 15c3 0 8 1 8 5',
  shield: 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z',
  scroll: 'M7 3h11a2 2 0 012 2v2h-4M7 3a2 2 0 00-2 2v12a2 2 0 01-2 2h11a2 2 0 002-2V7M7 3a2 2 0 012 2v0M9 9h5M9 13h5',
  gem: 'M6 3h12l4 6-10 12L2 9zM2 9h20M9 3l3 18M15 3l-3 18',
  note: 'M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h6',
  hourglass: 'M6 2h12M6 22h12M7 2c0 6 10 6 10 10S7 16 7 22M17 2c0 6-10 6-10 10s10 4 10 10',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-2.7-1.1l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-1.1-2.7H3a2 2 0 110-4h.1a1.6 1.6 0 001.1-2.7l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 002.7-1.1V3a2 2 0 114 0v.1a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 001.1 2.7H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  cursor: 'M5 3l14 8-6 2-2 6z',
  pin: 'M12 22s7-7 7-12a7 7 0 10-14 0c0 5 7 12 7 12zM12 12a2 2 0 100-4 2 2 0 000 4z',
  pen: 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3',
  brush: 'M14 4l6 6-8 8-6-6zM6 12l-3 7 7-3',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3',
  back: 'M15 18l-6-6 6-6',
  next: 'M9 18l6-6-6-6',
  play: 'M7 4l13 8-13 8z',
  pause: 'M7 4h3v16H7zM14 4h3v16h-3z',
  folder: 'M3 6h6l2 2h10v11H3z',
  image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5',
  calendar: 'M4 5h16v16H4zM4 9h16M8 3v4M16 3v4',
  sword: 'M14 4h6v6L9 21l-3-3zM4 17l3 3M3 21l2-2',
  coins: 'M12 9c4 0 7-1.3 7-3s-3-3-7-3-7 1.3-7 3 3 3 7 3zM5 6v6c0 1.7 3 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3 3 7 3s7-1.3 7-3v-6',
  balance: 'M12 3v18M5 21h14M4 8h16M7 8l-3 7h6zM17 8l-3 7h6z',
  link: 'M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  target: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8z'
}

export type IconName = keyof typeof paths

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  )
}
