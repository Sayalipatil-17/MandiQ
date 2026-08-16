// Skeleton loaders — spinner ki jagah premium loading feel

export function SkeletonPriceCard() {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-md border border-gray-100 mq-fadein">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="skeleton h-3 w-24 mb-2" />
          <div className="skeleton h-4 w-36" />
        </div>
        <div className="skeleton h-7 w-20 rounded-full" />
      </div>
      <div className="bg-gray-50 rounded-2xl px-4 py-4 mb-4">
        <div className="skeleton h-12 w-40 mb-3" />
        <div className="flex gap-6">
          <div>
            <div className="skeleton h-3 w-16 mb-1" />
            <div className="skeleton h-5 w-20" />
          </div>
          <div>
            <div className="skeleton h-3 w-16 mb-1" />
            <div className="skeleton h-5 w-20" />
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        {[0,1,2,3].map(i => (
          <div key={i} className="skeleton flex-shrink-0 h-14 w-16 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonAdviceCard() {
  return (
    <div className="rounded-3xl p-5 border-2 border-gray-100 bg-white mq-fadein">
      <div className="flex items-center gap-3 mb-3">
        <div className="skeleton w-10 h-10 rounded-2xl" />
        <div>
          <div className="skeleton h-4 w-20 mb-1" />
          <div className="skeleton h-3 w-14" />
        </div>
      </div>
      <div className="skeleton h-6 w-64 mb-2" />
      <div className="skeleton h-4 w-48" />
    </div>
  );
}

export function SkeletonListItem() {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center justify-between mq-fadein">
      <div className="flex items-center gap-3">
        <div className="skeleton w-12 h-12 rounded-2xl" />
        <div>
          <div className="skeleton h-4 w-20 mb-2" />
          <div className="skeleton h-3 w-14" />
        </div>
      </div>
      <div className="text-right">
        <div className="skeleton h-6 w-16 mb-1" />
        <div className="skeleton h-3 w-12" />
      </div>
    </div>
  );
}
