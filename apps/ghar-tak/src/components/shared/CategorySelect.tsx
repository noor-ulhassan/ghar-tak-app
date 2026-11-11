import { useListCategories } from '@workspace/api-client-react';

const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Category picker built from the site's category list, so a store lands on the
 * matching category page. Service providers get service categories; stores and
 * restaurants get product ones. It stores the category's name, as typed
 * categories always did.
 */
export default function CategorySelect({
  id,
  value,
  onChange,
  providerType,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  providerType: string;
}) {
  const { data } = useListCategories({ query: { queryKey: ['listCategories'] } });
  const wantedType = providerType === 'service' ? 'service' : 'product';
  const options = (Array.isArray(data) ? data : [])
    .filter((c) => c.type === wantedType || c.type === 'both')
    .map((c) => c.name);

  // A category saved before this list existed stays selectable, so editing
  // other shop details doesn't erase it.
  const current = options.find((name) => name.toLowerCase() === value.trim().toLowerCase()) ?? value;
  if (current && !options.includes(current)) options.push(current);

  return (
    <select id={id} className={SELECT_CLASS} value={current} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choose a category</option>
      {options.map((name) => (
        <option key={name} value={name}>{name}</option>
      ))}
    </select>
  );
}
