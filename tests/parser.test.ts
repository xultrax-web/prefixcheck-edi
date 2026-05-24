import { describe, it, expect } from "vitest";
import {
  parse,
  extractContainerNumbers,
  extractUNLocodes,
  DEFAULT_DELIMITERS,
} from "../src/parser.js";
import { SAMPLE_CODECO, SAMPLE_COPRAR } from "../src/samples.js";

describe("parse · basics", () => {
  it("handles empty input", () => {
    const r = parse("");
    expect(r.segments).toEqual([]);
    expect(r.envelopeWarnings).toContain("Empty input.");
  });

  it("uses default delimiters when no UNA segment", () => {
    const r = parse("UNH+1+CODECO:D:00B:UN:SMDG21'BGM+34+REF+9'UNT+2+1'");
    expect(r.delimiters.element).toBe("+");
    expect(r.delimiters.segment).toBe("'");
    expect(r.segments.length).toBe(3);
  });

  it("reads UNA delimiter overrides", () => {
    const r = parse("UNA:+.? 'UNH+1+CODECO:D:00B:UN:SMDG21'BGM+34+REF+9'UNT+2+1'");
    expect(r.delimiters.composite).toBe(":");
    expect(r.delimiters.element).toBe("+");
    expect(r.delimiters.segment).toBe("'");
    expect(r.segments.length).toBe(3);
  });

  it("tokenizes composite sub-elements", () => {
    const r = parse("LOC+9+USLAX:139:6'");
    expect(r.segments[0].tag).toBe("LOC");
    expect(r.segments[0].elements[1]).toEqual(["USLAX", "139", "6"]);
  });

  it("respects the release character for literal delimiters", () => {
    const r = parse("FTX+AAA+++HARBOUR ?+ TERMINAL'");
    expect(r.segments[0].elements[3]).toEqual(["HARBOUR + TERMINAL"]);
  });

  it("strips whitespace between segments without touching segment content", () => {
    const r = parse("UNH+1+CODECO:D:00B:UN:SMDG21'\r\n  BGM+34+REF+9'\n  UNT+2+1'");
    expect(r.segments.length).toBe(3);
    expect(r.segments.map((s) => s.tag)).toEqual(["UNH", "BGM", "UNT"]);
  });
});

describe("parse · envelopes", () => {
  it("extracts UNB interchange metadata", () => {
    const r = parse(SAMPLE_CODECO);
    expect(r.interchange).not.toBeNull();
    expect(r.interchange?.sender).toBe("TERMINAL01");
    expect(r.interchange?.recipient).toBe("MSCU");
    expect(r.interchange?.controlRef).toBe("CDC00012345");
    expect(r.interchange?.syntaxId).toBe("UNOA");
  });

  it("extracts UNH message metadata", () => {
    const r = parse(SAMPLE_CODECO);
    expect(r.message).not.toBeNull();
    expect(r.message?.type).toBe("CODECO");
    expect(r.message?.version).toBe("D");
    expect(r.message?.release).toBe("00B");
    expect(r.message?.assocCode).toBe("SMDG21");
  });

  it("warns when UNB has no matching UNZ", () => {
    const r = parse("UNB+UNOA:2+A+B+260524:0900+R001'UNH+1+CODECO:D:00B:UN:SMDG21'");
    expect(r.envelopeWarnings.some((w) => w.includes("no UNZ"))).toBe(true);
  });

  it("warns when no UNH is present", () => {
    const r = parse("BGM+34+REF+9'");
    expect(r.envelopeWarnings.some((w) => w.includes("No UNH"))).toBe(true);
  });
});

describe("extractContainerNumbers", () => {
  it("finds every ISO 6346-shaped token, dedup'd", () => {
    const r = parse(SAMPLE_CODECO);
    const numbers = extractContainerNumbers(r);
    expect(numbers).toContain("MSCU1234566");
    expect(numbers.length).toBe(new Set(numbers).size);
  });

  it("returns an empty array when no container numbers present", () => {
    const r = parse("UNH+1+CODECO:D:00B:UN:SMDG21'UNT+1+1'");
    expect(extractContainerNumbers(r)).toEqual([]);
  });
});

describe("extractUNLocodes", () => {
  it("pulls all 5-char UN/LOCODEs from LOC segments", () => {
    const r = parse(SAMPLE_CODECO);
    const locs = extractUNLocodes(r);
    expect(locs).toContain("NLRTM");
    expect(locs).toContain("USNYC");
  });

  it("ignores malformed location codes", () => {
    const r = parse("LOC+9+nlrtm:139:6'");
    expect(extractUNLocodes(r)).toEqual([]);
  });
});

describe("DEFAULT_DELIMITERS", () => {
  it("is the EDIFACT Level A defaults", () => {
    expect(DEFAULT_DELIMITERS.element).toBe("+");
    expect(DEFAULT_DELIMITERS.composite).toBe(":");
    expect(DEFAULT_DELIMITERS.segment).toBe("'");
    expect(DEFAULT_DELIMITERS.release).toBe("?");
  });
});

describe("parse · COPRAR sample", () => {
  it("parses the full SMDG COPRAR sample cleanly", () => {
    const r = parse(SAMPLE_COPRAR);
    expect(r.message?.type).toBe("COPRAR");
    const containers = extractContainerNumbers(r);
    expect(containers).toContain("MSCU1234566");
    expect(containers).toContain("MSCU2345672");
    expect(containers).toContain("MSCU3456789");
  });
});
