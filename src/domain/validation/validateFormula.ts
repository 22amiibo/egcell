import type { ChallengeValidator } from "@/domain/validation/validatorTypes";
import { failed, partial, passed } from "@/domain/validation/validatorTypes";
import { cellKey } from "@/domain/grid/range";
import { formatA1 } from "@/domain/grid/formulaEval";

const EPSILON = 1e-9;

function normalize(formula: string): string {
  return formula.replace(/\s+/g, "").toUpperCase();
}

/**
 * A formula spec grades two things at once: did the player write a formula at all (not a typed-in
 * literal that merely happens to match), and does that formula compute the target? An accepted
 * form that computes right is the only full pass; a formula of any other shape that still computes
 * right earns half credit, because the player found *a* route to the number without the one this
 * challenge means to teach.
 */
export const validateFormula: ChallengeValidator<"formula"> = (input, spec) => {
  const value = input.grid.cells[cellKey(spec.cell)]?.value ?? { kind: "blank" };
  const a1 = formatA1(spec.cell);

  if (value.kind === "blank") {
    return failed(`Type a formula into ${a1}.`);
  }

  if (value.kind !== "formula") {
    const literalMatches =
      value.kind === "number" && Math.abs(value.value - spec.expectedValue) < EPSILON;

    return failed(
      literalMatches
        ? `Right number — but type a formula (${spec.acceptedFormulas[0]}), not the value.`
        : `${a1} needs a formula starting with =.`,
    );
  }

  const computedMatches =
    value.computed.kind === "number" && Math.abs(value.computed.value - spec.expectedValue) < EPSILON;

  if (!spec.acceptedFormulas.includes(normalize(value.formula))) {
    return computedMatches
      ? partial(0.5, `It computes the right value — use ${spec.acceptedFormulas[0]}.`)
      : failed(`That formula does not compute the target.`);
  }

  return computedMatches
    ? passed(`${a1} computes the target.`)
    : failed(`That formula does not compute the target.`);
};
