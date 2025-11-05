export function Empty({ title, description }: { title: string; description?: string }) {
  return (
    <div className="card">
      <h1 className="text-xl font-semibold">{title}</h1>
      {description && <p className="text-gray-600 mt-2">{description}</p>}
      <div className="mt-6 h-40 rounded-xl border border-dashed border-gray-300 bg-gray-50" />
    </div>
  );
}