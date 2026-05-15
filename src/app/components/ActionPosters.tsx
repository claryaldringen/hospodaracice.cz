import { getPublicUrl } from '@/app/lib/storage';
import type { ActionPoster } from '@/app/types';

interface Props {
  posters: ActionPoster[];
}

export default function ActionPosters({ posters }: Props) {
  if (posters.length === 0) return null;
  const ts = Date.now();

  return (
    <section id="action" className="py-4">
      <div className="hidden md:grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 px-4 items-start">
        {posters.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.id}
            src={`${getPublicUrl('menu', p.filename)}?${ts}`}
            alt={p.altText}
            className="w-full max-h-[80vh] object-contain"
            loading="eager"
          />
        ))}
      </div>
      <div className="md:hidden flex overflow-x-auto snap-x snap-mandatory gap-3 px-4 pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {posters.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.id}
            src={`${getPublicUrl('menu', p.filename)}?${ts}`}
            alt={p.altText}
            className="min-w-[80vw] snap-center max-h-[80vh] object-contain"
            loading="eager"
          />
        ))}
      </div>
      <div className="sr-only">
        {posters.map((p) => (
          <span key={p.id}>{p.altText}. </span>
        ))}
      </div>
    </section>
  );
}
