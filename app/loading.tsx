export default function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-3">
        <img
          src="/pictures/filipinohomespointer.png"
          alt="Loading"
          width={64}
          height={64}
          className="animate-bounce"
        />
        <p className="text-sm text-gray-600">Loading…</p>
      </div>
    </div>
  );
}
