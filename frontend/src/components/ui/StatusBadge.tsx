import { OS_PRIORITY_CONFIG, OS_STATUS_CONFIG, type OSStatus } from '../../constants/osStatus.js';
import { Badge } from './Badge.js';
import styles from './StatusBadge.module.css';

export function StatusBadge({ status }: { status: OSStatus }) {
  const config = OS_STATUS_CONFIG[status];
  return (
    <Badge tone={config.tone} className={styles.statusBadge}>
      <span className={`${styles.dot} ${styles[config.tone]}`} aria-hidden="true" />
      {config.label}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: keyof typeof OS_PRIORITY_CONFIG }) {
  const config = OS_PRIORITY_CONFIG[priority];
  return (
    <Badge tone={config.tone} className={`${styles.priorityBadge} ${styles[`priority${priority}`]}`}>
      <span className={styles.dot} aria-hidden="true" />
      {config.label}
    </Badge>
  );
}
