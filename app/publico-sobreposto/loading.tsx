import { Skeleton } from "../_components/Skeleton";

export default function PublicoSobrepostoLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}
