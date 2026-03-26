interface SkeletonRowProps {
  cols?: number;
}

export function SkeletonRow({ cols = 4 }: SkeletonRowProps) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-200 bg-white p-6 space-y-3">
      <div className="h-4 bg-gray-200 rounded w-1/3" />
      <div className="h-8 bg-gray-200 rounded w-1/2" />
    </div>
  );
}
