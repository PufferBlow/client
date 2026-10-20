import { parsePuff } from "../../lib/puff";

const SPIKE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const;

/**
 * A puff reaction's face. Each time `pop` goes up the fish puffs up and eight spines shoot out in
 * its colour (the keyed elements restart the CSS animation). With reduced motion there is no scale
 * and no spines: the stylesheet turns the animations off.
 */
export function PuffFace({ reaction, size = 20, pop = 0 }: { reaction: string; size?: number; pop?: number }) {
  const puff = parsePuff(reaction);
  if (!puff) return null;
  return (
    <span className="relative block shrink-0" style={{ width: size, height: size }} data-puff={puff.face}>
      <img
        key={`face-${pop}`}
        src={puff.url}
        alt={puff.label}
        draggable={false}
        width={size}
        height={size}
        className={pop > 0 ? "pb-anim-pop block" : "block"}
      />
      {pop > 0 &&
        SPIKE_ANGLES.map((angle) => (
          <span
            key={`${pop}-${angle}`}
            aria-hidden="true"
            className="pb-anim-spike absolute rounded-[2px] opacity-0"
            style={{
              left: size / 2,
              top: size / 2,
              width: 2.5,
              height: 7,
              marginLeft: -1.25,
              marginTop: -3.5,
              background: puff.hex,
              ["--r" as string]: `${angle}deg`,
            }}
          />
        ))}
    </span>
  );
}
