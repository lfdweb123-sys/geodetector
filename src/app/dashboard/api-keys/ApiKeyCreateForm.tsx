'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createApiKeyAction } from './actions';
import { useToast } from '../ToastProvider';

type Project = { id: string; name: string };

const initialState: { rawKey: string; hmacSecret: string } | null = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? 'Creating…' : 'Create API key'}
    </button>
  );
}

export function ApiKeyCreateForm({ projects }: { projects: Project[] }) {
  const [state, formAction] = useFormState(async (_prev: typeof initialState, formData: FormData) => {
    const result = await createApiKeyAction(formData);
    return result ?? null;
  }, initialState);
  const { showToast } = useToast();
  const seen = useRef(state);

  useEffect(() => {
    if (state && state !== seen.current) {
      seen.current = state;
      showToast('Clé API créée.', 'success');
    }
  }, [state, showToast]);

  return (
    <div className="card">
      <h2 className="mb-4 text-lg font-medium">New API key</h2>
      {state && (
        <div className="mb-4 space-y-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-semibold">Copy these now - they will not be shown again.</p>
          <p className="break-all font-mono">Key: {state.rawKey}</p>
          <p className="break-all font-mono">HMAC secret: {state.hmacSecret}</p>
        </div>
      )}
      <form action={formAction}>
        <label className="label">Project</label>
        <select name="projectId" required className="input mb-4">
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label className="label">Key name</label>
        <input name="name" className="input mb-4" placeholder="Production backend" />
        <label className="label">Environment</label>
        <select name="env" className="input mb-4">
          <option value="live">live</option>
          <option value="test">test</option>
        </select>
        <SubmitButton />
      </form>
    </div>
  );
}
