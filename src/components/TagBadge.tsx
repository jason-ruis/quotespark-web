import './TagBadge.css';

interface TagBadgeProps {
  tag: string;
  size?: 'normal' | 'small';
}

export function TagBadge({ tag, size = 'normal' }: TagBadgeProps) {
  return (
    <span className={`tag-badge tag-badge--${size}`}>
      {tag}
    </span>
  );
}
