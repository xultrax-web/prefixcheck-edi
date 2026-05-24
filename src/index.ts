// ============================================================
// @prefixcheck/edi · public entry
//
// Operator-grade EDIFACT CODECO + COPRAR decoder, SMDG validator,
// and COPRAR ↔ CODECO reconciler. Pure TypeScript, zero deps,
// browser- and Node-friendly.
//
// Quick start:
//
//   import { parse, diagnoseSingle, reconcile, SAMPLE_CODECO } from "@prefixcheck/edi";
//
//   const parsed = parse(SAMPLE_CODECO);
//   console.log(parsed.message?.type);           // "CODECO"
//   console.log(parsed.segments.length);         // 30
//
//   const diags = diagnoseSingle(parsed);
//   console.log(diags);                          // [] when clean
//
//   const coprar = parse(coprarText);
//   const codeco = parse(codecoText);
//   const report = reconcile(coprar, codeco);
//   console.log(report.matched.length, "matched");
//
// See the README for the full API + diagnostic rule catalogue.
// ============================================================

export {
  parse,
  extractContainerNumbers,
  extractUNLocodes,
  DEFAULT_DELIMITERS,
} from "./parser.js";

export {
  validateCheckDigit,
  decodeISOSizeType,
  detectMessageType,
  lookup,
  segmentInfo,
  diagnoseSingle,
  reconcile,
  CODECO,
  COPRAR,
  SEGMENTS,
  CODE_LISTS,
  type SegmentInfo,
} from "./schemas.js";

export { SAMPLE_CODECO, SAMPLE_COPRAR } from "./samples.js";

export type {
  Delimiters,
  Segment,
  Interchange,
  Message,
  ParsedMessage,
  Diagnostic,
  ReconcileDiff,
  MatchedContainer,
  ReconcileReport,
  MessageType,
  MessageSchema,
} from "./types.js";
