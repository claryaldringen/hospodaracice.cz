'use client';

import Image from 'next/image';
import { useState } from 'react';

interface NavigationProps {
  visibleImages: {
    action: boolean;
    weekly: boolean;
    permanent: boolean;
  };
}

export default function Navigation({ visibleImages }: NavigationProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setMenuOpen(false);
    }
  };

  const menuItems = [
    { id: 'action', label: 'Akce', visible: visibleImages.action },
    { id: 'weekly', label: 'Týdenní Nabídka', visible: visibleImages.weekly },
    { id: 'permanent', label: 'Stálá Nabídka', visible: visibleImages.permanent },
    { id: 'contact', label: 'Kontakt', visible: true },
  ];

  return (
    <header className="fixed top-0 left-0 w-full bg-white shadow-md z-50 p-4 flex justify-between items-center">
      <div className="flex items-center space-x-4 relative">
        <div className="relative w-12 h-12 md:w-16 md:h-16 -mb-4 -mt-4">
          <Image src="/logo_Bakalar.png" alt="Logo Hospody" layout="fill" objectFit="contain" />
        </div>
        <h1
          className="text-sm md:text-3xl whitespace-nowrap"
          style={{ fontFamily: 'Cheque-Regular' }}
        >
          Hospoda Na Palouku
        </h1>
      </div>
      <div className="md:hidden">
        <button onClick={() => setMenuOpen(!menuOpen)} className="focus:outline-none">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
            />
          </svg>
        </button>
      </div>
      <nav
        className={`${
          menuOpen ? 'block' : 'hidden'
        } absolute top-16 left-0 w-full bg-white shadow-md p-4 md:static md:flex md:space-x-4 md:bg-transparent md:shadow-none md:p-0 text-1xl justify-end`}
        style={{ fontFamily: 'bukhariscript' }}
      >
        {menuItems.map(
          (item) =>
            item.visible && (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="hover:text-blue-500 cursor-pointer block md:inline text-xl py-3 md:py-0 px-1"
              >
                {item.label}
              </button>
            )
        )}
      </nav>
    </header>
  );
}
