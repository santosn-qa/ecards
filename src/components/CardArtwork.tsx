import type { CardTemplate } from '../data/templates'

type CardArtworkProps = { template: CardTemplate }
const assetUrl = (name: string) => `${import.meta.env.BASE_URL}artwork/${name}`

/** A complete, pre-composed illustration used edge-to-edge with no extra decoration layered on top. */
function FullBleedArtwork({ template }: CardArtworkProps) {
  return (
    <svg className={`card-artwork artwork-full-bleed artwork-${template.style}`} viewBox="0 0 600 750" preserveAspectRatio="xMidYMid slice">
      <image className="source-art source-full-bleed" href={assetUrl(template.artwork.asset ?? '')} x="0" y="0" width="600" height="750" preserveAspectRatio="xMidYMid slice" />
    </svg>
  )
}

/** Purely illustrative SVG decoration used by templates that don't (yet) have a bespoke full-bleed asset. */
function CelebrationArtwork({ template }: CardArtworkProps) {
  return (
    <svg className={`card-artwork artwork-celebration artwork-${template.style}`} viewBox="0 0 600 750" preserveAspectRatio="xMidYMid slice">
      <path className="art-celebration-paper" d="M0 0h600v750H0z" />
      <path className="art-streamer art-streamer-one" d="M-30 118C92 32 163 174 274 87s166-5 356 20" />
      <path className="art-streamer art-streamer-two" d="M170-20c9 94 116 100 71 219s88 141 43 261" />
      <g className="art-confetti-pieces">
        <path d="M70 186l26-8 8 26-26 8z" /><path d="M500 315l28-20 20 28-28 20z" /><path d="M390 80l11-28 27 11-11 28z" />
        <circle cx="111" cy="310" r="9" /><circle cx="535" cy="150" r="8" /><path d="M480 520l34 4-4 34-34-4z" />
      </g>
      <path className="art-confetti-sweep" d="M-20 680C170 570 292 746 620 555" />
    </svg>
  )
}

function ArtisticArtwork({ template }: CardArtworkProps) {
  return (
    <svg className={`card-artwork artwork-artistic artwork-${template.style}`} viewBox="0 0 600 750" preserveAspectRatio="xMidYMid slice">
      <path className="art-night-paper" d="M0 0h600v750H0z" />
      <path className="art-moon" d="M470 80a112 112 0 1 0-52 204A126 126 0 1 1 470 80z" />
      <g className="art-stars"><circle cx="105" cy="94" r="3" /><circle cx="185" cy="166" r="5" /><circle cx="535" cy="360" r="3" /><path d="M85 280l7 20 20 7-20 7-7 20-7-20-20-7 20-7z" /></g>
      <path className="art-hill art-hill-back" d="M-30 645c142-168 225-31 332-121 96-80 168-81 329 55v191H-30z" />
      <path className="art-hill art-hill-front" d="M-30 694c106-119 213-83 320-20 108 64 185-3 340-87v194H-30z" />
      <path className="art-branch" d="M-10 630C109 566 132 453 195 329M104 528l-57-40M132 461l62-59M158 409l-37-60" />
      <g className="art-branch-leaves"><ellipse cx="50" cy="484" rx="14" ry="34" transform="rotate(-52 50 484)" /><ellipse cx="190" cy="407" rx="14" ry="34" transform="rotate(52 190 407)" /><ellipse cx="123" cy="354" rx="12" ry="29" transform="rotate(-44 123 354)" /></g>
    </svg>
  )
}

export function CardArtwork({ template }: CardArtworkProps) {
  if (template.artwork.illustrationStyle === 'full-bleed') return <FullBleedArtwork template={template} />
  if (template.collection === 'celebration') return <CelebrationArtwork template={template} />
  return <ArtisticArtwork template={template} />
}
