'use client';

import { useState } from 'react';
import { COUNTRIES } from '@/lib/countries';

export function CountrySelect({ name, defaultValue = [] }: { name: string; defaultValue?: string[] }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>(defaultValue);

  function toggle(code: string) {
    setSelected((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  const filtered = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) || c.code.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div>
      <input
        type="text"
        placeholder="Rechercher un pays…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="input mb-2"
      />
      <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-300 p-2">
        {filtered.length === 0 && <p className="px-1 text-xs text-slate-400">Aucun pays trouvé.</p>}
        {filtered.map((c) => (
          <label key={c.code} className="flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-slate-50">
            <input
              type="checkbox"
              name={name}
              value={c.code}
              checked={selected.includes(c.code)}
              onChange={() => toggle(c.code)}
              className="h-4 w-4"
            />
            {c.name} <span className="text-xs text-slate-400">({c.code})</span>
          </label>
        ))}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {selected.length === 0
          ? 'Aucun pays sélectionné - tous les pays seront autorisés.'
          : `${selected.length} pays autorisé(s) : ${selected.join(', ')}`}
      </p>
    </div>
  );
}
