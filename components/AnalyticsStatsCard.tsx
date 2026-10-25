"use client";

export function AnalyticsStatsCard({
  title,
  data,
  color,
}: {
  title: string;
  data: Record<string, number>;
  color: string;
}) {
  // Sort entries based on the title
  const entries = Object.entries(data).sort((a, b) => {
    // For "Clicks by Submission", sort by submission number in ascending order
    if (title === "Clicks by Submission") {
      const aIsNumeric = !isNaN(Number(a[0]));
      const bIsNumeric = !isNaN(Number(b[0]));

      if (aIsNumeric && bIsNumeric) {
        return Number(a[0]) - Number(b[0]); // Ascending numeric order
      }
      if (aIsNumeric) return -1;
      if (bIsNumeric) return 1;
      return a[0].localeCompare(b[0]); // Alphabetical order for non-numeric
    }

    // For all other cards, sort by count (descending)
    return b[1] - a[1];
  });
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  const colorMap: Record<string, string> = {
    blue: "from-blue-500 to-blue-600",
    emerald: "from-emerald-500 to-emerald-600",
    orange: "from-orange-500 to-orange-600",
    cyan: "from-cyan-500 to-cyan-600",
    amber: "from-amber-500 to-amber-600",
    violet: "from-violet-500 to-violet-600",
    green: "from-green-500 to-green-600",
    slate: "from-slate-500 to-slate-600",
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200/60 p-4 sm:p-6 hover:shadow-xl transition-shadow duration-300">
      <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-4 sm:mb-5 flex items-center gap-2">
        <div
          className={`w-1 h-6 rounded-full bg-gradient-to-b ${colorMap[color]}`}
        ></div>
        {title}
      </h3>
      {entries.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-slate-500 text-xs sm:text-sm font-medium">
            No data available
          </p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {entries.map(([key, count], idx) => {
            const percentage = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={key} className="group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs font-bold text-slate-500 flex-shrink-0">
                      #{idx + 1}
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-700 truncate">
                      {key || "Unknown"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="text-xs text-slate-500 font-medium">
                      {percentage.toFixed(0)}%
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded-lg">
                      {count}
                    </span>
                  </div>
                </div>
                <div className="relative w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full bg-gradient-to-r ${colorMap[color]} transition-all duration-500 ease-out relative`}
                    style={{ width: `${percentage}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
