'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ActionPoster } from '@/app/types';
import { processImage } from '@/app/admin/processImage';

const UPLOADS_URL = process.env.NEXT_PUBLIC_UPLOADS_URL || '/uploads';

interface Props {
  onStatus: (type: 'success' | 'error', text: string) => void;
}

function PosterCard({
  poster,
  onDelete,
}: {
  poster: ActionPoster;
  onDelete: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: poster.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative aspect-[0.707] bg-gray-100 border border-gray-200 rounded overflow-hidden cursor-grab touch-none"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${UPLOADS_URL}/menu/${poster.filename}`}
        alt={poster.altText}
        className="h-full w-full object-contain"
        loading="lazy"
      />
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(poster.id);
        }}
        className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-red-500 shadow hover:bg-red-50 hover:text-red-700"
        aria-label="Smazat plakát"
      >
        ✕
      </button>
      <div className="absolute bottom-1 left-1 rounded bg-white/90 px-2 py-0.5 text-xs text-gray-700">
        #{poster.position}
      </div>
    </div>
  );
}

export default function ActionPostersAdmin({ onStatus }: Props) {
  const [posters, setPosters] = useState<ActionPoster[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = useCallback(async () => {
    const res = await fetch('/api/action-posters');
    if (res.ok) {
      const data = (await res.json()) as { posters: ActionPoster[] };
      setPosters(data.posters);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = '';
    setUploading(true);
    let uploaded = 0;
    try {
      // Sequential upload — POST computes position = MAX+1 server-side, parallel
      // uploads would race and produce duplicate positions.
      for (const file of files) {
        const processed = await processImage(file);
        const formData = new FormData();
        formData.append('file', processed, 'poster.webp');
        const res = await fetch('/api/action-posters', { method: 'POST', body: formData });
        if (!res.ok) throw new Error('upload failed');
        const data = (await res.json()) as ActionPoster;
        setPosters((prev) => [...prev, data]);
        uploaded++;
      }
      onStatus('success', files.length === 1 ? 'Plakát nahrán.' : `Nahráno ${uploaded} plakátů.`);
    } catch {
      onStatus(
        'error',
        uploaded === 0
          ? 'Chyba při nahrávání plakátu.'
          : `Nahráno ${uploaded} z ${files.length}, zbytek selhal.`
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Opravdu smazat tento plakát?')) return;
    const prev = posters;
    setPosters((p) => p.filter((x) => x.id !== id));
    const res = await fetch(`/api/action-posters/${id}`, { method: 'DELETE' });
    if (res.ok) {
      load();
      onStatus('success', 'Plakát smazán.');
    } else {
      setPosters(prev);
      onStatus('error', 'Chyba při mazání.');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = posters.findIndex((p) => p.id === Number(active.id));
    const newIndex = posters.findIndex((p) => p.id === Number(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const previous = posters;
    const reordered = arrayMove(posters, oldIndex, newIndex).map((p, i) => ({
      ...p,
      position: i + 1,
    }));
    setPosters(reordered);
    const res = await fetch('/api/action-posters/order', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: reordered.map((p) => p.id) }),
    });
    if (!res.ok) {
      setPosters(previous);
      onStatus('error', 'Chyba při ukládání pořadí.');
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Akce — plakáty</h3>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="px-3 py-1 bg-gray-900 hover:bg-gray-800 text-white rounded text-sm disabled:opacity-50"
        >
          {uploading ? 'Nahrávám…' : '+ Přidat plakát'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
      </div>
      {posters.length === 0 ? (
        <p className="text-gray-500 text-sm">Žádné plakáty zatím nejsou.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={posters.map((p) => p.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {posters.map((p) => (
                <PosterCard key={p.id} poster={p} onDelete={handleDelete} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}
