export function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center min-h-[400px]">
      <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full"></div>
    </div>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
      <h2 className="text-xl font-bold text-red-800 mb-2">Erreur</h2>
      <p className="text-red-600">{message}</p>
    </div>
  );
}