import { describe, it, expect } from "vitest";
import { parse } from "../src/parser.js";
import {
  validateCheckDigit,
  decodeISOSizeType,
  detectMessageType,
  lookup,
  segmentInfo,
  diagnoseSingle,
  CODECO,
  COPRAR,
  IFTSTA,
  COREOR,
} from "../src/schemas.js";
import { SAMPLE_CODECO, SAMPLE_COPRAR, SAMPLE_IFTSTA, SAMPLE_COREOR } from "../src/samples.js";

describe("validateCheckDigit", () => {
  it("accepts a known-good ISO 6346 number", () => {
    expect(validateCheckDigit("MSCU1234566")).toBe(true);
    expect(validateCheckDigit("MSCU3456789")).toBe(true);
  });

  it("rejects a known-bad ISO 6346 number", () => {
    expect(validateCheckDigit("MSCU1234567")).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(validateCheckDigit("MSCU12345")).toBe(false);
    expect(validateCheckDigit("mscu1234566")).toBe(false);
    expect(validateCheckDigit("MSCUABCDEFG")).toBe(false);
    expect(validateCheckDigit("")).toBe(false);
  });
});

describe("decodeISOSizeType", () => {
  it("decodes 22G1 (20ft GP)", () => {
    const r = decodeISOSizeType("22G1");
    expect(r).toContain("20ft");
    expect(r).toContain("General purpose");
  });

  it("decodes 45R1 (40ft HC reefer)", () => {
    const r = decodeISOSizeType("45R1");
    expect(r).toContain("40ft");
    expect(r).toContain("Integral reefer");
  });

  it("returns null for unknown codes", () => {
    expect(decodeISOSizeType("99X9")).toBeNull();
    expect(decodeISOSizeType("xxxx")).toBeNull();
  });
});

describe("detectMessageType", () => {
  it("detects CODECO from UNH", () => {
    const r = parse(SAMPLE_CODECO);
    expect(detectMessageType(r)).toBe("CODECO");
  });

  it("detects COPRAR from UNH", () => {
    const r = parse(SAMPLE_COPRAR);
    expect(detectMessageType(r)).toBe("COPRAR");
  });

  it("falls back to BGM document code when UNH is absent", () => {
    const r = parse("BGM+34+REF+9'");
    expect(detectMessageType(r)).toBe("CODECO");
  });

  it("returns null for unknown messages", () => {
    const r = parse("UNH+1+BAPLIE:D:00B:UN:SMDG30'");
    expect(detectMessageType(r)).toBeNull();
  });
});

describe("lookup", () => {
  it("decodes DTM qualifier 137", () => {
    expect(lookup("DTM.qualifier", "137")).toContain("issue");
  });

  it("decodes EQD.fullEmpty 4", () => {
    expect(lookup("EQD.fullEmpty", "4")).toBe("Full");
  });

  it("returns null for unknown codes", () => {
    expect(lookup("DTM.qualifier", "999")).toBeNull();
    expect(lookup("nonexistent.list", "any")).toBeNull();
  });
});

describe("segmentInfo", () => {
  it("returns a friendly name + brief for known tags", () => {
    const info = segmentInfo("EQD");
    expect(info.name).toBe("Equipment Details");
    expect(info.brief).toContain("Container");
  });

  it("returns a fallback for unknown tags", () => {
    const info = segmentInfo("ZZZ");
    expect(info.name).toBe("ZZZ");
    expect(info.brief).toContain("Unknown");
  });
});

describe("diagnoseSingle", () => {
  it("returns clean diagnostics on the SMDG CODECO sample", () => {
    const r = parse(SAMPLE_CODECO);
    const diags = diagnoseSingle(r);
    const errors = diags.filter((d) => d.level === "error");
    expect(errors).toEqual([]);
  });

  it("fires BAD_CHECK_DIGIT when container fails Mod-11", () => {
    const broken = SAMPLE_CODECO.replace(/MSCU1234566/g, "MSCU1234567");
    const r = parse(broken);
    const diags = diagnoseSingle(r);
    expect(diags.some((d) => d.code === "BAD_CHECK_DIGIT")).toBe(true);
  });

  it("fires MISSING_NAD_CF when container operator party absent", () => {
    const broken = SAMPLE_CODECO.replace("NAD+CF+MSC:160:20'\n", "");
    const r = parse(broken);
    const diags = diagnoseSingle(r);
    expect(diags.some((d) => d.code === "MISSING_NAD_CF")).toBe(true);
  });

  it("fires UNT_COUNT_WRONG when segment count is off", () => {
    const broken = SAMPLE_CODECO.replace("UNT+28+CDC0001'", "UNT+99+CDC0001'");
    const r = parse(broken);
    const diags = diagnoseSingle(r);
    expect(diags.some((d) => d.code === "UNT_COUNT_WRONG")).toBe(true);
  });

  it("fires DTM_FORMAT when SMDG-mandated 203 isn't used", () => {
    const broken = SAMPLE_CODECO.replace("DTM+137:202605241430:203'", "DTM+137:20260524:102'");
    const r = parse(broken);
    const diags = diagnoseSingle(r);
    expect(diags.some((d) => d.code === "DTM_FORMAT")).toBe(true);
  });

  it("fires CNT_EQD_MISMATCH when CNT+16 disagrees with EQD count", () => {
    const broken = SAMPLE_CODECO.replace("CNT+16:1'", "CNT+16:5'");
    const r = parse(broken);
    const diags = diagnoseSingle(r);
    expect(diags.some((d) => d.code === "CNT_EQD_MISMATCH")).toBe(true);
  });

  it("fires EMPTY in the special empty-input case", () => {
    const r = parse("");
    const diags = diagnoseSingle(r);
    expect(diags.some((d) => d.code === "EMPTY")).toBe(true);
  });
});

describe("schema exports", () => {
  it("exposes CODECO schema metadata", () => {
    expect(CODECO.name).toBe("CODECO");
    expect(CODECO.bgmCodes).toContain("34");
  });

  it("exposes COPRAR schema metadata", () => {
    expect(COPRAR.name).toBe("COPRAR");
    expect(COPRAR.bgmCodes).toContain("45");
  });

  it("exposes IFTSTA schema metadata", () => {
    expect(IFTSTA.name).toBe("IFTSTA");
    expect(IFTSTA.bgmCodes).toContain("23");
  });

  it("exposes COREOR schema metadata", () => {
    expect(COREOR.name).toBe("COREOR");
    expect(COREOR.bgmCodes).toContain("12");
  });
});

describe("IFTSTA detection + diagnostics", () => {
  it("detects IFTSTA from UNH header", () => {
    const r = parse(SAMPLE_IFTSTA);
    expect(detectMessageType(r)).toBe("IFTSTA");
  });

  it("detects IFTSTA from BGM 23 when UNH is absent", () => {
    const r = parse("BGM+23+REF+9'");
    expect(detectMessageType(r)).toBe("IFTSTA");
  });

  it("parses the SMDG IFTSTA sample cleanly (no errors)", () => {
    const r = parse(SAMPLE_IFTSTA);
    const diags = diagnoseSingle(r);
    const errors = diags.filter((d) => d.level === "error");
    expect(errors).toEqual([]);
  });

  it("fires MISSING_CNI when no CNI present", () => {
    const broken = SAMPLE_IFTSTA.replace(/CNI\+1\+MSCUNLRTM0042:BM'\n/, "");
    const r = parse(broken);
    const diags = diagnoseSingle(r);
    expect(diags.some((d) => d.code === "MISSING_CNI")).toBe(true);
  });

  it("fires MISSING_STS_DTM when an STS lacks a timestamp", () => {
    // Remove the DTM+334 line that follows the first STS
    const broken = SAMPLE_IFTSTA.replace("DTM+334:202605241455:203'\n", "");
    const r = parse(broken);
    const diags = diagnoseSingle(r);
    expect(diags.some((d) => d.code === "MISSING_STS_DTM")).toBe(true);
  });

  it("decodes STS detail code 29 as gate-out", () => {
    expect(lookup("STS.detail", "29")).toContain("Gate-out");
  });

  it("decodes STS qualifier 1 as equipment status", () => {
    expect(lookup("STS.qualifier", "1")).toContain("Equipment");
  });
});

describe("COREOR detection + diagnostics", () => {
  it("detects COREOR from UNH header", () => {
    const r = parse(SAMPLE_COREOR);
    expect(detectMessageType(r)).toBe("COREOR");
  });

  it("detects COREOR from BGM 12 when UNH is absent", () => {
    const r = parse("BGM+12+REF+9'");
    expect(detectMessageType(r)).toBe("COREOR");
  });

  it("parses the SMDG COREOR sample cleanly (no errors)", () => {
    const r = parse(SAMPLE_COREOR);
    const diags = diagnoseSingle(r);
    const errors = diags.filter((d) => d.level === "error");
    expect(errors).toEqual([]);
  });

  it("fires MISSING_AAY when no release ref present", () => {
    const broken = SAMPLE_COREOR.replace(/RFF\+AAY:[^']+'\n/, "");
    const r = parse(broken);
    const diags = diagnoseSingle(r);
    expect(diags.some((d) => d.code === "MISSING_AAY")).toBe(true);
  });

  it("fires MULTIPLE_AAY when more than one release ref present", () => {
    const broken = SAMPLE_COREOR.replace(
      "RFF+AAY:REL-MSCU-NYC-2026-00042'",
      "RFF+AAY:REL-MSCU-NYC-2026-00042'\nRFF+AAY:REL-MSCU-NYC-2026-00043'",
    );
    const r = parse(broken);
    const diags = diagnoseSingle(r);
    expect(diags.some((d) => d.code === "MULTIPLE_AAY")).toBe(true);
  });

  it("fires RELEASE_WITHOUT_ADDRESSEE when neither CN nor BO present", () => {
    const broken = SAMPLE_COREOR.replace(/NAD\+CN\+[^']+'\n/, "").replace(/NAD\+BO\+[^']+'\n/, "");
    const r = parse(broken);
    const diags = diagnoseSingle(r);
    expect(diags.some((d) => d.code === "RELEASE_WITHOUT_ADDRESSEE")).toBe(true);
  });

  it("fires EXPIRED_RELEASE on a past DTM+36 expiration", () => {
    const broken = SAMPLE_COREOR.replace("DTM+36:202606101200:203", "DTM+36:202001011200:203");
    const r = parse(broken);
    const diags = diagnoseSingle(r);
    expect(diags.some((d) => d.code === "EXPIRED_RELEASE")).toBe(true);
  });

  it("fires EMPTY_ON_IMPORT_RELEASE when BGM 12 has empty container", () => {
    // EQD position 5 (sixth element) is full/empty indicator. Replace
    // the +4 at position 5 with +5 (empty). The EQD in the sample is:
    // EQD+CN+MSCU1234566+45G1:102:5++4+4
    // We change the second '4' (the full-empty indicator at index 5) to '5'.
    const broken = SAMPLE_COREOR.replace(
      "EQD+CN+MSCU1234566+45G1:102:5++4+4",
      "EQD+CN+MSCU1234566+45G1:102:5++4+5",
    );
    const r = parse(broken);
    const diags = diagnoseSingle(r);
    expect(diags.some((d) => d.code === "EMPTY_ON_IMPORT_RELEASE")).toBe(true);
  });

  it("decodes BGM doc code 12 as Container release order", () => {
    expect(lookup("BGM.docname", "12")).toContain("release");
  });
});
