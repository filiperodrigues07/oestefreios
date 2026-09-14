import { useState } from 'react';
import { OS_STATUS_CONFIG } from '../../constants/osStatus.js';
import { ALLOWED_TRANSITIONS, type OSStatus } from '../../types/os.types.js';
import { Select } from '../ui/Select.js';
import { Button } from '../ui/Button.js';

interface StatusChangerProps {
  current: OSStatus;
  onChange: (status: OSStatus) => void;
  loading?: boolean;
}

/**
 * Lista só as transições permitidas a partir do status atual (mesmo mapa do
 * backend/src/services/osWorkflow.ts, duplicado só para UX — o backend
 * sempre revalida, então uma cópia desatualizada aqui nunca vira brecha).
 */
export function StatusChanger({ current, onChange, loading }: StatusChangerProps) {
  const options = ALLOWED_TRANSITIONS[current];
  const [selected, setSelected] = useState<OSStatus | ''>('');

  if (options.length === 0) {
    return null;
  }

  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
      <div style={{ minWidth: 220 }}>
        <Select
          label="Alterar status para"
          placeholder="Selecione..."
          value={selected}
          onChange={(e) => setSelected(e.target.value as OSStatus)}
          options={options.map((status) => ({ value: status, label: OS_STATUS_CONFIG[status].label }))}
        />
      </div>
      <Button
        variant="secondary"
        disabled={!selected}
        loading={loading}
        onClick={() => {
          if (selected) {
            onChange(selected);
            setSelected('');
          }
        }}
      >
        Aplicar
      </Button>
    </div>
  );
}
