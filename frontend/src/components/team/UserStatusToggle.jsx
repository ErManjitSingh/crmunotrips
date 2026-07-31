import Switch from '../ui/switch';

export default function UserStatusToggle({
  active = false,
  disabled = false,
  loading = false,
  onChange,
  size = 'md',
}) {
  return (
    <Switch
      checked={active}
      disabled={disabled}
      loading={loading}
      size={size}
      tone="emerald"
      title={active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
      aria-label={active ? 'Deactivate user' : 'Activate user'}
      onCheckedChange={(next) => onChange?.(next)}
    />
  );
}
