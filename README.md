# @prefixcheck/edi

Operator-grade EDIFACT **CODECO** + **COPRAR** decoder, **SMDG-aware** validator, and **cross-message reconciler** for container-shipping operations. Pure TypeScript, zero dependencies, browser- and Node-friendly.

```bash
npm install @prefixcheck/edi
```

```ts
import { parse, diagnoseSingle, reconcile, SAMPLE_CODECO, SAMPLE_COPRAR } from "@prefixcheck/edi";

const parsed = parse(SAMPLE_CODECO);
console.log(parsed.message?.type); // "CODECO"
console.log(parsed.segments.length); // 30

const diags = diagnoseSingle(parsed);
console.log(diags); // [] when the message is clean

const coprar = parse(SAMPLE_COPRAR);
const codeco = parse(SAMPLE_CODECO);
const report = reconcile(coprar, codeco);
console.log(report.matched); // [{ number: "MSCU1234566", diffs: [] }]
```

---

## Why this library exists

Container-shipping EDI is a closed-world skill. The people who know CODECO and COPRAR sell consulting, not libraries. Existing open-source EDIFACT parsers tell you _what each segment is_; none of them tell you _what's wrong_ with the message you have, _speak SMDG_, _validate ISO 6346 check digits_, or _reconcile a COPRAR against its matching CODECO_. That's the gap this library fills.

Built on:

- **UN/EDIFACT D.00B** directories (UNECE)
- **SMDG 2.1.3 ST VGM** Implementation Guides for CODECO + COPRAR
- **SMDG Recommendation 07** (code lists), JM4/120 (FTX), JM4/272 (damage)
- **ISO 6346** mod-11 check-digit algorithm
- Operator-side guides from DAKOSY (Hamburg), Valenciaport PCS, Transnet, EPB Bilbao

---

## What's in the box

### Parser (`parse`)

EDIFACT tokenizer that handles:

- Optional **UNA** service segment for delimiter overrides
- **UNB / UNZ** interchange envelope extraction
- **UNH / UNT** message envelope extraction
- Release-character escape (default `?`) for literal delimiters
- Whitespace normalisation between segments (handles both single-line and CR/LF-separated transmissions)
- Bare segment bodies, full interchanges, or anything in between

Output is a `ParsedMessage` with structured `segments[]`, envelope metadata, and warnings.

### Schema (`SEGMENTS`, `CODE_LISTS`, `CODECO`, `COPRAR`)

A 32-segment dictionary with operator-grade explanations for every common CODECO/COPRAR segment, plus 17 code-list lookups:

| List                                        | Codes                          | Source                        |
| ------------------------------------------- | ------------------------------ | ----------------------------- |
| `BGM.docname`, `BGM.function`               | Document + function codes      | UN/CEFACT 1001, 1225          |
| `DTM.qualifier`, `DTM.format`               | Date/time qualifiers + formats | UN/CEFACT 2005, 2379          |
| `LOC.qualifier`                             | Place qualifiers               | UN/CEFACT 3227                |
| `EQD.type`, `EQD.supplier`, `EQD.fullEmpty` | Equipment metadata             | UN/CEFACT 8053, 8077, 8169    |
| `STS.code`                                  | Status codes + SMDG attributes | UN/CEFACT 9015 + SMDG JM4/170 |
| `RFF.qualifier`                             | Reference qualifiers           | UN/CEFACT 1153                |
| `NAD.party`                                 | Party qualifiers               | UN/CEFACT 3035                |
| `MEA.qualifier`, `MEA.unit`                 | Measurement + units            | UN/CEFACT 6313, 6411          |
| `VGM.method`                                | SOLAS VGM method codes         | SMDG 2.1.3 ST VGM             |
| `HAN.code`                                  | Handling instruction codes     | UN/CEFACT 4079 + SMDG JM4/121 |
| `SEL.party`                                 | Seal-applying party            | UN/CEFACT 9303                |
| `FTX.qualifier`                             | Free text qualifiers           | UN/CEFACT 4451                |
| `TDT.mode`, `TDT.idCodeList`                | Transport mode + ID code lists | UN/CEFACT 8067, 1131          |
| `CNT.qualifier`                             | Control total qualifiers       | UN/CEFACT 6069                |
| `UNB.syntax`                                | Syntax level codes             | UN/CEFACT 0001                |

### Diagnostics (`diagnoseSingle`)

Eleven validation rules implementing the operator-grade checks that paid EDI consultants run:

| Code                 | Level       | Catches                                          |
| -------------------- | ----------- | ------------------------------------------------ |
| `BAD_CHECK_DIGIT`    | error       | Container number fails ISO 6346 mod-11           |
| `BAD_BIC_FORMAT`     | warn        | Equipment ID not in 4-letter + 7-digit shape     |
| `BAD_LOCODE_FORMAT`  | warn        | LOC place doesn't match UN/LOCODE pattern        |
| `DTM_FORMAT`         | warn / info | Date format not SMDG-mandated 203                |
| `MISSING_NAD_CF`     | error       | No container operator party (SMDG requires it)   |
| `EMPTY_BUT_HEAVY`    | error       | EQD declared empty but gross weight exceeds tare |
| `UNKNOWN_SIZETYPE`   | warn        | ISO 4-char size-type not in catalogue            |
| `UNT_COUNT_WRONG`    | error       | UNT count ≠ actual UNH→UNT inclusive count       |
| `CNT_EQD_MISMATCH`   | error       | CNT+16 disagrees with EQD count                  |
| `REEFER_WITHOUT_TMP` | warn        | R-type ISO size but no TMP setpoint              |
| `LOAD_BUT_EMPTY`     | warn        | COPRAR Load order but EQD declares empty         |
| `MISSING_VGM`        | warn        | Full container on Load order missing SOLAS VGM   |
| `CHARSET_LOWERCASE`  | warn        | UNB declares UNOA but body contains lowercase    |

### Reconcile (`reconcile`)

Cross-message matching for a COPRAR + its matching CODECO. For every shared container number, compares the relevant operator-level fields and surfaces diffs at the right severity:

| Field              | Tolerance   | Severity |
| ------------------ | ----------- | -------- |
| ISO size-type      | exact match | error    |
| Full/empty         | exact match | error    |
| POL                | exact match | error    |
| POD                | exact match | error    |
| Booking ref        | exact match | warn     |
| Gross weight       | ±2%         | warn     |
| VGM                | ±5%         | warn     |
| Reefer temperature | ±1°C        | warn     |

Also returns:

- `matched[]` — containers in both messages, with field-level diffs
- `inCoprarOnly[]` — expected on load list but never gated
- `inCodecoOnly[]` — gated but not on the load list

---

## API

### `parse(rawInput: string): ParsedMessage`

Tokenize raw EDIFACT text. Accepts bare message bodies or full interchanges. Always returns a `ParsedMessage` — never throws.

### `diagnoseSingle(parsed: ParsedMessage): Diagnostic[]`

Run all single-message diagnostic rules. Empty array = clean.

### `reconcile(coprar: ParsedMessage, codeco: ParsedMessage): ReconcileReport`

Cross-message reconciliation. See the table above for fields and tolerances.

### `detectMessageType(parsed: ParsedMessage): "CODECO" | "COPRAR" | null`

Detect the message type. Checks UNH first, falls back to BGM document code.

### `lookup(listName: string, code: string): string | null`

Decode any code-list value to plain English. See the code-list table above for the available `listName` values.

### `segmentInfo(tag: string): SegmentInfo`

Get the operator-grade English explanation for a 3-letter segment tag. Returns a fallback for unknown tags.

### `validateCheckDigit(code: string): boolean`

ISO 6346 mod-11 check-digit validation. Same algorithm used by all major terminal operating systems.

### `decodeISOSizeType(code: string): string | null`

Decode a 4-character ISO 6346 size-type code (e.g. `45R1`) into operator-readable parts (`40ft · Integral reefer · 9ft 6in (high cube) · variant 1`).

### `extractContainerNumbers(parsed: ParsedMessage): string[]` / `extractUNLocodes(parsed: ParsedMessage): string[]`

Find every ISO 6346-shaped container number / 5-character UN/LOCODE in a parsed message. Useful for cross-referencing to external registries.

### `SAMPLE_CODECO` / `SAMPLE_COPRAR`

Real-shape SMDG 2.1.3 D.00B sample messages with valid ISO 6346 check digits. Use for demos, tests, and documentation. The two samples share container `MSCU1234566` so `reconcile()` produces a clean match.

---

## TypeScript

Full type definitions are bundled. Import the type-only surface if you need it:

```ts
import type {
  ParsedMessage,
  Segment,
  Diagnostic,
  ReconcileReport,
  MessageType,
  MessageSchema,
} from "@prefixcheck/edi";
```

---

## Browser usage

Works in any modern browser via a bundler (Vite, Rollup, Webpack, esbuild). No DOM or Node-only APIs are used.

The companion in-browser decoder lives at [prefixcheck.com/container-edi/](https://prefixcheck.com/container-edi/) — same parser, same schemas, same diagnostics, with a UI.

---

## What this library does NOT do

- **Send or receive messages.** This is a read-side library. It does not transmit, queue, or talk to any EDI VAN or carrier network.
- **Generate messages from scratch.** Decoding is one direction. Building a CODECO or COPRAR for transmission still needs the terminal operating system (Navis, CATOS, RBS) or an EDI authoring tool.
- **Persist or aggregate.** Each call to `parse()` is stateless. The library has no storage layer.
- **Cover every EDIFACT message type.** Scope is CODECO + COPRAR. Other container-shipping messages (BAPLIE, IFTSTA, IFTMIN, COREOR, COARRI, VERMAS, COPARN) are not implemented in this release.

---

## License

MIT
