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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ActionPoster } from '@/app/types';
import { processImage } from '@/app/admin/processImage';

const UPLOADS_URL = process.env.NEXT_PUBLIC_UPLOADS_URL || '/uploads';

interface Props {
  onStatus: (type: 'success' | 'error', text: string) => void;
}

function PosterRow({ poster, onDelete }: { poster: ActionPoster; onDelete: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: poster.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const ts = Date.now();
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 bg-zinc-900 border border-zinc-700 rounded p-2"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none px-2 text-zinc-400 hover:text-white"
        aria-label="Přesunout"
      >
        ≡
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${UPLOADS_URL}/menu/${poster.filename}?${ts}`}
        alt={poster.altText}
        className="h-24 w-auto object-contain"
        loading="lazy"
      />
      <div className="flex-1 text-sm text-zinc-300">
        #{poster.position} — {poster.altText}
      </div>
      <button
        type="button"
        onClick={() => onDelete(poster.id)}
        className="px-3 py-1 text-red-400 hover:text-red-200"
        aria-label="Smazat plakát"
      >
        ✕
      </button>
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
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const processed = await processImage(file);
      const formData = new FormData();
      formData.append('file', processed, 'poster.webp');
      const res = await fetch('/api/action-posters', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('upload failed');
      const data = (await res.json()) as ActionPoster;
      setPosters((prev) => [...prev, data]);
      onStatus('success', 'Plakát nahrán.');
    } catch {
      onStatus('error', 'Chyba při nahrávání plakátu.');
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
          className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-sm disabled:opacity-50"
        >
          {uploading ? 'Nahrávám…' : '+ Přidat plakát'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
        />
      </div>
      {posters.length === 0 ? (
        <p className="text-zinc-500 text-sm">Žádné plakáty zatím nejsou.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={posters.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {posters.map((p) => (
                <PosterRow key={p.id} poster={p} onDelete={handleDelete} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}
