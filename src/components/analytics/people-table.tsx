"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { SERIES, STATUS } from "./palette";
import type { PersonStats } from "./types";

type SortKey =
  | "name"
  | "open"
  | "overdue"
  | "dueThisWeek"
  | "completed"
  | "onTimeRate"
  | "medianCycleHours";

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "name", label: "Person", numeric: false },
  { key: "open", label: "Open", numeric: true },
  { key: "overdue", label: "Overdue", numeric: true },
  { key: "dueThisWeek", label: "This week", numeric: true },
  { key: "completed", label: "Completed", numeric: true },
  { key: "onTimeRate", label: "On time", numeric: true },
  { key: "medianCycleHours", label: "Median cycle", numeric: true },
];

function hours(value: number | null): string {
  if (value === null) return "—";
  if (value < 24) return `${Math.round(value)}h`;
  return `${Math.round((value / 24) * 10) / 10}d`;
}

/**
 * Everyone's numbers side by side.
 *
 * A table, not a chart: seven measures across a roster is well past the point
 * where colour classes stop being readable, and a reader comparing two people
 * wants the figures, not a shape. The one bit of colour is the on-time meter,
 * which is a ratio against a limit.
 */
export function PeopleTable({
  people,
  rangeDays,
}: {
  people: PersonStats[];
  rangeDays: number;
}) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "open",
    desc: true,
  });

  const rows = useMemo(() => {
    const sorted = [...people].sort((a, b) => {
      if (sort.key === "name") return a.name.localeCompare(b.name);
      const av = a[sort.key];
      const bv = b[sort.key];
      // Nobody with no data outranks somebody with data, either direction.
      if (av === null) return 1;
      if (bv === null) return -1;
      return (av as number) - (bv as number);
    });
    return sort.desc && sort.key !== "name" ? sorted.reverse() : sorted;
  }, [people, sort]);

  function toggle(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, desc: !current.desc }
        : { key, desc: key !== "name" }
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-[12px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.12em] text-faint">
            {COLUMNS.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`pb-2 font-normal ${column.numeric ? "text-right" : "text-left"}`}
              >
                <button
                  type="button"
                  onClick={() => toggle(column.key)}
                  className={`inline-flex items-center gap-1 transition-colors hover:text-foreground ${
                    sort.key === column.key ? "text-foreground" : ""
                  }`}
                >
                  {column.label}
                  {sort.key === column.key &&
                    (sort.desc ? <ArrowDown size={10} /> : <ArrowUp size={10} />)}
                </button>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((person) => (
            <tr
              key={person.userId}
              className="border-t border-[color-mix(in_oklab,white_6%,transparent)]"
            >
              <td className="py-2 pr-3">
                <Link
                  href={`/people/${person.userId}`}
                  className="flex items-center gap-2 transition-colors hover:text-foreground"
                >
                  <Avatar
                    avatarUrl={person.avatarUrl}
                    image={person.image}
                    name={person.name}
                    size={20}
                  />
                  <span className="truncate">{person.name}</span>
                </Link>
              </td>

              <td className="py-2 text-right tabular-nums">{person.open}</td>

              <td className="py-2 text-right tabular-nums">
                <span
                  style={
                    person.overdue > 0 ? { color: STATUS.critical } : undefined
                  }
                >
                  {person.overdue}
                </span>
              </td>

              <td className="py-2 text-right tabular-nums text-muted-foreground">
                {person.dueThisWeek}
              </td>

              <td className="py-2 text-right tabular-nums">
                {person.completed}
              </td>

              <td className="py-2 text-right">
                {person.onTimeRate === null ? (
                  <span className="text-faint">—</span>
                ) : (
                  <span className="flex items-center justify-end gap-2">
                    {/* A meter — one ratio against a limit, on the same hue as
                        the rest of the page's magnitude marks. */}
                    <span className="hidden h-1 w-12 overflow-hidden rounded-full bg-[color-mix(in_oklab,white_8%,transparent)] sm:block">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${Math.round(person.onTimeRate * 100)}%`,
                          backgroundColor: SERIES[0],
                        }}
                      />
                    </span>
                    <span className="w-9 tabular-nums">
                      {Math.round(person.onTimeRate * 100)}%
                    </span>
                  </span>
                )}
              </td>

              <td className="py-2 text-right tabular-nums text-muted-foreground">
                {hours(person.medianCycleHours)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 text-[11px] text-faint">
        Open, overdue and this week are as of now. Completed, on time and median
        cycle cover the last {rangeDays} days.
      </p>
    </div>
  );
}
