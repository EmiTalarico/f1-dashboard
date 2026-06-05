'use client'

export default function CircuitImage({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      className="max-h-64 w-full object-contain"
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  )
}