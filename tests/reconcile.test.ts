import { describe, it, expect } from "vitest";
import { parse } from "../src/parser.js";
import { reconcile } from "../src/schemas.js";
import { SAMPLE_CODECO, SAMPLE_COPRAR } from "../src/samples.js";

describe("reconcile · clean COPRAR + CODECO pair", () => {
  it("matches the shared container without diffs", () => {
    const coprar = parse(SAMPLE_COPRAR);
    const codeco = parse(SAMPLE_CODECO);
    const r = reconcile(coprar, codeco);
    expect(r.coprarType).toBe("COPRAR");
    expect(r.codecoType).toBe("CODECO");
    expect(r.matched.length).toBe(1);
    expect(r.matched[0].number).toBe("MSCU1234566");
    expect(r.matched[0].diffs).toEqual([]);
  });

  it("lists the COPRAR-only containers as expected-but-not-gated", () => {
    const coprar = parse(SAMPLE_COPRAR);
    const codeco = parse(SAMPLE_CODECO);
    const r = reconcile(coprar, codeco);
    expect(r.inCoprarOnly).toContain("MSCU2345672");
    expect(r.inCoprarOnly).toContain("MSCU3456789");
  });

  it("reports correct counts", () => {
    const coprar = parse(SAMPLE_COPRAR);
    const codeco = parse(SAMPLE_CODECO);
    const r = reconcile(coprar, codeco);
    expect(r.coprarCount).toBe(3);
    expect(r.codecoCount).toBe(1);
  });
});

describe("reconcile · field-level diffs", () => {
  it("flags POL mismatch as error", () => {
    const coprar = parse(SAMPLE_COPRAR);
    const codecoModified = parse(SAMPLE_CODECO.replace(/NLRTM/g, "NLAMS"));
    const r = reconcile(coprar, codecoModified);
    const matched = r.matched.find((m) => m.number === "MSCU1234566");
    expect(matched).toBeDefined();
    expect(matched?.diffs.some((d) => d.field === "POL" && d.severity === "error")).toBe(true);
  });

  it("flags gross-weight mismatch beyond 2% as warn", () => {
    const coprar = parse(SAMPLE_COPRAR);
    // CODECO sample has 28450 kg; bump it to 30000 kg = +5.4%
    const codecoModified = parse(
      SAMPLE_CODECO.replace("MEA+AAE+AET+KGM:28450", "MEA+AAE+AET+KGM:30000"),
    );
    const r = reconcile(coprar, codecoModified);
    const matched = r.matched.find((m) => m.number === "MSCU1234566");
    expect(matched?.diffs.some((d) => d.field === "Gross weight")).toBe(true);
  });

  it("does NOT flag gross-weight within 2% tolerance", () => {
    const coprar = parse(SAMPLE_COPRAR);
    // Bump by 1% (28450 → 28550 = +0.35%)
    const codecoModified = parse(
      SAMPLE_CODECO.replace("MEA+AAE+AET+KGM:28450", "MEA+AAE+AET+KGM:28550"),
    );
    const r = reconcile(coprar, codecoModified);
    const matched = r.matched.find((m) => m.number === "MSCU1234566");
    expect(matched?.diffs.some((d) => d.field === "Gross weight")).toBe(false);
  });
});

describe("reconcile · disjoint sets", () => {
  it("handles two messages with zero overlap", () => {
    const empty = parse("UNH+1+CODECO:D:00B:UN:SMDG21'UNT+1+1'");
    const coprar = parse(SAMPLE_COPRAR);
    const r = reconcile(coprar, empty);
    expect(r.matched).toEqual([]);
    expect(r.inCoprarOnly.length).toBe(3);
    expect(r.inCodecoOnly).toEqual([]);
  });

  it("handles two empty messages", () => {
    const a = parse("");
    const b = parse("");
    const r = reconcile(a, b);
    expect(r.coprarCount).toBe(0);
    expect(r.codecoCount).toBe(0);
    expect(r.matched).toEqual([]);
  });
});
