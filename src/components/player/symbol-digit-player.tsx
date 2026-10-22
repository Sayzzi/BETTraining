"use client";

import { symbolDigitKey, symbolDigitSpec, type SymbolDigitSpec, type SymbolDigitStimulus } from "@/engine/symbol-digit";
import { ChoicePlayer, choiceEngine } from "./choice-player";
import type { FixedRun } from "./use-exercise-run";
import { SymbolGlyph } from "./symbol-glyph";

// The key is reshuffled from each run's seed.
const ENGINE = choiceEngine("symbol_digit", (seed) => symbolDigitSpec(symbolDigitKey(seed)));
const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function SymbolDigitPlayer({ fixed }: { fixed?: FixedRun } = {}) {
  return (
    <ChoicePlayer<SymbolDigitStimulus>
      engine={ENGINE}
      fixed={fixed}
      namespace="symbolDigit"
      options={DIGITS.map((digit) => ({
        id: String(digit),
        label: String(digit),
        keyHint: "",
        keys: [String(digit)],
      }))}
      optionsClassName="grid-cols-5 md:grid-cols-9"
      renderLegend={(run) => {
        const { key } = run.spec as SymbolDigitSpec;
        return (
          <dl className="grid w-full max-w-xl grid-cols-9 gap-1 rounded-md border border-trait/30 p-2">
            {DIGITS.map((digit) => (
              <div key={digit} className="flex flex-col-reverse items-center gap-1">
                <dt className="text-sm font-semibold tabular-nums text-trait">{digit}</dt>
                <dd>
                  <SymbolGlyph symbol={key[digit]} className="size-5 text-brume md:size-7" />
                </dd>
              </div>
            ))}
          </dl>
        );
      }}
      renderStimulus={(stimulus) => <SymbolGlyph symbol={stimulus.symbol} className="size-24 text-chrono md:size-32" />}
    />
  );
}
