/**
 * Mock implementation of the Dataview plugin API for use in tests.
 */
import type { DataviewApi, DataviewPage, DataviewArray, DataviewTask, DataviewLink } from "../../src/types";

// ─── DataviewArray mock ────────────────────────────────────────────────────

export function createDataviewArray<T>(items: T[]): DataviewArray<T> {
  const arr: DataviewArray<T> = {
    length: items.length,
    values: items,
    where(predicate) {
      return createDataviewArray(items.filter(predicate));
    },
    sort<K>(key: (item: T) => K, order: "asc" | "desc" = "asc") {
      const sorted = [...items].sort((a, b) => {
        const ka = key(a);
        const kb = key(b);
        const cmp = ka < kb ? -1 : ka > kb ? 1 : 0;
        return order === "asc" ? cmp : -cmp;
      });
      return createDataviewArray(sorted);
    },
    map<U>(mapper: (item: T) => U) {
      return createDataviewArray(items.map(mapper));
    },
    filter(predicate) {
      return createDataviewArray(items.filter(predicate));
    },
    [Symbol.iterator]() {
      return items[Symbol.iterator]();
    },
  };

  // Numeric indexing
  for (let i = 0; i < items.length; i++) {
    (arr as unknown as Record<number, T>)[i] = items[i];
  }

  return arr;
}

// ─── Page factory ──────────────────────────────────────────────────────────

export interface MockPageData {
  path: string;
  name?: string;
  folder?: string;
  tags?: string[];
  frontmatter?: Record<string, unknown>;
  tasks?: Array<Partial<DataviewTask>>;
}

export function createMockPage(data: MockPageData): DataviewPage {
  const path = data.path;
  const name = data.name ?? path.split("/").pop()?.replace(/\.md$/, "") ?? path;
  const folder = data.folder ?? path.split("/").slice(0, -1).join("/");
  const fm = data.frontmatter ?? {};
  const taskItems = (data.tasks ?? []).map((t, i) =>
    createMockTask({ path, line: i, ...t })
  );

  const fileLink: DataviewLink = { path, type: "file" };
  const mtimeDate = new Date();

  return {
    file: {
      name,
      path,
      folder,
      link: fileLink,
      tags: data.tags ?? [],
      mtime: { valueOf: () => mtimeDate.valueOf(), toISO: () => mtimeDate.toISOString() },
      tasks: createDataviewArray(taskItems),
    },
    ...fm,
  } as DataviewPage;
}

export function createMockTask(data: Partial<DataviewTask> & { path: string }): DataviewTask {
  return {
    text: data.text ?? "Sample task",
    completed: data.completed ?? false,
    path: data.path,
    line: data.line ?? 0,
    link: data.link ?? { path: data.path, type: "file" },
    due: data.due,
    tags: data.tags ?? [],
    ...data,
  };
}

// ─── DataviewApi mock factory ──────────────────────────────────────────────

export function createMockDataviewApi(pages: MockPageData[]): DataviewApi {
  const mockPages = pages.map(createMockPage);

  const pageMap = new Map(mockPages.map((p) => [p.file.path, p]));

  const api: DataviewApi = {
    pages(source?: string) {
      if (!source) return createDataviewArray(mockPages);

      // Handle tag sources like "#client" or complex "#tag AND !\"folder\""
      if (source.startsWith("#")) {
        const tag = source.split(/\s+AND\s+/i)[0].trim();
        return createDataviewArray(
          mockPages.filter((p) => p.file.tags.includes(tag))
        );
      }

      // Handle folder sources like '"clients"'
      if (source.startsWith('"') && source.endsWith('"')) {
        const folder = source.slice(1, -1);
        return createDataviewArray(
          mockPages.filter((p) => p.file.folder === folder || p.file.path.startsWith(folder + "/"))
        );
      }

      // Handle link sources like "[[FileName]]"
      if (source.startsWith("[[")) {
        const name = source.replace(/^\[\[/, "").replace(/\]\]$/, "");
        return createDataviewArray(
          mockPages.filter((p) =>
            p.file.name === name || p.file.path.includes(name)
          )
        );
      }

      return createDataviewArray(mockPages);
    },

    page(path: string) {
      // Try exact path first, then with .md extension (mirrors Dataview behaviour)
      return pageMap.get(path) ?? pageMap.get(path + ".md") ?? null;
    },

    date(value: unknown) {
      const str = String(value).substring(0, 10);
      const d = new Date(str);
      return {
        equals: (other: ReturnType<DataviewApi["date"]>) =>
          str === other.toString(),
        plus: (duration: { days?: number; weeks?: number }) => {
          const next = new Date(d);
          if (duration.days) next.setDate(next.getDate() + duration.days);
          if (duration.weeks) next.setDate(next.getDate() + duration.weeks * 7);
          return api.date(next.toISOString().split("T")[0]);
        },
        toString: () => str,
        toISOString: () => d.toISOString(),
        valueOf: () => d.valueOf(),
      };
    },

    func: {
      contains(value: unknown, target: unknown): boolean {
        if (!value) return false;
        if (Array.isArray(value)) {
          return value.some(
            (v) =>
              String(v) === String(target) ||
              (typeof v === "object" && v !== null && "path" in v &&
                (v as DataviewLink).path === (target as DataviewLink)?.path)
          );
        }
        if (typeof value === "object" && value !== null && "path" in value) {
          const t = target as DataviewLink;
          return (value as DataviewLink).path === t?.path;
        }
        return String(value).includes(String(target));
      },
    },
  };

  return api;
}
