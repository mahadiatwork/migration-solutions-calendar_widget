import {
  getRegardingOptions,
  getResultBasedOnActivityType,
  getResultBasedOnActivityType2,
} from "./helperFunction";
import {
  CUSTOM_REGARDING_LABEL,
  CUSTOM_REGARDING_OPTION,
  getPersistedRegardingValue,
  getRegardingOptions as getRegardingFieldOptions,
} from "./atom/helperFunc";

describe("custom-module dependent picklists", () => {
  test("uses exact-parent results, then _default, and otherwise stays empty", () => {
    const config = {
      _source: "custom_module",
      results: {
        Appointment: ["Completed"],
        _default: ["Default result"],
      },
    };

    expect(getResultBasedOnActivityType2("Appointment", config)).toEqual([
      "Completed",
    ]);
    expect(getResultBasedOnActivityType2("Meeting", config)).toEqual([
      "Default result",
    ]);
    expect(
      getResultBasedOnActivityType2("Appointment", {
        _source: "custom_module",
        results: {
          Appointment: [],
          _default: ["Must not leak into an explicit empty parent"],
        },
      })
    ).toEqual([]);
    expect(
      getResultBasedOnActivityType("Appointment", {
        _source: "custom_module",
        results: { Appointment: [] },
      })
    ).toBe("");
    expect(
      getResultBasedOnActivityType2("Meeting", {
        _source: "custom_module",
        results: {},
      })
    ).toEqual([]);
  });

  test("uses exact-parent regarding, then _default, without adding legacy values", () => {
    const config = {
      _source: "custom_module",
      regarding: {
        Appointment: ["Visa"],
        _default: ["General configured"],
      },
    };

    expect(getRegardingOptions("Appointment", undefined, config)).toEqual([
      "Visa",
    ]);
    expect(getRegardingOptions("Meeting", undefined, config)).toEqual([
      "General configured",
    ]);
    expect(
      getRegardingOptions("Appointment", undefined, {
        _source: "custom_module",
        regarding: {
          Appointment: [],
          _default: ["Must not leak into an explicit empty parent"],
        },
      })
    ).toEqual([]);
    expect(
      getRegardingOptions("Meeting", undefined, {
        _source: "custom_module",
        regarding: {},
      })
    ).toEqual([]);
    expect(getRegardingOptions("Appointment", "Saved legacy", config)).toEqual([
      "Saved legacy",
      "Visa",
    ]);
    expect(getRegardingOptions("Appointment", undefined, config)).not.toContain(
      "Other"
    );
    expect(getRegardingFieldOptions("Appointment", undefined, config)).toEqual([
      "Visa",
    ]);
  });

  test("persists custom Regarding text instead of its UI sentinel", () => {
    expect(getPersistedRegardingValue("Visa")).toBe("Visa");
    expect(getPersistedRegardingValue(CUSTOM_REGARDING_OPTION)).toBe("");
    expect(
      getPersistedRegardingValue(CUSTOM_REGARDING_OPTION, "My own regarding")
    ).toBe("My own regarding");
  });

  test("filters reserved Custom values without removing configured Other", () => {
    const config = {
      _source: "custom_module",
      regarding: {
        Appointment: [
          CUSTOM_REGARDING_LABEL,
          CUSTOM_REGARDING_OPTION,
          "Other",
          "Visa",
        ],
      },
    };

    expect(getRegardingOptions("Appointment", undefined, config)).toEqual([
      "Other",
      "Visa",
    ]);
    expect(
      getRegardingFieldOptions("Appointment", undefined, config)
    ).toEqual(["Other", "Visa"]);
  });
});
