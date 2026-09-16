import styles from './Avatar.module.css';

interface AvatarProps {
  name: string;
  photoUrl?: string;
  size?: number;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Iniciais por padrão — `photoUrl` já preparado pra quando existir upload de foto de perfil. */
export function Avatar({ name, photoUrl, size = 36 }: AvatarProps) {
  const src = photoUrl?.startsWith('/uploads/') ? `/api${photoUrl}` : photoUrl;
  return (
    <div className={styles.avatar} style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">
      {src ? <img src={src} alt="" /> : getInitials(name)}
    </div>
  );
}
