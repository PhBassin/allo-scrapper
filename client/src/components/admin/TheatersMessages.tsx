interface TheatersMessagesProps {
  successMessage: string | null;
  errorMessage: string | null;
}

export function TheatersMessages({ successMessage, errorMessage }: TheatersMessagesProps) {
  return (
    <>
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">{successMessage}</p>
        </div>
      )}
      {errorMessage && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{errorMessage}</p>
        </div>
      )}
    </>
  );
}