import { describe, expect, test } from "vitest";
import { generatePertemuanDates } from "./kelas";

describe("generatePertemuanDates", () => {
  test("returns empty when there is no jadwal slot", () => {
    expect(generatePertemuanDates("2026-01-01", [], 10)).toEqual([]);
  });

  test("returns empty when jumlahPertemuan is zero or negative", () => {
    expect(generatePertemuanDates("2026-01-01", [{ hari: 1 }], 0)).toEqual([]);
    expect(generatePertemuanDates("2026-01-01", [{ hari: 1 }], -1)).toEqual([]);
  });

  test("walks forward to the next matching weekday, starting on the day itself if it matches", () => {
    // 2026-01-01 is a Thursday (hari=4).
    const dates = generatePertemuanDates("2026-01-01", [{ hari: 4 }], 3);
    expect(dates).toEqual(["2026-01-01", "2026-01-08", "2026-01-15"]);
  });

  test("supports multiple weekly slots and returns one date per matching day", () => {
    // 2026-01-01 (Thu) — jadwal on Tue(2) & Thu(4).
    const dates = generatePertemuanDates(
      "2026-01-01",
      [{ hari: 2 }, { hari: 4 }],
      4
    );
    expect(dates).toEqual([
      "2026-01-01",
      "2026-01-06",
      "2026-01-08",
      "2026-01-13",
    ]);
  });

  test("does not double count a day matched by two slots", () => {
    const dates = generatePertemuanDates(
      "2026-01-01",
      [{ hari: 4 }, { hari: 4 }],
      2
    );
    expect(dates).toEqual(["2026-01-01", "2026-01-08"]);
  });
});
