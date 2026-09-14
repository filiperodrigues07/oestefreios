import styles from './Skeleton.module.css';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ width = '100%', height = 16 }: SkeletonProps) {
  return <div className={styles.skeleton} style={{ width, height }} aria-hidden="true" />;
}
