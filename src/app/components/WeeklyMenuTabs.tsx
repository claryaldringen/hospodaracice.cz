'use client';

import { useState } from 'react';
import type { WeeklyTabData } from '@/app/types';
import { getOrderableDays } from '@/app/lib/menuDeadline';
import OrderForm from '@/app/components/OrderForm';

interface WeeklyMenuTabsProps {
  current: WeeklyTabData | null;
  next: WeeklyTabData | null;
}

type TabKey = 'current' | 'next';

function pickInitialTab(current: WeeklyTabData | null, next: WeeklyTabData | null): TabKey {
  const currentHasOrderable = !!current && getOrderableDays(current.days).length > 0;
  const nextHasOrderable = !!next && getOrderableDays(next.days).length > 0;

  if (currentHasOrderable) return 'current';
  if (nextHasOrderable) return 'next';
  if (current) return 'current';
  return 'next';
}

export default function WeeklyMenuTabs({ current, next }: WeeklyMenuTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(() => pickInitialTab(current, next));

  if (!current && !next) return null;

  const showTabBar = !!current && !!next;
  const activeData = activeTab === 'current' ? current : next;
  const fallbackData = activeData ?? current ?? next;
  if (!fallbackData) return null;

  const activeTabId = `weekly-tab-${activeTab}`;

  return (
    <>
      {showTabBar && (
        <div
          role="tablist"
          aria-label="Volba týdne"
          className="flex flex-wrap justify-center gap-2 px-4 pt-6"
        >
          <TabButton
            tabKey="current"
            active={activeTab === 'current'}
            onClick={() => setActiveTab('current')}
            label="Tento týden"
            range={current!.weekRange}
          />
          <TabButton
            tabKey="next"
            active={activeTab === 'next'}
            onClick={() => setActiveTab('next')}
            label="Příští týden"
            range={next!.weekRange}
          />
        </div>
      )}
      <div
        role={showTabBar ? 'tabpanel' : undefined}
        id="weekly-panel"
        aria-labelledby={showTabBar ? activeTabId : undefined}
      >
        <WeeklyWeekView data={fallbackData} />
      </div>
    </>
  );
}

interface TabButtonProps {
  tabKey: TabKey;
  active: boolean;
  onClick: () => void;
  label: string;
  range: string;
}

function TabButton({ tabKey, active, onClick, label, range }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      id={`weekly-tab-${tabKey}`}
      aria-selected={active}
      aria-controls="weekly-panel"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active
          ? 'bg-white text-gray-900'
          : 'border border-white/30 bg-white/10 text-white hover:bg-white/20'
      }`}
    >
      {label} <span className="opacity-70">· {range}</span>
    </button>
  );
}

interface WeeklyWeekViewProps {
  data: WeeklyTabData;
}

function WeeklyWeekView({ data }: WeeklyWeekViewProps) {
  const orderableDays = getOrderableDays(data.days);
  const altText = data.ocrData?.altText || 'Týdenní Nabídka';

  if (orderableDays.length > 0) {
    return (
      <>
        <div className="mt-4 mb-4 flex flex-col md:flex-row">
          <div className="relative flex h-screen w-full items-center justify-center md:w-1/2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.imageUrl}
              alt={altText}
              className="max-h-full max-w-full object-contain shadow-lg"
              loading="eager"
            />
          </div>
          <div className="flex w-full items-start justify-center py-8 md:w-1/2">
            <div className="w-full max-w-md">
              <OrderForm days={orderableDays} />
            </div>
          </div>
        </div>
        {data.ocrData?.fullText && <div className="sr-only">{data.ocrData.fullText}</div>}
      </>
    );
  }

  return (
    <>
      <div className="relative mt-4 mb-4 flex h-screen w-full items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={data.imageUrl}
          alt={altText}
          className="max-h-full max-w-full object-contain shadow-lg"
          loading="eager"
        />
      </div>
      {data.ocrData?.fullText && <div className="sr-only">{data.ocrData.fullText}</div>}
    </>
  );
}
