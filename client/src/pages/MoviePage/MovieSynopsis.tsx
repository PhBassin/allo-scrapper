export function MovieSynopsis({
  synopsis,
  actors,
}: {
  synopsis?: string;
  actors?: string[];
}) {
  if (!synopsis) return null;
  return (
    <section className="bg-white rounded-xl border border-gray-100 p-6">
      <h2 className="text-xl font-bold mb-3">Synopsis</h2>
      <p className="text-gray-700 leading-relaxed whitespace-pre-line">{synopsis}</p>

      {actors && actors.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-50">
          <h3 className="text-sm font-bold text-gray-500 uppercase mb-2">Avec</h3>
          <p className="text-sm text-gray-700">{actors.join(', ')}</p>
        </div>
      )}
    </section>
  );
}
